const GitHubRunner = require('./runners/githubRunner');
const DbRunner = require('./runners/dbRunner');
const DownloadRunner = require('./runners/downloadRunner');
const CliRunner = require('./runners/cliRunner');
const TriggerRunner = require('./runners/triggerRunner');

const RUNNERS = {
  'github-pull': new GitHubRunner(),
  'db-export': new DbRunner(),
  download: new DownloadRunner(),
  cli: new CliRunner(),
  trigger: new TriggerRunner()
};

const getRunner = (type = '') => RUNNERS[type] || null;

const runJob = async (job = {}, ctx = {}) => {
  const runner = getRunner(job.type);
  if (!runner || typeof runner.run !== 'function') {
    return {
      ok: false,
      message: `No runner for type "${job.type}"`
    };
  }
  return runner.run(job, ctx);
};

module.exports = {
  getRunner,
  runJob
};
