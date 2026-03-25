const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class GitHubRunner {
  async run(job = {}) {
    const payload = job.payload || {};
    const owner = payload.owner || payload.org || payload.user;
    const repo = payload.repo || payload.repository;
    const branch = payload.branch || 'main';
    const token = payload.token || payload.pat || '';
    const outputDir = payload.outputDir || payload.path || payload.destination || '';

    if (!owner || !repo) {
      return { ok: false, message: 'Missing owner/repo for GitHub pull' };
    }
    if (!outputDir) {
      return { ok: false, message: 'Missing outputDir for GitHub pull' };
    }

    await fsp.mkdir(outputDir, { recursive: true });
    const zipName = `${repo}-${branch}-${Date.now()}.zip`;
    const dest = path.join(outputDir, zipName);

    const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`;
    const headers = {
      'User-Agent': 'MuBrowser-Scheduler'
    };
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: `GitHub pull failed: ${res.status} ${text}` };
    }

    const fileStream = fs.createWriteStream(dest);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    return { ok: true, message: `Downloaded ${zipName}`, outputPath: dest };
  }
}

module.exports = GitHubRunner;
