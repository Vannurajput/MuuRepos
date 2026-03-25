const { runJob } = require('./jobRunnerFactory');
const { readJobs, writeJobs, normalizeJob } = require('./jobsStore');
const { appendLog, rotateLogsIfNeeded } = require('./logStore');
const { computeNextRun } = require('./schedule');
const { execFile } = require('child_process');

const isServiceRunning = (serviceName = 'MuBrowserScheduler') =>
  new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve(true);
    }
    execFile('sc.exe', ['query', serviceName], { windowsHide: true }, (err, stdout = '') => {
      if (err) return resolve(false);
      resolve(/STATE\s*:\s*4\s+RUNNING/i.test(stdout));
    });
  });

const stampRun = (job, patch) => ({
  ...job,
  lastRun: {
    ...(job.lastRun || {}),
    ...patch
  }
});

const startSchedulerService = async ({
  app,
  log = console.log,
  tickMs = 15_000,
  serviceName = 'MuBrowserScheduler',
  requireServiceRunning = true
}) => {
  await rotateLogsIfNeeded(app);
  log('[Scheduler] service loop starting');

  const processTick = async () => {
    if (requireServiceRunning) {
      const running = await isServiceRunning(serviceName);
      if (!running) {
        log?.debug?.('[Scheduler] service not running; skipping tick');
        return;
      }
    }

    const now = Date.now();
    const jobs = (await readJobs(app)).map((j) => normalizeJob(j));
    const updated = [];
    for (const job of jobs) {
      if (!job.enabled) {
        updated.push(job);
        continue;
      }
      const nextRunAt = job.nextRunAt || computeNextRun(job, now);
      if (nextRunAt > now) {
        updated.push({ ...job, nextRunAt });
        continue;
      }

      const startedAt = Date.now();
      log?.info?.('[Scheduler] job starting', { id: job.id, name: job.name, type: job.type });
      await appendLog(app, { level: 'info', jobId: job.id, message: 'Starting job run', status: 'running' });
      const result = await runJob(job, { app });
      const finishedAt = Date.now();
      const success = Boolean(result?.ok);

      const patched = stampRun(job, {
        startedAt,
        finishedAt,
        status: success ? 'success' : 'error',
        message: result?.message || (success ? 'Completed' : 'Failed')
      });
      patched.nextRunAt = computeNextRun(patched, finishedAt);
      updated.push(patched);

      await appendLog(app, {
        level: success ? 'info' : 'error',
        jobId: job.id,
        message: result?.message || (success ? 'Completed' : 'Failed'),
        status: patched.lastRun.status,
        detail: result?.outputPath || null
      });
      log?.info?.('[Scheduler] job finished', {
        id: job.id,
        name: job.name,
        status: patched.lastRun.status,
        message: result?.message || (success ? 'Completed' : 'Failed')
      });
    }

    if (updated.length) {
      await writeJobs(app, updated);
    }
  };

  // initial run
  await processTick();
  const timer = setInterval(processTick, tickMs);
  timer.unref?.();
  return timer;
};

module.exports = {
  startSchedulerService,
  computeNextRun
};
