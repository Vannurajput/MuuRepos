const fs = require('fs/promises');
const path = require('path');
const credentialRegistry = require('./credentialRegistry');

const toBuffer = (input) => {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return null;
};

const decodeDataUrl = (dataUrl = '') => {
  const match = dataUrl.match(/^data:.*;base64,(.+)$/i);
  const base64 = match ? match[1] : dataUrl;
  return Buffer.from(base64, 'base64');
};

async function handleLocalZip(message = {}) {
  const credentialId = message.credentialId || message.id;

  // Helper: find a usable local entry
  const resolveEntry = async () => {
    // 1) Try by explicit credentialId
    if (credentialId) {
      const found = await credentialRegistry.get('other', credentialId);
      if (found && (found.localPath || found.secret || found.description || found.path)) {
        return found;
      }
    }
    // 2) Fallback: first "other" entry that has a local path-ish field
    const all = await credentialRegistry.list('other');
    const candidate = all.find(
      (item) => item && (item.localPath || item.secret || item.description || item.path)
    );
    return candidate || null;
  };

  const entry = await resolveEntry();
  if (!entry) {
    throw new Error(
      credentialId
        ? `Local save failed: credential ${credentialId} not found`
        : 'Local save failed: no local credential found'
    );
  }

  const basePath = entry.localPath || entry.secret || entry.description || entry.path;
  if (!basePath) {
    throw new Error(`Local save failed: local path missing for credential ${entry.id || credentialId || 'unknown'}`);
  }

  const safeBase = path.resolve(basePath);
  const fileName = message.fileName || message.name || 'upload.zip';
  const buffer =
    toBuffer(message.zipBytes || message.git?.zipBytes) ||
    (message.dataUrl || message.git?.dataUrl ? decodeDataUrl(message.dataUrl || message.git?.dataUrl) : null);
  if (!buffer || !buffer.length) {
    throw new Error('Local save failed: zip data missing');
  }

  const targetPath = path.resolve(safeBase, fileName);
  if (!targetPath.startsWith(safeBase)) {
    throw new Error('Local save failed: invalid target path');
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  return {
    ok: true,
    connector: 'LOCAL_ZIP',
    fileName,
    savePath: targetPath
  };
}

module.exports = handleLocalZip;
