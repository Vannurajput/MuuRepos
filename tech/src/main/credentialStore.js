const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const keytar = require('keytar');
const log = require('../logger');
const { buildTlsOptions, prepareHostPort, preparePassword } = require('./connectors/helpers/connectionOptions');

const CONFIG_NAME = 'credential-config.json';
const SERVICE_NAME = 'codex-electron-browser-credentials';
const PASSWORD_ACCOUNT = 'db-password';

const defaultConfig = {
  label: '',
  customId: '',
  connectionName: '',
  dbType: '',
  host: '',
  port: '',
  database: '',
  user: '',
  ssh: {
    enabled: false,
    host: '',
    port: '',
    user: '',
    password: '',
    privateKey: '',
    passphrase: '',
    remoteHost: '',
    remotePort: ''
  },
  ssl: {
    enabled: false,
    rejectUnauthorized: true,
    servername: '',
    ca: '',
    cert: '',
    key: ''
  },
  iam: {
    enabled: false,
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    host: '',
    port: ''
  }
};

const getConfigPath = () => path.join(app.getPath('userData'), CONFIG_NAME);

async function loadConfig() {
  try {
    const data = await fs.readFile(getConfigPath(), 'utf8');
    const parsed = JSON.parse(data);
    const password = await keytar.getPassword(SERVICE_NAME, PASSWORD_ACCOUNT);
    return {
      ...defaultConfig,
      ...parsed,
      ssh: { ...defaultConfig.ssh, ...(parsed?.ssh || {}) },
      ssl: { ...defaultConfig.ssl, ...(parsed?.ssl || {}) },
      iam: { ...defaultConfig.iam, ...(parsed?.iam || {}) },
      password: password || ''
    };
  } catch {
    const password = await keytar.getPassword(SERVICE_NAME, PASSWORD_ACCOUNT);
    return { ...defaultConfig, password: password || '' };
  }
}

async function saveConfig(payload = {}) {
  const { password, ...rest } = payload || {};
  const normalized = {
    label: rest.label || rest.connectionName || '',
    customId: rest.customId || rest.id || '',
    connectionName: rest.connectionName || rest.label || '',
    dbType: rest.dbType || '',
    host: rest.host || '',
    port: rest.port || '',
    database: rest.database || '',
    user: rest.user || '',
    ssh: { ...defaultConfig.ssh, ...(rest.ssh || {}) },
    ssl: { ...defaultConfig.ssl, ...(rest.ssl || {}) },
    iam: { ...defaultConfig.iam, ...(rest.iam || {}) }
  };

  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(normalized, null, 2), 'utf8');

  if (typeof password === 'string') {
    if (password.length) {
      await keytar.setPassword(SERVICE_NAME, PASSWORD_ACCOUNT, password);
    } else {
      await keytar.deletePassword(SERVICE_NAME, PASSWORD_ACCOUNT);
    }
  }

  return { ...normalized, password: password || '' };
}

const parsePort = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const dbTesters = {
  postgres: async ({ host, port, database, user, password, ssl, ssh, iam }) => {
    const { Client } = require('pg');
    const tunnel = await prepareHostPort({ host, port, ssh });
    const sslConfig = iam?.enabled ? { enabled: true, ...(ssl || {}) } : ssl;
    const finalPassword = await preparePassword({
      host: iam?.host || host,
      port: iam?.port || port,
      user,
      password,
      iam
    });
    const client = new Client({
      host: tunnel.host,
      port: parsePort(tunnel.port, 5432),
      database,
      user,
      password: finalPassword,
      connectionTimeoutMillis: 5000,
      ssl: buildTlsOptions(sslConfig)
    });
    await client.connect();
    try {
      await client.end();
    } finally {
      await tunnel.cleanup();
    }
  },
  mysql: async ({ host, port, database, user, password, ssl, ssh, iam }) => {
    const mysql = require('mysql2/promise');
    const tunnel = await prepareHostPort({ host, port, ssh });
    const sslConfig = iam?.enabled ? { enabled: true, ...(ssl || {}) } : ssl;
    const finalPassword = await preparePassword({
      host: iam?.host || host,
      port: iam?.port || port,
      user,
      password,
      iam
    });
    const connection = await mysql.createConnection({
      host: tunnel.host,
      port: parsePort(tunnel.port, 3306),
      user,
      password: finalPassword,
      database,
      connectTimeout: 5000,
      ssl: buildTlsOptions(sslConfig)
    });
    try {
      await connection.ping();
      await connection.end();
    } finally {
      await tunnel.cleanup();
    }
  },
  sqlserver: async ({ host, port, database, user, password, ssl, ssh, iam }) => {
    const sql = require('mssql');
    const tunnel = await prepareHostPort({ host, port, ssh });
    const sslConfig = iam?.enabled ? { enabled: true, ...(ssl || {}) } : ssl;
    const tls = buildTlsOptions(sslConfig);
    const finalPassword = await preparePassword({
      host: iam?.host || host,
      port: iam?.port || port,
      user,
      password,
      iam
    });
    const cryptoCredentialsDetails = {};
    if (tls?.ca) cryptoCredentialsDetails.ca = tls.ca;
    if (tls?.cert) cryptoCredentialsDetails.cert = tls.cert;
    if (tls?.key) cryptoCredentialsDetails.key = tls.key;
    const hasCrypto = Object.keys(cryptoCredentialsDetails).length > 0;
    try {
      await sql.connect({
        server: tunnel.host,
        port: parsePort(tunnel.port, 1433),
        user,
        password: finalPassword,
        database,
        options: {
          encrypt: !!tls,
          trustServerCertificate: tls ? !tls.rejectUnauthorized : true,
          serverName: tls?.servername || tls?.serverName || undefined,
          cryptoCredentialsDetails: hasCrypto ? cryptoCredentialsDetails : undefined
        },
        connectionTimeout: 5000,
        requestTimeout: 5000
      });
    } finally {
      await sql.close().catch(() => {});
      await tunnel.cleanup();
    }
  },
  sqlite: async ({ database }) => {
    const sqlite3 = require('sqlite3');
    const dbPath = database || ':memory:';
    await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        db.close((closeErr) => (closeErr ? reject(closeErr) : resolve()));
      });
    });
  },
  mongo: async ({ host, port, database, user, password }) => {
    const { MongoClient } = require('mongodb');
    const auth =
      user && password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : '';
    const dbSegment = database ? `/${database}` : '';
    const portSegment = port ? `:${port}` : '';
    const uri = `mongodb://${auth}${host}${portSegment}${dbSegment}`;
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    try {
      await client.db(database || undefined).command({ ping: 1 });
    } finally {
      await client.close();
    }
  }
};

async function testConnection(config = {}) {
  const { host, port, database, user, dbType, label, connectionName } = config || {};
  const normalizedType = (dbType || '').toLowerCase();

  log.info('[CredentialStore] Test connection requested', {
    dbType: normalizedType || '',
    host: host || '',
    port: port || '',
    database: database || '',
    user: user || '',
    connectionName: connectionName || label || ''
  });

  if (!normalizedType) {
    return { ok: false, message: 'Select a database type' };
  }

  const tester = dbTesters[normalizedType];
  if (!tester) {
    return { ok: false, message: `Unsupported database type: ${dbType}` };
  }

  try {
    await tester({
  host,
  port,
  database,
  user,
  password: config.password,
  ssl: config.ssl, // ✅ pass ssl settings
  ssh: config.ssh, // optional (for future SSH tunnel)
  iam: config.iam  // optional (for future IAM)
});

    log.info('[CredentialStore] Test connection succeeded', { dbType: normalizedType });
    return { ok: true, message: 'Connection successful' };
  } catch (error) {
    log.error('[CredentialStore] Test connection failed', error);
    return { ok: false, message: error?.message || 'Connection failed' };
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  testConnection
};




