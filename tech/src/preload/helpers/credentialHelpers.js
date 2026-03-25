// Shared helpers for credential tabs in preload
const buildCredentialQuery = (options = {}) => {
  const params = new URLSearchParams();
  if (options.mode) {
    params.set('mode', options.mode);
  }
  if (options.entryId) {
    params.set('entryId', options.entryId);
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : '';
};

const openCredentialTab = async (relativePath, options = {}, ipcRenderer) => {
  if (!relativePath || !ipcRenderer) return;
  const targetUrl = new URL(`${relativePath}${buildCredentialQuery(options)}`, window.location.href).toString();
  await ipcRenderer.invoke('tabs:new');
  await ipcRenderer.invoke('tabs:navigate', targetUrl);
};

module.exports = {
  buildCredentialQuery,
  openCredentialTab
};
