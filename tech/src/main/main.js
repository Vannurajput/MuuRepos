/**
 * main.js
 * Boots the Electron app, manages BrowserViews, popups, and IPC bridges.
 * Acts as the coordinator for tabs, window chrome, auxiliary popups, and Git actions.
 */
const { app, BrowserWindow, ipcMain, nativeTheme, Menu, shell, session } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url'); // for file:// conversion
require('./googleProfileService');
const { DEFAULT_HOME } = require('./constants');
const TabManager = require('./tabManager');
const historyStore = require('./historyStore');
const bookmarkStore = require('./bookmarkStore');
const githubManager = require('./githubManager');
const credentialStore = require('./credentialStore');
const credentialRegistry = require('./credentialRegistry');
const { registerPrinterHandlers } = require('./printerController');
const { handleExternalMessage } = require('./messageHandler');
const { createBookmarkQuickController } = require('./windows/bookmarkQuickWindow');
const { createGitController } = require('./windows/gitWindow');
const { createSettingsController } = require('./windows/settingsWindow');
const { createDownloadsController } = require('./windows/downloadsManager');
const { createCredentialFormController } = require('./windows/credentialFormWindow');
const { createCredentialManagerController } = require('./windows/credentialWindow');
const { createSuggestionsWindowController } = require('./windows/suggestionsWindow');
const { createSecurityPopoverController } = require('./windows/securityPopoverWindow');
const { createProfileController } = require('./windows/profileManager');
const { registerShortcutManager } = require('./shortcuts');
const { registerMediaPermissionHandler } = require('./permissions/mediaPermissions');
const { initUpdater, autoUpdater } = require('./updater');
const registerSchedulerIpc = require('./ipc/scheduler');
const scheduler = require('./scheduler');
// Expose app version
const { app: electronApp } = require('electron');
// use shared logger (electron-log wrapper)
const log = require('../logger');
let customDialogWindow = null;

// give other modules access to downloadsController
const { setDownloadsController } = require('./downloadsRegistry');

// small popup controller
const tabMenuPopup = require('./tabMenuWindow');
const { DEFAULT_THEME, readThemeFile, writeThemeFile } = require('./themeStore');
const keytar = require('keytar');

const GITHUB_LOGIN_URL = 'https://github.com/login';
const GITHUB_LOGOUT_PATHS = new Set(['/logout', '/logout/', '/session/logout', '/sessions/logout']);
const GITHUB_TOKEN_SERVICE = 'CodexBrowser-GitHub';
const GITHUB_TOKEN_ACCOUNT = 'oauth-token';

const INITIAL_URL_FLAG = '--initial-url=';
const encodeInitialUrlArg = (url) => `${INITIAL_URL_FLAG}${encodeURIComponent(url)}`;
const parseInitialUrlArg = () => {
  const raw = process.argv.find((arg) => arg.startsWith(INITIAL_URL_FLAG));
  if (!raw) {
    return DEFAULT_HOME;
  }
  try {
    return decodeURIComponent(raw.slice(INITIAL_URL_FLAG.length));
  } catch {
    return DEFAULT_HOME;
  }
};

const launchNewInstance = (initialUrl) => {
  const exePath = process.execPath;
  const appPath = app.getAppPath();
  const child = spawn(exePath, [appPath, encodeInitialUrlArg(initialUrl)], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
};

/* =========================
   Deep-link normalization
   ========================= */
// Accepts raw argv items (may include quotes or wrappers) and returns http(s) URL if present.
const normalizeDeepLink = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();

  // strip wrapping quotes some shells add
  s = s.replace(/^"+|"+$/g, '');

  // unwrap microsoft-edge: or url: wrappers used by some apps
  const edgePrefix = /^microsoft-edge:/i;
  if (edgePrefix.test(s)) s = s.replace(edgePrefix, '');
  s = s.replace(/^url:/i, '');

  // only accept http(s)
  if (/^https?:\/\//i.test(s)) return s;
  return null;
};

// Extract a deep-link target from argv (http/https preferred; otherwise local .htm/.html -> file://)
const extractUrlFromArgs = (argv = []) => {
  for (const rawArg of argv) {
    if (!rawArg) continue;

    // 1) Try to normalize to http/https first (handles microsoft-edge:, quotes, etc.)
    const httpUrl = normalizeDeepLink(rawArg);
    if (httpUrl) return httpUrl;

    // 2) Fall back to local HTML files (convert to file://)
    const arg = String(rawArg).trim().replace(/^"+|"+$/g, '');
    if (arg.startsWith('--')) continue; // ignore switches

    if (/\.(?:html?)$/i.test(arg)) {
      try {
        // Windows absolute path or UNC
        if (/^[a-zA-Z]:\\|^\\\\/.test(arg)) {
          return pathToFileURL(arg).toString();
        }
      } catch {
        // ignore malformed path
      }
    }
  }
  return null;
};

let mainWindow;
let tabManager;
let themeState = { ...DEFAULT_THEME };
let githubTabId = null;
const githubTabCleanups = new Map();
let githubLogoutInProgress = false;
let pendingDeepLinks = [];
let updaterInitialized = false;
const sendWindowState = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:state', {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen?.()
    });
  }
};

// Allow multiple windows/processes (for the "New Window" action) by not enforcing single-instance lock.

const getMainWindow = () => mainWindow;
const getTabManager = () => tabManager;
const emitHandshakeStatus = (payload = {}) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('codex-handshake-status', payload);
  }
};
const bookmarkQuickController = createBookmarkQuickController(getMainWindow);
const gitController = createGitController(getMainWindow);
const settingsController = createSettingsController(getMainWindow);
const credentialFormController = createCredentialFormController(getMainWindow);
const credentialManagerController = createCredentialManagerController(getMainWindow);
const downloadsController = createDownloadsController({
  getMainWindow,
  getTabManager,
  ipcMain,
  log
});
const suggestionsController = createSuggestionsWindowController(getMainWindow);
const securityPopoverController = createSecurityPopoverController(getMainWindow);
const profileController = createProfileController({
  getMainWindow,
  ipcMain,
  log
});

// let other modules record manual downloads
setDownloadsController(downloadsController);

downloadsController.registerIpcHandlers();
profileController.registerIpcHandlers();
const { registerChatIpc } = require('./chatIpc');
const { resolveFetch } = require('./fetchHelper');
registerChatIpc({
  ipcMain,
  getMainWindow,
  getTabManager
});

// Lightweight placeholder: remote suggestions disabled until a provider is configured.
const fetchRemoteSuggestions = async () => [];

const collectTabWebContents = () => {
  const contents = [];
  if (mainWindow && !mainWindow.isDestroyed()) {
    contents.push(mainWindow.webContents);
  }
  const managerWindow = credentialManagerController.getWindow?.();
  if (managerWindow && !managerWindow.isDestroyed()) {
    contents.push(managerWindow.webContents);
  }
  if (tabManager?.tabs instanceof Map) {
    for (const tab of tabManager.tabs.values()) {
      const viewContents = tab?.view?.webContents;
      if (viewContents && !viewContents.isDestroyed()) {
        contents.push(viewContents);
      }
    }
  }
  return contents;
};

const broadcastCredentialManagerRefresh = () => {
  collectTabWebContents().forEach((contents) => {
    try {
      contents.send?.('credential-manager:refresh');
    } catch (error) {
      log.warn('Failed to broadcast credential refresh', error);
    }
  });
};

registerPrinterHandlers({
  ipcMain,
  credentialRegistry,
  broadcastCredentialManagerRefresh,
  log
});

/* ====== STRONGER: open URL in a new tab with explicit logs + focus ====== */
const handleOpenUrlInTab = (url) => {
  const normalized = normalizeDeepLink(url) || url;
  if (!normalized) {
    log.warn('[deeplink] ignored invalid url:', url);
    return;
  }

  log.info('[deeplink] request to open:', normalized);

  if (tabManager) {
    let createdId = null;
    try {
      createdId = tabManager.createTab(normalized);
      log.info('[deeplink] createTab returned id:', createdId);
    } catch (e) {
      log.error('[deeplink] createTab threw:', e);
    }

    if (createdId != null) {
      try { tabManager.setActiveTab(createdId); }
      catch (e) { log.warn('[deeplink] setActiveTab failed:', e); }
    } else {
      log.warn('[deeplink] createTab returned null/undefined');
    }

    if (mainWindow) {
      try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop?.();
      } catch (e) {
        log.warn('[deeplink] focusing mainWindow failed:', e);
      }
    }
  } else {
    log.warn('[deeplink] tabManager not ready, queuing:', normalized);
    pendingDeepLinks.push(normalized);
  }
};

app.on('second-instance', (_event, argv) => {
  log.info('[second-instance] argv =', argv);
  const url = extractUrlFromArgs(argv);
  log.info('[second-instance] parsed url =', url); // <— added instrumentation
  if (url) {
    handleOpenUrlInTab(url);
  } else if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

const normalizeThemeColor = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  let hex = value.trim();
  if (!hex.startsWith('#')) {
    return null;
  }
  hex = hex.slice(1);
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return null;
};

const sendThemeToContents = (contents) => {
  if (contents && !contents.isDestroyed()) {
    contents.send('theme:update', themeState);
  }
};

const auxiliaryThemeWindows = () => [
  bookmarkQuickController.getWindow?.(),
  gitController.getWindow?.(),
  settingsController.getWindow?.(),
  credentialFormController.getWindow?.(),
  credentialManagerController.getWindow?.(),
  downloadsController.getWindow?.(),
  profileController.getWindow?.(),
  suggestionsController.getWindow?.()
];

const broadcastTheme = () => {
  sendThemeToContents(mainWindow?.webContents);
  auxiliaryThemeWindows()
    .filter((win) => win && !win.isDestroyed())
    .forEach((win) => sendThemeToContents(win.webContents));
};

const broadcastHistoryEntries = (entries) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history:update', entries);
  }
};

const broadcastBookmarkWindows = (entries) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bookmarks:update', entries);
  }
  bookmarkQuickController.broadcastBookmarks(entries);
};

const parseGithubTokenFromUrl = (urlObj) => {
  if (!urlObj) return null;
  const queryToken = urlObj.searchParams.get('access_token');
  if (queryToken) {
    return queryToken;
  }
  if (urlObj.hash) {
    const params = new URLSearchParams(urlObj.hash.replace(/^#/, ''));
    return params.get('access_token');
  }
  return null;
};

const persistGithubToken = async (token) => {
  if (!token) {
    return;
  }
  try {
    await keytar.setPassword(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT, token);
    log.info('[GitHubAuth] Stored OAuth token via keytar');
  } catch (error) {
    log.warn('[GitHubAuth] Failed to persist token', error);
  }
};

const clearGithubToken = async () => {
  try {
    await keytar.deletePassword(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT);
  } catch (error) {
    log.warn('[GitHubAuth] Failed to delete stored token', error);
  }
};

const clearGithubSessionData = async () => {
  const ses = session?.defaultSession;
  if (!ses) return;
  try {
    const storageOptions = { storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'caches'] };
    await Promise.all([
      ses.clearStorageData({ origin: 'https://github.com', ...storageOptions }),
      ses.clearStorageData({ origin: 'https://gist.github.com', ...storageOptions })
    ]);
    const cookies = await ses.cookies.get({ domain: 'github.com' });
    await Promise.all(
      cookies.map((cookie) => {
        const protocol = cookie.secure ? 'https://' : 'http://';
        const domain = cookie.domain?.startsWith('.') ? cookie.domain.slice(1) : cookie.domain || 'github.com';
        const pathName = cookie.path || '/';
        const url = `${protocol}${domain}${pathName}`;
        return ses.cookies.remove(url, cookie.name).catch(() => { });
      })
    );
  } catch (error) {
    log.warn('[GitHubAuth] Failed clearing github.com storage', error);
  }
  await clearGithubToken();
};

const isGithubLogoutNavigation = (urlObj) => {
  if (!urlObj) return false;
  if (!urlObj.hostname || !urlObj.hostname.endsWith('github.com')) {
    return false;
  }
  if (GITHUB_LOGOUT_PATHS.has(urlObj.pathname)) {
    return true;
  }
  return urlObj.pathname === '/login' && urlObj.searchParams.has('logged_out');
};

const handleGithubNavigation = async (webContents, url) => {
  if (!url) return;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (!parsed.hostname || !parsed.hostname.endsWith('github.com')) {
    return;
  }

  const token = parseGithubTokenFromUrl(parsed);
  if (token) {
    await persistGithubToken(token);
  }

  if (isGithubLogoutNavigation(parsed)) {
    if (githubLogoutInProgress) return;
    githubLogoutInProgress = true;
    await clearGithubSessionData();
    if (webContents && !webContents.isDestroyed()) {
      webContents.loadURL(GITHUB_LOGIN_URL);
    }
    setTimeout(() => {
      githubLogoutInProgress = false;
    }, 500);
  }
};

const attachGithubTabHandlers = (tabId) => {
  if (!tabManager || typeof tabManager.getTab !== 'function') {
    return;
  }
  const tab = tabManager.getTab(tabId);
  const contents = tab?.view?.webContents;
  if (!contents) {
    return;
  }
  if (githubTabCleanups.has(tabId)) {
    const dispose = githubTabCleanups.get(tabId);
    dispose?.();
  }

  const navHandler = (_event, targetUrl) => {
    handleGithubNavigation(contents, targetUrl);
  };

  contents.on('did-navigate', navHandler);
  contents.on('did-navigate-in-page', navHandler);
  contents.on('will-navigate', navHandler);

  const cleanup = () => {
    contents.removeListener('did-navigate', navHandler);
    contents.removeListener('did-navigate-in-page', navHandler);
    contents.removeListener('will-navigate', navHandler);
    githubTabCleanups.delete(tabId);
    if (githubTabId === tabId) {
      githubTabId = null;
    }
  };

  contents.once('destroyed', cleanup);
  githubTabCleanups.set(tabId, cleanup);
};


const openGithubLoginTab = async () => {
  if (!tabManager) return null;
  if (githubTabId && typeof tabManager.getTab === 'function') {
    const existing = tabManager.getTab(githubTabId);
    if (existing) {
      tabManager.setActiveTab?.(githubTabId);
      const contents = existing.view?.webContents;
      if (contents && !contents.isDestroyed()) {
        contents.loadURL(GITHUB_LOGIN_URL);
      }
      return githubTabId;
    }
  }
  const newTabId = tabManager.createTab(GITHUB_LOGIN_URL);
  if (typeof newTabId === 'number') {
    githubTabId = newTabId;
    attachGithubTabHandlers(newTabId);
  }
  return newTabId;
};

const loadThemeFromDisk = async () => {
  try {
    themeState = await readThemeFile();
  } catch (error) {
    log.warn('Failed to load theme config', error);
    themeState = { ...DEFAULT_THEME };
  }
};

const formatGitRow = (entry = {}, source = 'store') => {
  const owner = (entry.owner || entry.repositoryOwner || '').trim();
  const repository = (entry.repository || entry.repo || '').trim();
  const label = owner && repository ? `${owner}/${repository}` : 'Git Credentials';
  const configured = Boolean(owner && repository && (entry.pat || entry.token) && (entry.defaultPath || entry.path));
  return {
    id: entry.id || `git-${source}`,
    entryType: 'git',
    entrySource: source,
    name: entry.label || label,
    type: 'GIT',
    summary: label,
    configured
  };
};

const formatDatabaseRow = (entry = {}, source = 'store') => {
  const dbType = (entry.dbType || entry.type || '').toUpperCase();
  const dbName = (entry.connectionName || entry.label || '').trim() || 'Database Credentials';
  const summaryParts = [];
  if (entry.user) summaryParts.push(entry.user);
  if (entry.host) summaryParts.push(entry.host);
  const summary = summaryParts.join(' - ');
  const configured = Boolean((entry.dbType || '').length && (entry.host || '').length && (entry.user || '').length);
  return {
    id: source === 'registry' ? entry.id : entry.customId || entry.id || `database-${source}`,
    entryType: 'database',
    entrySource: source,
    name: dbName,
    type: dbType || 'DATABASE',
    summary,
    configured
  };
};

const formatOtherRow = (entry = {}) => ({
  id: entry.id,
  entryType: 'other',
  entrySource: 'registry',
  name: entry.label || 'Other Credential',
  type: 'OTHER',
  summary: entry.description || '',
  configured: Boolean(entry.secret)
});

const formatPrinterRow = (entry = {}) => {
  const summaryParts = [
    entry.printerType && entry.printerType.toUpperCase(),
    entry.printerModel,
    entry.companyName,
    entry.printerPort ? `Port ${entry.printerPort}` : ''
  ];
  return {
    id: entry.id,
    entryType: 'printer',
    entrySource: 'registry',
    name: entry.label || entry.printerName || entry.deviceName || 'Printer',
    type: 'PRINTER',
    summary: summaryParts.filter(Boolean).join(' - '),
    configured: Boolean(entry.deviceName || entry.printerName)
  };
};

const buildCredentialRows = async () => {
  const rows = [];
  try {
    const gitConfig = await githubManager.loadConfig();
    rows.push(formatGitRow(gitConfig, 'store'));
  } catch (error) {
    log.warn('Failed to load default Git credentials', error);
  }
  try {
    const dbConfig = await credentialStore.loadConfig();
    rows.push(formatDatabaseRow(dbConfig, 'store'));
  } catch (error) {
    log.warn('Failed to load default database credentials', error);
  }
  try {
    const registry = await credentialRegistry.listAll();
    registry.git.forEach((entry) => rows.push(formatGitRow(entry, 'registry')));
    registry.database.forEach((entry) => rows.push(formatDatabaseRow(entry, 'registry')));
    registry.other.forEach((entry) => rows.push(formatOtherRow(entry)));
    registry.printer?.forEach((entry) => rows.push(formatPrinterRow(entry)));
  } catch (error) {
    log.error('Failed to load credential registry', error);
  }
  return rows;
};

// Builds the main BrowserWindow and wires the TabManager plus lifecycle handlers.
const createWindow = (initialUrl = DEFAULT_HOME) => {
  nativeTheme.themeSource = 'light';
  log('Creating main window');

  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';

  const isFrameless = !isMac;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    useContentSize: true,
    transparent: true,
    hasShadow: false,
    frame: isFrameless ? false : true,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    titleBarOverlay: isMac
      ? {
        color: '#eedcfb',
        symbolColor: '#1c1f26',
        height: 0
      }
      : undefined,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, isWindows ? '../../build/icon.ico' : '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged && !updaterInitialized) {
    initUpdater(mainWindow);
    updaterInitialized = true;
  }

  // Set up media permission handling (mic/camera) once per session.
  try {
    registerMediaPermissionHandler(session.defaultSession);
  } catch (err) {
    log.warn('Failed to register media permission handler', err);
  }

  // give the popup module a getter for the main window
  tabMenuPopup.init(() => mainWindow);

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  // Disable pinch zoom on the chrome itself; we handle content zoom manually in the renderer.
  try {
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    mainWindow.webContents.setLayoutZoomLevelLimits(0, 0);
    mainWindow.webContents.setZoomFactor(1);
  } catch (_) {
    // best effort
  }
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow?.isDestroyed()) {

      mainWindow.show();
      sendWindowState();
    }
  });
  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.on('enter-full-screen', sendWindowState);
  mainWindow.on('leave-full-screen', sendWindowState);
  mainWindow.webContents.once('did-finish-load', () => {
    sendThemeToContents(mainWindow.webContents);
  });
  mainWindow.webContents.on('context-menu', (event) => event.preventDefault());
  // Route Ctrl+Shift+I to the renderer DevTools so the chrome can be inspected.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isCmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control;
    const isShift = input.shift;
    const isAlt = input.alt;

    // Global tab cycling (works even when focus is inside a page)
    if (input.type === 'keyDown' && input.code === 'Tab' && isCmdOrCtrl && !isAlt) {
      event.preventDefault();
      const delta = isShift ? -1 : 1;
      try {
        tabManager?.cycleTab?.(delta);
      } catch (e) {
        log.warn('[hotkey] cycleTab failed:', e);
      }
      return;
    }

    // Global History shortcut (Ctrl/Cmd + H)
    // (handled by shortcut matcher to avoid duplicate opens)
    if (input.type === 'keyDown' && input.code === 'Escape' && mainWindow?.isFullScreen()) {
      event.preventDefault();
      syncAppFullscreen(false);
      const activeTab = tabManager?.activeTab;
      const contents = activeTab?.view?.webContents;
      contents?.executeJavaScript(`if (document.fullscreenElement) document.exitFullscreen();`).catch(() => { });
      return;
    }
    if (input.type === 'keyDown' && input.code === 'F11') {
      event.preventDefault();
      const next = !mainWindow?.isFullScreen();
      syncAppFullscreen(next);
      if (!next) {
        const activeTab = tabManager?.activeTab;
        const contents = activeTab?.view?.webContents;
        contents?.executeJavaScript(`if (document.fullscreenElement) document.exitFullscreen();`).catch(() => { });
      }
      return;
    }
    if (input.type === 'keyDown' && isCmdOrCtrl && isShift && input.code === 'KeyJ') {
      event.preventDefault();
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
        labelDevToolsWindow(mainWindow.webContents, 'Chrome DevTools');
        log('Renderer DevTools opened via keyboard');
      }
    }
  });

  // Media permissions (camera/mic) for trusted origins
  try {
    registerMediaPermissionHandler(session.defaultSession);
  } catch (err) {
    log.warn('Failed to register media permission handler', err);
  }

  tabManager = new TabManager(
    mainWindow,
    (payload) => {
      if (mainWindow) {
        mainWindow.webContents.send('tabs:state', payload);
      }
    },
    broadcastHistoryEntries,
    (url) => launchNewInstance(url),
    (enabled) => syncAppFullscreen(enabled)
  );
  registerShortcutManager(mainWindow, tabManager, () => launchNewInstance(DEFAULT_HOME));

  mainWindow.on('resize', () => tabManager.resizeActiveView());
  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
    bookmarkQuickController.destroy();
    gitController.destroy();
    settingsController.destroy();
    credentialManagerController.destroy();
    credentialFormController.destroy();
    tabMenuPopup.destroyIfAny();
    downloadsController.destroy();
    profileController.destroy();
    suggestionsController.destroy();
    securityPopoverController.destroy();
  });

  tabManager.createInitialTab(initialUrl);
  broadcastBookmarkWindows(bookmarkStore.getAll());

  mainWindow.webContents.on('enter-html-full-screen', () => {
    syncAppFullscreen(true);
  });

  mainWindow.webContents.on('leave-html-full-screen', () => {
    syncAppFullscreen(false);
  });
};

const openPopupDevTools = () => {
  const popupWindows = [
    bookmarkQuickController.getWindow(),
    gitController.getWindow(),
    settingsController.getWindow(),
    downloadsController.getWindow(),
    securityPopoverController.getWindow()
  ];
  popupWindows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });
};

// Tab controls exposed to the renderer through the preload bridge.
ipcMain.handle('tabs:new', () => {
  const id = tabManager?.createTab(DEFAULT_HOME);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcuts:focus-address', { selectAll: true });
  }
  return id;
});
ipcMain.handle('tabs:activate', (_, tabId) => tabManager?.setActiveTab(tabId));
ipcMain.handle('tabs:close', (_, tabId) => tabManager?.destroyTab(tabId));
ipcMain.handle('tabs:navigate', (_, input) => tabManager?.navigateActiveTab(input));
ipcMain.handle('tabs:reload', () => tabManager?.reload());
ipcMain.handle('tabs:back', () => tabManager?.goBack());
ipcMain.handle('tabs:forward', () => tabManager?.goForward());
ipcMain.handle('tabs:detach', (_, tabId) => tabManager?.detachTab(tabId));
ipcMain.handle('tabs:print', () => tabManager?.printActive());
ipcMain.handle('tabs:get-zoom', () => tabManager?.getActiveZoom());
ipcMain.handle('tabs:set-zoom', (_evt, factor) => tabManager?.setActiveZoom(factor));
ipcMain.handle('tabs:zoom-in', () => tabManager?.nudgeActiveZoom(1));
ipcMain.handle('tabs:zoom-out', () => tabManager?.nudgeActiveZoom(-1));
ipcMain.handle('tabs:zoom-reset', () => tabManager?.setActiveZoom(1));
ipcMain.handle('tabs:reopen-last', () => tabManager?.reopenLastClosed());
ipcMain.handle('chrome:update-offset', (_, height) => tabManager?.updateTopOffset(height));
// Pin / Close Others / Close Right handlers for tab context menu
ipcMain.handle('tabs:pin', (_, tabId) => tabManager?.togglePin(tabId));
ipcMain.handle('tabs:close-others', (_, tabId) => tabManager?.closeOtherTabs(tabId));
ipcMain.handle('tabs:close-right', (_, tabId) => tabManager?.closeTabsToRight(tabId));
ipcMain.handle('tabs:move', (_evt, { tabId, beforeTabId }) =>
  tabManager?.moveTab(tabId, beforeTabId)
);
ipcMain.handle('tabs:cycle', (_evt, delta = 1) => tabManager?.cycleTab?.(delta));

// Set pin state directly
ipcMain.handle('tabs:setPinned', (_evt, { tabId, pinned }) => {
  tabManager?.setPinned?.(tabId, pinned);
});

// Quit whole app from renderer
ipcMain.handle('app:quit', () => {
  log('main: app.quit() requested');
  app.quit();
});

// IPC endpoints for the overlaying tab context menu and suggestions
ipcMain.handle('tabmenu:toggle-popup', (_, bounds, payload) => tabMenuPopup.toggle(bounds, payload));
ipcMain.handle('tabmenu:close-popup', () => tabMenuPopup.hide());
ipcMain.handle('suggestions:toggle-popup', (_evt, bounds, payload) =>
  suggestionsController.toggleWindow(bounds, payload)
);
ipcMain.handle('suggestions:update', (_evt, payload) => suggestionsController.update(payload));
ipcMain.handle('suggestions:hide', () => suggestionsController.hide());
ipcMain.handle('security:show', (_evt, bounds, payload) =>
  securityPopoverController.show(bounds, payload)
);
ipcMain.handle('security:update', (_evt, payload) => securityPopoverController.update(payload));
ipcMain.handle('security:hide', () => securityPopoverController.hide());

/* ================== NEW WINDOW ================== */
ipcMain.handle('window:new', () => {
  launchNewInstance(DEFAULT_HOME);
});
/* =============================================== */

// App version for renderer (settings panel)
ipcMain.handle('app:get-version', () => app.getVersion());

/* ============= DEFAULT BROWSER HELPERS ============= */
ipcMain.handle('app:set-default-browser', async () => {
  const result = { http: false, https: false };
  try {
    result.http = app.setAsDefaultProtocolClient('http');
    result.https = app.setAsDefaultProtocolClient('https');
  } catch (e) {
    result.error = String(e?.message || e);
  }
  try {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:defaultapps');
    } else if (process.platform === 'darwin') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.general?DefaultWebBrowser');
    }
  } catch (_) { }
  return result;
});
/* ==================================================== */

// History popup coordination.
ipcMain.handle('history:get', () => historyStore.getHistory());
ipcMain.handle('history:clear', () => {
  historyStore.clear();
  log('History cleared');
  tabManager?.emitHistoryUpdate();
});

// Bookmark star/popup coordination.
ipcMain.handle('bookmarks:get', () => bookmarkStore.getAll());
ipcMain.handle('bookmarks:toggle', (_, entry) => {
  const result = bookmarkStore.toggle(entry);
  log('Bookmark toggled', entry?.url);
  broadcastBookmarkWindows(bookmarkStore.getAll());
  return result;
});
ipcMain.handle('bookmarks:save', (_, entry) => {
  const saved = bookmarkStore.upsert(entry);
  if (saved) {
    log('Bookmark saved', saved.url, saved.folder);
    broadcastBookmarkWindows(bookmarkStore.getAll());
  }
  return saved;
});
ipcMain.handle('bookmarks:remove', (_, payload) => {
  const removed = bookmarkStore.remove(payload);
  if (removed) {
    const label = typeof payload === 'string' ? payload : payload?.url || payload?.id;
    log('Bookmark removed', label);
    broadcastBookmarkWindows(bookmarkStore.getAll());
  }
  return removed;
});
ipcMain.handle('bookmarks:clear', () => {
  bookmarkStore.clear();
  log('Bookmarks cleared');
  broadcastBookmarkWindows(bookmarkStore.getAll());
});
ipcMain.handle('bookmarks:toggle-quick', (_event, bounds, context) =>
  bookmarkQuickController.toggleQuickWindow(bounds, context)
);
ipcMain.handle('bookmarks:close-quick', () => bookmarkQuickController.closeQuickWindow());
ipcMain.handle('bookmarks:update-quick-context', (_event, context) =>
  bookmarkQuickController.sendContext(context || {})
);
ipcMain.handle('github:open-login-tab', () => openGithubLoginTab());
ipcMain.handle('credentials:toggle-popup', (_, bounds) => credentialManagerController.toggleWindow(bounds));
ipcMain.handle('credentials:close-popup', () => credentialManagerController.closeWindow());
ipcMain.handle('credentials:open-form', (_, bounds) => credentialFormController.openWindow(bounds));
ipcMain.handle('credentials:close-form', () => credentialFormController.closeWindow());

ipcMain.handle('credentials:list', async () => buildCredentialRows());
ipcMain.handle('credentials:get', () => credentialStore.loadConfig());
ipcMain.handle('credentials:save', async (_event, payload = {}) => {
  const normalized = {
    customId: (payload.id || payload.customId || '').trim(),
    label: (payload.label || payload.connectionName || '').trim(),
    connectionName: (payload.connectionName || payload.label || '').trim(),
    dbType: (payload.dbType || '').trim(),
    host: (payload.host || '').trim(),
    port: (payload.port || '').trim(),
    database: (payload.database || '').trim(),
    user: (payload.user || '').trim(),
    password: payload.password || '',
    ssh: { ...(payload.ssh || {}) },
    ssl: { ...(payload.ssl || {}) },
    iam: { ...(payload.iam || {}) }
  };
  const shouldRegistry = !payload.__skipRegistry && (payload.__registry || payload.__entryId);
  if (shouldRegistry) {
    const entry = await credentialRegistry.upsert('database', {
      id: payload.__entryId,
      ...normalized,
      customId: normalized.customId,
      label: normalized.label || normalized.database || normalized.host || 'Database Credential',
      connectionName: normalized.connectionName
    });
    broadcastCredentialManagerRefresh();
    return { ...normalized, __entryId: entry.id };
  }
  const saved = await credentialStore.saveConfig(normalized);
  broadcastCredentialManagerRefresh();
  return saved;
});
ipcMain.handle('credentials:test', (_event, payload = {}) => credentialStore.testConnection(payload));
ipcMain.handle('credentials:entry:get', (_event, { type, id }) => credentialRegistry.get(type, id));
ipcMain.handle('credentials:entry:delete', async (_event, { type, id }) => {
  const removed = await credentialRegistry.remove(type, id);
  if (removed) {
    broadcastCredentialManagerRefresh();
  }
  return removed;
});
ipcMain.handle('credentials:other:save', async (_event, payload = {}) => {
  const entry = await credentialRegistry.upsert('other', {
    id: payload.id,
    label: (payload.label || '').trim() || 'Other Credential',
    description: (payload.description || '').trim(),
    secret: payload.secret || ''
  });
  broadcastCredentialManagerRefresh();
  return entry;
});
// Printer credential IPC moved into printerController

// Git integration commands for the popup UI.
ipcMain.handle('git:toggle-popup', (_, bounds) => gitController.toggleGitWindow(bounds));
ipcMain.handle('git:close-popup', () => gitController.closeGitWindow());
ipcMain.handle('settings:toggle-popup', (_, bounds) => settingsController.toggleSettingsWindow(bounds));
ipcMain.handle('settings:close-popup', () => settingsController.closeSettingsWindow());
ipcMain.handle('settings:resize', (_evt, height) => settingsController.resizeSettingsWindow?.(height));
ipcMain.handle('github:get-config', async () => {
  const stored = (await githubManager.loadConfig()) || {};
  const hasStoredConfig = Boolean(stored.owner && stored.repository && (stored.pat || stored.token) && stored.defaultPath);
  if (hasStoredConfig) {
    return stored;
  }
  try {
    const normalizeGitEntry = (entry) => {
      if (!entry) return null;
      const owner = String(entry.owner || entry.repositoryOwner || '').trim();
      const repository = String(entry.repository || entry.repo || '').trim();
      const branch = String(entry.branch || '').trim() || 'main';
      const defaultPath = String(entry.defaultPath || entry.path || '').trim();
      const pat = String(entry.pat || entry.token || '').trim();
      const defaultCommitMessage = String(entry.defaultCommitMessage || entry.commitMessage || '').trim() || 'chore: push from Chromo';

      if (!owner || !repository || !defaultPath || !pat) {
        return null;
      }

      return {
        owner,
        repository,
        branch,
        defaultPath,
        defaultCommitMessage,
        pat,
        __entryId: entry.id
      };
    };

    const entries = (await credentialRegistry.list('git')) || [];
    const sorted = entries.slice().sort((a, b) => {
      const aTime = Number(a?.updatedAt || a?.createdAt || 0);
      const bTime = Number(b?.updatedAt || b?.createdAt || 0);
      return bTime - aTime;
    });
    const best = sorted.map(normalizeGitEntry).find(Boolean);
    if (best) {
      return best;
    }
  } catch (error) {
    log.warn('[github:get-config] failed to fallback to registry config', error);
  }
  return stored;
});
ipcMain.handle('github:save-config', async (_, config) => {
  const saved = await githubManager.saveConfig(config);
  const shouldRegistry =
    config && !config.__skipRegistry && (config.__registry || config.__entryId || config?.mode === 'new');
  if (shouldRegistry) {
    const registryEntry = await credentialRegistry.upsert('git', {
      id: config.__entryId,
      owner: saved.owner || config.owner || '',
      repository: saved.repository || config.repository || '',
      branch: saved.branch || config.branch || '',
      defaultPath: saved.defaultPath || config.defaultPath || '',
      defaultCommitMessage: saved.defaultCommitMessage || config.defaultCommitMessage || '',
      pat: saved.pat || config.pat || '',
      label: config.label || `${saved.owner || config.owner || ''}/${saved.repository || config.repository || ''}`
    });
    broadcastCredentialManagerRefresh();
    return { ...saved, __entryId: registryEntry.id };
  }
  broadcastCredentialManagerRefresh();
  return saved;
});
ipcMain.handle('github:sign-out', async () => {
  await githubManager.signOut();
  broadcastCredentialManagerRefresh();
});
ipcMain.handle('github:push', async (_, payload) => githubManager.pushContent(payload));
ipcMain.handle('github:pull', async () => githubManager.pullContent());
ipcMain.handle('github:log-message', (_evt, entry) => {
  if (entry) {
    log.info('[GitHub][renderer]', entry);
  }
  return true;
});
// Title-bar proxy handlers keep the custom chrome working.
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) {
    return false;
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged || !updaterInitialized) {
    return { ok: false, error: 'Updates available in packaged builds only.' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});
ipcMain.handle('update:install', () => {
  if (!app.isPackaged || !updaterInitialized) {
    return { ok: false, error: 'Updates available in packaged builds only.' };
  }
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});
ipcMain.handle('window:toggle-devtools', () => tabManager?.toggleDevTools());
// Open chrome (header) DevTools only to avoid spawning multiple windows.
ipcMain.handle('window:open-devtools', () => {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    labelDevToolsWindow(mainWindow.webContents, 'Chrome DevTools');
    log('Renderer DevTools opened');
  }
});
ipcMain.handle('window:open-renderer-devtools', () => {
  if (mainWindow && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    labelDevToolsWindow(mainWindow.webContents, 'Chrome DevTools');
    log('Renderer DevTools opened');
  }
});
ipcMain.handle('windows:open-popup-devtools', () => openPopupDevTools());
ipcMain.handle('theme:get', () => themeState);
ipcMain.handle('theme:set', async (_event, colorValue) => {
  const normalized = normalizeThemeColor(colorValue);
  if (!normalized) {
    throw new Error('Invalid color format');
  }
  themeState = { color: normalized };
  try {
    await writeThemeFile(themeState);
  } catch (error) {
    log.warn('Failed to persist theme config', error);
  }
  broadcastTheme();
  return themeState;
});
ipcMain.handle('theme:set-mode', (_event, mode) => {
  const valid = mode === 'dark' || mode === 'light' || mode === 'system';
  if (!valid) return nativeTheme.themeSource;
  nativeTheme.themeSource = mode;
  return nativeTheme.themeSource;
});

/* ========================== APP LIFECYCLE ========================== */
app.whenReady().then(async () => {
  await loadThemeFromDisk();
  log('App ready');

  // Best-effort: register as default protocol client (Windows/macOS)
  try {
    const httpOk = app.setAsDefaultProtocolClient('http');
    const httpsOk = app.setAsDefaultProtocolClient('https');
    log.info('[default-protocol] http:', httpOk, 'https:', httpsOk);
  } catch (e) {
    log.warn('[default-protocol] failed:', e);
  }

  log.info('[Startup] process.argv =', process.argv);

  const deepLinkUrl = extractUrlFromArgs(process.argv); // uses normalization + file:// fallback
  const initialUrl = deepLinkUrl || parseInitialUrlArg();
  log.info('[initialUrl]', initialUrl || '(none)');

  createWindow(initialUrl);

  downloadsController.setupDownloadListener();

  // Centralized permission handling (camera/mic + fullscreen allowlist)
  registerMediaPermissionHandler(session.defaultSession);

  // Scheduler IPC + background loop
  try {
    registerSchedulerIpc(ipcMain, { scheduler, app, log });
    await scheduler.startSchedulerService({ app, log });
  } catch (err) {
    log.error('[Scheduler] failed to initialize', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle any queued deep links after main window/tab manager is ready
  if (pendingDeepLinks.length) {
    pendingDeepLinks.forEach((url) => handleOpenUrlInTab(url));
    pendingDeepLinks = [];
  }
});

// Always quit when all windows are closed (including macOS)
app.on('window-all-closed', () => {
  log('All windows closed, quitting');
  app.quit();
});

const labelDevToolsWindow = (targetWebContents, title) => {
  const devTools = targetWebContents?.devToolsWebContents;
  if (devTools && !devTools.isDestroyed()) {
    devTools.executeJavaScript(`document.title = ${JSON.stringify(title)};`).catch(() => { });
  }
};

/**
 * Handle JSON string coming from the test webpage via `window.externalMessage.send(jsonText)`
 */
ipcMain.handle('external-message', async (event, jsonText) => {
  log.info('[external-message] raw text from webpage:', jsonText);
  try {
    const data = JSON.parse(jsonText);
    log.debug('[external-message] parsed JSON object:', data);
    const senderUrl =
      event?.senderFrame?.url ||
      (typeof event?.sender?.getURL === 'function' ? event.sender.getURL() : '') ||
      '';

    let result;
    if (typeof handleExternalMessage === 'function') {
      result = await handleExternalMessage(data, {
        onHandshakeStatus: emitHandshakeStatus,
        handshakeContext: { url: senderUrl },
        replyTo: event?.senderFrame
      });
    }

    // Push result back to renderer as a fire-and-forget event for subscribers.
    try {
      event?.senderFrame?.send?.('external:result', result);
    } catch (pushErr) {
      log.warn('[external-message] failed to push result to renderer:', pushErr);
    }

    return result;
  } catch (err) {
    log.error('[external-message] error:', err);
    const msg = err?.message || 'Invalid JSON';
    const failure = { ok: false, error: msg };
    try {
      event?.senderFrame?.send?.('external:result', failure);
    } catch (_) {
      // best effort
    }
    return failure;
  }
});

// Handle external / website-style messages via MessageHandler + ConnectorFactory
ipcMain.handle('external:message', async (event, message) => {
  try {
    return await handleExternalMessage(message);
  } catch (err) {
    log.error('[external:message] error:', err);
    return { ok: false, error: err?.message || String(err) };
  }
});


const ensureCustomDialogWindow = (parent) => {
  if (customDialogWindow && !customDialogWindow.isDestroyed()) {
    return customDialogWindow;
  }
  customDialogWindow = new BrowserWindow({
    width: 420,
    height: 220,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    frame: false,
    modal: !!parent,
    parent: parent || undefined,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  customDialogWindow.setMenuBarVisibility(false);
  customDialogWindow.loadFile(path.join(__dirname, '../renderer/dialog/index.html'));
  customDialogWindow.on('closed', () => {
    customDialogWindow = null;
  });
  return customDialogWindow;
};

ipcMain.handle('custom-dialog', async (event, payload = {}) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const win = ensureCustomDialogWindow(parent);
  if (!win) return payload.type === 'confirm' ? false : undefined;

  return new Promise((resolve) => {
    const responseHandler = (_evt, result) => {
      resolve(result);
    };
    ipcMain.once('custom-dialog:response', responseHandler);
    win.once('closed', () => resolve(payload.type === 'confirm' ? false : undefined));
    win.webContents.send('custom-dialog:show', {
      type: payload.type || 'alert',
      message: payload.message || ''
    });
    win.show();
    win.focus();
  });
});

ipcMain.handle('address:suggestions', async (_event, query = '') => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) {
    return [];
  }
  const history = historyStore.getHistory?.() || [];
  const seen = new Set();
  const matches = [];
  const addSuggestion = (entry) => {
    if (!entry || !entry.url || seen.has(entry.url)) {
      return;
    }
    seen.add(entry.url);
    matches.push(entry);
  };
  for (const entry of history) {
    const title = entry.title || entry.url || '';
    const url = entry.url || '';
    if (title.toLowerCase().includes(term) || url.toLowerCase().includes(term)) {
      addSuggestion({
        title,
        url,
        source: 'history'
      });
    }
    if (matches.length >= 5) {
      return matches.slice(0, 5);
    }
  }
  // If no history entries matched the query, fall back to showing a few recent history items
  if (matches.length === 0 && history.length) {
    history.slice(0, 3).forEach((entry) =>
      addSuggestion({
        title: entry.title || entry.url,
        url: entry.url,
        source: 'history'
      })
    );
  }

  if (matches.length < 5) {
    const remote = await fetchRemoteSuggestions(query);
    for (const suggestion of remote) {
      const suggestionUrl = `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`;
      addSuggestion({
        title: suggestion,
        url: suggestionUrl,
        source: 'search',
        query: suggestion
      });
      if (matches.length >= 5) {
        return matches.slice(0, 5);
      }
    }
  }
  if (matches.length < 5) {
    const raw = query.trim();
    const directUrl = raw.includes('://') ? raw : `https://${raw}`;
    addSuggestion({
      title: directUrl,
      url: directUrl,
      source: 'history'
    });
    if (matches.length < 5 && !raw.includes('://')) {
      addSuggestion({
        title: raw,
        url: `https://www.google.com/search?q=${encodeURIComponent(raw)}`,
        source: 'search',
        query: raw
      });
    }
  }
  return matches.slice(0, 5);
});

const toggleRendererFullscreen = (enabled) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:fullscreen-toggle', { enabled });
  }
  if (tabManager && typeof tabManager.getTab === 'function' && tabManager.activeTabId != null) {
    const tab = tabManager.getTab(tabManager.activeTabId);
    const contents = tab?.view?.webContents;
    if (contents && !contents.isDestroyed()) {
      contents.send('window:fullscreen-toggle', { enabled });
    }
  }
};

const syncAppFullscreen = (enabled) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isFullScreen() !== enabled) {
      mainWindow.setFullScreen(enabled);
    }
  }
  toggleRendererFullscreen(enabled);
};

