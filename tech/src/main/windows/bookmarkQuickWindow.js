const { BrowserWindow } = require('electron');
const path = require('path');
const bookmarkStore = require('../bookmarkStore');

const QUICK_WINDOW_SIZE = { width: 300, height: 320 };

function createBookmarkQuickController(getMainWindow) {
  let quickWindow = null;
  let lastContext = {};

  const ensureQuickWindow = () => {
    if (quickWindow && !quickWindow.isDestroyed()) {
      return quickWindow;
    }

    const parent = getMainWindow?.();
    quickWindow = new BrowserWindow({
      width: QUICK_WINDOW_SIZE.width,
      height: QUICK_WINDOW_SIZE.height,
      frame: false,
      resizable: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      parent: parent || undefined,
      skipTaskbar: true,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    quickWindow.setMenuBarVisibility(false);
    quickWindow.loadFile(path.join(__dirname, '../../renderer/bookmarks/quick.html'));
    quickWindow.webContents.on('context-menu', (event) => event.preventDefault());
    quickWindow.on('blur', () => quickWindow && !quickWindow.isDestroyed() && quickWindow.hide());
    quickWindow.on('closed', () => {
      quickWindow = null;
    });

    quickWindow.webContents.once('did-finish-load', () => {
      quickWindow?.webContents.send('bookmarks:update', bookmarkStore.getAll());
      quickWindow?.webContents.send('bookmark-quick:context', lastContext);
    });

    return quickWindow;
  };

  const positionWindow = (target, bounds = {}) => {
    const mainWindow = getMainWindow?.();
    if (!target || !mainWindow) return;
    const windowContentBounds = mainWindow.getContentBounds();
    const contentX = windowContentBounds.x;
    const contentY = windowContentBounds.y;
    const contentWidth = windowContentBounds.width;
    const { x = 0, y = 0, width = 40 } = bounds;

    const desiredX = contentX + x - QUICK_WINDOW_SIZE.width + width;
    const minX = contentX + 8;
    const maxX = contentX + contentWidth - QUICK_WINDOW_SIZE.width - 8;
    const clampedX = Math.max(minX, Math.min(desiredX, maxX));
    const clampedY = contentY + y;

    target.setBounds({
      width: QUICK_WINDOW_SIZE.width,
      height: QUICK_WINDOW_SIZE.height,
      x: Math.round(clampedX),
      y: Math.round(clampedY)
    });
  };

  const toggleQuickWindow = (bounds = {}, context = {}) => {
    const win = ensureQuickWindow();
    const mainWindow = getMainWindow?.();
    if (!win || !mainWindow) return;

    if (win.isVisible()) {
      win.hide();
      return;
    }

    positionWindow(win, bounds);
    lastContext = context || {};
    win.webContents.send('bookmarks:update', bookmarkStore.getAll());
    win.webContents.send('bookmark-quick:context', lastContext);
    win.show();
    win.focus();
  };

  const closeQuickWindow = () => {
    if (quickWindow && !quickWindow.isDestroyed()) {
      quickWindow.hide();
    }
  };

  const broadcastBookmarks = (entries) => {
    quickWindow?.webContents.send('bookmarks:update', entries);
  };

  const sendContext = (context = {}) => {
    lastContext = context;
    quickWindow?.webContents.send('bookmark-quick:context', lastContext);
  };

  const destroy = () => {
    if (quickWindow && !quickWindow.isDestroyed()) {
      quickWindow.close();
    }
    quickWindow = null;
  };

  return {
    toggleQuickWindow,
    closeQuickWindow,
    broadcastBookmarks,
    sendContext,
    destroy,
    getWindow: () => quickWindow
  };
}

module.exports = {
  createBookmarkQuickController
};
