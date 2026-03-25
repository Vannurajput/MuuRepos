/**
 * Scheduler service entrypoint.
 * This version is service-aware enough for SCM: it responds to stop signals,
 * keeps a heartbeat alive, and emits start/stop/error events to Event Viewer
 * via the built-in `eventcreate` tool (no extra deps).
 */

const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { startSchedulerService } = require('../src/main/scheduler/serviceEngine');

// Minimal app-like object to satisfy scheduler code (getPath only)
const fakeApp = {
  getPath(name) {
    if (name === 'userData') return path.join(os.homedir(), 'AppData', 'Roaming', 'muulbrowser');
    if (name === 'appData') return path.join(os.homedir(), 'AppData', 'Roaming');
    if (name === 'temp') return os.tmpdir();
    return process.cwd();
  }
};

const emitEvent = (type, message) => {
  // type: INFO | WARNING | ERROR
  spawn(
    'eventcreate',
    ['/l', 'Application', '/so', 'MuBrowserScheduler', '/t', type, '/id', '1001', '/d', message],
    { stdio: 'ignore' }
  );
};

let serviceTimer = null;

const stopService = () => {
  if (serviceTimer) {
    clearInterval(serviceTimer);
    serviceTimer = null;
  }
  emitEvent('INFO', 'Scheduler service stopping');
  process.exit(0);
};

(async () => {
  try {
    emitEvent('INFO', 'Scheduler service starting');
    serviceTimer = await startSchedulerService({ app: fakeApp, log: console.log });

    // Keep process alive with a ref'ed interval so SCM sees it running.
    setInterval(() => {}, 60 * 60 * 1000);

    // Handle stop signals from SCM
    process.on('SIGINT', stopService);
    process.on('SIGTERM', stopService);
  } catch (err) {
    emitEvent('ERROR', `Scheduler failed to start: ${err?.message || err}`);
    console.error('[SchedulerService] failed to start', err);
    process.exit(1);
  }
})();
