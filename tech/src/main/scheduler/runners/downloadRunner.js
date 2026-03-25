const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class DownloadRunner {
  async run(job = {}) {
    const payload = job.payload || {};
    const url = payload.url || payload.href;
    const outputDir = payload.outputDir || payload.destination || payload.path || '';
    const fileName = payload.fileName || payload.name || `download-${Date.now()}`;

    if (!url || !outputDir) {
      return { ok: false, message: 'Missing url or outputDir for download job' };
    }

    await fsp.mkdir(outputDir, { recursive: true });
    const dest = path.join(outputDir, fileName);

    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, message: `Download failed: ${res.status} ${res.statusText}` };
    }

    const fileStream = fs.createWriteStream(dest);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    return { ok: true, message: `Downloaded to ${path.basename(dest)}`, outputPath: dest };
  }
}

module.exports = DownloadRunner;
