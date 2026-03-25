import '../theme/themeBootstrap.js';

const bridge = window.browserBridge;
if (!bridge) {
  throw new Error('Scheduler bridge missing');
}

const statusEl = document.getElementById('schedulerStatus');
const statusTextEl = document.getElementById('schedulerStatusText');
const jobForm = document.getElementById('jobForm');
const jobType = document.getElementById('jobType');
const jobEvery = document.getElementById('jobEvery');
const jobCron = document.getElementById('jobCron');
const jobsList = document.getElementById('jobsList');
const logList = document.getElementById('logList');
const formAlert = document.getElementById('formAlert');

const githubFields = document.getElementById('githubFields');
const dbFields = document.getElementById('dbFields');
const downloadFields = document.getElementById('downloadFields');
const cliFields = document.getElementById('cliFields');
const triggerFields = document.getElementById('triggerFields');
const debugLog = (...args) => console.log('[SchedulerUI]', ...args);

const state = {
  jobs: [],
  logs: []
};

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString() : '—');
const formatStatus = (job) => job?.lastRun?.status || 'pending';

const setStatus = (text, tone = 'warn') => {
  if (statusTextEl) statusTextEl.textContent = text;
  if (!statusEl) return;
  const pill = statusEl.querySelector('.pill');
  if (!pill) return;
  pill.classList.remove('pill-ok', 'pill-warn', 'pill-err');
  if (tone === 'ok') {
    pill.classList.add('pill-ok');
  } else if (tone === 'err') {
    pill.classList.add('pill-err');
  } else {
    pill.classList.add('pill-warn');
  }
};

const showFieldsForType = (type) => {
  githubFields.classList.toggle('hidden', type !== 'github-pull');
  dbFields.classList.toggle('hidden', type !== 'db-export');
  downloadFields.classList.toggle('hidden', type !== 'download');
  cliFields.classList.toggle('hidden', type !== 'cli');
  triggerFields.classList.toggle('hidden', type !== 'trigger');
};

jobType?.addEventListener('change', (e) => showFieldsForType(e.target.value));
showFieldsForType(jobType?.value || 'github-pull');

const showAlert = (message = '') => {
  if (!formAlert) return;
  if (!message) {
    formAlert.classList.add('hidden');
    formAlert.textContent = '';
    return;
  }
  formAlert.classList.remove('hidden');
  formAlert.textContent = message;
};

const renderJobs = () => {
  if (!jobsList) return;
  if (!state.jobs.length) {
    jobsList.innerHTML =
      '<div class="jobs-empty"><strong>No jobs yet.</strong> Create one on the left, then use "Run now" or let the schedule handle it.</div>';
    return;
  }

  jobsList.innerHTML = '';
  state.jobs.forEach((job) => {
    const row = document.createElement('div');
    row.className = 'job-row';

    const header = document.createElement('div');
    header.className = 'job-row-header';

    const title = document.createElement('div');
    title.className = 'job-name';
    title.textContent = job.name || job.id;

    const status = document.createElement('span');
    const statusClass =
      job.enabled === false
        ? 'badge off'
        : job?.lastRun?.status === 'success'
        ? 'badge success'
        : job?.lastRun?.status === 'error'
        ? 'badge error'
        : 'badge';
    status.className = statusClass;
    status.textContent = job.enabled === false ? 'Paused' : formatStatus(job);

    header.appendChild(title);
    header.appendChild(status);
    row.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'job-meta';
    meta.innerHTML = `
      <span>Type: ${job.type}</span>
      <span>${job?.schedule?.cron ? `Cron: ${job.schedule.cron}` : `Every ${job?.schedule?.everyMinutes || '?' } min`}</span>
      <span>Next: ${formatDate(job.nextRunAt)}</span>
      <span>Last: ${formatDate(job?.lastRun?.finishedAt || job?.lastRun?.startedAt)}</span>
    `;
    row.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'job-actions';

    const runBtn = document.createElement('button');
    runBtn.textContent = 'Run now';
    runBtn.addEventListener('click', async () => {
      await bridge.runSchedulerJobNow(job.id);
      await loadJobs();
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = job.enabled === false ? 'Enable' : 'Disable';
    toggleBtn.addEventListener('click', async () => {
      await bridge.saveSchedulerJob({ ...job, enabled: job.enabled === false });
      await loadJobs();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      await bridge.deleteSchedulerJob(job.id);
      await loadJobs();
    });

    actions.appendChild(runBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(actions);

    jobsList.appendChild(row);
  });
};

const renderLogs = () => {
  if (!logList) return;
  if (!state.logs.length) {
    logList.innerHTML = '<div class="log-row">No activity yet.</div>';
    return;
  }
  logList.innerHTML = '';
  state.logs.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'log-row';
    const ts = formatDate(entry.ts);
    row.innerHTML = `<div><strong>${entry.status || entry.level || ''}</strong> — ${entry.message || ''}</div><small>${ts}${entry.jobId ? ` · Job ${entry.jobId}` : ''}${entry.detail ? ` · ${entry.detail}` : ''}</small>`;
    logList.appendChild(row);
  });
};

const loadJobs = async () => {
  try {
    const res = await bridge.listSchedulerJobs();
    debugLog('listSchedulerJobs result', res);
    if (res?.ok !== false) {
      state.jobs = res.jobs || res;
    }
  } catch (err) {
    console.error('Failed to load jobs', err);
    debugLog('listSchedulerJobs error', err);
  }
  renderJobs();
};

const loadLogs = async () => {
  try {
    const res = await bridge.getSchedulerLogs(100);
    debugLog('getSchedulerLogs result', res);
    if (res?.ok !== false) {
      state.logs = res.logs || res || [];
    }
  } catch (err) {
    console.error('Failed to load logs', err);
    debugLog('getSchedulerLogs error', err);
  }
  renderLogs();
};

const loadStatus = async () => {
  try {
    const res = await bridge.getSchedulerStatus();
    debugLog('getSchedulerStatus result', res);
    if (res?.ok === false) {
      setStatus(res.error, 'err');
      return;
    }
    const status = res?.status || res || {};
    setStatus(`Service active · ${status.enabled || 0}/${status.count || 0} enabled jobs`, 'ok');
  } catch (err) {
    setStatus(`Status unavailable: ${err?.message || err}`, 'err');
    debugLog('getSchedulerStatus error', err);
  }
};

const validatePayload = (type, payload, base) => {
  const errors = [];
  if (!base.name) errors.push('Job name is required.');
  const hasCron = Boolean(base.cron);
  const minutes = Number(base.everyMinutes || 0);
  if (!hasCron && (!minutes || minutes < 1)) errors.push('Every (minutes) must be at least 1 or provide a cron.');
  if (type === 'github-pull') {
    if (!payload.owner) errors.push('Owner is required for GitHub pull.');
    if (!payload.repo) errors.push('Repository is required for GitHub pull.');
    if (!payload.outputDir) errors.push('Output directory is required for GitHub pull.');
  } else if (type === 'db-export') {
    if (!payload.dbType) errors.push('DB type is required for DB export.');
    if (!payload.credentialId) errors.push('Credential ID/name is required for DB export.');
    if (!payload.query) errors.push('Query is required for DB export.');
    if (!payload.outputDir) errors.push('Output directory is required for DB export.');
  } else if (type === 'download') {
    if (!payload.url) errors.push('URL is required for download.');
    if (!payload.fileName) errors.push('File name is required for download.');
    if (!payload.outputDir) errors.push('Output directory is required for download.');
  } else if (type === 'cli') {
    if (!payload.command) errors.push('Command is required for CLI job.');
  } else if (type === 'trigger') {
    if (!Array.isArray(payload.targets) || !payload.targets.length) errors.push('At least one target job ID is required.');
  }
  return errors;
};

jobForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = jobType.value;
  const payload = {};

  if (type === 'github-pull') {
    payload.owner = document.getElementById('ghOwner').value;
    payload.repo = document.getElementById('ghRepo').value;
    payload.branch = document.getElementById('ghBranch').value;
    payload.token = document.getElementById('ghToken').value;
    payload.outputDir = document.getElementById('ghOutput').value;
  } else if (type === 'db-export') {
    payload.dbType = document.getElementById('dbType').value;
    payload.credentialId = document.getElementById('dbCredential').value;
    payload.database = document.getElementById('dbName').value;
    payload.query = document.getElementById('dbQuery').value;
    payload.outputDir = document.getElementById('dbOutput').value;
  } else if (type === 'download') {
    payload.url = document.getElementById('dlUrl').value;
    payload.fileName = document.getElementById('dlFileName').value;
    payload.outputDir = document.getElementById('dlOutput').value;
  } else if (type === 'cli') {
    payload.command = document.getElementById('cliCommand').value;
    payload.cwd = document.getElementById('cliCwd').value;
    payload.timeoutMs = Number(document.getElementById('cliTimeout').value || 0);
  } else if (type === 'trigger') {
    const raw = document.getElementById('triggerTargets').value || '';
    payload.targets = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const everyMinutes = Number(jobEvery.value || 5);
  const cronExpr = (jobCron.value || '').trim();
  const jobName = document.getElementById('jobName').value;

  const errors = validatePayload(type, payload, { name: jobName, everyMinutes, cron: cronExpr });
  if (errors.length) {
    showAlert(errors.join(' '));
    return;
  }

  showAlert('');

  debugLog('saveSchedulerJob request', { name: jobName, type, everyMinutes, cronExpr, payload });
  try {
    const res = await bridge.saveSchedulerJob({
      name: jobName,
      type,
      schedule: { everyMinutes, cron: cronExpr },
      payload,
      enabled: true
    });
    debugLog('saveSchedulerJob response', res);
  } catch (err) {
    debugLog('saveSchedulerJob error', err);
    showAlert(err?.message || 'Failed to save job');
    return;
  }

  jobForm.reset();
  jobType.value = 'github-pull';
  jobEvery.value = everyMinutes || 30;
  if (jobCron) jobCron.value = '';
  showFieldsForType('github-pull');
  await loadJobs();
  await loadLogs();
  await loadStatus();
});

const refresh = async () => {
  await loadJobs();
  await loadLogs();
  await loadStatus();
};

refresh();
setInterval(refresh, 20000);
