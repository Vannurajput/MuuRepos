const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { PermissionError, StorageError } = require('./errors');
const { getSchedulerPaths } = require('./paths');

const appendLog = async (app, entry = {}) => {
  const { logsPath } = getSchedulerPaths(app);
  const line = JSON.stringify({
    ts: entry.ts || Date.now(),
    level: entry.level || 'info',
    jobId: entry.jobId || null,
    message: entry.message || '',
    status: entry.status || null,
    detail: entry.detail || null
  });
  try {
    await fsp.appendFile(logsPath, `${line}${require('os').EOL}`, 'utf-8');
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      throw new PermissionError(logsPath);
    }
    throw new StorageError('append-log', logsPath, err);
  }
};

const readLogs = async (app, limit = 200) => {
  const { logsPath } = getSchedulerPaths(app);
  try {
    const raw = await fsp.readFile(logsPath, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, limit));
    return lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      throw new PermissionError(logsPath);
    }
    throw new StorageError('read-logs', logsPath, err);
  }
};

const rotateLogsIfNeeded = async (app, maxBytes = 1024 * 1024) => {
  const { logsPath } = getSchedulerPaths(app);
  try {
    const stat = await fsp.stat(logsPath);
    if (stat.size < maxBytes) return;
    const backup = path.join(path.dirname(logsPath), `scheduler-${Date.now()}.log.bak`);
    await fsp.rename(logsPath, backup);
  } catch {
    // ignore rotation errors
  }
};

module.exports = {
  appendLog,
  readLogs,
  rotateLogsIfNeeded
};
