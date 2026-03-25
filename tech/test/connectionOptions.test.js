jest.mock('../src/logger');

const fs = require('fs');
const path = require('path');
const { buildTlsOptions } = require('../src/main/connectors/helpers/connectionOptions');

describe('buildTlsOptions', () => {
  it('returns undefined when disabled', () => {
    expect(buildTlsOptions({ enabled: false })).toBeUndefined();
  });

  it('maps rejectUnauthorized default true and servername', () => {
    const ssl = buildTlsOptions({ enabled: true, servername: 'db.local' });
    expect(ssl).toBeDefined();
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.servername).toBe('db.local');
  });

  it('respects rejectUnauthorized false', () => {
    const ssl = buildTlsOptions({ enabled: true, rejectUnauthorized: false });
    expect(ssl.rejectUnauthorized).toBe(false);
  });

  it('accepts inline PEM values', () => {
    const ca = '---CA---';
    const cert = '---CERT---';
    const key = '---KEY---';
    const ssl = buildTlsOptions({ enabled: true, ca, cert, key });
    expect(ssl.ca).toBe(ca);
    expect(ssl.cert).toBe(cert);
    expect(ssl.key).toBe(key);
  });

  it('reads PEM from file paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-'));
    const caPath = path.join(tmpDir, 'ca.pem');
    fs.writeFileSync(caPath, 'CAFILE');
    const ssl = buildTlsOptions({ enabled: true, ca: caPath });
    expect(ssl.ca).toBe('CAFILE');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
