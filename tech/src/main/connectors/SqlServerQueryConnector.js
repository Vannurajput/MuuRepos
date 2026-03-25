const sql = require('mssql');
const { buildTlsOptions, prepareHostPort, preparePassword } = require('./helpers/connectionOptions');

const parsePort = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const convertPlaceholders = (query = '') => {
  let i = 0;
  return query.replace(/\?/g, () => `@p${i++}`);
};

class SqlServerQueryConnector {
  async execute({ sql: query, params = [], credentials = {} } = {}) {
    const prepared = convertPlaceholders(query);
    const { host, port, cleanup } = await prepareHostPort(credentials);
    const password = await preparePassword({
      ...credentials,
      host: credentials.iam?.host || credentials.host,
      port: credentials.iam?.port || credentials.port
    });
    const sslConfig = credentials.iam?.enabled
      ? { enabled: true, ...(credentials.ssl || {}) }
      : credentials.ssl;
    const ssl = buildTlsOptions(sslConfig);

    const cryptoCredentialsDetails = {};
    if (ssl?.ca) cryptoCredentialsDetails.ca = ssl.ca;
    if (ssl?.cert) cryptoCredentialsDetails.cert = ssl.cert;
    if (ssl?.key) cryptoCredentialsDetails.key = ssl.key;
    const hasCryptoDetails = Object.keys(cryptoCredentialsDetails).length > 0;

    const pool = new sql.ConnectionPool({
      server: host,
      port: parsePort(port, 1433),
      user: credentials.user,
      password,
      database: credentials.database,
      options: {
        encrypt: !!ssl,
        trustServerCertificate: ssl ? !ssl.rejectUnauthorized : true,
        cryptoCredentialsDetails: hasCryptoDetails ? cryptoCredentialsDetails : undefined
      },
      connectionTimeout: 8000,
      requestTimeout: 8000
    });

    await pool.connect();
    try {
      const request = pool.request();
      params.forEach((val, idx) => {
        request.input(`p${idx}`, val);
      });
      const result = await request.query(prepared);
      const rows = result?.recordset || [];
      const rowCount = Array.isArray(rows) ? rows.length : 0;
      return { ok: true, rowCount, rows };
    } finally {
      await pool.close().catch(() => {});
      await cleanup().catch?.(() => {});
    }
  }
}

module.exports = SqlServerQueryConnector;

