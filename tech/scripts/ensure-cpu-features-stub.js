const fs = require('fs');
const path = require('path');

const stubDir = path.resolve(__dirname, '..', 'vendor', 'cpu-features-stub');
const targets = [
  path.resolve(__dirname, '..', 'node_modules', 'cpu-features'),
  path.resolve(__dirname, '..', 'node_modules', 'ssh2', 'node_modules', 'cpu-features')
];

const copyRecursive = (src, dest) => {
  if (!fs.existsSync(src)) {
    console.warn('[cpu-stub] stub source missing at', src);
    return;
  }
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch (_) {
      // ignore
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
};

try {
  targets.forEach((dest) => {
    copyRecursive(stubDir, dest);
  });
  console.log('[cpu-stub] ensured stub at:', targets.join(', '));
} catch (err) {
  console.warn('[cpu-stub] failed to ensure stub', err);
} 
