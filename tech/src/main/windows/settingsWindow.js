const { BrowserWindow } = require('electron');
const path = require('path');

const SETTINGS_WINDOW_SIZE = { width: 360, height: 540 };
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 720;

function createSettingsController(getMainWindow) {
  let settingsWindow = null;

  const ensureSettingsWindow = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      return settingsWindow;
    }

    const parent = getMainWindow?.();
    settingsWindow = new BrowserWindow({
      width: SETTINGS_WINDOW_SIZE.width,
      height: SETTINGS_WINDOW_SIZE.height,
      frame: false,
      resizable: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      focusable: true,
      parent: parent || undefined,
      skipTaskbar: true,
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    settingsWindow.setMenuBarVisibility(false);
    settingsWindow.loadFile(path.join(__dirname, '../../renderer/settings/index.html'));
    settingsWindow.on('blur', () => {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused === settingsWindow) {
        return; // still within the popup
      }
      if (settingsWindow && settingsWindow.isVisible()) {
        settingsWindow.hide();
      }
    });
    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });

    return settingsWindow;
  };

  const toggleSettingsWindow = (bounds = {}) => {
    const target = ensureSettingsWindow();
    const mainWindow = getMainWindow?.();
    if (!target || !mainWindow) {
      return;
    }

    if (target.isVisible()) {
      target.hide();
      return;
    }

    const windowContentBounds = mainWindow.getContentBounds();
    const contentX = windowContentBounds.x;
    const contentY = windowContentBounds.y;
    const contentWidth = windowContentBounds.width;
    const { x = 0, y = 0 } = bounds;
    const currentHeight = target.getBounds().height || SETTINGS_WINDOW_SIZE.height;

    const desiredX = contentX + x - SETTINGS_WINDOW_SIZE.width + (bounds.width || 0);
    const minX = contentX + 8;
    const maxX = contentX + contentWidth - SETTINGS_WINDOW_SIZE.width - 8;
    const clampedX = Math.max(minX, Math.min(desiredX, maxX));

    target.setBounds({
      width: SETTINGS_WINDOW_SIZE.width,
      height: currentHeight,
      x: Math.round(clampedX),
      y: Math.round(contentY + y)
    });

    target.show();
    target.focus();
  };

  const closeSettingsWindow = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.hide();
    }
  };

  const resizeSettingsWindow = (height) => {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      return;
    }
    const nextHeight = Math.round(
      Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(height) || SETTINGS_WINDOW_SIZE.height))
    );
    const bounds = settingsWindow.getBounds();
    if (bounds.height === nextHeight) {
      return;
    }
    settingsWindow.setBounds({
      width: SETTINGS_WINDOW_SIZE.width,
      height: nextHeight,
      x: bounds.x,
      y: bounds.y
    });
  };

  const destroy = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    settingsWindow = null;
  };

  return {
    toggleSettingsWindow,
    closeSettingsWindow,
    resizeSettingsWindow,
    destroy,
    getWindow: () => settingsWindow
  };
}

module.exports = {
  createSettingsController
};
