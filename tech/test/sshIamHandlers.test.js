jest.mock('../src/logger');

let pgOptions = null;
let mysqlOptions = null;
let mssqlOptions = null;

// Mocks for DB clients
jest.mock('pg', () => {
  return {
    Client: function MockPgClient(options) {
      pgOptions = options;
      return {
        connect: jest.fn().mockResolvedValue(),
        end: jest.fn().mockResolvedValue()
      };
    }
  };
});

jest.mock('mysql2/promise', () => {
  return {
    createConnection: async (options) => {
      mysqlOptions = options;
      return {
        ping: jest.fn().mockResolvedValue(),
        end: jest.fn().mockResolvedValue()
      };
    }
  };
});

jest.mock('mssql', () => {
  const connect = jest.fn(async (options) => {
    mssqlOptions = options;
  });
  const close = jest.fn(async () => {});
  return { connect, close };
});

describe('ssh/iam integration paths', () => {
  const cleanup = jest.fn();
  const prepareHostPort = jest.fn(async () => ({ host: '127.0.0.1', port: 7777, cleanup }));
  const preparePassword = jest.fn(async () => 'token-pass');
  const buildTlsOptions = jest.fn(() => ({ enabled: true, rejectUnauthorized: false }));

  beforeEach(() => {
    jest.resetModules();
    pgOptions = null;
    mysqlOptions = null;
    mssqlOptions = null;
    cleanup.mockClear();
    prepareHostPort.mockClear();
    preparePassword.mockClear();
    buildTlsOptions.mockClear();
  });

  const loadCredentialStore = () => {
    jest.doMock('../src/main/connectors/helpers/connectionOptions', () => ({
      prepareHostPort,
      preparePassword,
      buildTlsOptions
    }));
    return require('../src/main/credentialStore');
  };

  it('uses IAM token for postgres and forces TLS', async () => {
    const store = loadCredentialStore();
    const result = await store.testConnection({
      dbType: 'postgres',
      host: 'h',
      port: '5432',
      database: 'd',
      user: 'u',
      password: 'p',
      iam: { enabled: true, region: 'r', accessKeyId: 'a', secretAccessKey: 's' },
      ssl: { enabled: false }
    });
    expect(result.ok).toBe(true);
    expect(preparePassword).toHaveBeenCalled();
    expect(pgOptions.password).toBe('token-pass');
    expect(buildTlsOptions).toHaveBeenCalled();
  });

  it('uses IAM token for mysql and forces TLS', async () => {
    const store = loadCredentialStore();
    const result = await store.testConnection({
      dbType: 'mysql',
      host: 'h',
      port: '3306',
      database: 'd',
      user: 'u',
      password: 'p',
      iam: { enabled: true, region: 'r', accessKeyId: 'a', secretAccessKey: 's' },
      ssl: { enabled: false }
    });
    expect(result.ok).toBe(true);
    expect(mysqlOptions.password).toBe('token-pass');
    expect(buildTlsOptions).toHaveBeenCalled();
  });

  it('opens ssh tunnel and rewrites host/port for postgres', async () => {
    const store = loadCredentialStore();
    const result = await store.testConnection({
      dbType: 'postgres',
      host: 'db.host',
      port: '5432',
      database: 'd',
      user: 'u',
      password: 'p',
      ssh: { enabled: true, host: 'bastion', port: 22, user: 'jump' }
    });
    expect(result.ok).toBe(true);
    expect(prepareHostPort).toHaveBeenCalled();
    expect(pgOptions.host).toBe('127.0.0.1');
    expect(pgOptions.port).toBe(7777);
    expect(cleanup).toHaveBeenCalled();
  });

  it('opens ssh tunnel and rewrites host/port for mysql', async () => {
    const store = loadCredentialStore();
    const result = await store.testConnection({
      dbType: 'mysql',
      host: 'db.host',
      port: '3306',
      database: 'd',
      user: 'u',
      password: 'p',
      ssh: { enabled: true, host: 'bastion', port: 22, user: 'jump' }
    });
    expect(result.ok).toBe(true);
    expect(mysqlOptions.host).toBe('127.0.0.1');
    expect(mysqlOptions.port).toBe(7777);
    expect(cleanup).toHaveBeenCalled();
  });

  it('calls cleanup even when tester throws', async () => {
    const store = loadCredentialStore();
    // Make pg client throw on connect
    const err = new Error('connect fail');
    require('pg').Client.prototype.connect = jest.fn().mockRejectedValue(err);
    await store.testConnection({
      dbType: 'postgres',
      host: 'h',
      port: '5432',
      database: 'd',
      user: 'u',
      password: 'p',
      ssh: { enabled: true, host: 'bastion' }
    });
    expect(cleanup).toHaveBeenCalled();
  });
});
