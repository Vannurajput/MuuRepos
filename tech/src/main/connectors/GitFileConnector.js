const BaseConnector = require('./BaseConnector');
const credentialRegistry = require('../credentialRegistry');
const githubManager = require('../githubManager');

const decodeDataUrl = (value = '') => {
  const match = value.match(/^data:.*;base64,(.+)$/i);
  const base64 = match ? match[1] : value;
  return Buffer.from(base64, 'base64');
};

const normalizePath = (dir = '', fileName = '') => {
  const cleanDir = String(dir || '')
    .trim()
    .replace(/^[\/\\]+|[\/\\]+$/g, '');
  const safeName = String(fileName || '').trim() || `upload-${Date.now()}.bin`;
  return cleanDir ? `${cleanDir}/${safeName}` : safeName;
};

class GitFileConnector extends BaseConnector {
  async execute(payload = {}) {
    const credentialId = payload.credentialId || payload.entryId;
    const name = payload.name || payload.fileName;
    const entry =
      (credentialId && (await credentialRegistry.get('git', credentialId))) || null;

    let owner = entry?.owner;
    let repo = entry?.repository;
    let branch = payload.branch || entry?.branch || 'main';
    let token = entry?.pat;
    let defaultCommitMessage =
      payload.commitMessage ||
      entry?.defaultCommitMessage ||
      `chore(file): add ${name || 'file'}`;

    if (!owner || !repo || !token) {
      const fallback = await githubManager.loadConfig();
      owner = owner || fallback.owner;
      repo = repo || fallback.repository || fallback.repo;
      branch = branch || fallback.branch || 'main';
      token = token || fallback.pat;
      defaultCommitMessage =
        payload.commitMessage ||
        entry?.defaultCommitMessage ||
        fallback.defaultCommitMessage ||
        defaultCommitMessage;
    }

    if (!owner || !repo || !token) {
      throw new Error('GitFileConnector: Missing repository credentials');
    }

    const filePath = normalizePath(payload.pathInRepo, name);
    let buffer;
    if (payload.dataUrl) {
      buffer = decodeDataUrl(payload.dataUrl);
    } else if (payload.bytes) {
      buffer = Buffer.isBuffer(payload.bytes)
        ? payload.bytes
        : Buffer.from(payload.bytes);
    } else if (typeof payload.textContent === 'string') {
      buffer = Buffer.from(payload.textContent, 'utf8');
    } else {
      throw new Error('GitFileConnector: file data is required');
    }

    const result = await githubManager.pushFileBuffer({
      owner,
      repo,
      branch,
      filePath,
      token,
      buffer,
      commitMessage: defaultCommitMessage
    });

    return {
      ok: true,
      connector: 'GIT_FILE',
      path: result.path,
      branch: result.branch,
      repo: result.repo,
      commit: result.commit
    };
  }
}

module.exports = GitFileConnector;
