/**
 * githubManager.js
 * Handles GitHub connectivity, push, and pull operations.
 */
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');
const log = require('../logger');
const githubStore = require('./githubStore');

const API_BASE = 'https://api.github.com';
const POSIX = path.posix;

// ✅ ensure fetch exists in main process (Electron/Node versions may vary)
const _fetch = global.fetch || (async (...args) => {
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(...args);
});

const withAuthHeaders = (pat) => ({
  // FIX: use 'token' scheme for PATs
  Authorization: `token ${pat}`,
  'User-Agent': 'Chromo/Electron',
  Accept: 'application/vnd.github+json'
});

const encodeRepoPath = (path) =>
  String(path || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

// Confirms the PAT has access to the requested repository + branch + contents.
async function verifyRepository(config) {
  const repoLabel = `${config.owner}/${config.repository}`;
  const headers = withAuthHeaders(config.pat);
  log.info('[GitHub] Verifying repository access', {
    repo: repoLabel,
    branch: config.branch || 'auto'
  });

  // 1) repo exists
  const repoRes = await _fetch(`${API_BASE}/repos/${config.owner}/${config.repository}`, { headers });
  if (!repoRes.ok) {
    const body = await repoRes.text();
    log.error('[GitHub] Repo check failed', {
      repo: repoLabel,
      status: repoRes.status,
      body: body?.slice?.(0, 200) || body
    });
    throw new Error(`Failed to verify repository: ${repoRes.status} ${body}`);
  }
  const repo = await repoRes.json();

  // 2) branch exists (default to repo.default_branch if not provided)
  const branch = (config.branch && config.branch.trim()) || repo.default_branch;
  const brRes = await _fetch(
    `${API_BASE}/repos/${config.owner}/${config.repository}/branches/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!brRes.ok) {
    const body = await brRes.text();
    throw new Error(`Branch "${branch}" not found: ${brRes.status} ${body}`);
  }

  // 3) contents permission probe (requires contents:read)
  const listRes = await _fetch(
    `${API_BASE}/repos/${config.owner}/${config.repository}/contents?ref=${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Token lacks contents access: ${listRes.status} ${body}`);
  }

  log.info('[GitHub] Repository access confirmed', { repo: repoLabel, branch });
  // Return resolved branch so caller can persist it when user left blank.
  return { branch };
}

// Returns the SHA of the configured file if it already exists.
async function getExistingFileSha(config) {
  const ref = (config.branch && config.branch.trim()) || 'main';
  const url = `${API_BASE}/repos/${config.owner}/${config.repository}/contents/${config.defaultPath}?ref=${ref}`;
  const response = await _fetch(url, { headers: withAuthHeaders(config.pat) });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch existing file info: ${response.status} ${body}`);
  }
  const data = await response.json();
  return data.sha;
}

// Pushes inline text content to the configured repository path.
async function pushContent({ commitMessage, textContent, zipBytes, zipFileName, targetPath }) {
  const config = await githubStore.loadConfig();
  if (!config.pat || !config.owner || !config.repository || !config.defaultPath) {
    throw new Error('Missing GitHub configuration. Please fill Owner/Repo/Path.');
  }

  const hasZip = !!zipBytes && (zipBytes.length || zipBytes.byteLength);

  if (hasZip) {
    const buffer = normalizeToBuffer(zipBytes);
    if (!buffer || !buffer.length) {
      throw new Error('Zip archive is empty.');
    }
    log.info('[GitHub] Zip push requested', {
      repo: `${config.owner}/${config.repository}`,
      branch: config.branch,
      fileName: zipFileName,
      zipKB: Number(buffer.length / 1024).toFixed(2)
    });
    return pushZipArchive({
      config,
      commitMessage,
      zipBuffer: buffer,
      zipFileName
    });
  }

  if (!textContent || !textContent.length) {
    throw new Error('Enter some text or select a zip archive to push.');
  }
  const contentBuffer = Buffer.from(textContent, 'utf8');

  // FIX: compute finalPath before logging it
  const finalPath = (targetPath || config.defaultPath || '').trim();
  if (!finalPath) {
    throw new Error('Provide a repository path to push text.');
  }

  log.info('[GitHub] Text push requested', {
    repo: `${config.owner}/${config.repository}`,
    branch: config.branch,
    bytes: contentBuffer.length,
    path: finalPath
  });

  const sha = await getExistingFileSha({ ...config, defaultPath: finalPath });

  const url = `${API_BASE}/repos/${config.owner}/${config.repository}/contents/${finalPath}`;
  const body = {
    message: commitMessage || config.defaultCommitMessage,
    content: contentBuffer.toString('base64'),
    branch: config.branch,
    sha: sha || undefined
  };
  const response = await _fetch(url, {
    method: 'PUT',
    headers: {
      ...withAuthHeaders(config.pat),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to push file to ${finalPath}: ${response.status} ${text}`);
  }
  const result = await response.json();
  return {
    ...result,
    bytes: contentBuffer.length,
    files: 1
  };
}

// Downloads the configured file contents so the renderer can show it.
async function pullContent() {
  const config = await githubStore.loadConfig();
  if (!config.pat || !config.owner || !config.repository || !config.defaultPath) {
    throw new Error('Missing GitHub configuration or default path.');
  }
  return pullFile({
    owner: config.owner,
    repo: config.repository,
    branch: config.branch,
    filePath: config.defaultPath,
    token: config.pat
  });
}

async function pullFile({ owner, repo, branch = 'main', filePath, token }) {
  if (!owner || !repo || !filePath) {
    throw new Error('pullFile: owner, repo, and filePath are required');
  }
  if (!token) {
    throw new Error('pullFile: token is required');
  }
  const ref = (branch && branch.trim()) || 'main';
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(ref)}`;
  const response = await _fetch(url, { headers: withAuthHeaders(token) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to pull file: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    const archive = await downloadDirectoryArchive({
      owner,
      repo,
      ref,
      dirPath: filePath,
      token
    });
    return {
      content: null,
      buffer: archive.buffer,
      sha: null,
      path: filePath,
      repo: `${owner}/${repo}`,
      branch: ref,
      downloadUrl: null,
      downloadName: archive.fileName
    };
  }

  let buffer;
  if (data.content) {
    buffer = Buffer.from(data.content, 'base64');
  } else if (data.download_url) {
    const downloadRes = await _fetch(data.download_url, { headers: withAuthHeaders(token) });
    if (!downloadRes.ok) {
      const text = await downloadRes.text();
      throw new Error(`Failed to download file: ${downloadRes.status} ${text}`);
    }
    if (typeof downloadRes.arrayBuffer === 'function') {
      const ab = await downloadRes.arrayBuffer();
      buffer = Buffer.from(ab);
    } else if (typeof downloadRes.buffer === 'function') {
      buffer = await downloadRes.buffer();
    } else {
      const text = await downloadRes.text();
      buffer = Buffer.from(text, 'utf8');
    }
  } else if (data.sha) {
    const blobRes = await _fetch(
      `${API_BASE}/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(data.sha)}`,
      { headers: withAuthHeaders(token) }
    );
    if (!blobRes.ok) {
      const text = await blobRes.text();
      throw new Error(`Failed to download blob: ${blobRes.status} ${text}`);
    }
    const blobJson = await blobRes.json();
    if (blobJson.content) {
      const encoding =
        blobJson.encoding === 'utf-8' || blobJson.encoding === 'utf8' ? 'utf8' : blobJson.encoding || 'base64';
      buffer = Buffer.from(blobJson.content, encoding);
    }
  } else {
    throw new Error(`GitHub API did not return file content for "${filePath}".`);
  }

  return {
    content: buffer.toString('utf8'),
    buffer,
    sha: data.sha,
    path: filePath,
    repo: `${owner}/${repo}`,
    branch: ref,
    downloadUrl: data.download_url || null,
    downloadName: POSIX.basename(filePath)
  };
}

async function downloadDirectoryArchive({ owner, repo, ref, dirPath, token }) {
  const normalizedDir = String(dirPath || '').replace(/^\/+|\/+$/g, '');
  const files = [];

  const walk = async (currentPath) => {
    const encoded = encodeRepoPath(currentPath);
    const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encoded}${encoded ? '' : ''}?ref=${encodeURIComponent(ref)}`;
    const res = await _fetch(url, { headers: withAuthHeaders(token) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to read directory "${currentPath || '/'}": ${res.status} ${text}`);
    }
    const list = await res.json();
    if (!Array.isArray(list)) {
      throw new Error(`Expected directory listing for "${currentPath || '/'}"`);
    }
    for (const item of list) {
      const entryPath = item.path || (currentPath ? POSIX.join(currentPath, item.name) : item.name);
      if (item.type === 'file') {
        const fileBuffer = await fetchFileBufferFromEntry({
          downloadUrl: item.download_url,
          owner,
          repo,
          ref,
          repoPath: entryPath,
          token
        });
        const relative = normalizedDir ? POSIX.relative(normalizedDir, entryPath) : entryPath;
        const safeRelative = relative && !relative.startsWith('..') ? relative : item.name;
        if (safeRelative) {
          files.push({ relativePath: safeRelative, buffer: fileBuffer });
        }
      } else if (item.type === 'dir') {
        await walk(entryPath);
      }
    }
  };

  await walk(normalizedDir);
  if (!files.length) {
    throw new Error(`Directory "${dirPath}" contains no files to download.`);
  }

  const zip = new AdmZip();
  files.forEach((file) => zip.addFile(file.relativePath, file.buffer));
  const baseName = normalizedDir ? POSIX.basename(normalizedDir) : repo;
  const archiveName = `${baseName || 'payloads'}.zip`;
  return { buffer: zip.toBuffer(), fileName: archiveName };
}

async function fetchFileBufferFromEntry({ downloadUrl, owner, repo, ref, repoPath, token }) {
  if (downloadUrl) {
    return fetchBufferFromUrl(downloadUrl, token);
  }
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(ref)}`;
  const res = await _fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download file "${repoPath}": ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json.content) {
    throw new Error(`GitHub API did not return contents for "${repoPath}".`);
  }
  return Buffer.from(json.content, 'base64');
}

async function fetchBufferFromUrl(url, token) {
  const res = await _fetch(url, { headers: withAuthHeaders(token) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download file: ${res.status} ${text}`);
  }
  if (typeof res.arrayBuffer === 'function') {
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  if (typeof res.buffer === 'function') {
    const buf = await res.buffer();
    return Buffer.from(buf);
  }
  const text = await res.text();
  return Buffer.from(text, 'utf8');
}

// Validates and persists the Git connection settings.
async function saveConfig(config = {}) {
  const trimmed = {
    pat: (config.pat || '').trim(),
    owner: (config.owner || '').trim(),
    repository: (config.repository || '').trim(),
    defaultPath: (config.defaultPath || '').trim(),
    branch: (config.branch || '').trim() || 'main',
    defaultCommitMessage: (config.defaultCommitMessage || '').trim() || 'chore: push from Chromo'
  };

  if (!trimmed.owner) throw new Error('Owner is required.');
  if (!trimmed.repository) throw new Error('Repository is required.');
  if (!trimmed.defaultPath) throw new Error('Default path is required.');
  if (!trimmed.pat) throw new Error('Personal Access Token (PAT) is required.');

  log.info('[GitHub] Save config requested', {
    owner: trimmed.owner,
    repository: trimmed.repository,
    branch: trimmed.branch,
    defaultPath: trimmed.defaultPath ? trimmed.defaultPath : undefined
  });

  // FIX: verify repo/branch/contents and persist resolved branch if user left blank
  const verified = await verifyRepository(trimmed);
  if (!trimmed.branch) trimmed.branch = verified.branch;

  const saved = await githubStore.saveConfig(trimmed);
  log.info('[GitHub] Config saved', {
    owner: saved.owner,
    repository: saved.repository,
    branch: saved.branch
  });
  return saved;
}

// Clears stored GitHub credentials/PAT.
async function signOut() {
  await githubStore.clearConfig();
}

module.exports = {
  saveConfig,
  loadConfig: githubStore.loadConfig,
  signOut,
  pushContent,
  pullContent,
  pullFile,
  pushJson,
  pushFileBuffer
};


// Helper: create/update a JSON file at a repo path.

async function pushJson({ owner, repo, branch = 'main', filePath, token, commitMessage, json }) {
  if (!owner || !repo || !filePath) {
    throw new Error('pushJson: owner, repo, and filePath are required');
  }
  if (!token) {
    throw new Error('pushJson: token is required');
  }

  // 1) If the file exists, get its SHA (updates require sha)
  let sha = null;
  {
    const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(branch)}`;
    const res = await _fetch(url, { headers: withAuthHeaders(token) });
    if (res.status === 200) {
      const j = await res.json();
      sha = j.sha;
    } else if (res.status !== 404) {
      const text = await res.text();
      throw new Error(`GitHub GET contents failed: ${res.status} ${text}`);
    }
  }

  // 2) Prepare content
  const content = Buffer.from(JSON.stringify(json, null, 2), 'utf8').toString('base64');
  const body = {
    message: commitMessage || `chore(payload): add ${filePath}`,
    content,
    branch,
    ...(sha ? { sha } : {})
  };

  // 3) PUT create/update
  {
    const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}`;
    const res = await _fetch(url, {
      method: 'PUT',
      headers: {
        ...withAuthHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub PUT contents failed: ${res.status} ${text}`);
    }
    return res.json();
  }
}

async function pushFileBuffer({
  owner,
  repo,
  branch = 'main',
  filePath,
  token,
  buffer,
  commitMessage
}) {
  if (!owner || !repo || !filePath) {
    throw new Error('pushFileBuffer: owner, repo, and filePath are required');
  }
  if (!token) {
    throw new Error('pushFileBuffer: token is required');
  }
  if (!buffer || !buffer.length) {
    throw new Error('pushFileBuffer: buffer is empty');
  }

  let sha = null;
  try {
    sha = await getExistingFileSha({ owner, repository: repo, branch, defaultPath: filePath, pat: token });
  } catch (_) {
    // ignore; treated as new file
  }

  const content = buffer.toString('base64');
  const body = {
    message: commitMessage || `chore(file): update ${filePath}`,
    content,
    branch,
    ...(sha ? { sha } : {})
  };

  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}`;
  const res = await _fetch(url, {
    method: 'PUT',
    headers: {
      ...withAuthHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to push file: ${res.status} ${text}`);
  }
  const result = await res.json();
  return {
    path: result.content?.path || filePath,
    branch,
    repo: `${owner}/${repo}`,
    commit: result.commit
  };
}

function normalizeToBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(input));
  }

  // ipcRenderer may serialize Buffers as { type: 'Buffer', data: [] }
  if (Array.isArray(input)) {
    return Buffer.from(input);
  }
  if (input && input.type === 'Buffer' && Array.isArray(input.data)) {
    return Buffer.from(input.data);
  }

  return null;
}

const cleanBasePath = (input = '') => {
  if (!input) return '';
  const normalized = POSIX.normalize(String(input).trim().replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized === '/') {
    return '';
  }
  return normalized.replace(/^\/+/, '').replace(/\/+$/, '');
};

const deriveZipPrefix = (input = '') => {
  if (!input) return '';
  const normalized = cleanBasePath(input);
  if (!normalized) return '';

  const originalEndsWithSlash = /[\\/]$/.test(input.trim());
  if (originalEndsWithSlash) {
    return normalized;
  }

  if (!normalized.includes('/')) {
    return normalized.includes('.') ? '' : normalized;
  }

  const lastSlash = normalized.lastIndexOf('/');
  const tail = normalized.slice(lastSlash + 1);
  if (tail.includes('.')) {
    return normalized.slice(0, lastSlash);
  }
  return normalized;
};

const sanitizeEntryPath = (entryName = '') => {
  if (!entryName) return null;
  const normalized = POSIX.normalize(entryName.replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.endsWith('/')) {
    return null;
  }
  if (normalized.startsWith('..')) {
    return null;
  }
  const trimmed = normalized.replace(/^\/+/, '');
  if (trimmed.toLowerCase().startsWith('__macosx/')) {
    return null;
  }
  return trimmed;
};

const shouldStripCommonRoot = (paths) => {
  if (!paths.length) return false;
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) {
    return false;
  }
  const root = segments[0][0];
  if (!root) return false;
  return segments.every((parts) => parts[0] === root);
};

const stripFirstSegment = (relativePath) => {
  const idx = relativePath.indexOf('/');
  if (idx === -1) {
    return relativePath;
  }
  return relativePath.slice(idx + 1);
};

async function pushZipArchive({ config, commitMessage, zipBuffer, zipFileName }) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (!entries.length) {
    throw new Error('Zip archive contains no files to push.');
  }

  const sanitizedEntries = entries
    .map((entry) => ({
      relative: sanitizeEntryPath(entry.entryName),
      entry
    }))
    .filter((item) => !!item.relative);

  if (!sanitizedEntries.length) {
    throw new Error('Zip archive did not contain any publishable files.');
  }

  const stripOuterFolder = shouldStripCommonRoot(sanitizedEntries.map((item) => item.relative));
  const repoPrefix = deriveZipPrefix(config.defaultPath);
  log.info('[GitHub] Zip archive parsed', {
    repo: `${config.owner}/${config.repository}`,
    branch: config.branch,
    repoPrefix,
    files: sanitizedEntries.length,
    zipKB: Number(zipBuffer.length / 1024).toFixed(2),
    stripOuterFolder
  });

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-zip-'));
  const repoDir = path.join(tempRoot, 'repo');

  try {
    await cloneRepository(config, repoDir, tempRoot);
    await configureGitIdentity(repoDir);

    const targetDir = repoPrefix ? path.join(repoDir, repoPrefix) : repoDir;
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    let written = 0;
    for (const item of sanitizedEntries) {
      const adjustedRelative = stripOuterFolder ? stripFirstSegment(item.relative) : item.relative;
      const destPath = path.join(targetDir, adjustedRelative);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      const buffer = item.entry.getData();
      await fs.writeFile(destPath, buffer);
      written++;
    }
    log.info('[GitHub] Copied zip files into repo', {
      targetDir,
      files: written
    });

    await runGit(['add', '.'], repoDir);
    const hasChanges = await workingTreeHasChanges(repoDir);
    if (!hasChanges) {
      log.info('[GitHub] Zip push skipped: no changes detected after extraction.');
      return {
        files: 0,
        commit: null,
        bytes: zipBuffer.length
      };
    }
    const message =
      commitMessage?.trim() ||
      config.defaultCommitMessage ||
      `chore: push ${zipFileName || 'archive'}`;

    await runGit(['commit', '-m', message], repoDir);

    await runGit(['push', 'origin', config.branch], repoDir);
    const commitSha = (await runGit(['rev-parse', 'HEAD'], repoDir)).trim();
    log.info('[GitHub] Zip push committed via git CLI', {
      repo: `${config.owner}/${config.repository}`,
      files: written,
      commit: commitSha
    });
    return {
      files: written,
      commit: { sha: commitSha },
      bytes: zipBuffer.length
    };
  } finally {
    await safeRemove(tempRoot);
  }
}

async function cloneRepository(config, repoDir, workRoot) {
  const authUrl = buildAuthUrl(config);
  await runGit(
    ['clone', '--branch', config.branch, '--depth', '1', authUrl, repoDir],
    workRoot,
    { redact: true }
  );
}

async function configureGitIdentity(repoDir) {
  await runGit(['config', 'user.name', 'Codex Browser'], repoDir);
  await runGit(['config', 'user.email', 'codex-browser@example.com'], repoDir);
}

async function safeRemove(target) {
  if (!target) return;
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    log.warn('[GitHub] Failed to remove temp directory', { target, error: err.message });
  }
}

async function runGit(args, cwd, options = {}) {
  const displayArgs = options.redact ? '[redacted]' : args.join(' ');
  log.info('[GitHub] git command', { cwd, args: displayArgs });
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args[0]} failed: ${stderr || `exit code ${code}`}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function workingTreeHasChanges(repoDir) {
  const status = await runGit(['status', '--porcelain'], repoDir);
  return status.trim().length > 0;
}

const buildAuthUrl = (config) => {
  const token = encodeURIComponent(config.pat);
  return `https://${token}@github.com/${config.owner}/${config.repository}.git`;
};

async function requestJson(url, options) {
  const response = await _fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }
  return response.json();
}
