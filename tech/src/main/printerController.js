/**
 * printerController.js
 * Encapsulates all printer credential IPC handling so main.js stays lean.
 */
const PrintConnector = require('./connectors/PrintConnector');

const normalizePrinterPayload = (payload = {}) => {
  const printerName = (payload.printerName || payload.deviceName || '').trim();
  const printerType = (payload.printerType || '').trim();
  const printerModel = (payload.printerModel || '').trim();
  const companyName = (payload.companyName || '').trim();
  const printerPort = (payload.printerPort || payload.port || '').trim();
  const printMode = (payload.printMode || 'graphic').trim();
  const label = (payload.label || printerName || 'Printer').trim();

  return {
    id: payload.id,
    label,
    printerName,
    deviceName: printerName,
    printerType,
    printerModel,
    companyName,
    printerPort,
    printMode
  };
};

const buildTestPayload = (printerName, printerId) => {
  const now = new Date();
  return {
    printerId,
    printer_name: printerName,
    deviceName: printerName,
    data: [
      {
        type: 'header',
        data: {
          top_title: 'Printer Test',
          sub_titles: ['Printer connectivity check'],
          date_of_bill: now.toLocaleDateString(),
          time: now.toLocaleTimeString()
        }
      },
      {
        type: 'item',
        data: {
          itemdata: [
            {
              item_name: 'Connection verification',
              quantity: 1,
              item_amount: 0
            }
          ]
        }
      },
      {
        type: 'footer',
        data: {
          align: 'center',
          footer_text: ['Printer connected successfully']
        }
      }
    ]
  };
};

const registerPrinterHandlers = ({
  ipcMain,
  credentialRegistry,
  broadcastCredentialManagerRefresh,
  log
}) => {
  if (!ipcMain || !credentialRegistry) {
    throw new Error('printerController requires ipcMain and credentialRegistry');
  }

  ipcMain.handle('credentials:printer:list', async () => credentialRegistry.list('printer'));

  ipcMain.handle('credentials:printer:save', async (_event, payload = {}) => {
    const normalized = normalizePrinterPayload(payload);
    const entry = await credentialRegistry.upsert('printer', normalized);
    log?.info?.('[PrinterConfig] saved printer entry', {
      id: entry.id,
      printerName: normalized.printerName,
      printerType: normalized.printerType,
      printerModel: normalized.printerModel,
      companyName: normalized.companyName,
      printerPort: normalized.printerPort
    });
    broadcastCredentialManagerRefresh?.();
    return entry;
  });

  ipcMain.handle('credentials:printer:test', async (_event, payload = {}) => {
    const connector = new PrintConnector();
    const printerId = payload.id || payload.printerId || null;
    const printerName = (payload.printerName || payload.deviceName || '').trim() || 'Test Printer';
    const testPayload = buildTestPayload(printerName, printerId);
    try {
      const result = await connector.execute(testPayload);
      log?.info?.('[PrinterConfig] test print complete', { printerId, printerName, ok: result?.ok });
      return result;
    } catch (error) {
      log?.error?.('[PrinterConfig] test print failed', error);
      return { ok: false, error: error?.message || 'Printer test failed' };
    }
  });
};

module.exports = { registerPrinterHandlers };
