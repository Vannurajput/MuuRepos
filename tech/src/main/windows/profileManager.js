const { BrowserWindow, app } = require('electron');
const path = require('path');

const PROFILE_WINDOW_SIZE = { width: 280, height: 200 };

function createProfileController({ getMainWindow, ipcMain, log }) {
    let profileWindow = null;

    const ensureProfileWindow = () => {
        if (profileWindow && !profileWindow.isDestroyed()) return profileWindow;

        const parent = getMainWindow?.();
        profileWindow = new BrowserWindow({
            width: PROFILE_WINDOW_SIZE.width,
            height: PROFILE_WINDOW_SIZE.height,
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

        profileWindow.setMenuBarVisibility(false);
        profileWindow.loadFile(path.join(__dirname, '../../renderer/profile/popup.html'));

        profileWindow.webContents.on('context-menu', (e) => e.preventDefault());

        // Hide when clicking outside
        profileWindow.on('blur', () => {
            if (profileWindow && !profileWindow.isDestroyed()) {
                profileWindow.hide();
            }
        });

        profileWindow.on('closed', () => {
            profileWindow = null;
        });

        return profileWindow;
    };

    const toggleProfileWindow = (bounds = {}) => {
        const win = ensureProfileWindow();
        const mainWindow = getMainWindow?.();
        if (!win || !mainWindow) return;

        if (win.isVisible()) {
            win.hide();
            return;
        }

        const windowContentBounds = mainWindow.getContentBounds();
        const contentX = windowContentBounds.x;
        const contentY = windowContentBounds.y;
        const contentWidth = windowContentBounds.width;

        const { x = 0, y = 0, width = 40 } = bounds;

        // Position calculation to align with the button (similar to downloads)
        const desiredX = contentX + x - PROFILE_WINDOW_SIZE.width + width;
        const minX = contentX + 8;
        const maxX = contentX + contentWidth - PROFILE_WINDOW_SIZE.width - 8;
        const clampedX = Math.max(minX, Math.min(desiredX, maxX));
        const clampedY = contentY + y;

        win.setBounds({
            width: PROFILE_WINDOW_SIZE.width,
            height: PROFILE_WINDOW_SIZE.height,
            x: Math.round(clampedX),
            y: Math.round(clampedY)
        });

        win.show();
        win.focus();
        log?.('Profile popup shown');
    };

    const registerIpcHandlers = () => {
        if (!ipcMain) return;

        ipcMain.handle('profile:toggle-popup', (_e, bounds) => toggleProfileWindow(bounds));
        ipcMain.handle('profile:hide', () => {
            if (profileWindow && !profileWindow.isDestroyed()) {
                profileWindow.hide();
            }
        });

        ipcMain.handle('profile:get-data', () => {
            // In a real app, this would come from a store or main process state
            // For now, it will be handled by renderer localStorage or similar
            return {};
        });
    };

    const destroy = () => {
        if (profileWindow && !profileWindow.isDestroyed()) {
            profileWindow.close();
        }
        profileWindow = null;
    };

    return {
        ensureProfileWindow,
        toggleProfileWindow,
        registerIpcHandlers,
        destroy,
        getWindow: () => profileWindow
    };
}

module.exports = {
    createProfileController
};
