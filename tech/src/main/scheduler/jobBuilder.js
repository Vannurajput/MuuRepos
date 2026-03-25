const { normalizeJob } = require('./jobsStore');

/**
 * Simple builder to create a job definition with consistent shape.
 */
class JobBuilder {
  constructor() {
    this.job = {
      name: '',
      type: '',
      schedule: { everyMinutes: 5, cron: '' },
      payload: {},
      enabled: true,
      meta: {}
    };
  }

  withName(name) {
    this.job.name = name;
    return this;
  }

  withType(type) {
    this.job.type = type;
    return this;
  }

  withSchedule({ everyMinutes, cron } = {}) {
    if (everyMinutes != null) this.job.schedule.everyMinutes = everyMinutes;
    if (cron != null) this.job.schedule.cron = cron;
    return this;
  }

  withPayload(payload = {}) {
    this.job.payload = payload;
    return this;
  }

  enabled(enabled = true) {
    this.job.enabled = enabled;
    return this;
  }

  withMeta(meta = {}) {
    this.job.meta = meta;
    return this;
  }

  build() {
    return normalizeJob(this.job);
  }
}

module.exports = {
  JobBuilder
};
