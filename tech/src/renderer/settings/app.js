/**
 * settings/app.js
 * Simple popup that exposes chrome-level utilities.
 */
import '../theme/themeBootstrap.js';
import { applySkin, getStoredSkin, listenForThemeStorage, setStoredSkin } from '../theme/preferences.js';
if (!window.browserBridge) {
  throw new Error('Settings bridge missing');
}

window.addEventListener('contextmenu', (event) => event.preventDefault());

const settingsShell = document.querySelector('.settings-shell');
const canResizeSettingsPopup = typeof window.browserBridge?.resizeSettingsPopup === 'function';
let resizeQueued = false;
let lastMeasuredHeight = 0;

const measureSettingsHeight = () => {
  if (!settingsShell) return null;
  const shellRect = settingsShell.getBoundingClientRect();
  const bodyStyle = window.getComputedStyle(document.body);
  const paddingTop = Number.parseFloat(bodyStyle.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(bodyStyle.paddingBottom) || 0;
  return Math.ceil(shellRect.height + paddingTop + paddingBottom);
};

const scheduleSettingsResize = () => {
  if (!canResizeSettingsPopup || !settingsShell) return;
  if (resizeQueued) return;
  resizeQueued = true;
  window.requestAnimationFrame(() => {
    resizeQueued = false;
    const nextHeight = measureSettingsHeight();
    if (!nextHeight) return;
    if (Math.abs(nextHeight - lastMeasuredHeight) < 1) return;
    lastMeasuredHeight = nextHeight;
    window.browserBridge.resizeSettingsPopup(nextHeight);
  });
};

if (settingsShell && canResizeSettingsPopup) {
  scheduleSettingsResize();
  if (typeof window.ResizeObserver === 'function') {
    const resizeObserver = new ResizeObserver(() => scheduleSettingsResize());
    resizeObserver.observe(settingsShell);
  }
  window.addEventListener('load', scheduleSettingsResize);
  window.addEventListener('resize', scheduleSettingsResize);
  window.addEventListener('focus', scheduleSettingsResize);
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleSettingsResize).catch(() => {});
  }
}

// Let Ctrl/Cmd + Shift + T reopen last closed tab even when the settings popup has focus.
window.addEventListener(
  'keydown',
  (event) => {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    if (isCtrlOrCmd && event.shiftKey && !event.altKey && event.code === 'KeyT') {
      event.preventDefault();
      window.browserBridge?.reopenLastClosed?.();
    }
  },
  true
);

const closeButton = document.getElementById('settingsClose');
const devtoolsButton = document.getElementById('settingsDevtools');
const printRow = document.getElementById('settingsPrint');
const zoomOutBtn = document.getElementById('settingsZoomOut');
const zoomResetBtn = document.getElementById('settingsZoomReset');
const zoomInBtn = document.getElementById('settingsZoomIn');
const skinSelect = document.getElementById('settingsSkinSelect');
const updateRow = document.getElementById('settingsUpdate');
const updateStatus = document.getElementById('settingsUpdateStatus');
const updateInstallBtn = document.getElementById('settingsUpdateInstall');
const versionLabel = document.getElementById('settingsVersionLabel');

closeButton?.addEventListener('click', () => {
  window.browserBridge.closeSettingsPopup?.();
});

if (skinSelect) {
  skinSelect.value = getStoredSkin();
  applySkin(skinSelect.value);
  skinSelect.addEventListener('change', (event) => {
    const nextSkin = event.target.value;
    setStoredSkin(nextSkin);
    applySkin(nextSkin);
    scheduleSettingsResize();
  });
  listenForThemeStorage(({ skin }) => {
    if (!skin) return;
    skinSelect.value = skin;
    applySkin(skin);
    scheduleSettingsResize();
  });
}

devtoolsButton?.addEventListener('click', () => {
  // Only open the chrome (main window) DevTools; avoid opening DevTools for this popup or tabs.
  window.browserBridge.openRendererDevTools?.();
});

// Print (active tab)
if (printRow && window.browserBridge && typeof window.browserBridge.printActive === 'function') {
  const handlePrint = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    window.browserBridge.printActive();
  };
  printRow.addEventListener('click', handlePrint);
  printRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handlePrint(e);
  });
} else {
  console.warn('[Settings] Print row or bridge not available');
}

// Zoom controls
const updateZoomLabel = async () => {
  if (!window.browserBridge?.zoomBridge || !zoomResetBtn) return;
  try {
    const factor = await window.browserBridge.zoomBridge.get();
    const pct = Math.round((factor || 1) * 100);
    zoomResetBtn.textContent = `${pct}%`;
  } catch {
    zoomResetBtn.textContent = '100%';
  }
};

if (window.browserBridge?.zoomBridge) {
  const handleOut = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    await window.browserBridge.zoomBridge.out();
    updateZoomLabel();
  };
  const handleIn = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    await window.browserBridge.zoomBridge.in();
    updateZoomLabel();
  };
  const handleReset = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    await window.browserBridge.zoomBridge.reset();
    updateZoomLabel();
  };

  zoomOutBtn?.addEventListener('click', handleOut);
  zoomOutBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleOut(e);
  });
  zoomInBtn?.addEventListener('click', handleIn);
  zoomInBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleIn(e);
  });
  zoomResetBtn?.addEventListener('click', handleReset);
  zoomResetBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleReset(e);
  });

  updateZoomLabel();
} else {
  console.warn('[Settings] Zoom bridge not available');
}

// Version label
if (versionLabel && window.browserBridge?.getAppVersion) {
  window.browserBridge
    .getAppVersion()
    .then((version) => {
      versionLabel.textContent = version || 'Unknown';
    })
    .catch(() => {
      versionLabel.textContent = 'Unknown';
    });
}

// ========================= New Tab wiring =========================
const newTabRow = document.getElementById('settingsNewTab');

if (newTabRow && window.browserBridge?.createTab) {
  const openNewTab = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    try {
      await window.browserBridge.createTab();
      await window.browserBridge.closeSettingsPopup?.();
      console.log('[Settings] New Tab created from Settings popup');
    } catch (err) {
      console.error('[Settings] Failed to create new tab:', err);
    }
  };

  newTabRow.addEventListener('click', openNewTab);
  newTabRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openNewTab(e);
  });
} else {
  console.warn('[Settings] New Tab row or bridge not available');
}

// ====================== New Window wiring ======================
const newWindowRow = document.getElementById('settingsNewWindow');

if (newWindowRow && window.browserBridge?.newWindow) {
  const openNewWindow = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    try {
      await window.browserBridge.newWindow();
      await window.browserBridge.closeSettingsPopup?.();
      console.log('[Settings] New Window opened from Settings popup');
    } catch (err) {
      console.error('[Settings] Failed to open new window:', err);
    }
  };

  newWindowRow.addEventListener('click', openNewWindow);
  newWindowRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openNewWindow(e);
  });
} else {
  console.warn('[Settings] New Window row or bridge not available');
}

// ============== Set as Default Browser wiring ==============
const defaultBrowserRow = document.getElementById('settingsDefaultBrowser');

if (defaultBrowserRow && window.browserBridge?.setDefaultBrowser) {
  const setAsDefault = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    try {
      await window.browserBridge.setDefaultBrowser();
      await window.browserBridge.closeSettingsPopup?.();
      console.log('[Settings] Requested: set as default browser');
    } catch (err) {
      console.error('[Settings] Failed to set default browser:', err);
    }
  };

  defaultBrowserRow.addEventListener('click', setAsDefault);
  defaultBrowserRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') setAsDefault(e);
  });
} else {
  console.warn('[Settings] Default Browser row or bridge not available');
}

// ================ Download -> open full history tab ==============
const downloadRow = document.getElementById('settingsDownload');

if (downloadRow && window.browserBridge?.createTab && window.browserBridge?.navigate) {
  const openDownloadsFullPage = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    try {
      const downloadsUrl = new URL('../downloads/index.html', window.location.href).toString();
      await window.browserBridge.createTab();
      await window.browserBridge.navigate(downloadsUrl);
      await window.browserBridge.closeSettingsPopup?.();
      console.log('[Settings] Opened full Downloads page');
    } catch (err) {
      console.error('[Settings] Failed to open Downloads page:', err);
    }
  };

  downloadRow.addEventListener('click', openDownloadsFullPage);
  downloadRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openDownloadsFullPage(e);
  });
} else {
  console.warn('[Settings] Download row or required bridge methods not available');
}

// ============== History full page (new tab) ==============
const historyRow = document.getElementById('settingsHistory');

if (historyRow && window.browserBridge?.createTab && window.browserBridge?.navigate) {
  const openHistoryFullPage = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    try {
      const historyUrl = new URL('../history/index.html', window.location.href).toString();
      await window.browserBridge.createTab();
      await window.browserBridge.navigate(historyUrl);
      await window.browserBridge.closeSettingsPopup?.();
      console.log('[Settings] Opened full History page');
    } catch (err) {
      console.error('[Settings] Failed to open History page:', err);
    }
  };

  historyRow.addEventListener('click', openHistoryFullPage);
  historyRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openHistoryFullPage(e);
  });
} else {
  console.warn('[Settings] History row or required bridge methods not available');
}

// ============== Scheduler page (new tab) ==============
const schedulerRow = document.getElementById('settingsScheduler');
if (schedulerRow && window.browserBridge?.createTab && window.browserBridge?.navigate) {
  const openScheduler = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    try {
      const schedulerUrl = new URL('../scheduler/index.html', window.location.href).toString();
      await window.browserBridge.createTab();
      await window.browserBridge.navigate(schedulerUrl);
      await window.browserBridge.closeSettingsPopup?.();
    } catch (err) {
      console.error('[Settings] Failed to open Scheduler page', err);
    }
  };
  schedulerRow.addEventListener('click', openScheduler);
  schedulerRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openScheduler(e);
  });
} else {
  console.warn('[Settings] Scheduler row or required bridge methods not available');
}

// --- Credential Manager popup ---
const credentialManagerRow = document.getElementById('settingsCredentialManager');

const openCredentialManagerTab = async (event) => {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (
    !window.browserBridge?.createTab ||
    !window.browserBridge?.navigate ||
    !window.browserBridge?.closeSettingsPopup
  ) {
    console.warn('[Settings] Credential manager tab bridge missing');
    return;
  }
  try {
    const targetUrl = new URL('../credentialManager/index.html', window.location.href).toString();
    await window.browserBridge.createTab();
    await window.browserBridge.navigate(targetUrl);
    await window.browserBridge.closeSettingsPopup();
  } catch (err) {
    console.error('[Settings] Failed to open Credential Manager tab', err);
  }
};

if (credentialManagerRow) {
  credentialManagerRow.addEventListener('click', openCredentialManagerTab);
  credentialManagerRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openCredentialManagerTab(e);
  });
} else {
  console.warn('[Settings] Credential Manager row missing');
}

// --- Updates ---
const setUpdateStatus = (text) => {
  if (updateStatus) updateStatus.textContent = text;
};
const toggleInstallBtn = (show) => {
  if (updateInstallBtn) updateInstallBtn.hidden = !show;
};

if (updateRow && window.browserBridge?.checkForUpdates) {
  const handleCheck = async (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    toggleInstallBtn(false);
    setUpdateStatus('Checking for updates...');
    const res = await window.browserBridge.checkForUpdates();
    if (res?.ok === false && res.error) {
      setUpdateStatus(res.error);
    }
  };
  updateRow.addEventListener('click', handleCheck);
  updateRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleCheck(e);
  });
} else {
  console.warn('[Settings] Update row or bridge not available');
}

if (updateInstallBtn && window.browserBridge?.installUpdate) {
  updateInstallBtn.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setUpdateStatus('Restarting to install...');
    await window.browserBridge.installUpdate();
  });
}

window.browserBridge?.onUpdateStatus?.((payload = {}) => {
  const state = payload.state;
  if (state === 'checking') {
    setUpdateStatus('Checking for updates...');
    toggleInstallBtn(false);
  } else if (state === 'available') {
    setUpdateStatus('Update available. Downloading...');
    toggleInstallBtn(false);
  } else if (state === 'downloading') {
    const pct = typeof payload.percent === 'number' ? `${payload.percent}%` : '';
    setUpdateStatus(`Downloading update${pct ? ` (${pct})` : ''}...`);
    toggleInstallBtn(false);
  } else if (state === 'downloaded') {
    setUpdateStatus('Update ready. Restart to install.');
    toggleInstallBtn(true);
  } else if (state === 'not-available') {
    setUpdateStatus('You’re up to date.');
    toggleInstallBtn(false);
  } else if (state === 'error') {
    setUpdateStatus(payload.message || 'Update error');
    toggleInstallBtn(false);
  }
});

// --- Exit ---
const exitRow = document.getElementById('settingsExit');
if (exitRow && typeof window.browserBridge?.quitApp === 'function') {
  const handleExit = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    window.browserBridge.quitApp();
  };
  exitRow.addEventListener('click', handleExit);
  exitRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleExit(e);
  });
} else {
  console.warn('[Settings] Exit row or quit bridge not available');
}
