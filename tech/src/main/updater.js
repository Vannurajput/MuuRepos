const { autoUpdater } = require('electron-updater');
const log = require('../logger');

const status = (mainWindow, payload) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:status', payload);
    }
  } catch (err) {
    log.warn('[Updater] failed to send status', err);
  }
};

const initUpdater = (mainWindow) => {
  if (!mainWindow) return;

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => status(mainWindow, { state: 'checking' }));
  autoUpdater.on('update-available', (info) => status(mainWindow, { state: 'available', info }));
  autoUpdater.on('update-not-available', () => status(mainWindow, { state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => {
    status(mainWindow, {
      state: 'downloading',
      percent: Math.round(progress.percent || 0),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => status(mainWindow, { state: 'downloaded', info }));
  autoUpdater.on('error', (error) =>
    status(mainWindow, { state: 'error', message: error?.message || String(error) })
  );

  return autoUpdater;
};

module.exports = { initUpdater, autoUpdater };
