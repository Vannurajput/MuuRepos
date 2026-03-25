/**
 * github/app.js
 * Git configuration popup/tab that syncs inline text or zips to GitHub via PAT.
 */
window.addEventListener('contextmenu', (event) => event.preventDefault());

let storedConfig = {};
let gitRequestId = 0;
const gitPending = new Map();
const hasNativeGitBridge = !!window.browserBridge?.githubGetConfig;
const searchParams = new URLSearchParams(window.location.search);
const isNewFlow = searchParams.get('mode') === 'new';
const requestedEntryId = searchParams.get('entryId');
const isEmbed = searchParams.get('embed') === '1';
let activeEntryId = requestedEntryId || null;

if (isEmbed) {
  document.documentElement.classList.add('embed');
  document.body.classList.add('embed');
}

const postToParent = (method, payload) => {
  if (!window.parent || window.parent === window) {
    return Promise.reject(new Error('Git bridge missing'));
  }
  const id = ++gitRequestId;
  return new Promise((resolve, reject) => {
    gitPending.set(id, { resolve, reject });
    window.parent.postMessage({ __from: 'git-tab', id, method, payload }, '*');
    setTimeout(() => {
      if (gitPending.has(id)) {
        gitPending.delete(id);
        reject(new Error('Git bridge request timed out'));
      }
    }, 15000);
  });
};

window.addEventListener('message', (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'git-shell') return;
  const pending = gitPending.get(msg.id);
  if (!pending) return;
  gitPending.delete(msg.id);
  if (msg.error) {
    pending.reject(new Error(msg.error));
  } else {
    pending.resolve(msg.result);
  }
});

const callGitBridge = (method, payload) => {
  if (hasNativeGitBridge && typeof window.browserBridge?.[method] === 'function') {
    return window.browserBridge[method](payload);
  }
  return postToParent(method, payload);
};

const gitBridge = {
  getConfig: () => callGitBridge('githubGetConfig'),
  saveConfig: (config) => callGitBridge('githubSaveConfig', config),
  signOut: () => callGitBridge('githubSignOut'),
  log: (entry) => callGitBridge('githubLog', entry),
  getCredentialEntry: (type, id) => callGitBridge('getCredentialEntry', { type, id })
};

const elements = {
  pat: document.getElementById('patInput'),
  owner: document.getElementById('ownerInput'),
  repo: document.getElementById('repoInput'),
  branch: document.getElementById('branchInput'),
  path: document.getElementById('pathInput'),
  commitMessage: document.getElementById('commitMessageInput'),
  configStatus: document.getElementById('configStatus'),
  saveConfig: document.getElementById('saveConfigButton'),
  signOut: document.getElementById('signOutButton'),
  close: document.getElementById('closeButton')
};

if (isEmbed && elements.configStatus) {
  const actionsRow = document.querySelector('.actions');
  if (actionsRow) {
    actionsRow.appendChild(elements.configStatus);
  }
}

let embedStatusTimer = null;
const showEmbedStatus = (message, hideAfterMs = 2000) => {
  if (!isEmbed || !elements.configStatus) {
    if (elements.configStatus) elements.configStatus.textContent = message || '';
    return;
  }
  if (embedStatusTimer) {
    clearTimeout(embedStatusTimer);
    embedStatusTimer = null;
  }
  elements.configStatus.style.display = message ? 'inline-flex' : 'none';
  elements.configStatus.textContent = message || '';
  try {
    window.parent?.postMessage?.({ __from: 'git-embed', type: 'resize' }, '*');
  } catch (_) {}
  if (message && hideAfterMs > 0) {
    embedStatusTimer = setTimeout(() => {
      elements.configStatus.style.display = 'none';
      elements.configStatus.textContent = '';
      try {
        window.parent?.postMessage?.({ __from: 'git-embed', type: 'resize' }, '*');
      } catch (_) {}
    }, hideAfterMs);
  }
};

const sendLog = (message, level = 'info') => {
  const prefixed = `[GitHub][${level}] ${message}`;
  console.log(prefixed);
  gitBridge.log(prefixed).catch(() => {});
};

let toastEl = null;
const showToast = (message, tone = 'info', duration = 2200) => {
  if (toastEl?.parentNode) {
    toastEl.remove();
  }
  toastEl = document.createElement('div');
  toastEl.textContent = message;
  toastEl.style.position = 'fixed';
  toastEl.style.left = '50%';
  toastEl.style.bottom = '20px';
  toastEl.style.transform = 'translateX(-50%)';
  toastEl.style.padding = '12px 16px';
  toastEl.style.borderRadius = '10px';
  toastEl.style.border = '1px solid rgba(0,0,0,0.08)';
  toastEl.style.boxShadow = '0 12px 30px rgba(0,0,0,0.16)';
  toastEl.style.background =
    tone === 'error' ? '#fdecea' : tone === 'success' ? '#ecfdf3' : '#f8fafc';
  toastEl.style.color = tone === 'error' ? '#b91c1c' : tone === 'success' ? '#047857' : '#0f172a';
  toastEl.style.fontSize = '13px';
  toastEl.style.zIndex = 9999;
  toastEl.style.pointerEvents = 'none';
  document.body.appendChild(toastEl);
  if (duration > 0) {
    setTimeout(() => toastEl?.remove(), duration);
  }
};

const shouldUseRegistry = () => isNewFlow || !!activeEntryId;

const fillForm = (config = {}) => {
  storedConfig = { ...config };
  elements.pat.value = config.pat || '';
  elements.owner.value = config.owner || '';
  elements.repo.value = config.repository || '';
  elements.branch.value = config.branch || '';
  elements.path.value = config.defaultPath || '';
  elements.commitMessage.value = config.defaultCommitMessage || '';
  const isConnected = Boolean(config.owner && config.repository && (config.branch || config.defaultPath));
  if (isEmbed) {
    // In embedded modal mode, do not show persistent green status pill.
    showEmbedStatus('', 0);
  } else {
    elements.configStatus.textContent = isConnected
      ? `Connected: ${config.owner}/${config.repository}@${config.branch || 'main'}`
      : 'Not connected';
  }
  sendLog(
    isConnected
      ? `Config loaded for ${config.owner}/${config.repository}`
      : 'Config loaded but not connected yet.'
  );
};

const fillFromEntry = (entry = {}) => {
  const owner = entry.owner || entry.repositoryOwner || '';
  const repository = entry.repository || entry.repo || '';
  const pat = entry.pat || entry.token || '';
  const defaultPath = entry.defaultPath || entry.path || '';
  const defaultCommitMessage = entry.defaultCommitMessage || entry.commitMessage || 'chore: push from Chromo';
  const branch = entry.branch || 'main';
  fillForm({
    pat,
    owner,
    repository,
    branch,
    defaultPath,
    defaultCommitMessage
  });
};

const readForm = () => ({
  pat: elements.pat.value.trim(),
  owner: elements.owner.value.trim(),
  repository: elements.repo.value.trim(),
  branch: elements.branch.value.trim() || 'main',
  defaultPath: elements.path.value.trim(),
  defaultCommitMessage: elements.commitMessage.value.trim() || 'chore: push from Chromo'
});

elements.saveConfig?.addEventListener('click', async () => {
  const config = readForm();
  if (!config.owner || !config.repository || !config.pat || !config.defaultPath) {
    const message = 'Fill Owner, Repository, Default Path, and PAT before saving.';
    if (isEmbed) showEmbedStatus(message, 2500);
    else elements.configStatus.textContent = message;
    sendLog(message, 'error');
    showToast(message, 'error', 2600);
    return;
  }
  if (isEmbed) showEmbedStatus('Verifying repository...', 0);
  else elements.configStatus.textContent = 'Verifying repository...';
  sendLog('Verifying repository access...', 'info');
  try {
    if (shouldUseRegistry()) {
      config.__registry = true;
      if (activeEntryId) {
        config.__entryId = activeEntryId;
      }
    }
    const saved = await gitBridge.saveConfig(config);
    if (saved?.__entryId) {
      activeEntryId = saved.__entryId;
    }
    fillForm(saved);
    if (isEmbed) showEmbedStatus('Connected successfully.', 1800);
    else elements.configStatus.textContent = 'Connected successfully.';
    sendLog(`Connected to ${saved.owner}/${saved.repository}@${saved.branch}`, 'success');
    showToast('GitHub connection verified successfully.', 'success', 2200);
  } catch (error) {
    const message = error?.message || 'Failed to connect.';
    if (isEmbed) showEmbedStatus(message, 3000);
    else elements.configStatus.textContent = message;
    sendLog(`Save failed: ${message}`, 'error');
    showToast(message, 'error', 2800);
  }
});

elements.signOut?.addEventListener('click', async () => {
  await gitBridge.signOut();
  fillForm({
    pat: '',
    owner: '',
    repository: '',
    branch: 'main',
    defaultPath: '',
    defaultCommitMessage: 'chore: push from Chromo'
  });
  if (isEmbed) showEmbedStatus('Signed out.', 1500);
  else elements.configStatus.textContent = 'Signed out.';
  sendLog('Signed out and cleared stored GitHub config.', 'info');
});

elements.close?.addEventListener('click', () => {
  sendLog('Git window closed by user.', 'info');
  window.browserBridge?.closeGitPopup?.();
});

const bootstrap = async () => {
  sendLog('GitHub sync UI ready.');
  if (activeEntryId) {
    try {
      const entry = window.browserBridge?.getCredentialEntry
        ? await window.browserBridge.getCredentialEntry('git', activeEntryId)
        : await gitBridge.getCredentialEntry('git', activeEntryId);
      if (entry) {
        fillFromEntry(entry);
        return;
      }
    } catch (error) {
      sendLog('Failed to load credential entry, falling back to saved config.', 'warn');
    }
  }
  if (isNewFlow) {
    fillFromEntry({});
    elements.configStatus.textContent = 'Start entering a new configuration.';
    return;
  }
  const config = await gitBridge.getConfig();
  if (!activeEntryId && config?.__entryId) {
    activeEntryId = config.__entryId;
  }
  fillForm(config);
};

bootstrap();
