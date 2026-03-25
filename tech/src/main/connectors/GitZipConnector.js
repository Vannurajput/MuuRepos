const BaseConnector = require('./BaseConnector');
let githubManager = null;
try {
  githubManager = require('../githubManager');
} catch (_) {}

function toBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

function decodeDataUrl(dataUrl = '') {
  const match = dataUrl.match(/^data:.*;base64,(.+)$/i);
  const base64 = match ? match[1] : dataUrl;
  return Buffer.from(base64, 'base64');
}

class GitZipConnector extends BaseConnector {
  async execute(payload = {}) {
    if (!githubManager?.pushContent) {
      throw new Error('GitZipConnector: GitHub manager unavailable');
    }

    const stored = (githubManager.loadConfig ? await githubManager.loadConfig() : {}) || {};
    if (!stored.owner || !stored.repository || !stored.pat) {
      throw new Error('GitZipConnector: GitHub configuration not saved yet');
    }

    const info = payload.git || {};

    let buffer = toBuffer(payload.zipBytes || info.zipBytes);
    if (!buffer && (payload.dataUrl || info.dataUrl)) {
      buffer = decodeDataUrl(payload.dataUrl || info.dataUrl);
    }
    if (!buffer || !buffer.length) {
      throw new Error('GitZipConnector: zip data missing');
    }

    const fileLabel = payload.fileName || payload.name || info.fileName || info.name || 'upload.zip';
    const commitMessage =
      payload.commitMessage || info.commitMessage || `chore(zip): add ${fileLabel}`;

    const result = await githubManager.pushContent({
      commitMessage,
      zipBytes: buffer,
      zipFileName: fileLabel
    });

    return {
      ok: true,
      connector: 'GIT_ZIP',
      fileName: fileLabel,
      files: result?.files,
      commit: result?.commit?.sha
    };
  }
}

module.exports = GitZipConnector;
