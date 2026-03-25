const bridge = window.credentialBridge;
const rowsEl = document.getElementById('credentialRows');
const statusEl = document.getElementById('statusMessage');
const addConfigButton = document.getElementById('addConfigButton');
const addConfigMenu = document.getElementById('addConfigMenu');
const localModal = document.getElementById('localModal');
const localForm = document.getElementById('localForm');
const localFolderInput = document.getElementById('localFolder');
const localPathInput = document.getElementById('localPath');
const localError = document.getElementById('localError');
const localClose = document.getElementById('localModalClose');
const localCancel = document.getElementById('localCancel');
const editorModal = document.getElementById('editorModal');
const editorFrame = document.getElementById('editorFrame');
const editorClose = document.getElementById('editorClose');
const editorTitle = document.getElementById('editorTitle');

const setStatus = (message = '') => {
  if (!statusEl) return;
  statusEl.textContent = message;
};

const state = {
  rows: [],
  query: ''
};

const applyFilter = (rows = [], query = '') => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) {
    return rows;
  }
  return rows.filter((row) => {
    const name = (row.name || '').toLowerCase();
    const type = (row.type || row.entryType || '').toLowerCase();
    const summary = (row.summary || '').toLowerCase();
    return name.includes(term) || type.includes(term) || summary.includes(term);
  });
};

const ICONS = {
  edit: '<path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.17H5v-0.92l9.06-9.06 0.92 0.92L5.92 19.42zM20.71 5.63a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
  delete:
    '<path fill="currentColor" d="M6 7h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-3h6l1 1h4v2H4V5h4l1-1z"/>'
};

const createIconButton = (type, label, onClick, disabled = false) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-btn icon-${type}`;
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[type] || ''}</svg>`;
  button.title = label;
  if (disabled) {
    button.disabled = true;
  } else if (typeof onClick === 'function') {
    button.addEventListener('click', onClick);
  }
  return button;
};

const isRegistryRow = (row) => row?.entrySource === 'registry';
const isLocalRow = (row) => {
  if (!row) return false;
  const name = (row.name || '').toLowerCase();
  const summary = (row.summary || '').toLowerCase();
  return row.entryType === 'other' && (name.startsWith('local') || summary.includes('local path') || summary.includes(':\\') || summary.includes('/'));
};

const buildQuery = (options = {}) => {
  const params = new URLSearchParams();
  if (options.mode) {
    params.set('mode', options.mode);
  }
  if (options.entryId) {
    params.set('entryId', options.entryId);
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : '';
};

const openEditorModal = (relativePath, titleText) => {
  if (!editorModal || !editorFrame) return;
  if (editorTitle) {
    editorTitle.textContent = titleText || 'Editor';
  }
  const targetUrl = new URL(relativePath, window.location.href);
  targetUrl.searchParams.set('embed', '1');
  editorFrame.src = targetUrl.toString();
  editorModal.classList.add('open');
  editorModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('editor-open');

  queueMicrotask(() => {
    try {
      editorFrame.contentWindow?.focus?.();
    } catch (_) {}
  });
};

const closeEditorModal = () => {
  if (!editorModal || !editorFrame) return;
  editorModal.classList.remove('open');
  editorModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('editor-open');
  editorFrame.src = 'about:blank';
};

const resizeEditorFrame = () => {
  if (!editorModal?.classList.contains('open')) return;
  if (!editorFrame) return;
  try {
    const doc = editorFrame.contentDocument;
    if (!doc) return;
    const body = doc.body;
    const html = doc.documentElement;
    const pageShell = doc.querySelector?.('.page-shell');
    const windowShell = doc.querySelector?.('.window-shell');
    const panelShell = doc.querySelector?.('.panel');
    const containerShell = doc.querySelector?.('.container');
    // Prefer measuring the real card container; html/body heights can match the iframe height and cause blank space.
    const measured = [
      windowShell?.scrollHeight,
      windowShell?.offsetHeight,
      pageShell?.scrollHeight,
      pageShell?.offsetHeight
      ,
      panelShell?.scrollHeight,
      panelShell?.offsetHeight,
      containerShell?.scrollHeight,
      containerShell?.offsetHeight
    ]
      .map((value) => Number(value || 0))
      .filter((value) => value > 0);
    const contentHeight = measured.length
      ? Math.max(...measured)
      : Math.max(Number(body?.scrollHeight || 0), Number(html?.scrollHeight || 0));
    const maxHeight = Math.floor(window.innerHeight * 0.85);
    if (!contentHeight) return;
    // Fit tightly to content height (avoid blank space below the card).
    const nextHeight = Math.min(Math.max(contentHeight, 200), maxHeight);
    editorFrame.style.height = `${nextHeight}px`;
  } catch (_) {
    // ignore cross-origin / timing
  }
};

editorFrame?.addEventListener('load', () => {
  resizeEditorFrame();
  setTimeout(resizeEditorFrame, 50);
  setTimeout(resizeEditorFrame, 250);
});

window.addEventListener('resize', () => resizeEditorFrame());

// Allow embedded editors to request a re-measure when UI changes (e.g. status chip shown/hidden).
  window.addEventListener('message', (event) => {
    const msg = event?.data;
    if (!msg) return;
    if (msg.__from !== 'git-embed' && msg.__from !== 'embed-embed') return;
    if (msg.type === 'resize') {
      resizeEditorFrame();
      setTimeout(resizeEditorFrame, 50);
    } else if (msg.type === 'close') {
      closeEditorModal();
    } else if (msg.type === 'saved') {
      closeEditorModal();
      refresh();
    }
  });

// GitHub editor (iframe) uses postMessage bridge when browserBridge is unavailable.
window.addEventListener('message', async (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'git-tab') return;

  const reply = (payload) => {
    try {
      event.source?.postMessage?.({ __from: 'git-shell', id: msg.id, ...payload }, '*');
    } catch (error) {
      console.error('[CredentialManager] failed posting git-shell reply', error);
    }
  };

  try {
    if (!bridge) {
      reply({ error: 'Git bridge missing' });
      return;
    }

    switch (msg.method) {
      case 'githubGetConfig': {
        const result = await bridge.githubGetConfig?.();
        reply({ result });
        return;
      }
      case 'githubSaveConfig': {
        const result = await bridge.githubSaveConfig?.(msg.payload);
        reply({ result });
        return;
      }
      case 'githubSignOut': {
        await bridge.githubSignOut?.();
        reply({ result: true });
        return;
      }
      case 'githubLog': {
        await bridge.githubLog?.(msg.payload);
        reply({ result: true });
        return;
      }
      case 'getCredentialEntry': {
        const type = msg.payload?.type;
        const id = msg.payload?.id;
        const result = await bridge.getEntry?.(type, id);
        reply({ result });
        return;
      }
      default: {
        reply({ error: `Unsupported git method: ${msg.method}` });
      }
    }
  } catch (error) {
    reply({ error: error?.message || String(error) });
  }
});

// Generic embedded credential editor bridge (Database / Printer)
window.addEventListener('message', async (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'embed-tab') return;

  const reply = (payload) => {
    try {
      event.source?.postMessage?.({ __from: 'embed-shell', id: msg.id, ...payload }, '*');
    } catch (error) {
      console.error('[CredentialManager] failed posting embed-shell reply', error);
    }
  };

  try {
    if (!bridge) {
      reply({ error: 'Credential bridge missing' });
      return;
    }

    switch (msg.method) {
      case 'credentialsLoad': {
        const result = await bridge.load?.();
        reply({ result });
        return;
      }
      case 'credentialsSave': {
        const result = await bridge.save?.(msg.payload);
        reply({ result });
        return;
      }
      case 'credentialsTest': {
        const result = await bridge.test?.(msg.payload);
        reply({ result });
        return;
      }
      case 'credentialsGetEntry': {
        const type = msg.payload?.type;
        const id = msg.payload?.id;
        const result = await bridge.getEntry?.(type, id);
        reply({ result });
        return;
      }
      case 'credentialsClose': {
        closeEditorModal();
        reply({ result: true });
        return;
      }
      case 'printerList': {
        const result = await bridge.listPrinterEntries?.();
        reply({ result: result || [] });
        return;
      }
      case 'printerSave': {
        const result = await bridge.savePrinterEntry?.(msg.payload);
        reply({ result });
        return;
      }
      case 'printerTest': {
        const result = await bridge.testPrinterConnection?.(msg.payload);
        reply({ result });
        return;
      }
      default: {
        reply({ error: `Unsupported embed method: ${msg.method}` });
      }
    }
  } catch (error) {
    reply({ error: error?.message || String(error) });
  }
});

// Handle simple postMessage events from embedded forms (local/other) when bridge isn't available in the iframe
window.addEventListener('message', async (event) => {
  const msg = event?.data;
  if (!msg || msg.__from !== 'embed-embed') return;
  if (!bridge) return;

  if (msg.type === 'save-local') {
    try {
      await bridge.saveOtherEntry?.(msg.payload);
      refresh();
      event.source?.postMessage?.({ __from: 'embed-shell', type: 'saved' }, '*');
      closeEditorModal();
    } catch (error) {
      event.source?.postMessage?.({ __from: 'embed-shell', type: 'save-error', error: error?.message || String(error) }, '*');
    }
  }
});

const handleDelete = async (row) => {
  if (!row) return;
  const label = row.name || row.type || row.id;
  const confirmed = await new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    const msg = `Delete ${label}? This cannot be undone.`;
    modal.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-body">
          <div class="confirm-title">Confirm delete</div>
          <div class="confirm-text">${msg}</div>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn ghost confirm-cancel">Cancel</button>
          <button type="button" class="btn primary confirm-ok">Delete</button>
        </div>
      </div>
    `;
    const cleanup = (result) => {
      modal.remove();
      resolve(result);
    };
    modal.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
    modal.querySelector('.confirm-ok').addEventListener('click', () => cleanup(true));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) cleanup(false);
    });
    document.body.appendChild(modal);
  });
  if (!confirmed) return;
  try {
    if (isRegistryRow(row)) {
      await bridge?.deleteEntry?.(row.entryType, row.id);
      await refresh();
      return;
    }
    if (row.entryType === 'git') {
      await bridge?.githubReset?.();
      await refresh();
      return;
    }
    if (row.entryType === 'database') {
      await bridge?.databaseReset?.();
      await refresh();
      return;
    }
  } catch (error) {
    console.error('[CredentialManager] delete failed', error);
    setStatus('Delete failed.');
    setTimeout(() => setStatus(''), 2000);
  }
};

const renderRows = (rows = []) => {
  if (!rowsEl) return;
  rowsEl.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = row.name || '';
    tr.appendChild(nameCell);

    const typeCell = document.createElement('td');
    const typeBadge = document.createElement('span');
    const typeName = isLocalRow(row) ? 'local' : row.entryType || '';
    typeBadge.className = `type-pill type-${typeName}`.trim();
    typeBadge.textContent = isLocalRow(row) ? 'LOCAL' : row.type || row.entryType || row.id;
    typeCell.appendChild(typeBadge);
    tr.appendChild(typeCell);

    const statusCell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `status-pill ${row.configured ? 'ok' : 'missing'}`;
    pill.textContent = row.configured ? 'Configured' : 'Missing';
    statusCell.appendChild(pill);

    if (row.summary) {
      const summary = document.createElement('div');
      summary.className = 'status-summary';
      summary.textContent = row.summary;
      statusCell.appendChild(summary);
    }

    tr.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'table-actions';
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'action-pill';
    const disableActions = row.entryType === 'other' && row.entrySource !== 'registry';
    actionsWrap.appendChild(
      createIconButton('edit', 'Edit credential', () => handleEdit(row), disableActions)
    );
    actionsWrap.appendChild(
      createIconButton('delete', 'Delete credential', () => handleDelete(row), disableActions)
    );
    actionsCell.appendChild(actionsWrap);
    tr.appendChild(actionsCell);

    rowsEl.appendChild(tr);
  });
};

const handleEdit = (row) => {
  if (!row) {
    return;
  }
  const options = {};
  if (isRegistryRow(row)) {
    options.entryId = row.id;
  }
  if (isLocalRow(row)) {
    openEditorModal(`../credentialManager/local.html${buildQuery(options)}`, 'Local Configuration');
    return;
  }
  if (row.entryType === 'git') {
    openEditorModal(`../github/index.html${buildQuery(options)}`, 'GitHub Sync');
    return;
  }
  if (row.entryType === 'database') {
    openEditorModal(`../credentials/index.html${buildQuery(options)}`, 'Database Credentials');
    return;
  }
  if (row.entryType === 'other') {
    openEditorModal(`../credentialManager/other.html${buildQuery(options)}`, 'Other Configuration');
    return;
  }
  if (row.entryType === 'printer') {
    openEditorModal(`../credentialManager/printer.html${buildQuery(options)}`, 'Printer Configuration');
    return;
  }
};

const openAddConfigFlow = (type) => {
  if (!type) return;
  // Keep the credential manager context and open the editor as a modal iframe.
  const modalMap = {
    git: {
      path: '../github/index.html',
      title: 'GitHub Sync'
    },
    database: {
      path: '../credentials/index.html',
      title: 'Database Credentials'
    },
    other: {
      path: '../credentialManager/other.html',
      title: 'Other Configuration'
    },
    printer: {
      path: '../credentialManager/printer.html',
      title: 'Printer Configuration'
    },
    local: {
      path: '../credentialManager/local.html',
      title: 'Local Configuration'
    }
  };

  const target = modalMap[type];
  if (!target) return;

  // Close dropdown and open embedded editor
  bridge?.closeManager?.();
  openEditorModal(`${target.path}${buildQuery({ mode: 'new' })}`, target.title);
};

const toggleAddConfigMenu = (force) => {
  if (!addConfigMenu) return;
  const next = typeof force === 'boolean' ? force : !addConfigMenu.classList.contains('open');
  if (next) {
    addConfigMenu.classList.add('open');
    addConfigMenu.setAttribute('aria-hidden', 'false');
    addConfigButton?.classList.add('open');
  } else {
    addConfigMenu.classList.remove('open');
    addConfigMenu.setAttribute('aria-hidden', 'true');
    addConfigButton?.classList.remove('open');
  }
};

addConfigButton?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleAddConfigMenu();
});

addConfigMenu?.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const type = button.dataset.type;
    toggleAddConfigMenu(false);
    openAddConfigFlow(type);
  });
});

document.addEventListener('click', (event) => {
  if (!addConfigMenu?.classList.contains('open')) {
    return;
  }
  if (
    addConfigMenu &&
    !addConfigMenu.contains(event.target) &&
    addConfigButton &&
    !addConfigButton.contains(event.target)
  ) {
    toggleAddConfigMenu(false);
  }
});

const refresh = async () => {
  try {
    setStatus('Loading...');
    state.rows = (await bridge?.list?.()) || [];
    const filtered = applyFilter(state.rows, state.query);
    renderRows(filtered);
    setStatus(state.rows.length ? '' : 'No credentials to display yet.');
  } catch (error) {
    console.error('[CredentialManager] Failed to load credentials', error);
    setStatus('Unable to load credentials.');
  }
};

bridge?.onManagerRefresh?.(() => refresh());

const searchInput = document.getElementById('searchBox');
searchInput?.addEventListener('input', () => {
  state.query = searchInput.value || '';
  const filtered = applyFilter(state.rows, state.query);
  renderRows(filtered);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (editorModal?.classList.contains('open')) {
      closeEditorModal();
      return;
    }
    if (localModal?.classList.contains('open')) {
      closeLocalModal();
      return;
    }
    bridge?.closeManager?.();
  }
});

// Local modal helpers
const openLocalModal = () => {
  if (!localModal) return;
  localModal.classList.add('open');
  localModal.setAttribute('aria-hidden', 'false');
  if (localError) localError.textContent = '';
  if (localFolderInput) localFolderInput.value = '';
  if (localPathInput) {
    localPathInput.value = '';
    localPathInput.focus();
  }
};

const closeLocalModal = () => {
  if (!localModal) return;
  localModal.classList.remove('open');
  localModal.setAttribute('aria-hidden', 'true');
};

localClose?.addEventListener('click', closeLocalModal);
localCancel?.addEventListener('click', closeLocalModal);
localModal?.addEventListener('click', (event) => {
  if (event.target === localModal) {
    closeLocalModal();
  }
});

editorClose?.addEventListener('click', closeEditorModal);
editorModal?.addEventListener('click', (event) => {
  if (event.target === editorModal) {
    closeEditorModal();
  }
});

localForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!bridge?.saveOtherEntry) return;
  const folderName = (localFolderInput?.value || '').trim();
  const path = (localPathInput?.value || '').trim();
  if (!path) {
    if (localError) localError.textContent = 'Path is required.';
    return;
  }
  if (localError) localError.textContent = '';
  const label = folderName ? `Local - ${folderName}` : 'Local Path';
  try {
    await bridge.saveOtherEntry({
      label,
      description: `Local path: ${path}`,
      secret: path
    });
    closeLocalModal();
    await refresh();
    setStatus('Local config saved.');
    setTimeout(() => setStatus(''), 2000);
  } catch (error) {
    console.error('[CredentialManager] save local failed', error);
    if (localError) localError.textContent = 'Failed to save. Please try again.';
  }
});

async function openLocalTab(options = {}) {
  try {
    // Deprecated: Local configs now open inside the modal (embed) like other credential types.
    openEditorModal(`../credentialManager/local.html${buildQuery(options)}`, 'Local Configuration');
  } catch (error) {
    console.error('[CredentialManager] open local tab failed', error);
  }
}

refresh();
