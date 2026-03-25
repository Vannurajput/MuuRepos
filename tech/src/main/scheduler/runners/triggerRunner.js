const { setNextRun, readJobs, writeJobs } = require('../jobsStore');

class TriggerRunner {
  async run(job = {}, ctx = {}) {
    const payload = job.payload || {};
    const targets = Array.isArray(payload.targets) ? payload.targets : [];
    const app = ctx.app;

    if (!targets.length) {
      return { ok: false, message: 'No targets specified for trigger job' };
    }

    if (!app) {
      return { ok: false, message: 'Missing app context for trigger job' };
    }

    // set next run to now for each target job
    for (const id of targets) {
      await setNextRun(app, id, Date.now());
    }

    // also bump metadata to reflect trigger
    const jobs = await readJobs(app);
    let touched = false;
    const updated = jobs.map((j) => {
      if (targets.includes(j.id)) {
        touched = true;
        return { ...j, meta: { ...(j.meta || {}), triggeredBy: job.id, triggeredAt: Date.now() } };
      }
      return j;
    });
    if (touched) {
      await writeJobs(app, updated);
    }

    return { ok: true, message: `Triggered ${targets.length} job(s)` };
  }
}

module.exports = TriggerRunner;
