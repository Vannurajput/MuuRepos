const mysql = require('mysql2/promise');
const { buildTlsOptions, prepareHostPort, preparePassword } = require('./helpers/connectionOptions');

const parsePort = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

class MysqlQueryConnector {
  async execute({ sql, params = [], credentials = {} } = {}) {
    const { host, port, cleanup } = await prepareHostPort(credentials);
    const sslConfig = credentials.iam?.enabled
      ? { enabled: true, ...(credentials.ssl || {}) }
      : credentials.ssl;
    const ssl = buildTlsOptions(sslConfig);
    const password = await preparePassword({
      ...credentials,
      host: credentials.iam?.host || credentials.host,
      port: credentials.iam?.port || credentials.port
    });

    const connection = await mysql.createConnection({
      host,
      port: parsePort(port, 3306),
      user: credentials.user,
      password,
      database: credentials.database,
      connectTimeout: 8000,
      ssl
    });
    try {
      const [rows] = await connection.execute(sql, params);
      const rowCount = Array.isArray(rows) ? rows.length : 0;
      return { ok: true, rowCount, rows: Array.isArray(rows) ? rows : [] };
    } finally {
      await connection.end().catch(() => {});
      await cleanup().catch?.(() => {});
    }
  }
}

module.exports = MysqlQueryConnector;

