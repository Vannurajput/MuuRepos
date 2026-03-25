const { exec } = require('child_process');

class CliRunner {
  run(job = {}) {
    return new Promise((resolve) => {
      const payload = job.payload || {};
      const command = payload.command || payload.cmd;
      const cwd = payload.cwd || payload.workingDir || process.cwd();
      const timeout = Number(payload.timeoutMs || 0) || 5 * 60 * 1000; // default 5 minutes

      if (!command) {
        resolve({ ok: false, message: 'Missing command for CLI job' });
        return;
      }

      const child = exec(command, { cwd, timeout }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            ok: false,
            message: `CLI failed: ${error.message}`,
            outputPath: null,
            stdout,
            stderr
          });
          return;
        }
        resolve({
          ok: true,
          message: 'CLI completed',
          outputPath: null,
          stdout,
          stderr
        });
      });

      child.on('error', (err) => {
        resolve({ ok: false, message: `CLI spawn error: ${err.message}` });
      });
    });
  }
}

module.exports = CliRunner;
