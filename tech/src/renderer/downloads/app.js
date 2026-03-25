// Downloads popup / full-tab UI (bridge optional)
const hasBridge = !!window.browserBridge;
if (!hasBridge) {
  document.body.classList.add('full-tab');
}

const STORAGE_KEY = 'codex.downloadsHistory.v1';
const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};
const saveToStorage = (arr) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr || []));
  } catch {}
};

// DOM
const $list = document.getElementById('downloadList');
const $search = document.getElementById('dlSearch');
const $clearAll = document.getElementById('clearAll');

// State
const downloads = new Map();
let searchTerm = '';

// Utils
const humanBytes = (n) => {
  if (!Number.isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
};

const pct = (got, total) => {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((got / total) * 100)));
};

// Reveal helper
async function revealInFolder(item) {
  if (hasBridge) {
    try {
      await window.browserBridge.showDownloadedItemInFolder?.(item.id);
    } catch {}
    return;
  }
  try {
    window.top?.postMessage?.(
      { __from: 'downloads-ui', type: 'downloads:show-in-folder', id: item.id, savePath: item.savePath || null },
      '*'
    );
  } catch (e) {
    console.warn('[Downloads] Could not postMessage to top:', e);
  }
}

// Render
const RECENT_LIMIT = 5; // how many to show in popup mode

const render = () => {
  const term = searchTerm.trim().toLowerCase();
  let items = Array.from(downloads.values())
    .filter((d) => {
      if (!term) return true;
      const name = (d.fileName || d.name || '').toLowerCase();
      return name.includes(term);
    })
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

  // In popup (hasBridge=true), only show a small recent slice
  if (hasBridge && items.length > RECENT_LIMIT) {
    items = items.slice(0, RECENT_LIMIT);
  }

  $list.innerHTML = items
    .map((d) => {
      const total = d.totalBytes || 0;
      const got = d.receivedBytes || 0;
      const p = d.state === 'completed' ? 100 : pct(got, total);
      const sizeLine =
        d.state === 'completed'
          ? humanBytes(total || got)
          : d.state === 'interrupted'
          ? 'Interrupted'
          : total
          ? `${humanBytes(got)} / ${humanBytes(total)}`
          : 'Starting…';
      const filename = d.fileName || d.name || '(file)';
      const safeTitle = filename.replace(/"/g, '&quot;');
      const iconId = d.state === 'interrupted' ? 'alert' : 'download';
      const iconClass = d.state === 'interrupted' ? 'dl-icon dl-icon-error' : 'dl-icon';

      return `
        <div class="dl-item ${d.state || ''}" data-id="${d.id}">
          <div class="${iconClass}" aria-hidden="true">
            <svg class="dl-file-icon" viewBox="0 0 24 24">
              <use href="../assets/icons/mono.svg#${iconId}"></use>
            </svg>
          </div>
          <div class="dl-body">
            <div class="dl-name" title="${safeTitle}">${filename}</div>
            <div class="dl-sub">
              <span>${sizeLine}</span>
              ${d.mimeType ? `<span class="dl-dot"></span><span>${d.mimeType}</span>` : ''}
            </div>
            <div class="dl-progress"${p >= 100 || d.state === 'interrupted' ? ' style="display:none;"' : ''}>
              <span class="dl-bar" style="width:${p}%"></span>
            </div>
          </div>
          <div class="dl-row-actions">
            <button class="row-btn" title="Show in folder" aria-label="Show in folder" data-act="show">
              <svg class="dl-action-icon" viewBox="0 0 24 24">
                <use href="../assets/icons/mono.svg#folder"></use>
              </svg>
            </button>
            <button class="row-btn" title="Remove from list" aria-label="Remove from list" data-act="remove">
              <svg class="dl-action-icon" viewBox="0 0 24 24">
                <use href="../assets/icons/mono.svg#close"></use>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');
};

// Delegated click
$list.addEventListener('click', (e) => {
  const btn = e.target.closest('.row-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const host = btn.closest('.dl-item');
  const id = host?.getAttribute('data-id');
  const item = id ? downloads.get(id) : null;
  if (!item) return;
  const act = btn.getAttribute('data-act');
  if (act === 'show') {
    revealInFolder(item);
  } else if (act === 'remove') {
    downloads.delete(id);
    render();
    saveToStorage(Array.from(downloads.values()));
  }
});

// Bootstrap
(async () => {
  try {
    const stored = loadFromStorage();
    if (Array.isArray(stored) && stored.length) {
      stored.forEach((item) => downloads.set(String(item.id), item));
      render();
    }
    if (hasBridge) {
      const history = await window.browserBridge.getDownloads?.();
      if (Array.isArray(history)) {
        downloads.clear();
        history.forEach((item) => downloads.set(String(item.id), item));
        render();
        saveToStorage(Array.from(downloads.values()));
      }
    }
  } catch {}
})();

// Live updates
if (hasBridge) {
  window.browserBridge.onDownloadsUpdate?.((snapshot) => {
    if (!Array.isArray(snapshot)) return;
    downloads.clear();
    snapshot.forEach((item) => downloads.set(String(item.id), item));
    render();
    saveToStorage(Array.from(downloads.values()));
  });
}

// Header actions
$clearAll?.addEventListener('click', async () => {
  if (hasBridge) {
    await window.browserBridge.clearDownloads?.();
  }
  downloads.clear();
  render();
  saveToStorage([]);
});

$search?.addEventListener('input', (e) => {
  searchTerm = e.target.value || '';
  render();
});

// Suppress native context menu
window.addEventListener('contextmenu', (e) => e.preventDefault());
