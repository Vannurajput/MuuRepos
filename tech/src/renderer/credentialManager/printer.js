(() => {
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get('embed') === '1';
  const hasNativeBridge = !!window.credentialBridge?.savePrinterEntry;

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
      getEntry: (type, id) => postToParent('credentialsGetEntry', { type, id }),
      savePrinterEntry: (payload) => postToParent('printerSave', payload),
      testPrinterConnection: (payload) => postToParent('printerTest', payload),
      close: () => postToParent('credentialsClose')
    };
  const form = document.getElementById('printerForm');
  const cancelBtn = document.getElementById('cancelPrinter');
  const statusLabel = document.getElementById('connectedStatus');
  const testBtn = document.getElementById('testPrinter');

  let activeEntryId = params.get('entryId') || null;

  const printerNameInput = document.getElementById('printerName');
  const printerTypeInput = document.getElementById('printerType');
  const printerModelInput = document.getElementById('printerModel');
  const companyInput = document.getElementById('companyName');
  const printerPortInput = document.getElementById('printerPort');
  const printerPortRow = document.getElementById('printerPortRow');
  const printModeInput = document.getElementById('printMode');

  const requestResize = () => {
    if (!isEmbed || !window.parent || window.parent === window) return;
    window.parent.postMessage({ __from: 'embed-embed', type: 'resize' }, '*');
  };

  const setStatus = (text, variant = 'neutral') => {
    if (!statusLabel) return;
    statusLabel.textContent = text || '';
    statusLabel.classList.toggle('success', variant === 'success');
    statusLabel.classList.toggle('error', variant === 'error');
    requestAnimationFrame(requestResize);
  };

  const isIpAddress = (value = '') => /^\d{1,3}(\.\d{1,3}){3}$/.test(value.trim());

  const shouldShowPort = () => printerTypeInput.value === 'network';

  const updatePortVisibility = () => {
    const visible = shouldShowPort();
    printerPortRow?.classList.toggle('visible', visible);
    if (printerPortInput) {
      printerPortInput.required = visible;
      if (!visible) {
        printerPortInput.value = '';
      } else if (!printerPortInput.value) {
        printerPortInput.value = '9100';
      }
    }
    requestAnimationFrame(requestResize);
  };

  const fillForm = (entry = {}) => {
    printerNameInput.value = entry.printerName || entry.deviceName || entry.label || entry.name || '';
    printerTypeInput.value = entry.printerType || '';
    printerModelInput.value = entry.printerModel || '';
    companyInput.value = entry.companyName || '';
    // [ADDED: Print Mode]
    if (printModeInput) {
      printModeInput.value = entry.printMode || 'graphic';
    }
    if (printerPortInput) {
      printerPortInput.value = entry.printerPort || entry.port || '';
    }
    updatePortVisibility();
    if (entry.id) {
      setStatus('Printer connected', 'success');
    } else {
      setStatus('New printer', 'neutral');
    }
  };

  const collectFormPayload = () => ({
    id: activeEntryId || undefined,
    printerName: printerNameInput.value.trim(),
    printerType: printerTypeInput.value,
    printerPort: printerPortInput?.value.trim(),
    printerModel: printerModelInput.value.trim(),
    companyName: companyInput.value.trim(),
    printMode: printModeInput ? printModeInput.value : 'graphic'
  });

  const loadExisting = async () => {
    if (!activeEntryId) {
      fillForm({});
      requestAnimationFrame(requestResize);
      return;
    }
    try {
      const entry = await bridge?.getEntry?.('printer', activeEntryId);
      if (entry) {
        fillForm(entry);
      } else {
        fillForm({});
      }
    } catch (error) {
      console.error('[PrinterConfig] failed to load printer entry', error);
      fillForm({});
    } finally {
      requestAnimationFrame(requestResize);
    }
  };

  cancelBtn?.addEventListener('click', () => {
    if (isEmbed) {
      bridge?.close?.();
    } else {
      window.close?.();
    }
  });

  testBtn?.addEventListener('click', async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (typeof bridge?.testPrinterConnection !== 'function') {
      setStatus('Test unavailable.', 'error');
      return;
    }
    const payload = collectFormPayload();
    try {
      const result = await bridge.testPrinterConnection(payload);
      if (result?.ok) {
        setStatus('Printer test sent successfully.', 'success');
      } else {
        setStatus(result?.error || 'Printer test failed.', 'error');
      }
    } catch (error) {
      console.error('[PrinterConfig] printer test failed', error);
      setStatus('Unable to run printer test.', 'error');
    }
  });

  printerTypeInput?.addEventListener('change', updatePortVisibility);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const payload = collectFormPayload();
    console.log('[PrinterConfig] submit payload', payload);
    try {
      setStatus('Saving...', 'neutral');
      const saved = await bridge?.savePrinterEntry?.(payload);
      console.log('[PrinterConfig] save result', saved);
      activeEntryId = saved?.id || activeEntryId;
      await loadExisting();
      setStatus('Saved successfully', 'success');
    } catch (error) {
      console.error('[PrinterConfig] save failed', error);
      setStatus('Unable to save printer configuration.', 'error');
    }
  });

  loadExisting();
})();
