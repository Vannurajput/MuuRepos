jest.mock('electron');
jest.mock('keytar');
jest.mock('../src/logger');

// Capture options passed to DB clients
let pgOptions = null;
let mysqlOptions = null;
let mssqlOptions = null;

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
  const fn = {
    connect: jest.fn(async (options) => {
      mssqlOptions = options;
    }),
    close: jest.fn(async () => {})
  };
  return fn;
});

const credentialStore = require('../src/main/credentialStore');

describe('credentialStore testConnection branches', () => {
  beforeEach(() => {
    pgOptions = null;
    mysqlOptions = null;
    mssqlOptions = null;
  });

  it('returns error when dbType is missing', async () => {
    const result = await credentialStore.testConnection({});
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Select a database type/i);
  });

  it('returns error for unsupported dbType', async () => {
    const result = await credentialStore.testConnection({ dbType: 'unknown' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Unsupported database type/i);
  });

  it('passes ssl into postgres tester', async () => {
    const result = await credentialStore.testConnection({
      dbType: 'postgres',
      host: 'h',
      port: '5432',
      database: 'd',
      user: 'u',
      password: 'p',
      ssl: { enabled: true, rejectUnauthorized: true }
    });
    expect(result.ok).toBe(true);
    expect(pgOptions).not.toBeNull();
    expect(pgOptions.ssl).toBeDefined();
    expect(pgOptions.ssl.rejectUnauthorized).toBe(true);
  });

  it('passes ssl into mysql tester', async () => {
    const result = await credentialStore.testConnection({
      dbType: 'mysql',
      host: 'h',
      port: '3306',
      database: 'd',
      user: 'u',
      password: 'p',
      ssl: { enabled: true, rejectUnauthorized: false }
    });
    expect(result.ok).toBe(true);
    expect(mysqlOptions).not.toBeNull();
    expect(mysqlOptions.ssl).toBeDefined();
    expect(mysqlOptions.ssl.rejectUnauthorized).toBe(false);
  });

  it('passes tls flags into sqlserver tester', async () => {
    const result = await credentialStore.testConnection({
      dbType: 'sqlserver',
      host: 'h',
      port: '1433',
      database: 'd',
      user: 'u',
      password: 'p',
      ssl: { enabled: true, rejectUnauthorized: true, servername: 'myhost' }
    });
    expect(result.ok).toBe(true);
    expect(mssqlOptions).not.toBeNull();
    expect(mssqlOptions.options.encrypt).toBe(true);
    expect(mssqlOptions.options.trustServerCertificate).toBe(false);
    expect(mssqlOptions.options.serverName).toBe('myhost');
  });
});
