// src/logger.js
const electronLog = require('electron-log');

// Configure transports only once, in main process
if (process.type === 'browser') {
  const { app } = require('electron');
  const fs = require('fs');
  const isDev = !app.isPackaged;

  // Console always shows everything while developing
  electronLog.transports.console.level = 'debug';

  // File logs: write version to a dedicated file, then log normally to main.log
  const path = require('path');
  const versionFile = path.join(app.getPath('userData'), 'logs', 'version_conflict.config');
  try {
    fs.writeFileSync(versionFile, String(app.getVersion()), 'utf-8');
  } catch (_) {
    // ignore write errors
  }
  // Configure main log file
  electronLog.transports.file.level = isDev ? 'debug' : 'info';
  electronLog.transports.file.fileName = 'main.config';
  console.log('[Logger] Version file path:', versionFile);
}

/**
 * Wrapper function so you can call log('message')
 * We forward this to electronLog.info(...)
 */
function log(...args) {
  electronLog.info(...args);
}

// Copy methods so you can still use log.debug, log.error, etc.
log.debug = electronLog.debug.bind(electronLog);
log.info = electronLog.info.bind(electronLog);
log.warn = electronLog.warn.bind(electronLog);
log.error = electronLog.error.bind(electronLog);
log.transports = electronLog.transports;

module.exports = log;
