const refs = {
  barList: document.getElementById('bookmarkQuickBar'),
  otherList: document.getElementById('bookmarkQuickOther'),
  empty: document.getElementById('bookmarkQuickEmpty')
};

const state = {
  entries: [],
  context: {
    currentUrl: '',
    currentTitle: '',
    isBookmarked: false
  }
};

// -------- Context menu (Open / Cut / Copy / Delete / Edit) ----------
let contextMenuEl = null;

const closeContextMenu = () => {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
};

const clampMenuPosition = (menu, x, y) => {
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(margin, x), Math.max(margin, innerWidth - rect.width - margin));
  const top = Math.min(Math.max(margin, y), Math.max(margin, innerHeight - rect.height - margin));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
};

const makeMenuButton = (label, onClick, extraClass = '') => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `bookmark-quick-menu-item ${extraClass}`.trim();
  btn.textContent = label;
  btn.addEventListener('click', () => {
    onClick?.();
    closeContextMenu();
  });
  return btn;
};

const copyToClipboard = async (text = '') => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn('[Bookmarks] Copy failed', err);
  }
};

const openContextMenu = (event, entry) => {
  event.preventDefault();
  event.stopPropagation();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'bookmark-quick-menu';

  const { id, title, url, folder, favicon, createdAt, timestamp } = entry;

  const openAction = () => {
    window.browserBridge?.navigate?.(url);
    window.browserBridge?.closeBookmarkQuickPopup?.();
  };

  const deleteAction = async () => {
    await window.browserBridge?.removeBookmark?.(id ? { id } : url);
  };

  const cutAction = async () => {
    await copyToClipboard(url);
    await deleteAction();
  };

  const copyAction = () => copyToClipboard(url);

  menu.append(
    makeMenuButton('Open', openAction),
    makeMenuButton('Cut', cutAction),
    makeMenuButton('Copy', copyAction),
    makeMenuButton('Delete', deleteAction, 'danger')
  );

  document.body.appendChild(menu);
  contextMenuEl = menu;
  clampMenuPosition(menu, event.clientX, event.clientY);
};

document.addEventListener('click', (e) => {
  if (contextMenuEl && !contextMenuEl.contains(e.target)) {
    closeContextMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeContextMenu();
  }
});

// --------------------------------------------------------------------

const getBookmarkInitial = (entry) => {
  const source = entry.title || entry.url || '';
  const match = source.match(/[A-Za-z]/);
  return (match ? match[0] : '?').toUpperCase();
};

const getBookmarkFavicon = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return null;
  }
};

const renderGroup = (listEl, items = []) => {
  if (!listEl) return;
  listEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  items.forEach((entry) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bookmark-quick-item';
    item.setAttribute('role', 'option');
    item.dataset.url = entry.url;

    const icon = document.createElement('span');
    icon.className = 'bookmark-quick-icon';
    const favicon = entry.favicon || getBookmarkFavicon(entry.url);
    if (favicon) {
      const img = document.createElement('img');
      img.src = favicon;
      img.alt = '';
      img.addEventListener('error', () => {
        icon.textContent = getBookmarkInitial(entry);
        img.remove();
      });
      icon.appendChild(img);
    } else {
      icon.textContent = getBookmarkInitial(entry);
    }

    const textWrap = document.createElement('span');
    textWrap.className = 'bookmark-quick-text';
    const title = document.createElement('span');
    title.className = 'bookmark-quick-name';
    title.textContent = entry.title || entry.url;
    textWrap.append(title);

    item.append(icon, textWrap);
    item.addEventListener('click', () => {
      window.browserBridge?.navigate?.(entry.url);
      window.browserBridge?.closeBookmarkQuickPopup?.();
    });
    item.addEventListener('contextmenu', (ev) => openContextMenu(ev, entry));

    fragment.appendChild(item);
  });
  listEl.appendChild(fragment);
};

const renderList = () => {
  const barEntries = state.entries.filter((e) => e.folder === 'bar');
  const otherEntries = state.entries.filter((e) => e.folder !== 'bar');
  renderGroup(refs.barList, barEntries);
  renderGroup(refs.otherList, otherEntries);
  if (refs.empty) {
    refs.empty.hidden = state.entries.length > 0;
  }
};

const setEntries = (entries = []) => {
  state.entries = entries;
  renderList();
};

const applyContext = (payload = {}) => {
  state.context = {
    ...state.context,
    currentUrl: payload.currentUrl || '',
    currentTitle: payload.currentTitle || payload.currentUrl || '',
    isBookmarked: !!payload.isBookmarked
  };
};

window.browserBridge
  ?.getBookmarks?.()
  .then((entries) => setEntries(entries || []))
  .catch(() => setEntries([]));

window.browserBridge?.onBookmarksUpdate?.((entries) => setEntries(entries || []));

window.browserBridge?.onBookmarkQuickContext?.((payload) => {
  applyContext(payload || {});
});
