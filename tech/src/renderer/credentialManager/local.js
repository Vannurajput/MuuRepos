(() => {
  const parentBridge =
    (window.parent && window.parent !== window && window.parent.credentialBridge) || null;
  const bridge = window.credentialBridge || parentBridge;
  const params = new URLSearchParams(window.location.search);
  let activeEntryId = params.get('entryId') || null;
  const isEmbed = params.get('embed') === '1';

  if (isEmbed) {
    document.body.classList.add('embed');
  }

  const requestResize = () => {
    try {
      window.parent?.postMessage?.({ __from: 'embed-embed', type: 'resize' }, '*');
    } catch (_) {
      // ignore
    }
  };

  const folderInput = document.getElementById('localFolder');
  const pathInput = document.getElementById('localPath');
  const errorEl = document.getElementById('localError');
  const form = document.getElementById('localForm');
  const logEl = document.getElementById('localLog');

  const showStatus = (message = '', type = 'info') => {
    if (!logEl) return;
    logEl.textContent = message;
    logEl.style.color = type === 'error' ? '#b91c1c' : '#0f766e';
    logEl.style.fontSize = '13px';
    logEl.style.marginTop = '6px';
    if (message) {
      setTimeout(() => {
        if (logEl.textContent === message) {
          logEl.textContent = '';
        }
      }, 2500);
    }
  };

  const logMsg = (msg) => {
    console.log('[LocalConfig]', msg);
    if (logEl) logEl.textContent = msg;
  };

  const fillForm = (entry = {}) => {
    folderInput.value = (entry.label || '').replace(/^Local\s*-\s*/i, '') || '';
    const path = entry.secret || (entry.description || '').replace(/^Local path:\s*/i, '');
    pathInput.value = path || '';
    logMsg('Loaded existing local config.');
    requestResize();
  };

  const loadExisting = async () => {
    if (!activeEntryId || !bridge?.getEntry) return;
    try {
      const entry = await bridge.getEntry('other', activeEntryId);
      if (entry) {
        fillForm(entry);
      } else {
        logMsg('No existing entry found.');
      }
    } catch (error) {
      console.error('[LocalConfig] failed to load entry', error);
      logMsg('Failed to load existing entry.');
    }
    requestResize();
  };

  const saveEntry = async () => {
    const folder = folderInput.value.trim();
    const path = pathInput.value.trim();
    if (!path) {
      errorEl.textContent = 'Path is required.';
      logMsg('Save failed: missing path.');
      return;
    }
    if (!bridge?.saveOtherEntry) {
      // Try to delegate to parent regardless (covers missing embed flag)
      try {
        errorEl.textContent = '';
        showStatus('Saving...', 'info');
        window.parent?.postMessage?.(
          { __from: 'embed-embed', type: 'save-local', payload: payload },
          '*'
        );
        return;
      } catch (err) {
        errorEl.textContent = 'Save is unavailable (bridge missing). Please reopen from Credential Manager.';
        logMsg('Save failed: bridge missing.');
        return;
      }
    }
    errorEl.textContent = '';
    const label = folder ? `Local - ${folder}` : 'Local Path';
    const payload = {
      id: activeEntryId || undefined,
      label,
      description: `Local path: ${path}`,
      secret: path
    };
    try {
      const saved = await bridge?.saveOtherEntry?.(payload);
      if (!saved?.id && !activeEntryId) {
        errorEl.textContent = 'Unable to save. Please try again.';
        logMsg('Save failed: no entry returned.');
        showStatus('Unable to save. Please try again.', 'error');
        return;
      }
      activeEntryId = saved?.id || activeEntryId;
      logMsg('Local config saved.');
      showStatus('Local configuration saved.', 'info');
      try {
        window.parent?.postMessage?.({ __from: 'embed-embed', type: 'saved' }, '*');
      } catch (_) {}
      closeSelf();
    } catch (error) {
      console.error('[LocalConfig] save failed', error);
      errorEl.textContent = 'Unable to save. Please try again.';
      logMsg('Save failed. See console for details.');
      showStatus('Unable to save. Please try again.', 'error');
    }
  };

  const closeSelf = () => {
    if (isEmbed) {
      try {
        window.parent?.postMessage?.({ __from: 'embed-embed', type: 'close' }, '*');
      } catch (_) {}
    } else {
      window.close?.();
    }
  };

  document.getElementById('localClose')?.addEventListener('click', closeSelf);
  document.getElementById('localCancel')?.addEventListener('click', closeSelf);

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEntry();
  });

  logMsg('Ready for local config.');
  loadExisting();
  requestResize();
})();
