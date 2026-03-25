/**
 * preload.js
 * Safe bridge exposing whitelisted IPC helpers to renderer code and blocking unwanted access.
 */
const { contextBridge, ipcRenderer } = require('electron');
try {
  require('./preload/bridges/chatBridge');
} catch (err) {
  console.log('[preload] chatBridge load failed:', err?.message || err);
}

contextBridge.exposeInMainWorld('browserBridge', {
  // Tab CRUD helpers
  createTab: () => ipcRenderer.invoke('tabs:new'),
  activateTab: (tabId) => ipcRenderer.invoke('tabs:activate', tabId),
  closeTab: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
  moveTab: (tabId, beforeTabId) => ipcRenderer.invoke('tabs:move', { tabId, beforeTabId }),
  navigate: (input) => ipcRenderer.invoke('tabs:navigate', input),
  reload: () => ipcRenderer.invoke('tabs:reload'),
  goBack: () => ipcRenderer.invoke('tabs:back'),
  goForward: () => ipcRenderer.invoke('tabs:forward'),
  updateTopOffset: (height) => ipcRenderer.invoke('chrome:update-offset', height),
  showSuggestionsPopup: (bounds, payload) => ipcRenderer.invoke('suggestions:toggle-popup', bounds, payload),
  updateSuggestionsPopup: (payload) => ipcRenderer.invoke('suggestions:update', payload),
  closeSuggestionsPopup: () => ipcRenderer.invoke('suggestions:hide'),
  showSecurityPopover: (bounds, payload) => ipcRenderer.invoke('security:show', bounds, payload),
  updateSecurityPopover: (payload) => ipcRenderer.invoke('security:update', payload),
  closeSecurityPopover: () => ipcRenderer.invoke('security:hide'),
  onSecurityPopoverClosed: (callback) => {
    const handler = () => {
      if (typeof callback === 'function') {
        callback();
      }
    };
    ipcRenderer.on('security:closed', handler);
    return () => ipcRenderer.removeListener('security:closed', handler);
  },

  // [ADDED - TAB ACTIONS] context-menu operations
  pinTab: (tabId) => ipcRenderer.invoke('tabs:pin', tabId),
  closeOtherTabs: (tabId) => ipcRenderer.invoke('tabs:close-others', tabId),
  closeTabsToRight: (tabId) => ipcRenderer.invoke('tabs:close-right', tabId),

  // [ADDED âœ¨] direct pin state + quit app
  setTabPinned: (tabId, pinned) => ipcRenderer.invoke('tabs:setPinned', { tabId, pinned }),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // [ADDED - TABMENU] open/close the overlay popup from the main renderer
  toggleTabMenuPopup: (bounds, payload) => ipcRenderer.invoke('tabmenu:toggle-popup', bounds, payload),
  closeTabMenuPopup: () => ipcRenderer.invoke('tabmenu:close-popup'),

  // History popup helpers
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  // Bookmark helpers
  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  toggleBookmark: (entry) => ipcRenderer.invoke('bookmarks:toggle', entry),
  saveBookmark: (entry) => ipcRenderer.invoke('bookmarks:save', entry),
  removeBookmark: (entry) => ipcRenderer.invoke('bookmarks:remove', entry),
  clearBookmarks: () => ipcRenderer.invoke('bookmarks:clear'),
  toggleBookmarkQuickPopup: (bounds, context) => ipcRenderer.invoke('bookmarks:toggle-quick', bounds, context),
  closeBookmarkQuickPopup: () => ipcRenderer.invoke('bookmarks:close-quick'),
  updateBookmarkQuickContext: (context) => ipcRenderer.invoke('bookmarks:update-quick-context', context),
  openGithubLoginTab: () => ipcRenderer.invoke('github:open-login-tab'),
  // Git integration
  toggleGitPopup: (bounds) => ipcRenderer.invoke('git:toggle-popup', bounds),
  closeGitPopup: () => ipcRenderer.invoke('git:close-popup'),
  toggleSettingsPopup: (bounds) => ipcRenderer.invoke('settings:toggle-popup', bounds),
  closeSettingsPopup: () => ipcRenderer.invoke('settings:close-popup'),
  resizeSettingsPopup: (height) => ipcRenderer.invoke('settings:resize', height),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
  openCredentialManager: (bounds) => ipcRenderer.invoke('credentials:toggle-popup', bounds),
  closeCredentialManager: () => ipcRenderer.invoke('credentials:close-popup'),
  openCredentialForm: (bounds) => ipcRenderer.invoke('credentials:open-form', bounds),
  getAddressSuggestions: (query) => ipcRenderer.invoke('address:suggestions', query),
  githubGetConfig: () => ipcRenderer.invoke('github:get-config'),
  githubSaveConfig: (config) => ipcRenderer.invoke('github:save-config', config),
  githubSignOut: () => ipcRenderer.invoke('github:sign-out'),
  githubPush: (payload) => ipcRenderer.invoke('github:push', payload),
  githubPull: () => ipcRenderer.invoke('github:pull'),
  githubLog: (entry) => ipcRenderer.invoke('github:log-message', entry),
  onHandshakeStatus: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('codex-handshake-status', handler);
    return () => ipcRenderer.removeListener('codex-handshake-status', handler);
  },
  getCredentialEntry: (type, id) => ipcRenderer.invoke('credentials:entry:get', { type, id }),
  // Window chrome proxies
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleDevTools: () => ipcRenderer.invoke('window:toggle-devtools'),
  openDevTools: () => ipcRenderer.invoke('window:open-devtools'),
  openRendererDevTools: () => ipcRenderer.invoke('window:open-renderer-devtools'),
  openPopupDevTools: () => ipcRenderer.invoke('windows:open-popup-devtools'),
  detachTab: (tabId) => ipcRenderer.invoke('tabs:detach', tabId),
  printActive: () => ipcRenderer.invoke('tabs:print'),
  zoomBridge: {
    get: () => ipcRenderer.invoke('tabs:get-zoom'),
    set: (factor) => ipcRenderer.invoke('tabs:set-zoom', factor),
    in: () => ipcRenderer.invoke('tabs:zoom-in'),
    out: () => ipcRenderer.invoke('tabs:zoom-out'),
    reset: () => ipcRenderer.invoke('tabs:zoom-reset')
  },
  reopenLastClosed: () => ipcRenderer.invoke('tabs:reopen-last'),
  cycleTab: (delta) => ipcRenderer.invoke('tabs:cycle', delta),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // ðŸ”½ðŸ”½ðŸ”½ [ADDED âœ¨] open a brand-new main application window
  // This calls ipcMain.handle('window:new') in main.js
  newWindow: () => ipcRenderer.invoke('window:new'),
  // ðŸ”¼ðŸ”¼ðŸ”¼ [/ADDED âœ¨]

  // ðŸ”½ðŸ”½ðŸ”½ [ADDED âœ¨ Default Browser] expose "Set as default browser"
  // Bridges to ipcMain.handle('app:set-default-browser') in main.js
  setDefaultBrowser: () => ipcRenderer.invoke('app:set-default-browser'),
  setThemeMode: (mode) => ipcRenderer.invoke('theme:set-mode', mode),
  // ðŸ”¼ðŸ”¼ðŸ”¼ [/ADDED âœ¨ Default Browser]

  /* ===================== [ADDED âœ¨ DOWNLOADS] =====================
     Bridge methods for the Downloads feature (mini popup + history).
     These map to the ipcMain handlers added in main.js Step 1.
  ---------------------------------------------------------------- */
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  toggleDownloadsPopup: (bounds) => ipcRenderer.invoke('downloads:toggle-popup', bounds),
  toggleProfilePopup: (bounds) => ipcRenderer.invoke('profile:toggle-popup', bounds),
  hideProfilePopup: () => ipcRenderer.invoke('profile:hide'),

  // Google Profile APIs
  googleGetProfile: () => ipcRenderer.invoke('google:get-profile'),
  googleSignOut: () => ipcRenderer.invoke('google:sign-out'),
  onGoogleProfileUpdate: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('google:profile-update', handler);
    return () => ipcRenderer.removeListener('google:profile-update', handler);
  },

  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),

  // [CHANGED âœ¨ DOWNLOADS] Rename to match popup JS
  openDownloadedItem: (id) => ipcRenderer.invoke('downloads:open-file', id),          // was openDownloadedFile
  showDownloadedItemInFolder: (id) => ipcRenderer.invoke('downloads:show-in-folder', id), // was showDownloadedInFolder

  // [KEPT for backward compatibility] old names still work if used elsewhere
  openDownloadedFile: (id) => ipcRenderer.invoke('downloads:open-file', id),          // alias
  showDownloadedInFolder: (id) => ipcRenderer.invoke('downloads:show-in-folder', id), // alias

  cancelDownload: (id) => ipcRenderer.invoke('downloads:cancel', id),

  // === [NEW âœ¨ FULL HISTORY TAB] open a new tab that lists all downloads
  downloadsOpenHistory: () => ipcRenderer.invoke('downloads:open-history-tab'),

  onDownloadsUpdate: (callback) => {
    const handler = (_e, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('downloads:update', handler);
    return () => ipcRenderer.removeListener('downloads:update', handler);
  },
  /* =================== [/ADDED âœ¨ DOWNLOADS] ===================== */

  // Theme controls
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setThemeColor: (color) => ipcRenderer.invoke('theme:set', color),
  onThemeUpdate: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('theme:update', handler);
    return () => ipcRenderer.removeListener('theme:update', handler);
  },

  // Subscriptions for renderer state updates
  onTabState: (callback) => {
    ipcRenderer.on('tabs:state', (_, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    });

    return () => ipcRenderer.removeAllListeners('tabs:state');
  },
  onHistoryUpdate: (callback) => {
    ipcRenderer.on('history:update', (_, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    });
    return () => ipcRenderer.removeAllListeners('history:update');
  },
  onBookmarksUpdate: (callback) => {
    ipcRenderer.on('bookmarks:update', (_, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    });
    return () => ipcRenderer.removeAllListeners('bookmarks:update');
  },
  onBookmarkQuickContext: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('bookmark-quick:context', handler);
    return () => ipcRenderer.removeListener('bookmark-quick:context', handler);
  },
  onAppFullscreenToggle: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('window:fullscreen-toggle', handler);
    return () => ipcRenderer.removeListener('window:fullscreen-toggle', handler);
  },
  onWindowState: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload || {});
      }
    };
    ipcRenderer.on('window:state', handler);
    return () => ipcRenderer.removeListener('window:state', handler);
  },
  onZoomFactor: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('tabs:zoom-factor', handler);
    return () => ipcRenderer.removeListener('tabs:zoom-factor', handler);
  },
  onShortcutFocusAddress: (callback) => {
    const handler = (_event, payload = {}) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('shortcuts:focus-address', handler);
    return () => ipcRenderer.removeListener('shortcuts:focus-address', handler);
  },
  onShortcutBookmark: (callback) => {
    const handler = () => {
      if (typeof callback === 'function') callback();
    };
    ipcRenderer.on('shortcuts:bookmark-current', handler);
    return () => ipcRenderer.removeListener('shortcuts:bookmark-current', handler);
  },
  onShortcutDownloads: (callback) => {
    const handler = () => {
      if (typeof callback === 'function') callback();
    };
    ipcRenderer.on('shortcuts:open-downloads', handler);
    return () => ipcRenderer.removeListener('shortcuts:open-downloads', handler);
  },
  onShortcutHistory: (callback) => {
    const handler = () => {
      if (typeof callback === 'function') callback();
    };
    ipcRenderer.on('shortcuts:open-history', handler);
    return () => ipcRenderer.removeListener('shortcuts:open-history', handler);
  },

  // Scheduler service bridge
  listSchedulerJobs: () => ipcRenderer.invoke('scheduler:list'),
  saveSchedulerJob: (job) => ipcRenderer.invoke('scheduler:save', job),
  deleteSchedulerJob: (jobId) => ipcRenderer.invoke('scheduler:delete', jobId),
  runSchedulerJobNow: (jobId) => ipcRenderer.invoke('scheduler:run-now', jobId),
  getSchedulerLogs: (limit) => ipcRenderer.invoke('scheduler:logs', limit),
  getSchedulerStatus: () => ipcRenderer.invoke('scheduler:status')
}
);

/* ðŸ”¹ NEW: printingBridge for receipt preview & printing
   This is what printPreview.js subscribes to:
   window.printingBridge.onShowReceipt((payload) => { ... })
*/
contextBridge.exposeInMainWorld('printingBridge', {
  onShowReceipt: (callback) => {
    const handler = (_event, payload) => {
      if (typeof callback === 'function') {
        callback(payload);
      }
    };
    ipcRenderer.on('print:show-receipt', handler);

    // return unsubscribe function
    return () => ipcRenderer.removeListener('print:show-receipt', handler);
  }
});

let buildCredentialQuery = () => '';
let openCredentialTab = async () => { };
try {
  const creds = require('./preload/helpers/credentialHelpers');
  buildCredentialQuery = creds.buildCredentialQuery;
  openCredentialTab = creds.openCredentialTab;
} catch (err) {
  console.log('[preload] credentialHelpers load failed:', err?.message || err);
}

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
  openGitTab: (options = {}) => openCredentialTab('../github/index.html', options),
  openDatabaseTab: (options = {}) => openCredentialTab('../credentials/index.html', options),
  openOtherTab: (options = {}) => openCredentialTab('../credentialManager/other.html', options),
  openPrinterTab: (options = {}) => openCredentialTab('../credentialManager/printer.html', options),
  githubReset: () => ipcRenderer.invoke('github:sign-out'),
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
  saveOtherEntry: (payload) => ipcRenderer.invoke('credentials:other:save', payload),
  savePrinterEntry: (payload) => ipcRenderer.invoke('credentials:printer:save', payload),
  listPrinterEntries: () => ipcRenderer.invoke('credentials:printer:list'),
  testPrinterConnection: (payload) => ipcRenderer.invoke('credentials:printer:test', payload)
});

// [ADDED - TABMENU]
// Expose a tiny bridge that is used by the TAB MENU POPUP WINDOW itself.
// The popup HTML/JS can listen for 'tabmenu:open' and close itself via IPC.
contextBridge.exposeInMainWorld('tabMenuBridge', {
  onOpen: (callback) => {
    const handler = (_, payload) => {
      if (typeof callback === 'function') callback(payload);
    };
    ipcRenderer.on('tabmenu:open', handler);
    return () => ipcRenderer.removeListener('tabmenu:open', handler);
  },
  close: () => ipcRenderer.invoke('tabmenu:close-popup')
});

// Expose a minimal bridge to simulate website â†’ app messages.
// We'll route this to ipcMain.handle('external:message') in Step 2.
contextBridge.exposeInMainWorld('externalBridge', {
  sendMessage: (message) => ipcRenderer.invoke('external:message', message)
});


// ============================= [ADDED âœ¨ DOWNLOADS FULL-TAB FALLBACK] =============================
// When the Downloads page is opened as a full tab, it has no preload and cannot call browserBridge.
// That page sends window.top.postMessage({ __from:'downloads-ui', type:'downloads:show-in-folder', id })
// We listen here (in the chrome renderer that DOES have preload) and forward to the existing IPC.
// This enables the folder button to work in the full history tab without changing main.js.
window.addEventListener('message', (event) => {
  const msg = event && event.data;
  if (!msg || msg.__from !== 'downloads-ui') return;

  if (msg.type === 'downloads:show-in-folder' && msg.id != null) {
    ipcRenderer.invoke('downloads:show-in-folder', msg.id).catch(() => { });
  }
});
// =========================== [/ADDED âœ¨ DOWNLOADS FULL-TAB FALLBACK] ==============================
// ============================= [NEW] GIT FULL-TAB FALLBACK =============================
window.addEventListener('message', (event) => {
  const msg = event && event.data;
  if (!msg || msg.__from !== 'git-tab' || !msg.method) return;

  const respond = (payload) => {
    try {
      event.source?.postMessage({ __from: 'git-shell', id: msg.id, ...payload }, '*');
    } catch (_) {
      // ignore
    }
  };

  const bridgeFn = window.browserBridge?.[msg.method];
  if (typeof bridgeFn !== 'function') {
    respond({ error: `Unknown git bridge method: ${msg.method}` });
    return;
  }

  Promise.resolve(bridgeFn(msg.payload))
    .then((result) => respond({ result }))
    .catch((error) => respond({ error: error?.message || String(error) }));
});
// =========================== [/NEW] GIT FULL-TAB FALLBACK] ==============================

