const BaseConnector = require('./BaseConnector');
const path = require('path');
const fs = require('fs/promises');
const { app } = require('electron');
const { getDownloadsController } = require('../downloadsRegistry');
let githubManager = null;
try {
  githubManager = require('../githubManager');
} catch (_) {}

const parseRepoUrl = (url) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length >= 2) {
      return {
        owner: parts[0],
        repo: parts[1].replace(/\.git$/i, '')
      };
    }
  } catch (_) {
    // ignore
  }
  return {};
};

class GitPullConnector extends BaseConnector {
  async execute(payload = {}) {
    if (!githubManager) {
      throw new Error('GitHub manager not available');
    }

    const stored = (githubManager.loadConfig ? await githubManager.loadConfig() : {}) || {};
    let owner = payload.owner || stored.owner;
    let repo = payload.repo || stored.repository || stored.repo;

    if ((!owner || !repo) && payload.repoUrl) {
      const parsed = parseRepoUrl(payload.repoUrl);
      owner = owner || parsed.owner;
      repo = repo || parsed.repo;
    }

    const filePath = payload.filePath || stored.defaultPath;
    const branch = payload.branch || stored.branch || 'main';
    const token = payload.token || stored.pat || stored.token;

    if (!owner || !repo) {
      throw new Error('GitPullConnector: repository owner/name not specified');
    }
    if (!filePath) {
      throw new Error('GitPullConnector: filePath is required');
    }
    if (!token) {
      throw new Error('GitPullConnector: GitHub token not found. Save it in settings or include token');
    }

    const result = await githubManager.pullFile({
      owner,
      repo,
      branch,
      filePath,
      token
    });

    const buffer = result.buffer || Buffer.from(result.content || '', 'utf8');
    const downloadsDir = app?.getPath ? app.getPath('downloads') : process.cwd();
    const baseName =
      result.downloadName || path.basename(filePath || '') || `payload-${Date.now()}${result.buffer ? '.zip' : '.json'}`;
    const targetPath = await ensureUniqueFilePath(downloadsDir, baseName);
    await fs.writeFile(targetPath, buffer);

    const downloadsController = typeof getDownloadsController === 'function' ? getDownloadsController() : null;
    const downloadId = downloadsController?.recordManualDownload?.({
      fileName: path.basename(targetPath),
      savePath: targetPath,
      sourceUrl:
        payload.repoUrl ||
        result.downloadUrl ||
        `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
      totalBytes: buffer.length
    });

    return {
      ok: true,
      connector: 'GIT_PULL',
      path: result.path,
      branch: result.branch,
      repo: result.repo,
      content: result.content,
      sha: result.sha,
      savePath: targetPath,
      downloadId: downloadId || null
    };
  }
}

async function ensureUniqueFilePath(dir, fileName) {
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);
  let attempt = 0;
  while (attempt < 1000) {
    const candidateName = attempt ? `${name} (${attempt})${ext}` : fileName;
    const candidatePath = path.join(dir, candidateName);
    try {
      await fs.access(candidatePath);
      attempt++;
    } catch {
      return candidatePath;
    }
  }
  return path.join(dir, `${name}-${Date.now()}${ext}`);
}

module.exports = GitPullConnector;
