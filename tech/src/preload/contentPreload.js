// src/preload/contentPreload.js
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const disableWebAuthn = () => {
  const nav = globalThis.navigator;
  if (nav && nav.credentials) {
    const original = nav.credentials;
    const patched = {
      create: () => Promise.reject(new Error('WebAuthn disabled')),
      get: () => Promise.reject(new Error('WebAuthn disabled')),
      preventSilentAccess: original.preventSilentAccess?.bind(original) || (() => Promise.resolve())
    };
    Object.setPrototypeOf(patched, null);
    try {
      Object.defineProperty(nav, 'credentials', {
        value: patched,
        configurable: false,
        enumerable: false,
        writable: false
      });
    } catch (_) {
      try {
        delete nav.credentials;
      } catch (__) {}
      nav.credentials = patched;
    }
  }
  if (globalThis.PublicKeyCredential) {
    try {
      Object.defineProperty(globalThis, 'PublicKeyCredential', {
        value: undefined,
        configurable: true
      });
    } catch (_) {
      globalThis.PublicKeyCredential = undefined;
    }
  }
};

disableWebAuthn();

// Lightweight in-page modal to replace native alert/confirm so OS dialogs never appear.
(() => {
  let overlay = null;
  let titleEl = null;
  let msgEl = null;
  let okBtn = null;
  let cancelBtn = null;
  let resolver = null;

  const ensureUi = () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.28);
      z-index: 999999;
      backdrop-filter: blur(3px);
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      min-width: 340px;
      max-width: 460px;
      background: #fff;
      color: #1f2937;
      border-radius: 12px;
      box-shadow: 0 20px 48px rgba(0,0,0,0.18);
      padding: 16px;
      font-family: "Segoe UI", system-ui, sans-serif;
    `;

    titleEl = document.createElement('div');
    titleEl.textContent = 'Mobrowser';
    titleEl.style.cssText = 'font-weight:600;font-size:15px;margin-bottom:8px;';

    msgEl = document.createElement('div');
    msgEl.style.cssText = 'white-space:pre-wrap;line-height:1.5;font-size:14px;color:#4b5563;margin-bottom:16px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

    cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'padding:8px 14px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;font-size:14px;';

    okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText =
      'padding:8px 14px;border-radius:8px;border:1px solid #5b21b6;background:#5b21b6;color:#fff;cursor:pointer;font-size:14px;';

    actions.append(cancelBtn, okBtn);
    panel.append(titleEl, msgEl, actions);
    overlay.appendChild(panel);
    document.addEventListener('keydown', (e) => {
      if (!overlay || overlay.style.display === 'none') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    });
    document.body.appendChild(overlay);
  };

  const hide = () => {
    if (overlay) overlay.style.display = 'none';
    resolver = null;
  };

  const handleOk = () => {
    if (resolver) resolver(true);
    hide();
  };
  const handleCancel = () => {
    if (resolver) resolver(false);
    hide();
  };

  const showCustomDialog = (type, message) => {
    ensureUi();
    overlay.style.display = 'flex';
    msgEl.textContent = message || '';
    const isConfirm = type === 'confirm';
    cancelBtn.style.display = isConfirm ? 'inline-flex' : 'none';

    return new Promise((resolve) => {
      resolver = resolve;
      okBtn.onclick = handleOk;
      cancelBtn.onclick = handleCancel;
    });
  };

  // Replace blocking native dialogs with in-page modals
  window.alert = (msg) => {
    return showCustomDialog('alert', String(msg));
  };
  window.confirm = (msg) => showCustomDialog('confirm', String(msg));

  // Listen for dialog requests from the page context (main world) and respond
  window.addEventListener('message', (event) => {
    const req = event.data && event.data.__mobrowserDialogRequest;
    if (!req || !req.id) return;
    showCustomDialog(req.type, req.message).then((ok) => {
      event.source?.postMessage(
        { __mobrowserDialogResult: { id: req.id, ok: !!ok } },
        '*'
      );
    });
  });

  // Inject an override into the page (main world) so page-level alert/confirm use the custom dialog
  const injectDialogOverride = () => {
    const script = `
      (function() {
        if (window.__mobrowserDialogInstalled) return;
        window.__mobrowserDialogInstalled = true;
        const sendDialog = (type, message) => {
          const id = 'dlg-' + Math.random().toString(36).slice(2, 8);
          return new Promise((resolve) => {
            const handler = (ev) => {
              const data = ev.data && ev.data.__mobrowserDialogResult;
              if (!data || data.id !== id) return;
              window.removeEventListener('message', handler);
              resolve(!!data.ok);
            };
            window.addEventListener('message', handler);
            window.postMessage({ __mobrowserDialogRequest: { id, type, message: String(message || '') } }, '*');
          });
        };
        window.alert = function(message) { sendDialog('alert', message); };
        window.confirm = function(message) { return sendDialog('confirm', message); };
      })();`;
    try {
      webFrame.executeJavaScript(script, false);
    } catch (_) {
      // best effort
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDialogOverride, { once: true });
  } else {
    injectDialogOverride();
  }
})();

contextBridge.exposeInMainWorld('externalMessage', {
  send: (jsonText) => {
    return ipcRenderer.invoke('external-message', jsonText);
  },
  onResult: (handler) => {
    if (typeof handler !== 'function') return;
    const wrapped = (_event, result) => handler(result);
    ipcRenderer.on('external:result', wrapped);
    return () => ipcRenderer.removeListener('external:result', wrapped);
  },
  offResult: (handler) => {
    if (typeof handler !== 'function') return;
    ipcRenderer.removeListener('external:result', handler);
  }
});

const scheduleMuuloriginHandshake = () => {
  const href = globalThis.location?.href || '';
  if (!href || !href.includes('muulorigin')) {
    return;
  }
  const payload = {
    type: 'MUULORIGIN'
  };
  ipcRenderer
    .invoke('external-message', JSON.stringify(payload))
    .then((result) => {
      try {
        console.info('[Muulorigin handshake]', result || {});
        window.dispatchEvent(
          new CustomEvent('muulorigin-handshake', {
            detail: result || {}
          })
        );
      } catch (_) {
        // ignore logging errors
      }
    })
    .catch(() => {});
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    scheduleMuuloriginHandshake();
  });
}

const pathname = (globalThis.location && globalThis.location.pathname) || '';
const isCredentialForm =
  globalThis.location &&
  globalThis.location.protocol === 'file:' &&
  (pathname.includes('/renderer/credentials/') || pathname.includes('/renderer/credentialManager/'));
if (isCredentialForm) {
  const openLocalTab = async (relativePath) => {
    if (!relativePath) return;
    const targetUrl = new URL(relativePath, window.location.href).toString();
    await ipcRenderer.invoke('tabs:new');
    await ipcRenderer.invoke('tabs:navigate', targetUrl);
  };

  const buildQuery = (options = {}) => {
    const params = new URLSearchParams();
    if (options.mode) {
      params.set('mode', options.mode);
    }
    if (options.entryId) {
      params.set('entryId', options.entryId);
    }
    const suffix = params.toString();
    return suffix ? `?${suffix}` : '';
  };

  contextBridge.exposeInMainWorld('credentialBridge', {
    load: () => ipcRenderer.invoke('credentials:get'),
    save: (payload) => ipcRenderer.invoke('credentials:save', payload),
    test: (payload) => ipcRenderer.invoke('credentials:test', payload),
    close: () => ipcRenderer.invoke('credentials:close-form'),
    closeManager: () => ipcRenderer.invoke('credentials:close-popup'),
    list: () => ipcRenderer.invoke('credentials:list'),
    getEntry: (type, id) => ipcRenderer.invoke('credentials:entry:get', { type, id }),
    deleteEntry: (type, id) => ipcRenderer.invoke('credentials:entry:delete', { type, id }),
    onManagerRefresh: (callback) => {
      const handler = () => {
        if (typeof callback === 'function') {
          callback();
        }
      };
      ipcRenderer.on('credential-manager:refresh', handler);
      return () => ipcRenderer.removeListener('credential-manager:refresh', handler);
    },
    openGitTab: (options = {}) => openLocalTab(`../github/index.html${buildQuery(options)}`),
    openDatabaseTab: (options = {}) => openLocalTab(`../credentials/index.html${buildQuery(options)}`),
    githubReset: () => ipcRenderer.invoke('github:sign-out'),
    githubGetConfig: () => ipcRenderer.invoke('github:get-config'),
    githubSaveConfig: (config) => ipcRenderer.invoke('github:save-config', config),
    githubSignOut: () => ipcRenderer.invoke('github:sign-out'),
    githubLog: (entry) => ipcRenderer.invoke('github:log-message', entry),
    databaseReset: () =>
      ipcRenderer.invoke('credentials:save', {
        __skipRegistry: true,
        dbType: '',
        host: '',
        port: '',
        database: '',
        user: '',
        password: ''
      }),
    openOtherTab: (options = {}) => openLocalTab(`../credentialManager/other.html${buildQuery(options)}`),
    openPrinterTab: (options = {}) => openLocalTab(`../credentialManager/printer.html${buildQuery(options)}`),
    saveOtherEntry: (payload) => ipcRenderer.invoke('credentials:other:save', payload),
    savePrinterEntry: (payload) => ipcRenderer.invoke('credentials:printer:save', payload),
    listPrinterEntries: () => ipcRenderer.invoke('credentials:printer:list'),
    testPrinterConnection: (payload) => ipcRenderer.invoke('credentials:printer:test', payload)
  });
}

if (globalThis.location && globalThis.location.protocol === 'file:' && pathname.includes('/renderer/github/')) {
  contextBridge.exposeInMainWorld('browserBridge', {
    githubGetConfig: () => ipcRenderer.invoke('github:get-config'),
    githubSaveConfig: (config) => ipcRenderer.invoke('github:save-config', config),
    githubSignOut: () => ipcRenderer.invoke('github:sign-out'),
    githubPush: (payload) => ipcRenderer.invoke('github:push', payload),
    githubPull: () => ipcRenderer.invoke('github:pull'),
    githubLog: (entry) => ipcRenderer.invoke('github:log-message', entry),
    closeGitPopup: () => ipcRenderer.invoke('git:close-popup'),
    getCredentialEntry: (type, id) => ipcRenderer.invoke('credentials:entry:get', { type, id })
  });
}

const isHistoryPage =
  globalThis.location &&
  globalThis.location.protocol === 'file:' &&
  pathname.includes('/renderer/history/');
if (isHistoryPage) {
  const historyBridge = {
    getHistory: () => ipcRenderer.invoke('history:get'),
    clearHistory: () => ipcRenderer.invoke('history:clear'),
    navigate: (input) => ipcRenderer.invoke('tabs:navigate', input),
    openInNewTab: async (input) => {
      // Opens a fresh tab, then navigates it to the requested URL.
      await ipcRenderer.invoke('tabs:new');
      await ipcRenderer.invoke('tabs:navigate', input);
    },
    closeHistoryPopup: () => Promise.resolve(),
    onHistoryUpdate: (callback) => {
      const handler = (_event, entries) => {
        if (typeof callback === 'function') {
          callback(entries);
        }
      };
      ipcRenderer.on('history:update', handler);
      return () => ipcRenderer.removeListener('history:update', handler);
    }
  };
  contextBridge.exposeInMainWorld('browserBridge', historyBridge);
}

const isSchedulerPage =
  globalThis.location &&
  globalThis.location.protocol === 'file:' &&
  pathname.includes('/renderer/scheduler/');
if (isSchedulerPage) {
  const schedulerBridge = {
    listSchedulerJobs: () => ipcRenderer.invoke('scheduler:list'),
    saveSchedulerJob: (job) => ipcRenderer.invoke('scheduler:save', job),
    deleteSchedulerJob: (jobId) => ipcRenderer.invoke('scheduler:delete', jobId),
    runSchedulerJobNow: (jobId) => ipcRenderer.invoke('scheduler:run-now', jobId),
    getSchedulerLogs: (limit) => ipcRenderer.invoke('scheduler:logs', limit),
    getSchedulerStatus: () => ipcRenderer.invoke('scheduler:status')
  };
  contextBridge.exposeInMainWorld('browserBridge', schedulerBridge);
}

// Generic downloads fallback: when a page without the full preload posts a message to reveal in folder,
// forward it to the main process so the folder opens instead of navigating.
window.addEventListener('message', (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'downloads-ui') return;
  if (msg.type === 'downloads:show-in-folder' && msg.id != null) {
    ipcRenderer.invoke('downloads:show-in-folder', msg.id).catch(() => {});
  }
});
