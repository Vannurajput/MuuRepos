const { BrowserWindow } = require('electron');
const path = require('path');

const WINDOW_SIZE = { width: 300, height: 128 };
const OFFSET_Y = 8;
const OFFSET_X = 8;

function createSecurityPopoverController(getMainWindow) {
  let win = null;
  let lastPayload = null;

  const notifyClosed = () => {
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('security:closed');
    }
  };

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
        contextIsolation: false,
        nodeIntegration: true
      }
    });

    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, '../../renderer/security/index.html'));
    win.webContents.on('context-menu', (e) => e.preventDefault());
    win.on('blur', () => {
      hide();
    });

    win.webContents.once('did-finish-load', () => {
      if (lastPayload) {
        win.webContents.send('security:update', lastPayload);
      }
    });

    win.on('closed', () => {
      win = null;
    });

    return win;
  };

  const show = (bounds = {}, payload = {}) => {
    const target = ensureWindow();
    const mainWindow = getMainWindow?.();
    if (!target || !mainWindow) return;

    const mainBounds = mainWindow.getContentBounds();
    const { x = 0, y = 0, width = 0, height = 0 } = bounds;

    const desiredWidth = WINDOW_SIZE.width;
    const desiredHeight = WINDOW_SIZE.height;
    const desiredX = mainBounds.x + x - OFFSET_X;
    const desiredY = mainBounds.y + y + height + OFFSET_Y;

    const clampedX = Math.round(
      Math.max(mainBounds.x, Math.min(desiredX, mainBounds.x + mainBounds.width - desiredWidth))
    );
    const clampedY = Math.round(
      Math.max(mainBounds.y, Math.min(desiredY, mainBounds.y + mainBounds.height - desiredHeight))
    );

    target.setBounds({
      width: desiredWidth,
      height: desiredHeight,
      x: clampedX,
      y: clampedY
    });

    lastPayload = payload;
    target.webContents.send('security:update', payload);
    target.show();
  };

  const update = (payload = {}) => {
    lastPayload = payload;
    if (win && !win.isDestroyed()) {
      win.webContents.send('security:update', payload);
    }
  };

  const hide = () => {
    if (win && !win.isDestroyed()) {
      win.hide();
      notifyClosed();
    }
  };

  const destroy = () => {
    if (win && !win.isDestroyed()) {
      win.close();
    }
    win = null;
  };

  return {
    show,
    update,
    hide,
    destroy,
    getWindow: () => win
  };
}

module.exports = {
  createSecurityPopoverController
};
