import { initAdvanced, fillAdvanced, readAdvanced } from './advanced.js';

const queryParams = new URLSearchParams(window.location.search);
const isEmbed = queryParams.get('embed') === '1';
const hasNativeBridge = !!window.credentialBridge?.load;

if (isEmbed) {
  document.documentElement.classList.add('embed');
  document.body.classList.add('embed');
}

let embedRequestId = 0;
const embedPending = new Map();

const postToParent = (method, payload) => {
  if (!window.parent || window.parent === window) {
    return Promise.reject(new Error('Credential bridge missing'));
  }
  const id = ++embedRequestId;
  return new Promise((resolve, reject) => {
    embedPending.set(id, { resolve, reject });
    window.parent.postMessage({ __from: 'embed-tab', id, method, payload }, '*');
    setTimeout(() => {
      if (embedPending.has(id)) {
        embedPending.delete(id);
        reject(new Error('Credential bridge request timed out'));
      }
    }, 15000);
  });
};

window.addEventListener('message', (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'embed-shell') return;
  const pending = embedPending.get(msg.id);
  if (!pending) return;
  embedPending.delete(msg.id);
  if (msg.error) {
    pending.reject(new Error(msg.error));
  } else {
    pending.resolve(msg.result);
  }
});

const bridge = hasNativeBridge
  ? window.credentialBridge
  : {
      load: () => postToParent('credentialsLoad'),
      save: (payload) => postToParent('credentialsSave', payload),
      test: (payload) => postToParent('credentialsTest', payload),
      getEntry: (type, id) => postToParent('credentialsGetEntry', { type, id }),
      close: () => postToParent('credentialsClose')
    };
const isNewFlow = queryParams.get('mode') === 'new';
const requestedEntryId = queryParams.get('entryId');
let activeEntryId = requestedEntryId || null;

const elements = {
  form: document.getElementById('credentialForm'),
  dbType: document.getElementById('dbType'),
  connectionName: document.getElementById('connectionName'),
  connectionId: document.getElementById('connectionId'),
  host: document.getElementById('dbHost'),
  port: document.getElementById('dbPort'),
  serverName: document.getElementById('dbServer'),
  hostGroup: document.getElementById('hostGroup'),
  portGroup: document.getElementById('portGroup'),
  serverGroup: document.getElementById('serverGroup'),
  database: document.getElementById('dbName'),
  user: document.getElementById('dbUser'),
  password: document.getElementById('dbPassword'),
  saveButton: document.getElementById('saveButton'),
  testButton: document.getElementById('testButton'),
  status: document.getElementById('statusMessage')
};

const setStatus = (message = '', variant = '') => {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.className = `status-chip ${variant}`.trim();
  elements.status.style.display = message ? 'inline-flex' : 'none';
  if (isEmbed) {
    try {
      window.parent?.postMessage?.({ __from: 'embed-embed', type: 'resize' }, '*');
    } catch (_) {}
  }
};

const shouldUseRegistry = () => isNewFlow || !!activeEntryId;

const isSqlServer = (value = '') => String(value || '').toLowerCase() === 'sqlserver';

const composeServerName = (host = '', port = '') => {
  const trimmedHost = (host || '').trim();
  const trimmedPort = (port || '').trim();
  if (!trimmedHost && !trimmedPort) return '';
  return trimmedPort ? `${trimmedHost},${trimmedPort}` : trimmedHost;
};

const parseServerName = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return { host: '', port: '' };

  // Accept "host,port", "host:port", or "host\instance" (instance keeps port empty)
  if (text.includes(',')) {
    const [rawHost = '', rawPort = ''] = text.split(',');
    return { host: rawHost.trim(), port: rawPort.trim() };
  }
  if (text.includes(':')) {
    const [rawHost = '', rawPort = ''] = text.split(':');
    return { host: rawHost.trim(), port: rawPort.trim() };
  }

  // Backslash instance name or plain hostname
  return {
    host: text,
    port: ''
  };
};

const updateDbFieldsVisibility = () => {
  const sqlServerSelected = isSqlServer(elements.dbType?.value);
  if (elements.serverGroup) {
    elements.serverGroup.classList.toggle('hidden', !sqlServerSelected);
  }
  if (elements.hostGroup) {
    elements.hostGroup.classList.toggle('hidden', sqlServerSelected);
  }
  if (elements.portGroup) {
    elements.portGroup.classList.toggle('hidden', sqlServerSelected);
  }
  if (elements.serverName) {
    elements.serverName.required = sqlServerSelected;
    elements.serverName.disabled = !sqlServerSelected;
  }
  if (elements.host) {
    elements.host.required = !sqlServerSelected;
    elements.host.disabled = sqlServerSelected;
  }
  if (elements.port) {
    elements.port.required = !sqlServerSelected;
    elements.port.disabled = sqlServerSelected;
  }
  if (isEmbed) {
    try {
      window.parent?.postMessage?.({ __from: 'embed-embed', type: 'resize' }, '*');
    } catch (_) {}
  }
};

const fillForm = (config = {}) => {
  elements.dbType.value = config.dbType || '';
  elements.connectionName.value = config.label || config.connectionName || '';
  elements.connectionId.value = config.customId || config.id || '';
  elements.host.value = config.host || '';
  elements.port.value = config.port || '';
  if (isSqlServer(config.dbType) && elements.serverName) {
    elements.serverName.value = composeServerName(config.host, config.port);
  } else if (elements.serverName) {
    elements.serverName.value = '';
  }
  elements.database.value = config.database || '';
  elements.user.value = config.user || '';
  elements.password.value = config.password || '';
  fillAdvanced(config);
  updateDbFieldsVisibility();
};

const readForm = () => ({
  id: elements.connectionId.value.trim(),
  dbType: elements.dbType.value.trim(),
  label: elements.connectionName.value.trim(),
  connectionName: elements.connectionName.value.trim(),
  host: (() => {
    if (isSqlServer(elements.dbType.value) && elements.serverName) {
      return parseServerName(elements.serverName.value).host;
    }
    return elements.host.value.trim();
  })(),
  port: (() => {
    if (isSqlServer(elements.dbType.value) && elements.serverName) {
      const parsed = parseServerName(elements.serverName.value);
      return parsed.port || '1433';
    }
    return elements.port.value.trim();
  })(),
  database: elements.database.value.trim(),
  user: elements.user.value.trim(),
  password: elements.password.value,
  ...readAdvanced()
});

const setBusy = (busy) => {
  elements.saveButton.disabled = busy;
  elements.testButton.disabled = busy;
};

const init = async () => {
  try {
    setStatus('Loading...');
    let config = null;
    if (activeEntryId && bridge?.getEntry) {
      config = await bridge.getEntry('database', activeEntryId);
    }
    if (!config) {
      config = isNewFlow ? {} : await bridge?.load?.();
    }
    fillForm(config || {});
    initAdvanced(config || {});
    setStatus('');
    if (isEmbed) {
      try {
        window.parent?.postMessage?.({ __from: 'embed-embed', type: 'resize' }, '*');
      } catch (_) {}
    }
  } catch (err) {
    console.error('[CredentialManager] load failed', err);
    setStatus('Failed to load saved credentials', 'error');
  }
};

elements.form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(true);
  setStatus('Saving...');
  try {
    const payload = readForm();
    if (shouldUseRegistry() && !payload.__skipRegistry) {
      payload.__registry = true;
      if (activeEntryId) {
        payload.__entryId = activeEntryId;
      }
    }
    const result = await bridge?.save?.(payload);
    if (result?.__entryId) {
      activeEntryId = result.__entryId;
    }
    setStatus('Saved successfully', 'success');
  } catch (err) {
    console.error('[CredentialManager] save failed', err);
    setStatus(err?.message || 'Failed to save credentials', 'error');
  } finally {
    setBusy(false);
  }
});

elements.testButton?.addEventListener('click', async () => {
  setBusy(true);
  setStatus('Testing connection...');
  try {
    const payload = readForm();
    const result = await bridge?.test?.(payload);
    if (result?.ok) {
      setStatus(result.message || 'Connection successful', 'success');
    } else {
      setStatus(result?.message || 'Connection failed', 'error');
    }
  } catch (err) {
    console.error('[CredentialManager] test failed', err);
    setStatus('Connection test failed', 'error');
  } finally {
    setBusy(false);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    bridge?.close?.();
  }
});

elements.dbType?.addEventListener('change', () => {
  if (isSqlServer(elements.dbType.value) && elements.serverName) {
    elements.serverName.placeholder = 'e.g. hostname,1433 or hostname:1433 or hostname\\SQLEXPRESS';
  }
  updateDbFieldsVisibility();
});

init();
