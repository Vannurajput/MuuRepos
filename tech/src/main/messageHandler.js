// src/main/messageHandler.js
const ConnectorFactory = require('./connectors/ConnectorFactory');
const handleLocalZip = require('./handleLocalZip');
const log = require('../logger');

// Allow listing for quick PING health-checks
const MUULOGIN_HOSTS = ['muulogin.mycompany.com', 'muulogin.internal'];

// Normalize incoming message into the payload we pass to connectors
function buildPayload(message) {
  return {
    git: message.git || {},
    db: message.db || {},
    dbType: message.dbType || null,
    metadata: message.metadata || {}
  };
}

async function handleExternalMessage(message, options = {}) {
  const { onHandshakeStatus, handshakeContext } = options || {};

  const summary = {
    ...message,
    dataUrl: message?.dataUrl ? '[omitted]' : undefined
  };
  log.info('[MessageHandler] received external message:', summary);

  const type = message?.type;
  const normalizedType = (type || '').toUpperCase();

  if (!type) {
    // If a DB query comes without type but has connectionname + sql, route directly
    if (message?.connectionname && message?.sql) {
      try {
        const DbQueryRouter = require('./connectors/DbQueryRouter');
        const router = new DbQueryRouter();
        const res = await router.execute({ ...message });
        log.info('[MessageHandler] connector result (summary):', res);
        return res;
      } catch (error) {
        return { ok: false, error: error?.message || 'DB query failed', requestId: message?.requestId };
      }
    }
    log.warn('[MessageHandler] message missing \"type\" field:', message);
    return { ok: false, error: 'Message missing \"type\"' };
  }

  const respondError = (err) => {
    const msg = err?.message || String(err);
    log.error('[MessageHandler] error handling message:', msg, { requestId: message?.requestId });
    return { ok: false, error: msg, requestId: message?.requestId };
  };

  try {
    if (normalizedType === 'MUULORIGIN') {
      const url = handshakeContext?.url || '';
      log.info('[MessageHandler] MUULORIGIN handshake received', { url });
      if (typeof onHandshakeStatus === 'function') {
        onHandshakeStatus({
          ok: true,
          url,
          isMuulorigin: true
        });
      }
      return { ok: true, isMuulorigin: true, message: 'Muulorigin handshake acknowledged' };
    }

    if (normalizedType === 'PING') {
      const href = message?.href;
      if (!href || typeof href !== 'string') {
        log.warn('[MessageHandler] PING missing href', message);
        return { ok: false, isMuuLogin: false, message: 'Invalid or missing href' };
      }
      let hostname = '';
      try {
        const parsed = new URL(href);
        hostname = parsed.hostname || '';
      } catch (error) {
        log.warn('[MessageHandler] PING invalid href', { href });
        return { ok: false, isMuuLogin: false, message: 'Invalid or missing href' };
      }
      const isMuuLogin = MUULOGIN_HOSTS.some((host) => host && host.toLowerCase() === hostname.toLowerCase());
      const response = isMuuLogin
        ? { ok: true, isMuuLogin: true, message: 'MuuLogin OK' }
        : { ok: true, isMuuLogin: false, message: 'Not MuuLogin' };
      log.debug('[MessageHandler] PING evaluated hostname', { hostname, isMuuLogin });
      return response;
    }

    if (normalizedType === 'EXECUTE_REMOTE_QUERY') {
      try {
        const DbQueryRouter = require('./connectors/DbQueryRouter');
        const router = new DbQueryRouter();
        // Normalize dbType hints if the caller used nested db payloads
        const dbType =
          message.dbType ||
          message.db?.dbType ||
          message.db?.type ||
          message.db_type ||
          null;
        const res = await router.execute({
          ...message,
          ...(dbType ? { dbType } : {})
        });
        log.info('[MessageHandler] connector result (summary):', res);
        return res;
      } catch (error) {
        log.error('[MessageHandler] EXECUTE_REMOTE_QUERY failed:', error?.message || error);
        return {
          ok: false,
          error: error?.message || 'DB query failed',
          requestId: message?.requestId
        };
      }
    }

    if (normalizedType === 'GET_LOCAL_CONFIG') {
      try {
        const LocalConfigService = require('./LocalConfigService');
        const service = new LocalConfigService();
        // Return ALL local configs instead of just one
        const data = await service.getAllLocalConfigs();
        return { ok: true, data, requestId: message?.requestId };
      } catch (error) {
        return {
          ok: false,
          error: error?.message || 'Failed to load local config',
          requestId: message?.requestId
        };
      }
    }

    if (normalizedType === 'GET_FOLDER_DETAILS') {
      try {
        const LocalConfigService = require('./LocalConfigService');
        const service = new LocalConfigService();
        // Return details for ALL local configs
        const configs = await service.getAllLocalConfigs();
        const results = [];

        for (const config of configs) {
          try {
            const details = await service.getFolderDetailsForPath(config.folderPath, config.folderName);
            results.push({
              id: config.id,
              ...details
            });
          } catch (err) {
            // If one folder fails, still return the others
            results.push({
              id: config.id,
              folderPath: config.folderPath,
              folderName: config.folderName,
              error: err?.message || 'Failed to read folder'
            });
          }
        }

        return { ok: true, data: results, requestId: message?.requestId };
      } catch (error) {
        return {
          ok: false,
          error: error?.message || 'Failed to get folder details',
          requestId: message?.requestId
        };
      }
    }

    log.debug('[MessageHandler] resolving connector for type:', type);
    const connector = ConnectorFactory.create(type);
    if (!connector) {
      throw new Error(`Unknown connector type: ${type}`);
    }

    let payload;
    if (Object.prototype.hasOwnProperty.call(message, 'payload')) {
      payload = message.payload;
      log.debug('[MessageHandler] using message.payload for connector:', JSON.stringify(payload, null, 2));
    } else {
      if (
        normalizedType === 'GIT_ZIP' ||
        normalizedType === 'GIT_FILE' ||
        normalizedType === 'GIT_PULL' ||
        normalizedType === 'POSTGRE' ||
        normalizedType === 'POSTGRES' ||
        normalizedType === 'POSTGRESQL' ||
        normalizedType === 'MYSQL' ||
        normalizedType === 'MSSQL' ||
        normalizedType === 'SQLSERVER' ||
        normalizedType === 'SQL_SERVER' ||
        normalizedType === 'GET_SAVED_CREDENTIALS'
      ) {
        payload = { ...message };
      } else {
        payload = buildPayload(message);
      }
      log.debug('[MessageHandler] built legacy payload from message:', JSON.stringify(payload, null, 2));
    }

    if (normalizedType === 'GIT_ZIP') {
      const target = (message.target || payload?.target || 'github').toLowerCase();
      if (target === 'local') {
        const localResult = await handleLocalZip(payload);
        log.debug('[MessageHandler] local zip result:', localResult);
        return { ok: true, data: localResult };
      }
      if (target === 'both') {
        const localResult = await handleLocalZip(payload);
        const gitResult = await connector.execute(payload);
        const combined = { local: localResult, github: gitResult };
        log.debug('[MessageHandler] combined local+github zip result:', combined);
        return { ok: true, data: combined };
      }
      // default: github only falls through
    }

    const result = await connector.execute(payload);
    // Surface connector result to both debug (detailed) and info (summary) so it is visible in logs
    log.debug('[MessageHandler] connector result:', result);
    log.info('[MessageHandler] connector result (summary):', result);

    // DB_QUERY returns a full response envelope itself so the webpage gets { ok, requestId, rows, rowCount } directly.
    if (
      normalizedType === 'POSTGRE' ||
      normalizedType === 'POSTGRES' ||
      normalizedType === 'POSTGRESQL' ||
      normalizedType === 'MYSQL' ||
      normalizedType === 'MSSQL' ||
      normalizedType === 'SQLSERVER' ||
      normalizedType === 'SQL_SERVER' ||
      normalizedType === 'GET_SAVED_CREDENTIALS'
    ) {
      return result;
    }

    return { ok: true, data: result };
  } catch (err) {
    return respondError(err);
  }
}

module.exports = { handleExternalMessage };
