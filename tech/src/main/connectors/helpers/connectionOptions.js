const fs = require('fs');
const path = require('path');
const net = require('net');
const { Client } = require('ssh2');
const { RDSAuthTokenGenerator } = require('@aws-sdk/rds-signer');
const log = require('../../../logger');

const readPem = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return undefined;
  // If looks like a path and exists, read it; otherwise treat as inline PEM
  try {
    if (fs.existsSync(text) && fs.statSync(text).isFile()) {
      return fs.readFileSync(path.resolve(text), 'utf8');
    }
  } catch (_) {
    // fall through to inline usage
  }
  return text;
};

const buildTlsOptions = (ssl = {}) => {
  if (!ssl?.enabled) return undefined;
  const ca = readPem(ssl.ca);
  const cert = readPem(ssl.cert);
  const key = readPem(ssl.key);
  const rejectUnauthorized =
    typeof ssl.rejectUnauthorized === 'boolean' ? ssl.rejectUnauthorized : true;
  const servername = ssl.servername || ssl.serverName || undefined;

  const sslOptions = { rejectUnauthorized };
  if (ca) sslOptions.ca = ca;
  if (cert) sslOptions.cert = cert;
  if (key) sslOptions.key = key;
  if (servername) sslOptions.servername = servername;
  return sslOptions;
};

const createSshTunnel = async (ssh = {}, targetHost, targetPort) => {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const server = net.createServer((socket) => {
      client.forwardOut(
        '127.0.0.1',
        0,
        targetHost,
        Number(targetPort),
        (err, stream) => {
          if (err) {
            socket.destroy();
            log.error('[SSH] forwardOut failed', err);
            return;
          }
          socket.pipe(stream);
          stream.pipe(socket);
        }
      );
    });

    server.listen(0, '127.0.0.1', () => {
      const localPort = server.address().port;
      resolve({
        host: '127.0.0.1',
        port: localPort,
        cleanup: async () => {
          try {
            server.close();
          } catch (_) {}
          try {
            client.end();
          } catch (_) {}
        }
      });
    });

    client
      .on('ready', () => {
        log.info('[SSH] tunnel ready');
      })
      .on('error', (err) => {
        log.error('[SSH] client error', err);
        try {
          server.close();
        } catch (_) {}
        reject(err);
      })
      .connect({
        host: ssh.host,
        port: Number(ssh.port) || 22,
        username: ssh.user,
        password: ssh.password || undefined,
        privateKey: ssh.privateKey ? readPem(ssh.privateKey) : undefined,
        passphrase: ssh.passphrase || undefined,
        readyTimeout: 15000
      });
  });
};

const prepareHostPort = async (credentials = {}) => {
  const ssh = credentials.ssh || {};
  const iam = credentials.iam || {};
  const targetHost = iam.host || ssh.remoteHost || credentials.host;
  const targetPort = iam.port || ssh.remotePort || credentials.port;

  if (ssh.enabled) {
    const tunnel = await createSshTunnel(ssh, targetHost, targetPort);
    return tunnel;
  }

  return {
    host: targetHost,
    port: targetPort,
    cleanup: async () => {}
  };
};

const generateIamAuthToken = async ({ iam, host, port, user }) => {
  const generator = new RDSAuthTokenGenerator({
    region: iam.region,
    credentials: {
      accessKeyId: iam.accessKeyId,
      secretAccessKey: iam.secretAccessKey,
      sessionToken: iam.sessionToken || undefined
    }
  });

  const token = await generator.generateAuthToken({
    hostname: host,
    port,
    username: user
  });
  return token;
};

const preparePassword = async (credentials = {}) => {
  const iam = credentials?.iam || {};
  if (!iam.enabled) {
    return credentials.password;
  }

  const hostname = iam.host || credentials.host;
  const port = Number(iam.port || credentials.port || 3306);
  const username = credentials.user;
  if (!hostname || !port || !username) {
    throw new Error('IAM auth requires host, port, and user');
  }
  if (!iam.region || !iam.accessKeyId || !iam.secretAccessKey) {
    throw new Error('IAM auth requires region, access key, and secret key');
  }

  const token = await generateIamAuthToken({
    iam,
    host: hostname,
    port,
    user: username
  });
  return token;
};

module.exports = {
  buildTlsOptions,
  prepareHostPort,
  preparePassword,
  createSshTunnel,
  generateIamAuthToken
};
