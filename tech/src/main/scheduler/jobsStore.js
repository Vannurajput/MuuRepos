const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { getSchedulerPaths } = require('./paths');
const { computeNextRun } = require('./schedule');
const { PermissionError, StorageError, JobNotFoundError, ValidationError } = require('./errors');

const parseJsonSafe = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readJobs = async (app) => {
  const { jobsPath } = getSchedulerPaths(app);
  try {
    const raw = await fsp.readFile(jobsPath, 'utf-8');
    const parsed = parseJsonSafe(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      throw new PermissionError(jobsPath);
    }
    throw new StorageError('read', jobsPath, err);
  }
  return [];
};

const atomicWrite = async (targetPath, data) => {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(dir, `.tmp-${Date.now()}-${path.basename(targetPath)}`);

  try {
    await fsp.writeFile(tmpPath, data, 'utf-8');
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      throw new PermissionError(dir);
    }
    throw new StorageError('write-temp', tmpPath, err);
  }

  try {
    await fsp.rename(tmpPath, targetPath);
  } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      // Fallback: write directly if rename is blocked (e.g., AV/permissions)
      try {
        await fsp.writeFile(targetPath, data, 'utf-8');
        try {
          await fsp.unlink(tmpPath);
        } catch {
          // best effort cleanup
        }
      } catch (writeErr) {
        if (writeErr.code === 'EPERM' || writeErr.code === 'EACCES') {
          throw new PermissionError(targetPath);
        }
        throw new StorageError('write-direct', targetPath, writeErr);
      }
    } else {
      throw new StorageError('rename', targetPath, err);
    }
  }
};

const writeJobs = async (app, jobs) => {
  const { jobsPath } = getSchedulerPaths(app);
  await atomicWrite(jobsPath, JSON.stringify(jobs || [], null, 2));
};

const normalizeJob = (job = {}) => {
  const now = Date.now();
  const id = job.id || randomUUID();
  const everyMinutes = Number(job?.schedule?.everyMinutes || job?.everyMinutes || 5);
  const cron = String(job?.schedule?.cron || job?.cron || '').trim();
  const enabled = job.enabled !== false;
  const schedule = { everyMinutes: everyMinutes > 0 ? everyMinutes : 5, cron };
  const normalized = {
    id,
    name: String(job.name || '').trim() || `Job ${id.slice(0, 6)}`,
    type: String(job.type || '').trim() || 'noop',
    schedule,
    payload: job.payload || {},
    enabled,
    createdAt: job.createdAt || now,
    nextRunAt: job.nextRunAt || null,
    lastRun: job.lastRun || null,
    meta: job.meta || {}
  };
  normalized.nextRunAt = normalized.nextRunAt || computeNextRun(normalized, now);
  return normalized;
};

const upsertJob = async (app, job) => {
  const jobs = await readJobs(app);
  const normalized = normalizeJob(job);
  const idx = jobs.findIndex((j) => j.id === normalized.id);
  if (idx === -1) {
    jobs.push(normalized);
  } else {
    jobs[idx] = { ...jobs[idx], ...normalized };
  }
  await writeJobs(app, jobs);
  return normalized;
};

const deleteJob = async (app, jobId) => {
  const jobs = await readJobs(app);
  const filtered = jobs.filter((job) => job.id !== jobId);
  await writeJobs(app, filtered);
  return filtered;
};

const setNextRun = async (app, jobId, nextRunAt) => {
  const jobs = await readJobs(app);
  const idx = jobs.findIndex((job) => job.id === jobId);
  if (idx === -1) {
    throw new JobNotFoundError(jobId);
  }
  jobs[idx].nextRunAt = nextRunAt;
  jobs[idx].meta = { ...(jobs[idx].meta || {}), requestedAt: Date.now() };
  await writeJobs(app, jobs);
  return jobs;
};

module.exports = {
  readJobs,
  writeJobs,
  upsertJob,
  deleteJob,
  setNextRun,
  normalizeJob
};
