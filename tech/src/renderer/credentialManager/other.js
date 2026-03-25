(() => {
  const form = document.getElementById('otherForm');
  const cancelBtn = document.getElementById('cancelOther');
  const parentBridge =
    (window.parent && window.parent !== window && window.parent.credentialBridge) || null;
  const bridge = window.credentialBridge || parentBridge;
  const params = new URLSearchParams(window.location.search);
  let activeEntryId = params.get('entryId') || null;
  const mode = (params.get('mode') || '').toLowerCase();
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

  // Redirect to local config page when opened with mode=local
  if (mode === 'local') {
    const target = new URL('local.html', window.location.href);
    const nextParams = new URLSearchParams();
    if (activeEntryId) nextParams.set('entryId', activeEntryId);
    target.search = nextParams.toString();
    window.location.replace(target.toString());
    return;
  }

  const fillForm = (entry = {}) => {
    document.getElementById('otherLabel').value = entry.label || '';
    document.getElementById('otherDescription').value = entry.description || '';
    document.getElementById('otherSecret').value = entry.secret || '';
    requestResize();
  };

  const bootstrap = async () => {
    if (activeEntryId && bridge?.getEntry) {
      try {
        const entry = await bridge.getEntry('other', activeEntryId);
        if (entry) {
          fillForm(entry);
        }
      } catch (error) {
        console.error('[OtherCredential] failed to load entry', error);
      }
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

  document.getElementById('otherClose')?.addEventListener('click', closeSelf);
  cancelBtn?.addEventListener('click', closeSelf);
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: activeEntryId || undefined,
      label: document.getElementById('otherLabel').value.trim(),
      description: document.getElementById('otherDescription').value.trim(),
      secret: document.getElementById('otherSecret').value
    };
    try {
      const saved = await bridge?.saveOtherEntry?.(payload);
      activeEntryId = saved?.id || activeEntryId;
      try {
        window.parent?.postMessage?.({ __from: 'embed-embed', type: 'saved' }, '*');
      } catch (_) {}
      closeSelf();
    } catch (error) {
      console.error('[OtherCredential] save failed', error);
      alert('Unable to save credential.');
    }
  });

  bootstrap().finally(() => requestResize());
})();
