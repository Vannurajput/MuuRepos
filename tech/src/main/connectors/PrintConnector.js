const { BrowserWindow } = require('electron');
const net = require('net');
const http = require('http');
const https = require('https');
const log = require('../../logger');
const credentialRegistry = require('../credentialRegistry');

/* ---------- utils ---------- */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function isNum(v) { const n = Number(v); return Number.isFinite(n); }
function money(v) { return isNum(v) ? Number(v).toFixed(2) : '0.00'; }

/* ---------- HTML builder tuned for 80mm printers ---------- */
function buildReceiptHtml(payload) {
  const blocks = Array.isArray(payload?.data) ? payload.data : [];

  // Make the inner printable width slightly smaller than the paper
  // so we never hit the driver’s unprintable margins.
  const printableMm = Math.min(72, Number(payload?.printable_mm) || 70);
  const leftOffsetMm = Number(payload?.left_offset_mm) || 0;   // + moves right
  const fontSizePx = Number(payload?.font_size_px) || 13;
  const sepChars = Number(payload?.item_length) || 42;

  const priceColMm = Math.max(16, Math.min(24, Math.round(printableMm * 0.28))); // slimmer price col
  const qtyColMm = 6;  // tighter qty column

  const css = `
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: monospace;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: ${fontSizePx}px;
      background: #fff;
    }
    /* Our inner "paper". Left-aligned with a little padding + optional nudge */
    .paper {
      width: ${printableMm}mm;
      margin: 0;
      padding: 3mm 2mm 3mm 4mm;    /* LEFT padding protects against clipping */
      transform: translateX(${leftOffsetMm}mm);
      box-sizing: border-box;
    }

    .center { text-align: center; }
    .right  { text-align: right; }
    .left   { text-align: left; }

    .logo { margin: 2mm 0 3mm; text-align: center; }
    .logo img { max-width: 100%; height: auto; display: inline-block; }

    .line  { margin: 1mm 0; }
    .sep   { margin: 2mm 0 2mm; border-top: 1px dashed #000; }

    /* Item rows: qty | name | price */
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 2mm;
      margin: 0.5mm 0;
    }
    .row.head { font-weight: 700; margin-top: 2mm; }
    .qty {
      flex: 0 0 ${qtyColMm}mm;
      text-align: right;
      white-space: nowrap;
    }
    .name {
      flex: 1 1 auto;
      min-width: 0;
      word-break: break-word;
      white-space: pre-wrap;
      padding-right: 2mm;
    }
    .amount {
      flex: 0 0 ${priceColMm}mm;
      text-align: right;
      white-space: nowrap;
    }
    .bold { font-weight: 700; }
  `;

  let html = '';
  html += '<!DOCTYPE html><html><head><meta charset="UTF-8" />';
  html += '<title>Receipt</title>';
  html += `<style>${css}</style></head><body>`;
  html += `<div class="paper">`;

  for (const block of blocks) {
    const type = block?.type;
    const d = block?.data || {};

    // LOGO
    if (type === 'logo' && d.url) {
      html += `<div class="logo"><img src="${escapeHtml(d.url)}" alt="logo"/></div>`;
    }

    // HEADER (centered)
    if (type === 'header') {
      if (d.top_title) html += `<div class="center bold line">${escapeHtml(d.top_title)}</div>`;
      (d.sub_titles || []).forEach(t => { html += `<div class="center line">${escapeHtml(t)}</div>`; });
      (d.address || []).forEach(a => { html += `<div class="center line">${escapeHtml(a)}</div>`; });
      if (d.bill_no) html += `<div class="center line">Bill No: ${escapeHtml(d.bill_no)}</div>`;
      if (d.ticket_no) html += `<div class="center line">Ticket: ${escapeHtml(d.ticket_no)}</div>`;
      if (d.date_of_bill || d.time) {
        const dt = `${d.date_of_bill ? escapeHtml(d.date_of_bill) : ''}${d.time ? ' ' + escapeHtml(d.time) : ''}`;
        html += `<div class="center line">${dt}</div>`;
      }
      if (d.order_type) html += `<div class="center line">Order Type: ${escapeHtml(d.order_type)}</div>`;
      if (d.employee) html += `<div class="center line">Employee: ${escapeHtml(d.employee)}</div>`;
      if (d.till) html += `<div class="center line">Till: ${escapeHtml(d.till)}</div>`;
    }

    // SEPARATOR (text dashes)
    if (type === 'separator') {
      const len = Number(d.separator_length) || sepChars;
      html += `<div class="line">${'-'.repeat(Math.max(4, len))}</div>`;
    }

    // ITEMS: header row + qty | name | price
    if (type === 'item' && Array.isArray(d.itemdata)) {
      // ---- NEW: column header once, before the items ----
      html += `
        <div class="row head">
          <div class="name">Item</div>
          <div class="qty">Qty</div>
          <div class="amount">Price</div>
        </div>
      `;
      // ---------------------------------------------------

      for (const it of d.itemdata) {
        const qty = isNum(it.quantity) ? Number(it.quantity) : 1;
        const name = (it.item_name || '').trim();
        const amount = isNum(it.item_amount) ? it.item_amount
          : isNum(it.price) ? it.price : 0;

        html += `
          <div class="row">
            <div class="name">${escapeHtml(name)}</div>
            <div class="qty">${qty}</div>
            <div class="amount">${money(amount)}</div>
          </div>
        `;

        // Print toppings_with_price (one per line)
        if (Array.isArray(it.toppings_with_price) && it.toppings_with_price.length) {
          it.toppings_with_price.forEach((t) => {
            html += `
              <div class="row">
                <div class="name">${escapeHtml(t)}</div>
                <div class="qty"></div>
                <div class="amount"></div>
              </div>
            `;
          });
        }

        // Print toppings (plain)
        if (Array.isArray(it.toppings) && it.toppings.length) {
          it.toppings.forEach((t) => {
            html += `
              <div class="row">
                <div class="name">${escapeHtml(t)}</div>
                <div class="qty"></div>
                <div class="amount"></div>
              </div>
            `;
          });
        }
      }
    }

    // SUMMARY (key left, value right)
    if (type === 'summary' && Array.isArray(d.summary)) {
      for (const s of d.summary) {
        html += `
          <div class="row">
            <div class="name">${escapeHtml(s.key)}</div>
            <div class="amount">${money(s.value)}</div>
          </div>
        `;
      }
    }

    // BIG SUMMARY (bold)
    if (type === 'bigsummary' && Array.isArray(d.bigsummary)) {
      for (const s of d.bigsummary) {
        html += `
          <div class="row bold">
            <div class="name">${escapeHtml(s.key)}</div>
            <div class="amount">${money(s.value)}</div>
          </div>
        `;
      }
    }

    // FOOTER (align per JSON)
    if (type === 'footer' && Array.isArray(d.footer_text)) {
      const align = (d.align || 'center').toLowerCase();
      const cls = (align === 'left' || align === 'right' || align === 'center') ? align : 'center';
      html += `<div class="${cls}">`;
      d.footer_text.forEach(f => { html += `<div class="line">${escapeHtml(f)}</div>`; });
      html += `</div>`;
    }
  }

  html += `</div></body></html>`;
  return html;
}

function buildReceiptPlainText(payload) {
  const blocks = Array.isArray(payload?.data) ? payload.data : [];
  const lines = [];
  const pushLine = (text = '') => {
    if (text == null) return;
    const value = String(text).trim();
    if (value.length) {
      lines.push(value);
    }
  };
  blocks.forEach((block) => {
    const type = block?.type;
    const d = block?.data || {};
    if (type === 'header') {
      pushLine(d.top_title);
      (d.sub_titles || []).forEach(pushLine);
      (d.address || []).forEach(pushLine);
      if (d.bill_no) pushLine(`Bill No: ${d.bill_no}`);
      if (d.ticket_no) pushLine(`Ticket: ${d.ticket_no}`);
      if (d.date_of_bill || d.time) {
        pushLine([d.date_of_bill, d.time].filter(Boolean).join(' '));
      }
      if (d.order_type) pushLine(`Order Type: ${d.order_type}`);
      if (d.employee) pushLine(`Employee: ${d.employee}`);
      if (d.till) pushLine(`Till: ${d.till}`);
      lines.push('----------------------------------------');
    }
    if (type === 'item' && Array.isArray(d.itemdata)) {
      lines.push('Item                        Qty   Amt');
      d.itemdata.forEach((item) => {
        const qty = isNum(item.quantity) ? Number(item.quantity) : 1;
        const name = (item.item_name || '').slice(0, 24).padEnd(24, ' ');
        const amount = money(isNum(item.item_amount) ? item.item_amount : item.price);
        lines.push(`${name} ${String(qty).padStart(3, ' ')} ${amount.padStart(7, ' ')}`);
      });
      lines.push('----------------------------------------');
    }
    if (type === 'summary' && Array.isArray(d.summary)) {
      d.summary.forEach((entry) => {
        lines.push(`${entry.key || ''}: ${money(entry.value)}`);
      });
    }
    if (type === 'bigsummary' && Array.isArray(d.bigsummary)) {
      lines.push('==================== TOTAL ====================');
      d.bigsummary.forEach((entry) => {
        lines.push(`${entry.key || ''}: ${money(entry.value)}`);
      });
      lines.push('===============================================');
    }
    if (type === 'footer' && Array.isArray(d.footer_text)) {
      d.footer_text.forEach(pushLine);
    }
  });
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function sendRawTextToPrinter(host, port, text) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let completed = false;
    const done = (error) => {
      if (completed) return;
      completed = true;
      socket.destroy();
      error ? reject(error) : resolve(true);
    };
    socket.setTimeout(8000, () => done(new Error('Network printer timeout')));
    socket.on('error', done);
    socket.connect(Number(port) || 9100, host, () => {
      const payload = Buffer.isBuffer(text) ? text : Buffer.from(String(text || ''), 'utf8');
      socket.write(payload, () => {
        socket.end();
      });
    });
    socket.on('close', () => done());
  });
}

// Fetch a remote image and return a data URL; fallback to null on failure
function fetchToDataUrl(url, depth = 0) {
  return new Promise((resolve) => {
    if (!url || depth > 3) {
      resolve(null);
      return;
    }
    try {
      const isHttps = url.startsWith('https:');
      const client = isHttps ? https : http;
      const agent = isHttps ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      const req = client.get(
        url,
        { headers: { 'User-Agent': 'Mozilla/5.0 (PrintConnector)' }, timeout: 6000, agent },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const next = new URL(res.headers.location, url).toString();
            fetchToDataUrl(next, depth + 1).then(resolve).catch(() => resolve(null));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            try {
              const buf = Buffer.concat(chunks);
              if (!buf.length) return resolve(null);
              const mime = (res.headers['content-type'] || 'image/png').split(';')[0];
              const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
              resolve(dataUrl);
            } catch (_) {
              resolve(null);
            }
          });
        }
      );
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.on('error', () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

// Inline logo URL as data URI to avoid load/CORS issues in hidden print window
async function inlineLogoInPayload(payload) {
  if (!payload || !Array.isArray(payload.data)) return payload;
  const blocks = [];
  for (const block of payload.data) {
    if (block?.type === 'logo' && block.data?.url && /^https?:\/\//i.test(block.data.url)) {
      const inlined = await fetchToDataUrl(block.data.url);
      blocks.push({
        ...block,
        data: {
          ...block.data,
          url: inlined || block.data.url
        }
      });
    } else {
      blocks.push(block);
    }
  }
  return { ...payload, data: blocks };
}

/* ---------- Client-side Image Processing (Monochrome) ---------- */
async function processImageForBW(url) {
  if (!url) return null;
  log.info('[PrintConnector] processImageForBW: starting conversion...');

  const win = new BrowserWindow({
    width: 200, height: 200, show: false,
    webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: true }
  });

  try {
    // 1. Safe extraction of variables to avoid broken scripts
    const safeUrl = JSON.stringify(url);

    // 2. The Script
    const code = `
      (async () => {
        try {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = ${safeUrl};
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Image load failed'));
            // Give slower images more time (network logos or large files)
            setTimeout(() => reject(new Error('Image load timeout')), 7000);
          });

          const w = img.width;
          const h = img.height;
          if (!w || !h) throw new Error('Invalid image dimensions');

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          
          const data = ctx.getImageData(0, 0, w, h);
          const rgba = data.data;
          
          for (let i = 0; i < rgba.length; i += 4) {
            const r = rgba[i];
            const g = rgba[i+1];
            const b = rgba[i+2];
            const val = (r + g + b) / 3;
            // Hard threshold with slight bias for darker content
            const newCol = val < 160 ? 0 : 255;
            rgba[i] = newCol;
            rgba[i+1] = newCol;
            rgba[i+2] = newCol;
            // Force Alpha to opaque
            rgba[i+3] = 255;
          }
          ctx.putImageData(data, 0, 0);
          return canvas.toDataURL('image/png');
        } catch (e) {
          return null;
        }
      })();
    `;

    // 3. Execution with Timeout race
    const processing = win.webContents.executeJavaScript(code);
    // Slightly longer overall timeout to tolerate slow fetch/convert
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 8000));

    const result = await Promise.race([processing, timeout]);
    log.info('[PrintConnector] processImageForBW: result obtained', !!result);
    return result;

  } catch (err) {
    log.error('Failed to process BW image', err);
    return null;
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

/* ---------- Image to ESC/POS Raster ---------- */
async function generateEscPosLogo(url) {
  if (!url) return Buffer.alloc(0);

  const win = new BrowserWindow({
    width: 200, height: 200, show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  try {
    const code = `
      (async () => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = "${url}";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const maxWidth = 384; // Standard 58mm width, safe for 80mm too
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((maxWidth / w) * h);
          w = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        const data = ctx.getImageData(0, 0, w, h);
        const rgba = data.data;
        
        // Thresholding
        const mono = new Uint8Array(Math.ceil(w / 8) * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = rgba[idx];
            const g = rgba[idx+1];
            const b = rgba[idx+2];
            // Simple luminosity
            const val = (r + g + b) / 3;
            // < 128 is black (bit 1), > 128 is white (bit 0)
            if (val < 128) {
              const byteIdx = y * Math.ceil(w / 8) + Math.floor(x / 8);
              const bit = 7 - (x % 8);
              mono[byteIdx] |= (1 << bit);
            }
          }
        }
        
        return { width: w, height: h, bytes: Array.from(mono) };
      })();
    `;

    const result = await win.webContents.executeJavaScript(code);
    if (!result) return Buffer.alloc(0);

    const { width, height, bytes } = result;
    const xL = (width / 8) % 256;
    const xH = Math.floor((width / 8) / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    // GS v 0 m xL xH yL yH d1...dk
    // m=0 (density normal)
    const header = Buffer.from([0x1d, 0x76, 0x30, 0, xL, xH, yL, yH]);
    const data = Buffer.from(bytes);
    return Buffer.concat([header, data, Buffer.from('\n')]); // space after logo
  } catch (err) {
    log.error('Failed to rasterize logo', err);
    return Buffer.alloc(0);
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

/* ---------- main connector ---------- */
class PrintConnector {
  async lookupPrinterConfig(payload = {}) {
    if (payload.printerId) {
      try {
        const entry = await credentialRegistry.get('printer', payload.printerId);
        if (entry) return entry;
      } catch (error) {
        log.warn('Failed to load printer config by id', error);
      }
    }
    const names = [];
    if (typeof payload.printer_name === 'string') {
      names.push(payload.printer_name.trim());
    } else if (Array.isArray(payload.printer_name)) {
      payload.printer_name.forEach((name) => {
        if (typeof name === 'string' && name.trim()) {
          names.push(name.trim());
        }
      });
    }

    // ✅ CHANGE START: if billing sends null/empty printer_name, auto-pick a saved printer
    if (!names.length) {
      try {
        const printers = await credentialRegistry.list('printer');
        if (!Array.isArray(printers) || !printers.length) {
          return null;
        }
        // Pick the most recently saved/updated printer if timestamps exist; otherwise first one
        const sorted = [...printers].sort((a, b) => (b.updatedAt || b.modifiedAt || 0) - (a.updatedAt || a.modifiedAt || 0));
        return sorted[0] || null;
      } catch (error) {
        log.warn('Failed to auto-select default printer config', error);
        return null;
      }
    }
    // ✅ CHANGE END

    try {
      const printers = await credentialRegistry.list('printer');
      return (
        printers.find((entry) => {
          const matcher = (entry.printerName || entry.deviceName || entry.label || '').trim();
          return matcher && names.some((name) => name.toLowerCase() === matcher.toLowerCase());
        }) || null
      );
    } catch (error) {
      log.warn('Failed to list printer configs', error);
      return null;
    }
  }

  static CUT_SEQUENCE = Buffer.from([0x1d, 0x56, 0x00]); // GS V full cut

  async execute(payload = {}) {
    log.info('[PrintConnector] execute called with payload');
    if (!payload || typeof payload !== 'object') {
      log.error('[PrintConnector] invalid or missing payload:', payload);
      throw new Error('PrintConnector: invalid payload');
    }

    const printerConfig = await this.lookupPrinterConfig(payload);
    if (!printerConfig) {
      log.error('[PrintConnector] no saved printer configuration found for payload');
      return { ok: false, error: 'printer_config_missing' };
    }

    const printablePayload = await inlineLogoInPayload(payload);

    // Determine Mode: 'text' or 'graphic'. Default to auto-detect if not set.
    let useTextMode = false;
    const mode = (printerConfig.printMode || '').toLowerCase();
    const isNetworkType = printerConfig.printerType === 'network';

    if (mode === 'text') {
      useTextMode = true;
    } else if (mode === 'graphic') {
      useTextMode = false;
    } else {
      // Legacy auto-detect (Network=Text, System=Graphic)
      useTextMode = isNetworkType;
    }

    // --- NETWORK PRINTER (Raw Socket) ---
    if (isNetworkType && printerConfig.printerName) {
      if (!useTextMode) {
        // [MODIFIED] If user wants Graphic Mode on Network, we treat it as Text Mode + Bitmap Logo
        useTextMode = true;
      }

      if (useTextMode) {
        // [FIX] Generate ESC/POS Bitmap for Logo
        let logoBytes = Buffer.alloc(0);
        const logoBlock = printablePayload.data.find(b => b.type === 'logo' && b.data?.url);
        if (logoBlock) {
          log.info('[PrintConnector] generating bitmap for network logo...');
          logoBytes = await generateEscPosLogo(logoBlock.data.url);
        }

        const textReceipt = buildReceiptPlainText(printablePayload);
        const cut = PrintConnector.CUT_SEQUENCE;
        // Prepend Logo Bytes + Text + Cut
        const buffer = Buffer.concat([logoBytes, Buffer.from(textReceipt + '\n\n\n', 'utf8'), cut]);

        try {
          await sendRawTextToPrinter(printerConfig.printerName, printerConfig.printerPort || 9100, buffer);
          log.info('[PrintConnector] network print sent with logo', {
            printer: printerConfig.printerName
          });
          return { ok: true, printed: true, method: 'network-text-bitmap' };
        } catch (error) {
          log.error('[PrintConnector] network socket print failed', error);
          return { ok: false, error: 'network_print_failed' };
        }
      }
    }

    // --- SYSTEM PRINTER (Electron Window) ---
    // Handles 'Bluetooth/USB' types OR Fallback for failed network (?)
    // Currently we only reach here if NOT network type.

    let html = '';
    if (useTextMode) {
      // User wants Text look, but on a System driver.
      // We simulate it using a pre-formatted HTML block.
      const plainText = buildReceiptPlainText(printablePayload);

      // [FIX]: Check if there is a logo to print even in Text Mode (Hybrid)
      let logoHtml = '';
      const logoBlock = Array.isArray(printablePayload.data)
        ? printablePayload.data.find((b) => b?.type === 'logo' && b.data?.url)
        : null;

      if (logoBlock) {
        log.info('[PrintConnector] processing logo for system-text-mode...', { originalUrl: logoBlock.data.url });

        // Try to reuse an already inlined/base64 URL if present; otherwise convert/fetch.
        // This keeps the logo available even when the printer driver ignores remote URLs.
        let logoSrc = null;
        if (logoBlock.data.url && logoBlock.data.url.startsWith('data:')) {
          logoSrc = logoBlock.data.url;
          log.info('[PrintConnector] logo already inlined as data URL');
        } else {
          log.info('[PrintConnector] fetching remote logo URL...');
          logoSrc = await fetchToDataUrl(logoBlock.data.url);
          if (logoSrc) {
            log.info('[PrintConnector] logo fetched successfully, converted to data URL');
          } else {
            log.warn('[PrintConnector] fetchToDataUrl returned null, logo fetch failed');
          }
        }

        // [FIX] For System Printers (Not Network), we should NOT force B/W conversion.
        // Modern drivers handle grayscale/color images much better than our 1-bit dithering.
        // However, if fetchToDataUrl failed, we use processImageForBW as a fallback since
        // it has its own robust image loading mechanism via a hidden BrowserWindow.
        let processedUrl = null;
        if (isNetworkType) {
          // Network printers need ESC/POS bitmap, so always use B/W conversion
          processedUrl = await processImageForBW(logoSrc || logoBlock.data.url);
        } else {
          // System driver: prefer the fetched data URL for best quality
          if (logoSrc) {
            processedUrl = logoSrc;
            log.info('[PrintConnector] using high-quality logo for system driver');
          } else {
            // Fallback: use processImageForBW which has a robust loading mechanism
            log.warn('[PrintConnector] fallback: using processImageForBW to load logo');
            processedUrl = await processImageForBW(logoBlock.data.url);
          }
        }

        if (processedUrl) {
          logoHtml = `
            <div class="logo">
              <img src="${escapeHtml(processedUrl)}" alt="Logo">
            </div>
          `;
          log.info('[PrintConnector] logoHtml generated successfully');
        } else {
          log.error('[PrintConnector] could not load logo from any source, skipping logo');
        }
      }

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            html, body { margin: 0; padding: 0; }
            body {
              font-family: 'Courier New', monospace;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-size: 12px;
              background: #fff;
            }
            .paper {
              width: 72mm;
              margin: 0;
              padding: 3mm 2mm 3mm 4mm;
              box-sizing: border-box;
            }
            .logo {
              display: block;
              width: 100%;
              text-align: center;
              margin-bottom: 3mm;
              padding-bottom: 2mm;
              border-bottom: 1px dashed #000;
            }
            .logo img {
              max-width: 80%;
              max-height: 30mm;
              height: auto;
              display: inline-block;
            }
            .text-content { white-space: pre; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="paper">
            ${logoHtml}
            <div class="text-content">${escapeHtml(plainText)}</div>
          </div>
        </body>
        </html>`;
      log.debug('[PrintConnector] generated simulated text-mode HTML with logo');
    } else {
      // Graphic Mode (Standard)
      html = buildReceiptHtml(printablePayload);
      log.debug('[PrintConnector] generated graphic-mode HTML');
    }

    const win = new BrowserWindow({
      width: 480,
      height: 800,
      show: false,
      webPreferences: { sandbox: true }
    });

    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', resolve);
      win.webContents.once('did-fail-load', (_e, code, desc) =>
        reject(new Error(`PrintConnector: failed to load HTML (${code}) ${desc}`))
      );
      win.loadURL(url);
    });

    const deviceName = printerConfig.deviceName || printerConfig.printerName;
    if (!deviceName) {
      log.error('[PrintConnector] printer configuration missing device name', printerConfig);
      return { ok: false, error: 'printer_config_missing' };
    }

    // Best effort: wait for images (logo) to finish loading before printing (with timeout)
    try {
      const waitImages = win.webContents.executeJavaScript(`
        const imgs = Array.from(document.images || []);
        if (!imgs.length) { return true; }
        return Promise.all(
          imgs.map((img) => {
            if (img.complete && img.naturalWidth > 0) return true;
            return new Promise((resolve) => {
              const done = () => resolve(true);
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            });
          })
        );
      `);
      // Allow more time for remotely-fetched/inlined logos to finish loading.
      const timeout = new Promise((resolve) => setTimeout(resolve, 4000));
      await Promise.race([waitImages, timeout]);
    } catch (_) {
      // ignore; continue to print
    }

    return await new Promise((resolve) => {
      win.webContents.print(
        { silent: true, deviceName, printBackground: true },
        (success, reason) => {
          if (!win.isDestroyed()) win.close();
          if (!success) {
            log.error('[PrintConnector] print failed:', reason || 'unknown');
            resolve({ ok: false, error: reason || 'print failed' });
          } else {
            log.info('[PrintConnector] print job sent');
            resolve({ ok: true, printed: true, silent: true });
          }
        }
      );
    });
  }
}

module.exports = PrintConnector;
