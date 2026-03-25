const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR_NAME = 'MuBrowser';

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // best-effort; failures will surface on file writes
  }
};

const isDirWritable = (dir) => {
  try {
    const testFile = path.join(dir, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
};

const getBaseDataDir = (app) => {
  const programData = process.env.PROGRAMDATA || process.env.ProgramData;
  if (programData) {
    const pdPath = path.join(programData, DATA_DIR_NAME);
    // Best practice: if ProgramData exists but isn't writable by current user (and isn't the service),
    // we might want to fallback or warn. For now, we stay linked to ProgramData but check.
    return pdPath;
  }
  if (app?.getPath) {
    try {
      return path.join(app.getPath('userData'), 'scheduler');
    } catch {
      // fall through
    }
  }
  return path.join(os.homedir(), DATA_DIR_NAME);
};

const getSchedulerPaths = (app) => {
  const dataDir = getBaseDataDir(app);
  ensureDir(dataDir);

  // Inno Setup script uses a specific folder for logs in ProgramData
  const programData = process.env.PROGRAMDATA || process.env.ProgramData;
  let logsPath;

  if (programData) {
    const logDir = path.join(programData, 'MuBrowserScheduler');
    ensureDir(logDir);
    logsPath = path.join(logDir, 'scheduler.log');
  } else {
    logsPath = path.join(dataDir, 'scheduler.log');
  }

  const jobsPath = path.join(dataDir, 'jobs.json');
  return { dataDir, jobsPath, logsPath };
};

module.exports = {
  getSchedulerPaths
};
