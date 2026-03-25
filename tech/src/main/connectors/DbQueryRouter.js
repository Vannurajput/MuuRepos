const credentialStore = require('../credentialStore');
const credentialRegistry = require('../credentialRegistry');
const PostgresQueryConnector = require('./PostgresQueryConnector');
const MysqlQueryConnector = require('./MysqlQueryConnector');
const SqlServerQueryConnector = require('./SqlServerQueryConnector');

const normalizeDbType = (value = '') => {
  const t = String(value || '').trim().toLowerCase();
  if (!t) return '';
  if (t === 'postgres' || t === 'postgresql' || t === 'pg') return 'postgres';
  if (t === 'mysql' || t === 'mariadb') return 'mysql';
  if (t === 'mssql' || t === 'sqlserver' || t === 'sql server') return 'mssql';
  return t;
};

async function loadCredentials({ credentialId, connectionname }) {
  if (credentialId) {
    const entry = await credentialRegistry.get('database', credentialId);
    if (entry) return entry;

    // Fallback: match credentialId against customId (MuulSQL Studio sends customId as credentialId)
    try {
      const list = (await credentialRegistry.list('database')) || [];
      const found = list.find(
        (row) => String(row.customId || '') === String(credentialId)
      );
      if (found) return found;
    } catch (_) {
      // ignore lookup errors and fall through
    }
  }

  // Fallback: try matching by label/connection name (case-insensitive)
  const name = (connectionname || '').trim().toLowerCase();
  if (name) {
    try {
      const list = (await credentialRegistry.list('database')) || [];
      const found = list.find((row) => {
        const label = (row.label || '').trim().toLowerCase();
        const connName = (row.connectionName || row.connectionname || '').trim().toLowerCase();
        const customId = (row.id || '').trim().toLowerCase();
        return label === name || connName === name || customId === name;
      });
      if (found) return found;
    } catch (_) {
      // ignore lookup errors and fall through to local config
    }
  }

  // try local store config only if it matches (or no name specified)
  const storeConfig = await credentialStore.loadConfig();
  const storeName = (storeConfig.connectionName || storeConfig.label || storeConfig.customId || '').trim().toLowerCase();
  if (!name || storeName === name) {
    return storeConfig;
  }

  // No matching connection
  throw new Error(`Connection not found for name "${connectionname}"`);
}

class DbQueryRouter {
  constructor() {
    this.engines = {
      postgres: new PostgresQueryConnector(),
      mysql: new MysqlQueryConnector(),
      mssql: new SqlServerQueryConnector()
    };
  }

  async execute(message = {}) {
    const requestId = message.requestId;
    const sqlText = message.sql || message.query;
    const params = Array.isArray(message.params) ? message.params : [];
    const isCreateDb = /^\s*create\s+database/i.test(sqlText || '');
    // Try to extract target database name for CREATE DATABASE statements
    let targetDbName = null;
    if (isCreateDb) {
      const match = sqlText.match(/create\s+database\s+("?)([^\s";]+)\1/i);
      targetDbName = match && match[2] ? match[2].replace(/["']/g, '') : null;
    }

    if (!sqlText || typeof sqlText !== 'string') {
      return { ok: false, requestId, error: 'DB_QUERY: missing sql' };
    }

    try {
      const credentials = await loadCredentials({
        credentialId: message.credentialId,
        connectionname: message.connectionname || message.connectionName
      });

    if (isCreateDb) {
      // Always use a system DB for CREATE DATABASE unless explicitly provided
      credentials.database = message.database || 'postgres';
    } else {
        // Prefer explicit database in the message; otherwise use stored database from credentials
        if (message.database) {
          credentials.database = message.database;
        }
      }

      const dbType = normalizeDbType(message.dbType || credentials?.dbType);
      const engine = this.engines[dbType];

      if (!engine) {
        return { ok: false, requestId, error: `DB_QUERY: unsupported dbType ${credentials?.dbType || 'unknown'}` };
      }

      const result = await engine.execute({ sql: sqlText, params, credentials });
      return {
        requestId,
        database: targetDbName || credentials.database,
        ...result
      };
    } catch (error) {
      return { ok: false, requestId, error: error?.message || String(error) };
    }
  }
}

module.exports = DbQueryRouter;
