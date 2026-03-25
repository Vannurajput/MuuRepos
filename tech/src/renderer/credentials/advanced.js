const advancedElements = {
  sshEnabled: document.getElementById('sshEnabled'),
  sshHost: document.getElementById('sshHost'),
  sshPort: document.getElementById('sshPort'),
  sshUser: document.getElementById('sshUser'),
  sshPassword: document.getElementById('sshPassword'),
  sshPrivateKey: document.getElementById('sshPrivateKey'),
  sshPassphrase: document.getElementById('sshPassphrase'),
  sshRemoteHost: document.getElementById('sshRemoteHost'),
  sshRemotePort: document.getElementById('sshRemotePort'),
  sslEnabled: document.getElementById('sslEnabled'),
  sslRejectUnauthorized: document.getElementById('sslRejectUnauthorized'),
  sslServername: document.getElementById('sslServername'),
  sslCa: document.getElementById('sslCa'),
  sslCert: document.getElementById('sslCert'),
  sslKey: document.getElementById('sslKey'),
  iamEnabled: document.getElementById('iamEnabled'),
  iamRegion: document.getElementById('iamRegion'),
  iamAccessKeyId: document.getElementById('iamAccessKeyId'),
  iamSecretAccessKey: document.getElementById('iamSecretAccessKey'),
  iamSessionToken: document.getElementById('iamSessionToken'),
  iamHost: document.getElementById('iamHost'),
  iamPort: document.getElementById('iamPort')
};

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return fallback;
};

export const fillAdvanced = (config = {}) => {
  const ssh = config.ssh || {};
  advancedElements.sshEnabled.checked = !!ssh.enabled;
  advancedElements.sshHost.value = ssh.host || '';
  advancedElements.sshPort.value = ssh.port || '';
  advancedElements.sshUser.value = ssh.user || '';
  advancedElements.sshPassword.value = ssh.password || '';
  advancedElements.sshPrivateKey.value = ssh.privateKey || '';
  advancedElements.sshPassphrase.value = ssh.passphrase || '';
  advancedElements.sshRemoteHost.value = ssh.remoteHost || '';
  advancedElements.sshRemotePort.value = ssh.remotePort || '';

  const ssl = config.ssl || {};
  advancedElements.sslEnabled.checked = !!ssl.enabled;
  advancedElements.sslRejectUnauthorized.value = String(
    toBool(ssl.rejectUnauthorized, true)
  );
  advancedElements.sslServername.value = ssl.servername || ssl.serverName || '';
  advancedElements.sslCa.value = ssl.ca || '';
  advancedElements.sslCert.value = ssl.cert || '';
  advancedElements.sslKey.value = ssl.key || '';

  const iam = config.iam || {};
  advancedElements.iamEnabled.checked = !!iam.enabled;
  advancedElements.iamRegion.value = iam.region || '';
  advancedElements.iamAccessKeyId.value = iam.accessKeyId || '';
  advancedElements.iamSecretAccessKey.value = iam.secretAccessKey || '';
  advancedElements.iamSessionToken.value = iam.sessionToken || '';
  advancedElements.iamHost.value = iam.host || '';
  advancedElements.iamPort.value = iam.port || '';
};

export const readAdvanced = () => ({
  ssh: {
    enabled: !!advancedElements.sshEnabled.checked,
    host: advancedElements.sshHost.value.trim(),
    port: advancedElements.sshPort.value.trim(),
    user: advancedElements.sshUser.value.trim(),
    password: advancedElements.sshPassword.value,
    privateKey: advancedElements.sshPrivateKey.value,
    passphrase: advancedElements.sshPassphrase.value,
    remoteHost: advancedElements.sshRemoteHost.value.trim(),
    remotePort: advancedElements.sshRemotePort.value.trim()
  },
  ssl: {
    enabled: !!advancedElements.sslEnabled.checked,
    rejectUnauthorized: toBool(advancedElements.sslRejectUnauthorized.value, true),
    servername: advancedElements.sslServername.value.trim(),
    ca: advancedElements.sslCa.value,
    cert: advancedElements.sslCert.value,
    key: advancedElements.sslKey.value
  },
  iam: {
    enabled: !!advancedElements.iamEnabled.checked,
    region: advancedElements.iamRegion.value.trim(),
    accessKeyId: advancedElements.iamAccessKeyId.value.trim(),
    secretAccessKey: advancedElements.iamSecretAccessKey.value,
    sessionToken: advancedElements.iamSessionToken.value,
    host: advancedElements.iamHost.value.trim(),
    port: advancedElements.iamPort.value.trim()
  }
});

export const initAdvanced = (config = {}) => {
  fillAdvanced(config);
};
