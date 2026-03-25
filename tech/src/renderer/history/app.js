/**
 * history/app.js
 * Controls the standalone history popup window UI.
 */
if (!window.browserBridge) {
  const list = document.getElementById('historyList');
  if (list) list.textContent = 'History unavailable (bridge missing)';
  throw new Error('History bridge missing');
}

window.addEventListener('contextmenu', (event) => event.preventDefault());

const historyList = document.getElementById('historyList');
const closeButton = document.getElementById('historyClose');
const clearButton = document.getElementById('clearHistory');
const header = document.querySelector('.history-header');

const state = { entries: [] };
let currentZoomFactor = 1;

/* Header shadow toggled only when list is scrolled */
function updateHeaderShadow() {
  if (!header || !historyList) return;
  header.classList.toggle('scrolled', historyList.scrollTop > 0);
}

const getFaviconUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}/favicon.ico`;
  } catch (err) {
    return null;
  }
};

const getFallbackInitial = (entry) => {
  const source = entry.title || entry.url || '';
  const letter = (source.match(/[A-Za-z]/) || ['?'])[0];
  return letter.toUpperCase();
};

const buildIcon = (entry) => {
  const icon = document.createElement('div');
  icon.className = 'history-entry-icon';

  const faviconUrl = getFaviconUrl(entry.url);
  if (!faviconUrl) {
    icon.textContent = getFallbackInitial(entry);
    return icon;
  }

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = '';
  img.src = faviconUrl;
  img.addEventListener('error', () => {
    icon.textContent = getFallbackInitial(entry);
    img.remove();
  });
  icon.appendChild(img);
  return icon;
};

const render = () => {
  if (!historyList) return;
  historyList.innerHTML = '';

  if (!state.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No history yet';
    historyList.appendChild(empty);
    updateHeaderShadow();
    return;
  }

  const frag = document.createDocumentFragment();

  state.entries.forEach((entry, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'history-entry';
    item.dataset.idx = String(i);
    item.tabIndex = 0;

    const icon = buildIcon(entry);

    const body = document.createElement('div');
    body.className = 'history-entry-body';

    const title = document.createElement('div');
    title.className = 'history-entry-title';
    title.textContent = entry.title || entry.url;

    const url = document.createElement('div');
    url.className = 'history-entry-url';
    url.textContent = entry.url;

    body.append(title, url);
    item.append(icon, body);

    item.addEventListener('click', async () => {
      try {
        if (window.browserBridge?.openInNewTab) {
          await window.browserBridge.openInNewTab(entry.url);
        } else {
          await window.browserBridge.navigate(entry.url);
        }
      } finally {
        window.browserBridge.closeHistoryPopup?.();
      }
    });

    frag.appendChild(item);
  });

  historyList.appendChild(frag);
  updateHeaderShadow();
};

/* Events */
historyList?.addEventListener('scroll', updateHeaderShadow);
closeButton?.addEventListener('click', () => window.browserBridge.closeHistoryPopup());

clearButton?.addEventListener('click', async () => {
  try {
    await window.browserBridge.clearHistory();
    state.entries = [];
    render();
  } catch (err) {
    console.error('[History] clearHistory failed', err);
  }
});

/* Initial load + live updates */
window.browserBridge
  .getHistory()
  .then((entries) => {
    state.entries = entries || [];
    render();
  })
  .catch((err) => {
    console.error('[History] getHistory failed', err);
    state.entries = [];
    render();
  });

window.browserBridge.onHistoryUpdate((entries) => {
  state.entries = entries || [];
  render();
});

// Apply current zoom on load and react to zoom factor updates so header stays fixed
if (window.browserBridge?.zoomBridge?.get) {
  window.browserBridge.zoomBridge
    .get()
    .then((factor) => {
      document.documentElement.style.setProperty('--content-scale', factor || 1);
    })
    .catch(() => {});
}
window.browserBridge?.onZoomFactor?.((payload = {}) => {
  const factor = typeof payload.factor === 'number' ? payload.factor : 1;
  document.documentElement.style.setProperty('--content-scale', factor);
});
