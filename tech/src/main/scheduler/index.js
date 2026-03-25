const { startSchedulerService } = require('./serviceEngine');
const { computeNextRun } = require('./schedule');
const { readJobs, upsertJob, deleteJob, setNextRun } = require('./jobsStore');
const { readLogs, appendLog } = require('./logStore');

const listJobs = async (app) => {
  const jobs = await readJobs(app);
  return jobs;
};

const saveJob = async (app, job) => {
  const saved = await upsertJob(app, job);
  return saved;
};

const removeJob = async (app, jobId) => deleteJob(app, jobId);

const runJobNow = async (app, jobId) => setNextRun(app, jobId, Date.now());

const getStatus = async (app) => {
  const jobs = await listJobs(app);
  return {
    count: jobs.length,
    enabled: jobs.filter((j) => j.enabled !== false).length,
    nextRuns: jobs
      .filter((j) => j.enabled !== false)
      .map((j) => ({ id: j.id, nextRunAt: j.nextRunAt || computeNextRun(j) }))
  };
};

module.exports = {
  startSchedulerService,
  listJobs,
  saveJob,
  removeJob,  
  runJobNow,
  getStatus,
  readLogs: (app, limit) => readLogs(app, limit),
  appendLog
};
