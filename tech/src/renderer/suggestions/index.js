const { ipcRenderer } = require('electron');

const list = document.getElementById('suggestions');

const getIconId = (item = {}) => {
  if (item.source === 'search') {
    return 'search';
  }
  return 'history';
};

const buildIcon = (iconId) => {
  const wrapper = document.createElement('span');
  wrapper.className = 'suggestion-icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'suggestion-icon-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `../assets/icons/mono.svg#${iconId}`);
  svg.appendChild(use);
  wrapper.appendChild(svg);
  return wrapper;
};

const render = (payload = {}) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const activeIndex = typeof payload.activeIndex === 'number' ? payload.activeIndex : -1;
  list.innerHTML = '';
  if (!items.length) return;

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'suggestion-item';
    if (index === activeIndex) {
      row.classList.add('active');
    }
    row.dataset.index = index;
    const body = document.createElement('div');
    body.className = 'suggestion-body';
    const title = document.createElement('div');
    title.className = 'suggestion-title';
    title.textContent = item.title || item.url;
    body.appendChild(title);
    row.appendChild(buildIcon(getIconId(item)));
    row.appendChild(body);
    row.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const targetUrl =
        item.url ||
        (item.source === 'search' && item.query
          ? `https://www.google.com/search?q=${encodeURIComponent(item.query)}`
          : item.title);
      if (!targetUrl) {
        ipcRenderer.invoke('suggestions:hide');
        return;
      }
      ipcRenderer.invoke('suggestions:hide');
      ipcRenderer.invoke('tabs:navigate', targetUrl);
    });
    list.appendChild(row);
  });
  list.classList.add('active');
};

ipcRenderer.on('suggestions:update', (_event, payload) => render(payload));
