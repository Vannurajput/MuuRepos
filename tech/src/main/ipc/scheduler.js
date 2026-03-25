const { SchedulerError } = require('../scheduler/errors');

// IPC handlers for scheduler operations
module.exports = function registerSchedulerIpc(ipcMain, { scheduler, app, log }) {
  const formatError = (err) => {
    if (err instanceof SchedulerError) {
      return {
        ok: false,
        error: err.message,
        code: err.code,
        path: err.path,
        field: err.field
      };
    }
    return { ok: false, error: err?.message || String(err), code: 'UNKNOWN_ERROR' };
  };

  ipcMain.handle('scheduler:list', async () => {
    try {
      const jobs = await scheduler.listJobs(app);
      log.info('[Scheduler] list requested', { count: jobs?.length || 0 });
      await scheduler.appendLog(app, { level: 'debug', message: 'scheduler:list requested', detail: `count=${jobs.length}` });
      return { ok: true, jobs };
    } catch (err) {
      log.error('[Scheduler] list failed', err);
      return formatError(err);
    }
  });

  ipcMain.handle('scheduler:save', async (_event, job) => {
    try {
      const saved = await scheduler.saveJob(app, job);
      log.info('[Scheduler] save', { id: saved?.id, name: saved?.name, type: saved?.type, enabled: saved?.enabled });
      await scheduler.appendLog(app, {
        level: 'info',
        jobId: saved?.id || null,
        message: 'scheduler:save',
        status: saved?.enabled === false ? 'disabled' : 'saved',
        detail: `name=${saved?.name || ''}; type=${saved?.type || ''}`
      });
      return { ok: true, job: saved };
    } catch (err) {
      log.error('[Scheduler] save failed', err);
      return formatError(err);
    }
  });

  ipcMain.handle('scheduler:delete', async (_event, jobId) => {
    try {
      await scheduler.removeJob(app, jobId);
      log.info('[Scheduler] delete', { jobId });
      await scheduler.appendLog(app, { level: 'info', jobId, message: 'scheduler:delete', status: 'deleted' });
      return { ok: true };
    } catch (err) {
      log.error('[Scheduler] delete failed', err);
      return formatError(err);
    }
  });

  ipcMain.handle('scheduler:run-now', async (_event, jobId) => {
    try {
      await scheduler.runJobNow(app, jobId);
      log.info('[Scheduler] run-now requested', { jobId });
      await scheduler.appendLog(app, { level: 'info', jobId, message: 'Run-now requested', status: 'queued' });
      return { ok: true };
    } catch (err) {
      log.error('[Scheduler] run-now failed', err);
      return formatError(err);
    }
  });

  ipcMain.handle('scheduler:logs', async (_event, limit = 200) => {
    try {
      const logs = await scheduler.readLogs(app, limit);
      log.info('[Scheduler] logs requested', { limit, count: logs?.length || 0 });
      return { ok: true, logs };
    } catch (err) {
      log.error('[Scheduler] logs failed', err);
      return formatError(err);
    }
  });

  ipcMain.handle('scheduler:status', async () => {
    try {
      const status = await scheduler.getStatus(app);
      log.info('[Scheduler] status requested', { count: status?.count || 0, enabled: status?.enabled || 0 });
      await scheduler.appendLog(app, {
        level: 'debug',
        message: 'scheduler:status requested',
        detail: `count=${status?.count ?? 0}; enabled=${status?.enabled ?? 0}`
      });
      return { ok: true, status };
    } catch (err) {
      log.error('[Scheduler] status failed', err);
      return formatError(err);
    }
  });
};
