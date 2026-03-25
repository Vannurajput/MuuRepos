/**
 * tabManager.js
 * Handles WebContentsView lifecycle, tab bookkeeping, navigation helpers, and DevTools state.
 * Architecture: WebContentsView-based multi-tab system. Each tab is a WebContentsView added to
 * the main window's content view. This provides modern, composited rendering with proper input handling.
 */
const { BrowserWindow, WebContentsView, app, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const log = require('../logger');
const { DEFAULT_HOME, TOP_BAR_HEIGHT } = require('./constants');
const historyStore = require('./historyStore');
const { formatInput } = require('./inputFormatter');
const { showContextMenu } = require('./contextMenu/contextMenu');

const CLOSED_TAB_STACK_LIMIT = 50;

const tabLog = (...args) => log.debug('[TabManager]', ...args);
const sanitizeFilename = (value = '') => {
  const safe = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim();
  return safe || 'page';
};
const clampIndex = (value, max) => {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

class TabManager {
  constructor(mainWindow, onStateChange, onHistoryUpdate, launchDetachedWindow, onHtmlFullscreenChange) {
    this.mainWindow = mainWindow;
    this.onStateChange = onStateChange;
    this.onHistoryUpdate = onHistoryUpdate;
    this.launchDetachedWindow = launchDetachedWindow;
    this.onHtmlFullscreenChange = onHtmlFullscreenChange;

    this.tabs = new Map();
    this.activeTabId = null;
    this.nextTabId = 1;
    this.topOffset = TOP_BAR_HEIGHT;
    this.rightInset = 0;
    this.devToolsPinned = false;
    this.closedTabs = [];
    this.currentZoom = 1;
  }

  getTab(tabId) {
    return this.tabs.get(tabId) || null;
  }

  get activeTab() {
    return this.getTab(this.activeTabId);
  }

  getTabOrder() {
    return Array.from(this.tabs.keys());
  }

  // Open a fresh tab and navigate to the given URL (used by context menu actions).
  openInNewTab(url = DEFAULT_HOME) {
    const newTabId = this.createTab(url);
    if (newTabId != null) {
      this.setActiveTab(newTabId);
    }
    return newTabId;
  }

  createInitialTab(url = DEFAULT_HOME) {
    return this.createTab(url);
  }

  createTab(initialUrl = DEFAULT_HOME) {
    if (!this.mainWindow) {
      return null;
    }

    const tabId = this.nextTabId++;

    // Create the WebContentsView for this tab
    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/contentPreload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundColor: '#f0f2f5',
        sandbox: true
      }
    });

    // Align user agent with the main window to avoid site blocks on Electron UA.
    try {
      const ua = this.mainWindow?.webContents?.getUserAgent?.();
      if (ua) {
        view.webContents.setUserAgent(ua);
      }
    } catch (_) {
      // best effort
    }

    const tab = {
      id: tabId,
      view,
      title: 'New Tab',
      url: '',
      isPinned: false,
      faviconUrl: ''
    };

    this.tabs.set(tabId, tab);
    tabLog('Created tab', tabId);
    this.registerViewListeners(tab);

    // Attach a Chrome-like context menu per tab.
    view.webContents.on('context-menu', (event, params) => {
      showContextMenu({
        mainWindow: this.mainWindow,
        tabManager: this,
        tabId,
        webContents: view.webContents,
        params
      });
    });

    if (initialUrl) {
      view.webContents.loadURL(formatInput(initialUrl));
    }

    this.setActiveTab(tabId);
    // Autofocus the top address bar when a new blank tab is created.
    try {
      this.mainWindow.webContents.send('shortcuts:focus-address', { selectAll: true });
    } catch (_) {
      // best effort
    }
    return tabId;
  }

  destroyTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return;
    }

    if (this.activeTabId === tabId) {
      this.detachCurrentView();
    }

    this.rememberClosedTab(tab);

    // Clean up the WebContentsView
    const contents = tab.view?.webContents;
    if (contents && !contents.isDestroyed()) {
      contents.removeAllListeners();
    }

    this.tabs.delete(tabId);
    tabLog('Destroyed tab', tabId);

    // Always keep at least one tab alive; this mirrors common browser UX and
    // keeps reopen (Ctrl+Shift+T) available even after closing the last tab.
    if (this.tabs.size === 0) {
      const fallbackId = this.createTab(DEFAULT_HOME);
      this.setActiveTab(fallbackId);
      return;
    }

    if (this.activeTabId === tabId) {
      const fallbackTab = Array.from(this.tabs.values()).pop();
      this.setActiveTab(fallbackTab.id);
    } else {
      this.broadcastState();
    }
  }

  setActiveTab(tabId) {
    if (!this.tabs.has(tabId)) {
      return;
    }

    this.detachCurrentView();
    this.activeTabId = tabId;
    this.attachTabView(this.tabs.get(tabId));
    if (this.devToolsPinned) {
      this.openDevTools();
    }
    this.broadcastState();
    tabLog('Activated tab', tabId);
  }

  resizeActiveView() {
    const activeTab = this.tabs.get(this.activeTabId);
    if (!this.mainWindow || !activeTab) {
      return;
    }

    const [width, height] = this.mainWindow.getContentSize();
    activeTab.view.setBounds({
      x: 0,
      y: this.topOffset,
      width: Math.max(0, width - this.rightInset),
      height: Math.max(0, height - this.topOffset)
    });
  }

  updateTopOffset(height) {
    if (typeof height === 'number' && height >= 0 && height !== this.topOffset) {
      this.topOffset = height;
      this.resizeActiveView();
      tabLog('Top offset updated', height);
    }
  }

  updateRightInset(pixels) {
    const next = Math.max(0, Number(pixels) || 0);
    if (next === this.rightInset) return;
    this.rightInset = next;
    this.resizeActiveView();
    tabLog('Right inset updated', next);
  }

  navigateActiveTab(input) {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) {
      return;
    }
    const target = formatInput(input || tab.url);
    tab.view.webContents.loadURL(target);
    tabLog('Navigating tab', this.activeTabId, target);
  }

  triggerFindInPage() {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    wc.focus();
    const modifiers = [process.platform === 'darwin' ? 'meta' : 'control'];
    ['keyDown', 'char', 'keyUp'].forEach((type) => {
      wc.sendInputEvent({
        type,
        keyCode: type === 'char' ? 'f' : 'F',
        modifiers
      });
    });
  }

  cycleTab(delta = 1) {
    const order = this.getTabOrder();
    const len = order.length;
    if (len < 2) return;
    const currentIndex = order.indexOf(this.activeTabId);
    const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + delta + len) % len;
    const nextId = order[nextIndex];
    if (nextId != null) {
      this.setActiveTab(nextId);
    }
  }

  goBack() {
    const tab = this.tabs.get(this.activeTabId);
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.goBack();
      tabLog('Go back', this.activeTabId);
    }
  }

  goForward() {
    const tab = this.tabs.get(this.activeTabId);
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.goForward();
      tabLog('Go forward', this.activeTabId);
    }
  }

  reload() {
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.view.webContents.reload();
      tabLog('Reload tab', this.activeTabId);
    }
  }

  reloadIgnoringCache() {
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.view.webContents.reloadIgnoringCache();
      tabLog('Hard reload tab', this.activeTabId);
    }
  }

  async saveActivePage() {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    const url = tab.url || wc.getURL();
    const defaultName = sanitizeFilename(tab.title || url || 'page');
    const defaultPath = app
      ? path.join(app.getPath('downloads'), `${defaultName}.html`)
      : `${defaultName}.html`;
    try {
      const result = await dialog.showSaveDialog(this.mainWindow, {
        defaultPath,
        filters: [
          { name: 'Web Page, Complete', extensions: ['html', 'htm'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result.canceled || !result.filePath) {
        return;
      }
      await wc.savePage(result.filePath, 'HTMLComplete');
      tabLog('Saved page', result.filePath);
    } catch (error) {
      log.warn('Failed to save page', error);
    }
  }

  viewSourceActive() {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    try {
      wc.viewSource();
    } catch (error) {
      log.warn('Failed to open view-source', error);
    }
  }

  goHome() {
    if (!DEFAULT_HOME) return;
    this.navigateActiveTab(DEFAULT_HOME);
  }

  detachTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      return;
    }

    const targetUrl = tab.url || DEFAULT_HOME;
    const wasActive = this.activeTabId === tabId;

    if (wasActive) {
      this.detachCurrentView();
    }

    const view = tab.view;
    const contents = view?.webContents;
    if (contents && !contents.isDestroyed()) {
      contents.removeAllListeners();
    }

    this.tabs.delete(tabId);

    if (this.tabs.size === 0) {
      this.createTab(DEFAULT_HOME);
    } else if (wasActive) {
      const fallbackTab = Array.from(this.tabs.values()).pop();
      this.setActiveTab(fallbackTab.id);
    } else {
      this.broadcastState();
    }

    if (view && typeof view.destroy === 'function') {
      view.destroy();
    }

    if (typeof this.launchDetachedWindow === 'function') {
      this.launchDetachedWindow(targetUrl);
    }
  }

  labelDevToolsInstance(targetWebContents, title = 'DevTools') {
    const devTools = targetWebContents?.devToolsWebContents;
    if (devTools && !devTools.isDestroyed()) {
      devTools.executeJavaScript(`document.title = ${JSON.stringify(title)};`).catch(() => {});
    }
  }

  openDevTools() {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) {
      return;
    }
    const { webContents } = tab.view;
    if (!webContents || webContents.isDestroyed()) {
      return;
    }
    if (!webContents.isDevToolsOpened()) {
      webContents.openDevTools({ mode: 'detach' });
      this.devToolsPinned = true;
      this.labelDevToolsInstance(webContents, 'Tab DevTools');
      tabLog('DevTools opened', this.activeTabId);
    }
  }

  toggleDevTools() {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) {
      return;
    }
    const { webContents } = tab.view;
    if (!webContents) {
      return;
    }
    if (webContents.isDevToolsOpened()) {
      webContents.closeDevTools();
      this.devToolsPinned = false;
      tabLog('DevTools closed', this.activeTabId);
    } else {
      webContents.openDevTools({ mode: 'detach' });
      this.devToolsPinned = true;
      this.labelDevToolsInstance(webContents, 'Tab DevTools');
      tabLog('DevTools opened', this.activeTabId);
    }
  }

  registerViewListeners(tab) {
    const { webContents } = tab.view;
    const updateFromView = () => this.broadcastState();
    const syncUrlFromWebContents = (maybeUrl) => {
      const nextUrl = maybeUrl || webContents.getURL?.() || '';
      if (nextUrl && nextUrl !== tab.url) {
        tab.url = nextUrl;
      }
      this.broadcastState();
    };
    const syncFaviconFromEvent = (favicons) => {
      if (!Array.isArray(favicons) || favicons.length === 0) return;
      const next = String(favicons[0] || '').trim();
      if (!next) return;
      if (next !== tab.faviconUrl) {
        tab.faviconUrl = next;
        this.broadcastState();
      }
    };

    const applyZoomLimits = () => {
      try {
        webContents.setVisualZoomLevelLimits(1, 5);
        webContents.setLayoutZoomLevelLimits(0, Infinity);
      } catch (_) {
        // best effort
      }
    };

    // Allow pinch-to-zoom via touchpad for better UX. Re-apply on navigation
    // because some pages reset zoom limits.
    applyZoomLimits();

    // Route any window.open / target="_blank" into a new tab instead of a popup window.
    if (webContents.setWindowOpenHandler) {
      webContents.setWindowOpenHandler(({ url }) => {
        if (url && /^https?:/i.test(url)) {
          this.createTab(url);
        }
        return { action: 'deny' };
      });
    }

    webContents.on('did-start-loading', updateFromView);
    webContents.on('did-stop-loading', () => {
      // Some navigations (notably search flows) can leave tab.url stale;
      // always sync from the authoritative webContents URL when loading stops.
      syncUrlFromWebContents();
      this.recordHistory(tab);
    });
    webContents.on('page-title-updated', (_, title) => {
      tab.title = title;
      this.broadcastState();
    });
    webContents.on('page-favicon-updated', (_event, favicons) => {
      syncFaviconFromEvent(favicons);
    });
    // Keep tab.url in sync for redirects and SPA navigations.
    webContents.on('will-navigate', (_event, url) => syncUrlFromWebContents(url));
    webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
      if (isMainFrame) {
        tab.faviconUrl = '';
        syncUrlFromWebContents(url);
      }
    });
    webContents.on('did-redirect-navigation', (_event, url) => syncUrlFromWebContents(url));
    webContents.on('did-navigate', (_, url) => {
      tab.url = url;
      tab.faviconUrl = '';
      applyZoomLimits();
      this.broadcastState();
    });
    webContents.on('did-navigate-in-page', (_, url) => {
      tab.url = url;
      applyZoomLimits();
      this.broadcastState();
    });
    webContents.on('dom-ready', () => syncUrlFromWebContents());
    webContents.on('did-fail-load', (_, __, ___, validatedURL) => {
      if (validatedURL) {
        syncUrlFromWebContents(validatedURL);
      }
    });
    webContents.on('context-menu', (event) => {
      event.preventDefault();
    });

    webContents.on('devtools-opened', () => {
      this.devToolsPinned = true;
      this.labelDevToolsInstance(webContents, 'Tab DevTools');
    });
    webContents.on('devtools-closed', () => {
      this.devToolsPinned = false;
    });

    // Allow core shortcuts (e.g., reopen closed tab) even when focus is inside the webview
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const ctrlOrCmd = process.platform === 'darwin' ? input.meta : input.control;
      // New tab (Ctrl/Cmd + T) — handled here so pages can't hijack the shortcut
      if (ctrlOrCmd && !input.shift && !input.alt && input.code === 'KeyT') {
        event.preventDefault();
        this.createTab(DEFAULT_HOME);
        return;
      }
      if (ctrlOrCmd && input.shift && !input.alt && input.code === 'KeyT') {
        event.preventDefault();
        this.reopenLastClosed();
      }
      // Close tab even when focus is in the webview (Ctrl/Cmd + W or Ctrl/Cmd + F4)
      if (ctrlOrCmd && !input.shift && !input.alt && (input.code === 'KeyW' || input.code === 'F4')) {
        event.preventDefault();
        this.destroyTab(tab.id);
      }
      // Downloads (Ctrl/Cmd + J) even when focus is inside the page
      if (ctrlOrCmd && !input.shift && !input.alt && input.code === 'KeyJ') {
        event.preventDefault();
        this.mainWindow?.webContents.send('shortcuts:open-downloads');
        return;
      }
      // Cycle tabs (Ctrl/Cmd + Tab / Ctrl/Cmd + Shift + Tab) even when focus is inside the page
      if (ctrlOrCmd && !input.alt && input.code === 'Tab') {
        event.preventDefault();
        const delta = input.shift ? -1 : 1;
        this.cycleTab(delta);
      }
    });

    const emitFullscreenChange = (enabled) => {
      if (typeof this.onHtmlFullscreenChange === 'function') {
        this.onHtmlFullscreenChange(enabled);
      }
    };
    webContents.on('enter-html-full-screen', () => emitFullscreenChange(true));
    webContents.on('leave-html-full-screen', () => emitFullscreenChange(false));
  }

  recordHistory(tab) {
    if (!tab || !tab.url || tab.url === 'about:blank') {
      return;
    }
    const title = tab.view.webContents.getTitle() || tab.title || tab.url;
    historyStore.addEntry({
      title,
      url: tab.url,
      timestamp: Date.now()
    });
    this.emitHistoryUpdate();
    tabLog('Recorded history', tab.url);
  }

  emitHistoryUpdate() {
    const entries = historyStore.getHistory();
    if (typeof this.onHistoryUpdate === 'function') {
      this.onHistoryUpdate(entries);
      return;
    }

    if (this.mainWindow) {
      this.mainWindow.webContents.send('history:update', entries);
    }
  }

  attachTabView(tab) {
    if (!this.mainWindow) {
      return;
    }

    // Add the tab's WebContentsView to the main window's content view
    this.mainWindow.contentView.addChildView(tab.view);
    this.resizeActiveView();

    // Avoid stealing focus when the tab is blank so typing can go to the address bar.
    if (tab.url && tab.url !== 'about:blank') {
      tab.view.webContents.focus();
    }
  }

  detachCurrentView() {
    if (!this.mainWindow) {
      return;
    }
    
    const activeTab = this.tabs.get(this.activeTabId);
    if (activeTab && activeTab.view) {
      this.mainWindow.contentView.removeChildView(activeTab.view);
    }
  }

  broadcastState() {
    if (!this.onStateChange) {
      return;
    }

    const tabsPayload = Array.from(this.tabs.values())
      .map((tab) => {
        if (!tab) return null;
        const wc = tab.view?.webContents;
        return {
          id: tab.id,
          title: tab.title || 'New Tab',
          url: tab.url || wc?.getURL?.() || '',
          faviconUrl: tab.faviconUrl || '',
          isLoading: !!wc?.isLoading?.(),
          isPinned: !!tab.isPinned
        };
      })
      .filter(Boolean);

    const activeTab = this.tabs.get(this.activeTabId);
    const navigation = activeTab
      ? {
          url: activeTab.url || activeTab.view?.webContents?.getURL?.() || '',
          canGoBack: activeTab.view.webContents.navigationHistory.canGoBack(),
          canGoForward: activeTab.view.webContents.navigationHistory.canGoForward()
        }
      : { url: '', canGoBack: false, canGoForward: false };

    this.onStateChange({
      tabs: tabsPayload,
      activeTabId: this.activeTabId,
      navigation
    });
  }

  setPinned(tabId, pinned = true) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    tab.isPinned = !!pinned;
    tabLog('Set pin', tabId, '->', tab.isPinned);
    this.broadcastState();
  }

  togglePin(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    tab.isPinned = !tab.isPinned;
    tabLog('Toggled pin', tabId, '->', tab.isPinned);
    this.broadcastState();
  }

  closeOtherTabs(tabId) {
    if (!this.tabs.has(tabId)) return;

    const idsToClose = [];
    for (const [id, t] of this.tabs.entries()) {
      if (id !== tabId && !t.isPinned) {
        idsToClose.push(id);
      }
    }
    idsToClose.forEach((id) => this.destroyTab(id));

    if (this.tabs.has(tabId)) {
      this.setActiveTab(tabId);
    } else if (this.tabs.size) {
      this.setActiveTab(Array.from(this.tabs.values())[0].id);
    }
  }

  closeTabsToRight(tabId) {
    const order = this.getTabOrder();
    const idx = order.indexOf(tabId);
    if (idx === -1) return;

    const idsToRight = order.slice(idx + 1);
    idsToRight.forEach((id) => {
      const t = this.tabs.get(id);
      if (t && !t.isPinned) {
        this.destroyTab(id);
      }
    });

    if (this.tabs.has(tabId)) {
      this.setActiveTab(tabId);
    } else if (this.tabs.size) {
      this.setActiveTab(Array.from(this.tabs.values())[0].id);
    }
  }

  printActive() {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    wc.print({ printBackground: true }, () => {});
  }

  getActiveZoom() {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return 1;
    return wc.getZoomFactor();
  }

  setActiveZoom(factor) {
    const tab = this.tabs.get(this.activeTabId);
    const wc = tab?.view?.webContents;
    if (!wc || wc.isDestroyed()) return;
    const clamped = Math.max(0, Math.min(5, factor));
    wc.setZoomFactor(clamped);
    this.currentZoom = clamped;
    this.emitZoomFactor(clamped);
  }

  nudgeActiveZoom(direction = 1) {
    const current = this.getActiveZoom();
    const next = current + 0.1 * (direction >= 0 ? 1 : -1);
    this.setActiveZoom(next);
  }

  moveTab(tabId, beforeTabId) {
    const dragged = this.tabs.get(tabId);
    if (!dragged) return;
    if (beforeTabId === tabId) return;

    const target = beforeTabId ? this.tabs.get(beforeTabId) : null;
    // Do not mix pinned/unpinned groups
    if (target && dragged.isPinned !== target.isPinned) return;

    const pinnedOrder = [];
    const unpinnedOrder = [];
    for (const id of this.tabs.keys()) {
      const t = this.tabs.get(id);
      if (!t) continue;
      if (t.isPinned) pinnedOrder.push(id);
      else unpinnedOrder.push(id);
    }

    const reorderWithin = (list, moveId, beforeId) => {
      const from = list.indexOf(moveId);
      if (from === -1) return list;
      list.splice(from, 1);
      if (beforeId && list.includes(beforeId)) {
        const idx = list.indexOf(beforeId);
        list.splice(idx, 0, moveId);
      } else {
        list.push(moveId);
      }
      return list;
    };

    if (dragged.isPinned) {
      reorderWithin(pinnedOrder, tabId, beforeTabId);
    } else {
      reorderWithin(unpinnedOrder, tabId, beforeTabId);
    }

    const merged = [...pinnedOrder, ...unpinnedOrder];
    const newTabs = new Map();
    merged.forEach((id) => {
      const t = this.tabs.get(id);
      if (t) newTabs.set(id, t);
    });
    this.tabs = newTabs;
    if (!this.tabs.has(this.activeTabId) && this.tabs.size) {
      this.activeTabId = Array.from(this.tabs.keys())[0];
    }
    this.broadcastState();
  }

  resetZoom() {
    this.setActiveZoom(1);
  }

  emitZoomFactor(value) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    const payload = typeof value === 'number' ? value : this.currentZoom;
    this.mainWindow.webContents.send('tabs:zoom-factor', { factor: payload });
  }

  getTabIdByIndex(index) {
    const order = this.getTabOrder();
    if (!order.length) return null;
    const clamped = clampIndex(index, order.length - 1);
    return order[clamped] ?? null;
  }

  getLastTabId() {
    const order = this.getTabOrder();
    if (!order.length) return null;
    return order[order.length - 1];
  }

  activateNextTab() {
    const order = this.getTabOrder();
    if (!order.length) return;
    const currentIndex = order.indexOf(this.activeTabId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    this.setActiveTab(order[nextIndex]);
  }

  activatePreviousTab() {
    const order = this.getTabOrder();
    if (!order.length) return;
    const currentIndex = order.indexOf(this.activeTabId);
    const prevIndex =
      currentIndex === -1 ? 0 : (currentIndex - 1 + order.length) % order.length;
    this.setActiveTab(order[prevIndex]);
  }

  rememberClosedTab(tab) {
    if (!tab) return;
    let url = tab.url || tab.view?.webContents?.getURL?.() || '';
    if (!url || url === 'about:blank') {
      url = DEFAULT_HOME;
    }
    const title = tab.title || (url === DEFAULT_HOME ? 'New Tab' : url);
    this.closedTabs.unshift({ url, title });
    if (this.closedTabs.length > CLOSED_TAB_STACK_LIMIT) {
      this.closedTabs.pop();
    }
  }

  reopenLastClosed() {
    if (!this.closedTabs.length) {
      return null;
    }
    const payload = this.closedTabs.shift();
    if (!payload?.url) {
      return null;
    }
    const tabId = this.createTab(payload.url);
    const tab = this.tabs.get(tabId);
    if (tab && payload.title) {
      tab.title = payload.title;
      this.broadcastState();
    }
    return tabId;
  }
}

module.exports = TabManager;
