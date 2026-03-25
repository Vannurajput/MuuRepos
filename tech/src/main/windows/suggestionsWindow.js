const { BrowserWindow } = require('electron');
const path = require('path');

const WINDOW_SIZE = { width: 600, height: 320 };
const MIN_WIDTH = 0;
const MAX_HEIGHT = 260;
const ROW_HEIGHT = 38; // tighter rows to avoid scroll
const VERTICAL_PADDING = 12;
const HORIZONTAL_PADDING = 12;
const LIST_VERTICAL_PADDING = 12; // matches CSS padding so border isn't clipped
const BORDER_FUDGE = 2; // extra pixels to avoid clipping on right edge

function createSuggestionsWindowController(getMainWindow) {
  let win = null;
  let lastPayload = null;

  const ensureWindow = () => {
    if (win && !win.isDestroyed()) return win;
    const parent = getMainWindow?.();
    win = new BrowserWindow({
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
      frame: false,
      resizable: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      parent: parent || undefined,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        // Keep this isolated to the popup; allow require for IPC in the popup renderer
        contextIsolation: false,
        nodeIntegration: true
      }
    });

    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, '../../renderer/suggestions/index.html'));
    win.webContents.on('context-menu', (e) => e.preventDefault());
    // Keep popup visible while navigating suggestions with keys.
    win.on('closed', () => {
      win = null;
    });

    win.webContents.once('did-finish-load', () => {
      if (lastPayload) {
        win.webContents.send('suggestions:update', lastPayload);
      }
    });

    return win;
  };

  const toggleWindow = (bounds = {}, payload = {}) => {
    const target = ensureWindow();
    const mainWindow = getMainWindow?.();
    if (!target || !mainWindow) return;

    const mainBounds = mainWindow.getContentBounds();
    const { x = 0, y = 0, width = 200, height = 0 } = bounds;
    // Shift left by padding, but never beyond the content area
    const desiredX = mainBounds.x + x - HORIZONTAL_PADDING;
    const desiredY = mainBounds.y + y + height;

    const rows = Array.isArray(payload?.items) ? payload.items.length : 0;
    const desiredHeight = Math.min(
      MAX_HEIGHT,
      Math.max(rows * ROW_HEIGHT + VERTICAL_PADDING + LIST_VERTICAL_PADDING * 2, VERTICAL_PADDING)
    );
    const desiredWidth = Math.max(
      MIN_WIDTH,
      Math.round((width || WINDOW_SIZE.width) + HORIZONTAL_PADDING * 2 + BORDER_FUDGE)
    );

    target.setBounds({
      width: desiredWidth,
      height: desiredHeight,
      // Clamp within the visible content area so the right border is not clipped
      x: Math.round(
        Math.max(
          mainBounds.x,
          Math.min(desiredX, mainBounds.x + mainBounds.width - desiredWidth)
        )
      ),
      y: Math.round(desiredY)
    });

    lastPayload = payload;
    target.webContents.send('suggestions:update', payload);
    target.showInactive();
  };

  const hide = () => {
    if (win && !win.isDestroyed()) win.hide();
  };

  const update = (payload = {}) => {
    lastPayload = payload;
    if (win && !win.isDestroyed()) {
      win.webContents.send('suggestions:update', payload);
    }
  };

  const destroy = () => {
    if (win && !win.isDestroyed()) {
      win.close();
    }
    win = null;
  };

  return {
    toggleWindow,
    hide,
    update,
    getWindow: () => win,
    destroy
  };
}

module.exports = {
  createSuggestionsWindowController
};
