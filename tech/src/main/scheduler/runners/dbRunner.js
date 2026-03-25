const path = require('path');
const fsp = require('fs/promises');
const DbQueryRouter = require('../../connectors/DbQueryRouter');

class DbRunner {
  constructor() {
    this.router = new DbQueryRouter();
  }

  async run(job = {}) {
    const payload = job.payload || {};
    const query = payload.query || payload.sql;
    const dbType = payload.dbType || payload.type || '';
    const credentialId = payload.credentialId || payload.connectionId || payload.connectionname;
    const database = payload.database || payload.db || '';
    const params = Array.isArray(payload.params) ? payload.params : [];
    const outputDir = payload.outputDir || payload.destination || payload.path || '';
    const format = (payload.format || 'json').toLowerCase();

    if (!query || !dbType) {
      return { ok: false, message: 'Missing query or dbType for DB export' };
    }
    if (!outputDir) {
      return { ok: false, message: 'Missing outputDir for DB export' };
    }

    const result = await this.router.execute({
      sql: query,
      dbType,
      credentialId,
      database,
      params
    });

    if (!result?.ok) {
      return { ok: false, message: result?.error || 'DB query failed' };
    }

    const rows = result.rows || result.data || result.result || [];
    await fsp.mkdir(outputDir, { recursive: true });
    const fileBase = `db-export-${Date.now()}`;
    const filePath =
      format === 'csv'
        ? path.join(outputDir, `${fileBase}.csv`)
        : path.join(outputDir, `${fileBase}.json`);

    if (format === 'csv') {
      const csv = this.toCsv(rows);
      await fsp.writeFile(filePath, csv, 'utf-8');
    } else {
      await fsp.writeFile(filePath, JSON.stringify(rows, null, 2), 'utf-8');
    }

    return {
      ok: true,
      message: `Exported ${rows.length || 0} rows to ${path.basename(filePath)}`,
      outputPath: filePath
    };
  }

  toCsv(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return '';
    const headers = Object.keys(rows[0] || {});
    const escape = (value) => {
      const s = value == null ? '' : String(value);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      const line = headers.map((h) => escape(row[h]));
      lines.push(line.join(','));
    }
    return lines.join('\n');
  }
}

module.exports = DbRunner;
