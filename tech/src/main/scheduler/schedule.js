const parser = require('cron-parser');

const minutesToMs = (minutes) => Math.max(1, Number(minutes) || 0) * 60 * 1000;

const computeNextRun = (job = {}, fromTs = Date.now()) => {
  const everyMinutes = job?.schedule?.everyMinutes ?? job?.everyMinutes ?? 5;
  const cronExpr = String(job?.schedule?.cron || '').trim();
  const baseTs = job?.lastRun?.finishedAt || job?.lastRun?.startedAt || fromTs;

  if (cronExpr) {
    try {
      const interval = parser.parseExpression(cronExpr, { currentDate: new Date(baseTs) });
      const next = interval.next();
      if (next) {
        return next.getTime();
      }
    } catch (err) {
      // fall through to interval-based scheduling on parse error
    }
  }

  return baseTs + minutesToMs(everyMinutes);
};

module.exports = {
  computeNextRun
};
