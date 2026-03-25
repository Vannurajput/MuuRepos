const { ipcRenderer } = require('electron');

const card = document.querySelector('.security-card');
const title = document.getElementById('securityTitle');
const host = document.getElementById('securityHost');
const message = document.getElementById('securityMessage');
const iconUse = document.querySelector('.security-icon use');

const render = (payload = {}) => {
  if (!card) return;
  const state = payload.state || 'internal';
  card.dataset.security = state;
  if (title) title.textContent = payload.title || '';
  if (message) message.textContent = payload.message || '';
  if (host) {
    host.textContent = payload.host || '';
    host.style.display = payload.host ? 'block' : 'none';
  }
  if (iconUse && payload.iconId) {
    iconUse.setAttribute('href', `../assets/icons/mono.svg#${payload.iconId}`);
  }
};

ipcRenderer.on('security:update', (_event, payload) => render(payload));

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    ipcRenderer.invoke('security:hide');
  }
});
