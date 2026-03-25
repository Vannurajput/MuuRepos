const credentialRegistry = require('../credentialRegistry');
const credentialStore = require('../credentialStore');

/**
 * Returns available database credentials from the registry plus the local default store.
 */
class DbListConnector {
  async execute() {
    try {
      const entries = [];

      // Default store entry (legacy)
      try {
        const stored = await credentialStore.loadConfig();
        if (stored && Object.keys(stored).length) {
          entries.push({
            id: stored.customId || stored.id || 'default-store',
            connectionName: stored.connectionName || stored.connectionname || stored.label || '',
            dbType: stored.dbType || stored.type || '',
            host: stored.host || '',
            user: stored.user || ''
          });
        }
      } catch (_) {
        // ignore store errors
      }

      // Registry entries
      try {
        const registry = (await credentialRegistry.list('database')) || [];
        registry.forEach((entry) => {
          entries.push({
            id: entry.customId || entry.id,
            connectionName: entry.connectionname || entry.connectionName || entry.label || '',
            dbType: entry.dbType || entry.type || '',
            host: entry.host || '',
            user: entry.user || ''
          });
        });
      } catch (_) {
        // ignore registry errors
      }

      return { ok: true, entries };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  }
}

module.exports = DbListConnector;
