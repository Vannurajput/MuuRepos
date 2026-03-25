// src/main/connectors/GitConnector.js
const BaseConnector = require('./BaseConnector');
let githubManager = null;
try { githubManager = require('../githubManager'); } catch (_) {}

class GitConnector extends BaseConnector {
  async execute(payload) {
    const { git = {}, ...rest } = payload;

    // Load saved config first so we can fallback to those values when message omits them
    const stored = (githubManager?.loadConfig ? await githubManager.loadConfig() : {}) || {};

    const owner  = git.owner || stored.owner;
    const repo   = git.repo || stored.repository || stored.repo;
    const branch = git.branch || stored.branch || 'main';

    // Prefer saved token from your app's GitHub settings; fallback to git.token in message (for testing)
    const token  = stored.pat || stored.token || git.token; // PAT is saved as 'pat'



    if (!owner || !repo) {
      throw new Error('GitConnector: git.owner and git.repo are required');
    }
    if (!token) {
      throw new Error('GitConnector: GitHub token not found. Save it in settings or include git.token');
    }

    // Build the JSON we will commit
    const savedAt = new Date().toISOString();
    const dataToPersist = {
      _kind: 'browser-payload',
      _savedAt: savedAt,
      git: { owner, repo, branch },
      ...rest, // includes db, dbType, metadata
    };

    const resolveFilePath = (basePath) => {
      const defaultName = savedAt.replace(/[:]/g, '-');
      const normalized = String(basePath || '').trim().replace(/\\/g, '/');
      if (!normalized) {
        return `payloads/${defaultName}.json`;
      }
      const parts = normalized.split('/');
      const last = parts[parts.length - 1];
      const hasExtension = /\.[^/.]+$/.test(last || '');
      if (hasExtension) {
        return normalized;
      }
      const cleanedDir = normalized.replace(/\/+$/, '');
      return `${cleanedDir}/${defaultName}.json`;
    };

    // Target path + commit message
    const defaultPath = resolveFilePath(stored.defaultPath);
    const filePath = resolveFilePath(git.filePath) || defaultPath;
    const commitMessage = git.commitMessage || stored.defaultCommitMessage || `chore(payload): add ${filePath}`;

    // Prefer a helper on githubManager if present, else use direct API
    if (githubManager?.pushJson) {
      await githubManager.pushJson({ owner, repo, branch, filePath, token, commitMessage, json: dataToPersist });
      return { ok: true, connector: 'GIT', path: filePath, message: 'Payload pushed via githubManager.pushJson()' };
    }

    await pushJsonViaGitHubApi({ owner, repo, branch, filePath, token, commitMessage, json: dataToPersist });
    return { ok: true, connector: 'GIT', path: filePath, message: 'Payload pushed via GitHub API' };
  }
}

const encodeRepoPath = (path) => {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

async function pushJsonViaGitHubApi({ owner, repo, branch, filePath, token, commitMessage, json }) {
  const API = 'https://api.github.com';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'electron-browser-client'
  };

  // If the file exists, we need its SHA to update
  let sha;
  {
    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(branch)}`, {
      method: 'GET',
      headers
    });
    if (res.status === 200) {
      const j = await res.json();
      sha = j.sha;
    } else if (res.status !== 404) {
      const text = await res.text();
      throw new Error(`GitHub GET contents failed: ${res.status} ${text}`);
    }
  }

  const content = Buffer.from(JSON.stringify(json, null, 2), 'utf8').toString('base64');
  const body = { message: commitMessage, content, branch, ...(sha ? { sha } : {}) };

  const put = await fetch(`${API}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!put.ok) {
    const text = await put.text();
    throw new Error(`GitHub PUT contents failed: ${put.status} ${text}`);
  }
}

module.exports = GitConnector;
