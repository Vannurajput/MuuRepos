const { BrowserWindow } = require('electron');
const path = require('path');

const WINDOW_SIZE = { width: 360, height: 260 };

function createCredentialManagerController(getMainWindow) {
  let managerWindow = null;

  const requestRefresh = () => {
    if (managerWindow && !managerWindow.isDestroyed()) {
      managerWindow.webContents.send('credential-manager:refresh');
    }
  };

  const ensureWindow = () => {
    if (managerWindow && !managerWindow.isDestroyed()) {
      return managerWindow;
    }

    const parent = getMainWindow?.();
    managerWindow = new BrowserWindow({
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
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

    managerWindow.setMenuBarVisibility(false);
    managerWindow.loadFile(path.join(__dirname, '../../renderer/credentialManager/index.html'));
    managerWindow.webContents.once('did-finish-load', () => requestRefresh());
    managerWindow.on('blur', () => {
      if (managerWindow && managerWindow.isVisible()) {
        managerWindow.hide();
      }
    });
    managerWindow.on('closed', () => {
      managerWindow = null;
    });

    return managerWindow;
  };

  const toggleWindow = (bounds = {}) => {
    const target = ensureWindow();
    const mainWindow = getMainWindow?.();
    if (!target || !mainWindow) {
      return;
    }

    if (target.isVisible()) {
      target.hide();
      return;
    }

    const mainBounds = mainWindow.getContentBounds();
    const fallbackX = mainBounds.x + mainBounds.width - WINDOW_SIZE.width - 24;
    const fallbackY = mainBounds.y + 40;
    const { x = fallbackX, y = fallbackY } = bounds || {};

    const desiredX = (typeof x === 'number' ? x : fallbackX) - WINDOW_SIZE.width - 12;
    const desiredY = typeof y === 'number' ? y : fallbackY;

    target.setBounds({
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
      x: Math.round(desiredX),
      y: Math.round(desiredY)
    });

    target.show();
    target.focus();
    requestRefresh();
  };

  const closeWindow = () => {
    if (managerWindow && !managerWindow.isDestroyed()) {
      managerWindow.hide();
    }
  };

  const destroy = () => {
    if (managerWindow && !managerWindow.isDestroyed()) {
      managerWindow.close();
    }
    managerWindow = null;
  };

  return {
    toggleWindow,
    closeWindow,
    destroy,
    getWindow: () => managerWindow
  };
}

module.exports = {
  createCredentialManagerController
};
