/**
 * scripts/app.js
 * Renderer bootstrap wiring UI controls to the preload bridge.
 */
import { state, applyState } from './state.js';
import { initTabStrip } from './components/tabStrip.js';
import { initNavigationBar } from './components/navigationBar.js';
import { initChatPanel } from '../chat/panel.js';
import {
  clamp,
  normalizeThemeHex,
  adjustThemeLightness,
  applyThemePalette,
  setHeroScale
} from './helpers/theme.js';
// import './components/printPreview.js';   
if (!window.browserBridge) {
  throw new Error('Renderer missing browserBridge');
}

const rendererLog = (...args) => console.log('[Renderer]', ...args);

setHeroScale(1);
let contentZoom = 1;
const applyHeroZoom = (factor) => {
  if (!Number.isFinite(factor)) return;
  contentZoom = factor;
  setHeroScale(factor);
};

window.browserBridge?.onThemeUpdate?.(applyThemePalette);
window.browserBridge?.getTheme?.().then(applyThemePalette).catch(() => { });
window.browserBridge?.onAppFullscreenToggle?.((payload = {}) => {
  const enabled = !!payload.enabled;
  document.body.classList.toggle('app-fs', enabled);
  reportTopOffset();
});
window.browserBridge?.onZoomFactor?.((payload = {}) => {
  if (typeof payload?.factor === 'number') {
    applyHeroZoom(payload.factor);
  }
});
if (window.browserBridge?.zoomBridge?.get) {
  window.browserBridge.zoomBridge
    .get()
    .then((factor) => {
      applyHeroZoom(factor);
    })
    .catch(() => { });
}

// Cache all DOM references so we do not query repeatedly.
const elements = {
  tabContainer: document.getElementById('tabStrip'),
  newTabButton: document.getElementById('newTabButton'),
  backButton: document.getElementById('backButton'),
  forwardButton: document.getElementById('forwardButton'),
  reloadButton: document.getElementById('reloadButton'),
  addressBar: document.getElementById('addressBar'),
  addressSecurity: document.getElementById('addressSecurity'),
  bookmarkStar: document.getElementById('bookmarkStar'),
  githubButton: document.getElementById('githubButton'),
  settingsButton: document.getElementById('settingsButton'),
  chatToggle: document.getElementById('chatToggle'),
  profileButton: document.getElementById('profileButton'),
  centerAddressBar: document.getElementById('centerAddressBar'),
  centerAddressForm: document.getElementById('centerAddressForm'),
  heroNewTab: document.getElementById('heroNewTab'),
  heroBookmarks: document.getElementById('heroBookmarks'),
  heroHistory: document.getElementById('heroHistory'),
  heroAddShortcut: document.getElementById('heroAddShortcut'),
  shortcutGrid: document.getElementById('shortcutGrid'),
  shortcutModal: document.getElementById('shortcutModal'),
  shortcutModalClose: document.getElementById('shortcutModalClose'),
  shortcutForm: document.getElementById('shortcutForm'),
  shortcutNameInput: document.getElementById('shortcutNameInput'),
  shortcutUrlInput: document.getElementById('shortcutUrlInput'),
  shortcutCancel: document.getElementById('shortcutCancel'),
  bookmarkBar: document.getElementById('bookmarkBar'),
  bookmarkAppsButton: document.getElementById('bookmarkAppsButton'),
  bookmarkOverflowButton: document.getElementById('bookmarkOverflowButton'),
  bookmarkBarItems: document.getElementById('bookmarkBarItems'),
  bookmarkAllButton: document.getElementById('bookmarkAllButton'),
  allBookmarksPanel: document.getElementById('allBookmarksPanel'),
  allBookmarksList: document.getElementById('allBookmarksList'),
  bookmarkModal: document.getElementById('bookmarkModal'),
  bookmarkModalClose: document.getElementById('bookmarkModalClose'),
  bookmarkForm: document.getElementById('bookmarkForm'),
  bookmarkNameInput: document.getElementById('bookmarkNameInput'),
  bookmarkFolderSelect: document.getElementById('bookmarkFolderSelect'),
  bookmarkSaveButton: document.getElementById('bookmarkSaveButton'),
  bookmarkCancelButton: document.getElementById('bookmarkCancelButton'),
  bookmarkRemoveButton: document.getElementById('bookmarkRemoveButton'),

  // ===================== [ADDED ✨ DOWNLOADS] =====================
  downloadButton: document.getElementById('downloadButton'),
  // =================== [/ADDED ✨ DOWNLOADS] ======================

  // ===================== [ADDED ✨ WINDOW CONTROLS] =====================
  minButton: document.getElementById('minButton'),
  maxButton: document.getElementById('maxButton'),
  closeButton: document.getElementById('closeButton'),
  heroCredentialTile: document.querySelector('.app-tile.app-credentials'),
  heroDownloadsTile: document.querySelector('.app-tile.app-downloads'),
  heroPrintTile: document.querySelector('.app-tile.app-print'),
  heroGitTile: document.querySelector('.app-tile.app-git'),
  heroDataTile: document.querySelector('.app-tile.app-data'),
  heroBookmarkTile: document.querySelector('.app-tile.app-bookmarks')
  // =================== [/ADDED ✨ WINDOW CONTROLS] ======================
};
const suggestionElements = {
  address: document.getElementById('addressSuggestions'),
  center: document.getElementById('centerSuggestions')
};
const handshakeBadge = document.getElementById('handshakeBadge');
if (handshakeBadge) {
  handshakeBadge.classList.add('handshake-hidden');
}

const header = document.querySelector('.header');
const contentArea = document.querySelector('.content');
const bookmarksState = {
  entries: []
};
const shortcutsState = {
  items: [],
  editingId: null
};
const handshakeState = {
  map: new Map()
};
let handshakeHideTimer = null;

const focusAddressInput = (options = {}) => {
  const input = elements.addressBar;
  if (!input) return;
  const { searchMode = false, selectAll = true } = options;
  input.focus();

  if (searchMode) {
    const raw = (input.value || '').replace(/^\?\s*/, '').trim();
    const prefix = '? ';
    const nextValue = raw.length ? `${prefix}${raw}` : prefix;
    input.value = nextValue;
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
    return;
  }

  if (selectAll) {
    input.select();
  } else {
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }
};

// ====== NEW HELPERS: detect typing fields & printable keys ======
const isTypingField = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  );
};

const isPrintableKey = (event) => {
  const k = event.key;

  // Single visible characters (letters, numbers, punctuation, space)
  if (k && k.length === 1) return true;

  // Allow backspace/delete as first key
  if (k === 'Backspace' || k === 'Delete' || k === ' ') return true;

  return false;
};
// ===============================================================

window.browserBridge?.onShortcutFocusAddress?.((payload = {}) => {
  focusAddressInput(payload);
});

const applySmartDomainShortcut = (tld) => {
  const input = elements.addressBar;
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;
  const sanitized = text
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split(/[/?#]/)[0]
    .trim();
  if (!sanitized) return;
  const target = `https://www.${sanitized}.${tld}`;
  window.browserBridge.navigate(target);
};

const bindAddressSmartShortcuts = () => {
  const input = elements.addressBar;
  if (!input) return;
  input.addEventListener('keydown', (event) => {
    if (event.code === 'Enter') {
      const ctrlOrCmd = event.ctrlKey || event.metaKey;
      const { shiftKey: shift, altKey: alt } = event;
      let tld = null;
      if (ctrlOrCmd && shift && !alt) {
        tld = 'org';
      } else if (ctrlOrCmd && !shift && !alt) {
        tld = 'com';
      } else if (!ctrlOrCmd && shift && !alt) {
        tld = 'net';
      }
      if (!tld) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      applySmartDomainShortcut(tld);
      // fall through: normal Enter navigation will handle plain inputs
    }
  });
};
// Allow suggestion commit to run first; fallback to raw navigate.
let commitAddressSuggestion = () => false;
if (elements.addressBar) {
  elements.addressBar.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (commitAddressSuggestion()) {
          elements.addressBar.blur();
          return;
        }
        const value = elements.addressBar.value || '';
        if (value.trim()) {
          const target = toTargetUrl(value);
          if (target) {
            window.browserBridge.navigate(target);
          }
        }
        suggestionControllers.address?.hide?.();
        elements.addressBar.blur();
      }
    },
    true
  );
}

const normalizeHandshakeUrl = (value) => {
  if (!value) return '';
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
};

const renderHandshakeBadge = (ok, options = {}) => {
  if (!handshakeBadge) return;
  const { transient, duration } = options;
  handshakeBadge.textContent = ok ? 'MOBrowser' : 'No MOBrowser';
  handshakeBadge.classList.toggle('handshake-ok', !!ok);
  handshakeBadge.classList.toggle('handshake-missing', !ok);
  if (!transient) {
    return;
  }
  handshakeBadge.classList.remove('handshake-hidden');
  if (handshakeHideTimer) {
    clearTimeout(handshakeHideTimer);
    handshakeHideTimer = null;
  }
  if (transient) {
    const hideAfter = typeof duration === 'number' ? duration : 3000;
    handshakeHideTimer = setTimeout(() => {
      handshakeBadge?.classList.add('handshake-hidden');
    }, hideAfter);
  }
};

const applyHandshakeToActiveUrl = () => {
  const currentUrl = normalizeHandshakeUrl(state.navigation?.url || '');
  if (!currentUrl) {
    return;
  }
  const status = handshakeState.map.get(currentUrl);
  const duration = status ? 2000 : 4000;
  renderHandshakeBadge(!!status, { transient: !!status, duration });
};

renderHandshakeBadge(false);

let securityPopoverOpen = false;

const buildSecurityPayload = () => {
  const indicator = elements.addressSecurity;
  if (!indicator) return null;
  const state = indicator.dataset.security;
  if (!state || state === 'hidden') return null;
  return {
    state,
    title: indicator.dataset.securityTitle || '',
    message: indicator.dataset.securityMessage || '',
    host: indicator.dataset.securityHost || '',
    iconId: indicator.dataset.securityIcon || 'lock'
  };
};

const showSecurityPopover = () => {
  if (!elements.addressSecurity || !window.browserBridge?.showSecurityPopover) return;
  const payload = buildSecurityPayload();
  if (!payload) return;
  const rect = elements.addressSecurity.getBoundingClientRect();
  window.browserBridge.showSecurityPopover(
    {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    },
    payload
  );
  elements.addressSecurity.setAttribute('aria-expanded', 'true');
  securityPopoverOpen = true;
};

const updateSecurityPopover = () => {
  if (!securityPopoverOpen || !window.browserBridge?.updateSecurityPopover) return;
  const payload = buildSecurityPayload();
  if (!payload) {
    hideSecurityPopover();
    return;
  }
  window.browserBridge.updateSecurityPopover(payload);
};

const hideSecurityPopover = () => {
  if (!securityPopoverOpen) return;
  window.browserBridge?.closeSecurityPopover?.();
  elements.addressSecurity?.setAttribute('aria-expanded', 'false');
  securityPopoverOpen = false;
};

if (elements.addressSecurity) {
  elements.addressSecurity.addEventListener('click', (event) => {
    event.stopPropagation();
    if (securityPopoverOpen) {
      hideSecurityPopover();
      return;
    }
    showSecurityPopover();
  });

  document.addEventListener('click', (event) => {
    if (!securityPopoverOpen) return;
    if (elements.addressSecurity.contains(event.target)) return;
    hideSecurityPopover();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideSecurityPopover();
    }
  });

  elements.addressBar?.addEventListener('focus', hideSecurityPopover);
}

window.browserBridge?.onSecurityPopoverClosed?.(() => {
  securityPopoverOpen = false;
  elements.addressSecurity?.setAttribute('aria-expanded', 'false');
});

const createSuggestionController = ({ input, list, onCommit }) => {
  if (!input || !list || !window.browserBridge?.getAddressSuggestions) {
    return null;
  }
  let items = [];
  let activeIndex = -1;
  let visibleItems = [];
  let currentQuery = '';
  let debounceHandle;
  let lastSelectedItem = null;

  const popupBounds = () => {
    const rect = input.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  };

  const render = () => {
    // Render only in popup to ensure overlay above BrowserView
    if (!items.length) {
      window.browserBridge?.closeSuggestionsPopup?.();
      visibleItems = [];
      return;
    }
    visibleItems = items.slice(0, 4); // cap rows to avoid scrollbar
    const selectionIndex = activeIndex >= 0 ? activeIndex : 0;
    lastSelectedItem = visibleItems[selectionIndex] || null;
    window.browserBridge?.showSuggestionsPopup?.(popupBounds(), {
      items: visibleItems,
      activeIndex
    });
  };

  const fetchSuggestions = async (query) => {
    if (!query) {
      items = [];
      activeIndex = -1;
      render();
      return;
    }
    // Ignore stale responses
    const requestId = query;
    try {
      const result = (await window.browserBridge.getAddressSuggestions(query)) || [];
      if (requestId !== currentQuery) {
        return;
      }
      items = result;
      if (activeIndex >= items.length) {
        activeIndex = items.length ? items.length - 1 : -1;
      }
      render();
    } catch (err) {
      console.error('[Suggestions] fetch failed', err);
    }
  };

  const scheduleFetch = () => {
    const value = input.value.trim();
    // If cleared, immediately hide and reset
    if (!value) {
      clearTimeout(debounceHandle);
      items = [];
      visibleItems = [];
      activeIndex = -1;
      currentQuery = '';
      lastSelectedItem = null;
      window.browserBridge?.closeSuggestionsPopup?.();
      return;
    }
    if (value !== currentQuery) {
      currentQuery = value;
      activeIndex = -1;
    }
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => fetchSuggestions(value), 60);
  };

  const highlight = (delta) => {
    if (!items.length) {
      return;
    }
    activeIndex = (activeIndex + delta + items.length) % items.length;
    render();
  };

  const commit = (index) => {
    const source =
      visibleItems[index] ||
      items[index] ||
      lastSelectedItem ||
      (items.length ? items[0] : null);
    const payload =
      source ||
      (input && input.value
        ? { url: input.value, title: input.value, source: 'manual' }
        : null);
    if (!payload) {
      hide();
      return;
    }
    onCommit?.(payload);
    hide();
  };

  const hide = () => {
    items = [];
    activeIndex = -1;
    window.browserBridge?.closeSuggestionsPopup?.();
  };

  input.addEventListener('input', scheduleFetch);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      if (items.length) {
        event.preventDefault();
        highlight(1);
      }
    } else if (event.key === 'ArrowUp') {
      if (items.length) {
        event.preventDefault();
        highlight(-1);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const targetIndex = activeIndex >= 0 ? activeIndex : 0;
      commit(targetIndex);
    } else if (event.key === 'Escape') {
      hide();
    }
  });

  input.addEventListener('blur', () => {
    hide();
  });

  const commitActive = () => {
    if (activeIndex < 0 || !items.length) return false;
    commit(activeIndex);
    return true;
  };

  return { hide, commitActive };
};

const toTargetUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  if (hasScheme) {
    try {
      const u = new URL(value);
      const host = u.hostname || '';
      const hostHasDot = host.includes('.');
      const isLocalHost = host === 'localhost';
      const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
      if (hostHasDot || isLocalHost || isIp) {
        return value;
      }
    } catch {
      // fall through to search
    }
  }

  // If no scheme and it has a dot, treat as URL; else search
  if (!hasScheme && value.includes('.')) {
    return value;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
};

const suggestionControllers = {
  address:
    createSuggestionController({
      input: elements.addressBar,
      list: suggestionElements.address,
      onCommit: (item) => {
        const finalValue =
          item.source === 'search'
            ? item.query || item.url || item.title
            : item.url || item.title;
        elements.addressBar.value = finalValue === 'about:blank' ? '' : finalValue;
        // send to popup overlay
        const targetUrl = toTargetUrl(item.url || finalValue);
        try {
          window.browserBridge?.navigate?.(targetUrl);
        } catch (err) {
          console.error('[Suggestions] navigate failed', err);
        }
        window.browserBridge?.closeSuggestionsPopup?.();
        // keep focus so Enter+arrow flows are reliable
        elements.addressBar.focus();
      }
    }) || null,
  center:
    createSuggestionController({
      input: elements.centerAddressBar,
      list: suggestionElements.center,
      onCommit: (item) => {
        const finalValue =
          item.source === 'search'
            ? item.query || item.url || item.title
            : item.url || item.title;
        elements.centerAddressBar.value = finalValue === 'about:blank' ? '' : finalValue;
        const targetUrl = toTargetUrl(item.url || finalValue);
        try {
          window.browserBridge?.navigate?.(targetUrl);
        } catch (err) {
          console.error('[Suggestions] navigate failed', err);
        }
        window.browserBridge?.closeSuggestionsPopup?.();
        elements.centerAddressBar.focus();
      }
    }) || null
};

if (suggestionControllers.address?.commitActive) {
  commitAddressSuggestion = suggestionControllers.address.commitActive;
}

// Center suggestions: prefer committing the highlighted suggestion, fall back to raw input.
let commitCenterSuggestion = () => false;
if (suggestionControllers.center?.commitActive) {
  commitCenterSuggestion = suggestionControllers.center.commitActive;
}

bindAddressSmartShortcuts();

/* ====== NEW GLOBAL KEY HANDLER: typing goes to top address bar ====== */
window.addEventListener(
  'keydown',
  (event) => {
    const isCmdOrCtrl = event.ctrlKey || event.metaKey;

    // Ctrl/Cmd + Tab (cycle forward) and Ctrl/Cmd + Shift + Tab (cycle backward)
    if (event.key === 'Tab' && isCmdOrCtrl) {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.shiftKey ? -1 : 1;
      window.browserBridge?.cycleTab?.(delta);
      return;
    }

    // 1) Ctrl/Cmd + L => focus address bar & select all
    if (
      isCmdOrCtrl &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'l'
    ) {
      event.preventDefault();
      focusAddressInput({ selectAll: true });
      return;
    }

    // If already typing in an input/textarea/contentEditable, do nothing
    if (isTypingField(document.activeElement)) {
      return;
    }

    if (event.defaultPrevented) return;

    // Ignore if any modifier is pressed (Ctrl, Alt, Meta)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (!isPrintableKey(event)) {
      return;
    }

    const input = elements.addressBar;
    if (!input) return;

    input.focus();

    if (event.key === 'Backspace' || event.key === 'Delete') {
      input.value = '';
    } else if (event.key.length === 1) {
      input.value = event.key;
    }

    const pos = input.value.length;
    input.setSelectionRange(pos, pos);

    event.preventDefault();
  },
  true
);

// Also handle Ctrl+Shift+T from the main renderer to reopen multiple closed tabs reliably.
window.addEventListener(
  'keydown',
  (event) => {
    const isCmdOrCtrl = event.ctrlKey || event.metaKey;
    if (isCmdOrCtrl && event.shiftKey && !event.altKey && event.code === 'KeyT') {
      event.preventDefault();
      window.browserBridge?.reopenLastClosed?.();
    }
  },
  true
);
/* ==================================================================== */

// Right-click anywhere to pop open DevTools while suppressing the native menu.
// Allow the custom tab context menu to work; block default menus elsewhere.
window.addEventListener('contextmenu', (event) => {
  // If the right-click is on a tab or its wrapper, let the tabStrip handler open the Pin/Close menu.
  if (
    event.target &&
    event.target.closest &&
    (event.target.closest('.tab') || event.target.closest('.tab-wrapper'))
  ) {
    return;
  }
  event.preventDefault();
});

const getHeaderHeight = () => header?.getBoundingClientRect().height || 0;
const getHeroHeight = () =>
  document.body.classList.contains('show-hero') && contentArea
    ? contentArea.getBoundingClientRect().height || 0
    : 0;
const getChromeHeight = () => Math.ceil(getHeaderHeight() + getHeroHeight());

// Tells the main process how tall the chrome currently is.
const setChromeOffsetCss = (value) => {
  const px = Math.max(0, Math.round(value || 0));
  document.documentElement.style.setProperty('--chrome-offset', `${px}px`);
};

const reportTopOffset = () => {
  if (!window.browserBridge.updateTopOffset) {
    return;
  }
  const headerHeight = getHeaderHeight();
  const height = Math.ceil(headerHeight + getHeroHeight());
  setChromeOffsetCss(headerHeight);
  window.browserBridge.updateTopOffset(height);
};

/* ----------------------------- [ADDED] -----------------------------
   Keep BrowserView correctly placed and guarantee clicks/scrolls
   outside the header pass through to the BrowserView.
------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  reportTopOffset();

  // 1) CSS safety: common overlay/fade elements shouldn't capture events
  const style = document.createElement('style');
  style.id = 'click-through-fix';
  style.textContent = `
    .tab-fade, .tab-fade-left, .tab-fade-right,
    .header-shadow, .top-gradient, .content-overlay {
      pointer-events: none !important;
    }
    /* Keep actual chrome interactive */
    .header, .tab-section, .toolbar,
    #newTabButton, #addressBar {
      pointer-events: auto;
    }

    /* ===== [DRAG FIX] Limit draggable region to header only ===== */
    /* Everything by default: NOT draggable (so web area gets clicks) */
    html, body, #root, .app, .content, .tab-content, .main, .page {
      -webkit-app-region: no-drag !important;
    }
    /* Only the header strip acts as the draggable titlebar */
    .header {
      -webkit-app-region: drag !important;
    }
    /* Buttons/inputs inside header must remain clickable */
    .header * {
      -webkit-app-region: no-drag !important;
    }
    /* ============================================================ */
  `;
  document.head.appendChild(style);

  // 2) Event pass-through: if a click/wheel happens outside the header,
  // temporarily disable pointer-events on the BODY so the BrowserView underneath
  // receives the event (prevents any stray transparent layer from blocking it).
  const passThroughIfOutsideHeader = () => {
    document.body.style.pointerEvents = 'none';
    // Use microtask to re-enable immediately after the event dispatch
    Promise.resolve().then(() => (document.body.style.pointerEvents = ''));
  };

  const isOutsideHeader = (target) => {
    if (target && target.closest && target.closest('.start-card')) return false;
    return !(header && header.contains(target));
  };

  // Capture phase so we run before any other handlers.
  document.addEventListener(
    'mousedown',
    (e) => {
      if (isOutsideHeader(e.target)) passThroughIfOutsideHeader();
    },
    true
  );

  document.addEventListener(
    'wheel',
    (e) => {
      if (isOutsideHeader(e.target)) passThroughIfOutsideHeader();
    },
    { capture: true, passive: true }
  );
});

/* Keep BrowserView in sync if the header height changes */
if (header && 'ResizeObserver' in window) {
  const ro = new ResizeObserver(() => reportTopOffset());
  ro.observe(header);
  if (contentArea) {
    ro.observe(contentArea);
  }
}

window.addEventListener('resize', reportTopOffset);
/* --------------------------- [/ADDED] ---------------------------- */

// Setup the tab strip renderer.
const { render: renderTabs } = initTabStrip({
  tabContainer: elements.tabContainer,
  newTabButton: elements.newTabButton,
  bridge: window.browserBridge
});

// Setup the navigation bar renderer.
const { render: renderNavigation } = initNavigationBar({
  elements: {
    backButton: elements.backButton,
    forwardButton: elements.forwardButton,
    reloadButton: elements.reloadButton,
    addressBar: elements.addressBar,
    securityIndicator: elements.addressSecurity,
    goButton: elements.goButton
  },
  bridge: window.browserBridge
});

// ===================== [ADDED ✨ WINDOW CONTROLS] =====================
// Setup window control buttons
if (elements.minButton) {
  elements.minButton.onclick = () => {
    window.browserBridge?.minimizeWindow?.();
  };
}
if (elements.maxButton) {
  elements.maxButton.onclick = () => {
    window.browserBridge?.toggleMaximize?.();
  };
}
if (elements.closeButton) {
  elements.closeButton.onclick = () => {
    window.browserBridge?.closeWindow?.();
  };
}
// =================== [/ADDED ✨ WINDOW CONTROLS] ======================

// Helper to keep the centered address bar in sync.
const syncCenterAddress = (url) => {
  if (!elements.centerAddressBar) return;
  if (document.activeElement === elements.centerAddressBar) return;
  if (!url || url === 'about:blank') {
    elements.centerAddressBar.value = '';
    return;
  }
  elements.centerAddressBar.value = url;
};

const toggleHeroVisibility = (url) => {
  const shouldShow = !url || url === 'about:blank';
  document.body.classList.toggle('show-hero', shouldShow);
  // Anytime hero changes, recalc offset so BrowserView sits below it.
  reportTopOffset();
};

const navigateFromCenter = () => {
  if (!elements.centerAddressBar) return;
  const target = toTargetUrl(elements.centerAddressBar.value);
  if (target) {
    window.browserBridge.navigate(target);
  }
  elements.centerAddressBar.blur();
};

/* ===================== CHANGED: onTabState ===================== */
// Anytime the main process reports tab state, redraw UI bindings.
window.browserBridge.onTabState((payload) => {
  // capture previous state (before applyState mutates it)
  const prevActiveId = state.activeTabId;
  const prevTabsLength = Array.isArray(state.tabs) ? state.tabs.length : 0;

  applyState(payload);
  renderTabs(state);
  renderNavigation(state);
  updateSecurityPopover();
  syncCenterAddress(state.navigation.url);
  toggleHeroVisibility(state.navigation.url);
  reportTopOffset();
  updateBookmarkIndicator();
  applyHandshakeToActiveUrl();
  rendererLog('Tab state updated', payload);
  suggestionControllers.address?.hide();
  suggestionControllers.center?.hide();

  // Detect when a *new* blank tab becomes active (New Tab)
  const newTabsLength = Array.isArray(state.tabs) ? state.tabs.length : 0;
  const hasNewTab = newTabsLength > prevTabsLength;
  const activeChanged = state.activeTabId !== prevActiveId;
  const url = state.navigation?.url;
  const isBlank = !url || url === 'about:blank';

  if ((hasNewTab || activeChanged) && isBlank) {
    // Wait a tick so BrowserView is attached, then steal focus to chrome
    setTimeout(() => {
      const input = elements.addressBar;
      if (!input) return;
      elements.centerAddressBar?.blur?.();
      window.focus?.();
      input.focus();
      input.select();
    }, 50);
  }

  // If the active tab is blank, keep the top address bar focused so typing starts there.
  if (isBlank) {
    elements.centerAddressBar?.blur?.();
    focusAddressInput({ selectAll: true });
  }
});
/* =============================================================== */

reportTopOffset();
toggleHeroVisibility(state.navigation.url);

// Anchors and toggles the bookmarks dropdown.
const getBookmarkFavicon = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return null;
  }
};

const getBookmarkInitial = (entry) => {
  const source = entry.title || entry.url || '';
  const match = source.match(/[A-Za-z]/);
  return (match ? match[0] : '?').toUpperCase();
};

const renderBookmarkBar = () => {
  if (!elements.bookmarkBar || !elements.bookmarkBarItems) return;
  const barEntries = bookmarksState.entries.filter((entry) => entry.folder === 'bar');
  elements.bookmarkBar.hidden = barEntries.length === 0;
  elements.bookmarkBarItems.innerHTML = '';
  barEntries.forEach((entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmark-bar-button';
    btn.title = entry.title || entry.url;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'bookmark-icon';
    const favicon = entry.favicon || getBookmarkFavicon(entry.url);
    if (favicon) {
      const img = document.createElement('img');
      img.src = favicon;
      img.alt = '';
      img.addEventListener('error', () => {
        iconWrap.textContent = getBookmarkInitial(entry);
        img.remove();
      });
      iconWrap.appendChild(img);
    } else {
      iconWrap.textContent = getBookmarkInitial(entry);
    }
    const label = document.createElement('span');
    label.className = 'bookmark-label';
    label.textContent = entry.title || entry.url;
    btn.append(iconWrap, label);
    btn.addEventListener('click', () => {
      window.browserBridge.navigate(entry.url);
    });
    // Right-click to edit bookmark inline.
    btn.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      openBookmarkModal(entry);
    });
    elements.bookmarkBarItems.appendChild(btn);
  });
};

const openHistoryPage = async () => {
  if (
    !window.browserBridge?.createTab ||
    !window.browserBridge?.navigate
  ) {
    console.warn('[Renderer] History tab bridge missing');
    return;
  }
  try {
    const historyUrl = new URL('./history/index.html', window.location.href).toString();
    await window.browserBridge.createTab();
    await window.browserBridge.navigate(historyUrl);
  } catch (err) {
    console.error('[Renderer] Failed to open history page', err);
  }
};

const openDownloadsPage = async () => {
  if (
    !window.browserBridge?.createTab ||
    !window.browserBridge?.navigate
  ) {
    console.warn('[Renderer] Downloads tab bridge missing');
    return;
  }
  try {
    const downloadsUrl = new URL('./downloads/index.html', window.location.href).toString();
    await window.browserBridge.createTab();
    await window.browserBridge.navigate(downloadsUrl);
  } catch (err) {
    console.error('[Renderer] Failed to open downloads page', err);
  }
};

const openCredentialManagerPage = async () => {
  if (
    !window.browserBridge?.createTab ||
    !window.browserBridge?.navigate
  ) {
    console.warn('[Renderer] Credential manager bridge missing');
    return;
  }
  try {
    const credentialUrl = new URL('./credentialManager/index.html', window.location.href).toString();
    await window.browserBridge.createTab();
    await window.browserBridge.navigate(credentialUrl);
  } catch (err) {
    console.error('[Renderer] Failed to open credential manager page', err);
  }
};

const getBookmarkQuickContext = () => {
  const activeTab = getActiveTab();
  const url = state.navigation?.url || '';
  const isBookmarked = !!url && bookmarksState.entries.some((entry) => entry.url === url);
  return {
    currentUrl: url,
    currentTitle: activeTab?.title || url,
    isBookmarked
  };
};

const syncBookmarkQuickContext = () => {
  if (!window.browserBridge?.updateBookmarkQuickContext) return;
  window.browserBridge.updateBookmarkQuickContext(getBookmarkQuickContext());
};

const toggleBookmarkQuickPopup = (anchorEl = elements.bookmarkStar) => {
  if (!anchorEl || !window.browserBridge?.toggleBookmarkQuickPopup) return;
  const rect = anchorEl.getBoundingClientRect();
  const bounds = {
    x: rect.left,
    y: rect.bottom + 8,
    width: rect.width,
    height: rect.height
  };
  window.browserBridge.toggleBookmarkQuickPopup(bounds, getBookmarkQuickContext());
};

const SHORTCUT_STORAGE_KEY = 'mobrowser-shortcuts';

const loadShortcutItems = () => {
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && entry.name && entry.url);
  } catch {
    return [];
  }
};

const persistShortcuts = () => {
  try {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(shortcutsState.items));
  } catch {
    // ignore
  }
};

const normalizeShortcutUrl = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const renderShortcuts = () => {
  if (!elements.shortcutGrid) return;
  elements.shortcutGrid.querySelectorAll('[data-shortcut-id]').forEach((node) => node.remove());
  shortcutsState.items.forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero-shortcut';
    button.dataset.shortcutId = entry.id;
    const icon = document.createElement('span');
    icon.className = 'hero-shortcut-icon';
    icon.textContent = (entry.name || entry.url || '?').trim().charAt(0).toUpperCase();
    const label = document.createElement('span');
    label.className = 'hero-shortcut-label';
    label.textContent = entry.name || entry.url;
    const menuToggle = document.createElement('button');
    menuToggle.type = 'button';
    menuToggle.className = 'hero-shortcut-menu-btn';
    menuToggle.setAttribute('aria-label', 'Shortcut options');
    menuToggle.textContent = '⋮';
    const menu = document.createElement('div');
    menu.className = 'hero-shortcut-menu';
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'hero-shortcut-menu-item';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeAllShortcutMenus();
      openShortcutModal(entry);
    });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'hero-shortcut-menu-item danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeAllShortcutMenus();
      shortcutsState.items = shortcutsState.items.filter((i) => i.id !== entry.id);
      persistShortcuts();
      renderShortcuts();
    });
    menu.append(renameBtn, deleteBtn);
    menuToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllShortcutMenus();
      if (!isOpen) menu.classList.add('open');
    });
    button.append(icon, label, menuToggle, menu);
    button.append(menuToggle, menu);
    button.addEventListener('click', () => {
      if (entry.url) {
        window.browserBridge.navigate(entry.url);
      }
    });
    elements.shortcutGrid.appendChild(button);
  });
};

const openShortcutModal = (entry = null) => {
  if (!elements.shortcutModal) return;
  elements.shortcutModal.hidden = false;
  if (entry) {
    shortcutsState.editingId = entry.id;
    elements.shortcutNameInput.value = entry.name || '';
    elements.shortcutUrlInput.value = entry.url || '';
  } else {
    shortcutsState.editingId = null;
    elements.shortcutNameInput.value = '';
    elements.shortcutUrlInput.value = '';
  }
  setTimeout(() => elements.shortcutNameInput?.focus(), 0);
};

const closeShortcutModal = () => {
  if (!elements.shortcutModal) return;
  elements.shortcutModal.hidden = true;
  shortcutsState.editingId = null;
};

const closeAllShortcutMenus = () => {
  document.querySelectorAll('.hero-shortcut-menu.open').forEach((node) => node.classList.remove('open'));
};

document.addEventListener('click', closeAllShortcutMenus);

const renderAllBookmarksList = () => {
  if (!elements.allBookmarksPanel || !elements.allBookmarksList) return;
  const listEl = elements.allBookmarksList;
  listEl.innerHTML = '';
  if (!bookmarksState.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'all-bookmarks-empty';
    empty.textContent = 'No bookmarks yet';
    listEl.appendChild(empty);
    return;
  }

  const renderGroup = (items, title) => {
    if (!items.length) return;
    const header = document.createElement('div');
    header.className = 'all-bookmarks-header';
    header.textContent = title;
    listEl.appendChild(header);
    const fragment = document.createDocumentFragment();
    items.forEach((entry) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'all-bookmarks-row';

      const icon = document.createElement('span');
      icon.className = 'all-bookmarks-icon';
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

      const label = document.createElement('span');
      label.className = 'all-bookmarks-label';
      label.textContent = entry.title || entry.url;

      row.append(icon, label);
      row.addEventListener('click', () => {
        window.browserBridge.navigate(entry.url);
        hideAllBookmarksPanel();
      });

      fragment.appendChild(row);
    });
    listEl.appendChild(fragment);
  };

  const barEntries = bookmarksState.entries.filter((e) => e.folder === 'bar');
  const otherEntries = bookmarksState.entries.filter((e) => e.folder === 'other');
  renderGroup(barEntries, 'Bookmarks bar');
  renderGroup(otherEntries, 'Other bookmarks');
};

let allBookmarksPanelVisible = false;

const hideAllBookmarksPanel = () => {
  if (!elements.allBookmarksPanel) return;
  elements.allBookmarksPanel.hidden = true;
  allBookmarksPanelVisible = false;
  setContentSuppressed(0);
};

const showAllBookmarksPanel = () => {
  if (!elements.allBookmarksPanel) return;
  renderAllBookmarksList();
  elements.allBookmarksPanel.hidden = false;
  elements.allBookmarksPanel.style.visibility = 'hidden';
  positionAllBookmarksPanel();
  elements.allBookmarksPanel.style.visibility = '';
  allBookmarksPanelVisible = true;
  const headerHeight = document.querySelector('.header')?.offsetHeight || 120;
  const panelHeight = elements.allBookmarksPanel?.offsetHeight || 260;
  const cushion = 24;
  const desiredOffset = Math.min(window.innerHeight || 800, headerHeight + panelHeight + cushion);
  setContentSuppressed(desiredOffset);
};

const toggleAllBookmarksPanel = () => {
  if (allBookmarksPanelVisible) {
    hideAllBookmarksPanel();
  } else {
    showAllBookmarksPanel();
  }
};

const refreshBookmarkUI = () => {
  renderBookmarkBar();
  renderAllBookmarksList();
};

const positionAllBookmarksPanel = () => {
  if (!elements.allBookmarksPanel || !elements.bookmarkAllButton) return;
  const rect = elements.bookmarkAllButton.getBoundingClientRect();
  const panel = elements.allBookmarksPanel;
  const panelWidth = panel.offsetWidth || 260;
  const panelHeight = panel.offsetHeight || 200;
  const margin = 16;
  let left = rect.left + rect.width / 2 - panelWidth / 2;
  left = Math.max(margin, Math.min(window.innerWidth - panelWidth - margin, left));
  let top = rect.bottom + 8;
  if (top + panelHeight + margin > window.innerHeight) {
    top = window.innerHeight - panelHeight - margin;
  }
  top = Math.max(margin, top);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
};

const getActiveTab = () => state.tabs.find((tab) => tab.id === state.activeTabId);

elements.bookmarkAllButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleBookmarkQuickPopup(event.currentTarget);
});

elements.bookmarkOverflowButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleBookmarkQuickPopup(event.currentTarget);
});

elements.bookmarkAppsButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  // Placeholder: navigate to home/shortcuts; reuse current behavior to focus address input
  focusAddressInput({ selectAll: true });
});

document.addEventListener('click', (event) => {
  if (!allBookmarksPanelVisible) return;
  if (
    elements.allBookmarksPanel?.contains(event.target) ||
    elements.bookmarkAllButton?.contains(event.target)
  ) {
    return;
  }
  hideAllBookmarksPanel();
});

// Visually indicates if the active page is bookmarked.
const updateBookmarkIndicator = () => {
  if (!elements.bookmarkStar) return;

  const url = state.navigation?.url;
  const isBookmarked = !!url && bookmarksState.entries.some((entry) => entry.url === url);
  elements.bookmarkStar.classList.toggle('active', isBookmarked);
  elements.bookmarkStar.textContent = isBookmarked ? '\u2605' : '\u2606';
  syncBookmarkQuickContext();
};

// ==== Bookmark modal helpers ====
const findBookmarkByUrl = (url) => bookmarksState.entries.find((entry) => entry.url === url);

const getActivePageTitle = () => {
  const activeTab = getActiveTab();
  return activeTab?.title || state.navigation?.title || state.navigation?.url || '';
};

const getActiveTabFavicon = () => {
  const activeTab = getActiveTab();
  return activeTab?.faviconUrl || state.navigation?.favicon || '';
};

function setContentSuppressed(offsetPx = 0) {
  // Move the BrowserView down so overlays (modal/panels) sit above it.
  const offset = Number(offsetPx) || 0;
  if (offset > 0) {
    window.browserBridge?.updateTopOffset?.(offset);
    return;
  }
  reportTopOffset();
}

const openBookmarkModal = (entryOverride = null) => {
  if (
    !elements.bookmarkModal ||
    !elements.bookmarkNameInput ||
    !elements.bookmarkFolderSelect ||
    !elements.bookmarkModalClose
  )
    return;
  const url = entryOverride?.url || state.navigation?.url || '';
  const existing = entryOverride || findBookmarkByUrl(url);
  elements.bookmarkModal.hidden = false;
  elements.bookmarkModal.dataset.bookmarkId = existing?.id || '';
  elements.bookmarkModal.dataset.bookmarkUrl = url;
  elements.bookmarkModal.dataset.bookmarkFavicon =
    existing?.favicon || getActiveTabFavicon() || getBookmarkFavicon(url) || '';
  const titleEl = document.getElementById('bookmarkModalTitle');
  if (titleEl) {
    titleEl.textContent = existing ? 'Edit bookmark' : 'Add bookmark';
  }
  elements.bookmarkNameInput.value = existing?.title || getActivePageTitle() || url;
  elements.bookmarkFolderSelect.value = existing?.folder || 'bar';
  if (elements.bookmarkRemoveButton) {
    elements.bookmarkRemoveButton.hidden = !existing;
  }
  setContentSuppressed(window.innerHeight || 800); // keep modal above BrowserView
  setTimeout(() => elements.bookmarkNameInput?.focus(), 0);
};

const closeBookmarkModal = () => {
  if (elements.bookmarkModal) {
    elements.bookmarkModal.hidden = true;
    elements.bookmarkModal.dataset.bookmarkId = '';
  }
  setContentSuppressed(0);
};

const saveBookmarkFromModal = async () => {
  const url =
    elements.bookmarkModal?.dataset.bookmarkUrl ||
    state.navigation?.url ||
    '';
  if (!url) return;
  const id = elements.bookmarkModal?.dataset.bookmarkId || '';
  const title = elements.bookmarkNameInput?.value?.trim() || url;
  const folder = elements.bookmarkFolderSelect?.value === 'other' ? 'other' : 'bar';
  const favicon =
    elements.bookmarkModal?.dataset.bookmarkFavicon ||
    getActiveTabFavicon() ||
    getBookmarkFavicon(url);
  await window.browserBridge.saveBookmark({
    id: id || undefined,
    title,
    url,
    folder,
    favicon,
    createdAt: Date.now()
  });
  closeBookmarkModal();
};

const removeBookmarkFromModal = async () => {
  const url =
    elements.bookmarkModal?.dataset.bookmarkUrl ||
    state.navigation?.url ||
    '';
  if (!url) return;
  const id = elements.bookmarkModal?.dataset.bookmarkId || '';
  await window.browserBridge.removeBookmark(id ? { id } : url);
  closeBookmarkModal();
};

elements.bookmarkStar?.addEventListener('click', (event) => {
  event.stopPropagation();
  openBookmarkModal();
});

elements.githubButton?.addEventListener('click', () => {
  window.browserBridge?.openGithubLoginTab?.();
});

// Hydrate bookmarks on startup.
window.browserBridge.getBookmarks().then((entries) => {
  bookmarksState.entries = entries || [];
  updateBookmarkIndicator();
  refreshBookmarkUI();
});

// Keep the bookmark indicator synced when other tabs add/remove entries.
window.browserBridge.onBookmarksUpdate((entries) => {
  bookmarksState.entries = entries || [];
  updateBookmarkIndicator();
  refreshBookmarkUI();
});

elements.bookmarkModalClose?.addEventListener('click', closeBookmarkModal);
elements.bookmarkCancelButton?.addEventListener('click', closeBookmarkModal);
elements.bookmarkRemoveButton?.addEventListener('click', (ev) => {
  ev.preventDefault();
  removeBookmarkFromModal();
});
elements.bookmarkForm?.addEventListener('submit', (ev) => {
  ev.preventDefault();
  saveBookmarkFromModal();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && elements.bookmarkModal && !elements.bookmarkModal.hidden) {
    closeBookmarkModal();
  }
});

window.browserBridge.onHandshakeStatus?.((payload = {}) => {
  const urlKey = normalizeHandshakeUrl(payload.url || '');
  if (!urlKey) {
    return;
  }
  handshakeState.map.set(urlKey, !!payload.ok);
  const currentUrl = normalizeHandshakeUrl(state.navigation?.url || '');
  if (currentUrl === urlKey) {
    const duration = payload.ok ? 2000 : 4000;
    renderHandshakeBadge(!!payload.ok, { transient: !!payload.ok, duration });
  }
});

const toggleSettingsPopup = () => {
  if (!elements.settingsButton || !window.browserBridge.toggleSettingsPopup) return;

  const rect = elements.settingsButton.getBoundingClientRect();
  const bounds = { x: rect.left, y: rect.bottom + 8, width: rect.width, height: rect.height };
  window.browserBridge.toggleSettingsPopup(bounds);
};

elements.settingsButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleSettingsPopup();
});

// Chat drawer toggle + keyboard shortcut (Ctrl+/)
if (window.chatBridge && elements.chatToggle) {
  const fullscreenToggleBtn = document.createElement('button');
  fullscreenToggleBtn.id = 'fullscreenChatToggle';
  fullscreenToggleBtn.className = 'fs-chat-toggle';
  fullscreenToggleBtn.type = 'button';
  fullscreenToggleBtn.setAttribute('aria-label', 'Toggle AI Chat');
  fullscreenToggleBtn.textContent = '🤖';
  document.body.appendChild(fullscreenToggleBtn);

  const panel = initChatPanel({
    bridge: window.chatBridge,
    toggleButton: elements.chatToggle
  });

  fullscreenToggleBtn.addEventListener('click', () => panel?.toggle?.());

  window.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === '/') {
      e.preventDefault();
      panel?.toggle?.();
    }
  });
} else {
  document.body.classList.add('unsupported-chat');
  console.warn('[Chat] bridge missing; chat disabled');
}

// Centered hero controls
elements.centerAddressForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  // Allow suggestion commit to run first; fallback to raw navigate.
  if (commitCenterSuggestion()) {
    elements.centerAddressBar?.blur?.();
    return;
  }
  navigateFromCenter();
});

elements.centerAddressBar?.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (commitCenterSuggestion()) {
        elements.centerAddressBar?.blur?.();
        return;
      }
      navigateFromCenter();
      suggestionControllers.center?.hide?.();
      elements.centerAddressBar?.blur?.();
    }
  },
  true
);

/* ✨ NEW: clicking anywhere on the center search pill focuses the center input */
if (elements.centerAddressBar) {
  document.addEventListener('click', (e) => {
    const container = e.target && e.target.closest ? e.target.closest('.center-address') : null;
    if (!container) return;
    if (document.activeElement === elements.centerAddressBar) return;

    elements.centerAddressBar.focus();
    const pos = elements.centerAddressBar.value.length;
    elements.centerAddressBar.setSelectionRange(pos, pos);
  });
}

elements.heroNewTab?.addEventListener('click', () => window.browserBridge.createTab());
elements.heroBookmarks?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleBookmarkQuickPopup(e.currentTarget);
});
elements.heroHistory?.addEventListener('click', (e) => {
  e.stopPropagation();
  openHistoryPage();
});
elements.heroCredentialTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openCredentialManagerPage();
});
elements.heroDownloadsTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openDownloadsPage();
});
elements.heroPrintTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openCredentialManagerPage();
});
elements.heroGitTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openCredentialManagerPage();
});
elements.heroDataTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openCredentialManagerPage();
});
elements.heroBookmarkTile?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openBookmarkModal();
});
elements.heroAddShortcut?.addEventListener('click', () => openShortcutModal());
elements.shortcutModalClose?.addEventListener('click', closeShortcutModal);
elements.shortcutCancel?.addEventListener('click', closeShortcutModal);
elements.shortcutModal?.addEventListener('click', (event) => {
  if (event.target === elements.shortcutModal) {
    closeShortcutModal();
  }
});

elements.shortcutForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = elements.shortcutNameInput?.value.trim();
  const url = normalizeShortcutUrl(elements.shortcutUrlInput?.value || '');
  if (!name || !url) {
    return;
  }
  if (shortcutsState.editingId) {
    const existing = shortcutsState.items.find((i) => i.id === shortcutsState.editingId);
    if (existing) {
      existing.name = name;
      existing.url = url;
    }
  } else {
    shortcutsState.items.unshift({
      id: `shortcut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      url
    });
    if (shortcutsState.items.length > 12) {
      shortcutsState.items.length = 12;
    }
  }
  shortcutsState.editingId = null;
  persistShortcuts();
  renderShortcuts();
  closeShortcutModal();
});

shortcutsState.items = loadShortcutItems();
renderShortcuts();

/* ===================================================================== */
/* ======================= [ADDED ✨ DOWNLOADS] ========================= */
/**
 * Light renderer-side UX for Downloads:
 * - badge counter on #downloadButton
 * - small toast when a download starts/completes
 * - (optional) in-window flyout if you’re not using the popup window
 *
 * NOTE: This expects your preload to expose:
 *   - toggleDownloadsPopup(bounds)   // to open the popup window
 *   - getDownloadsHistory()          // array of past downloads
 *   - onDownloadsUpdate(callback)    // progress/completed/started events
 *   - openDownloadedItem(id)         // optional if you wired it
 *   - revealInFolder(path) / openDownloadsFolder() // optional convenience
 */
const downloadsState = {
  activeCount: 0,
  items: []  // {id, name, fileName, receivedBytes, totalBytes, state, savePath, startedAt, completedAt, url}
};

const ensureBadge = () => {
  if (!elements.downloadButton) return null;
  let badge = elements.downloadButton.querySelector('.badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'badge';
    elements.downloadButton.appendChild(badge);
  }
  return badge;
};

const renderBadge = () => {
  const badge = ensureBadge();
  if (!badge) return;
  // Show count of active downloads (or latest finished as 1 flash)
  const count = downloadsState.activeCount;
  if (count > 0) {
    badge.style.display = 'inline-flex';
    badge.textContent = String(count);
  } else {
    // hide when nothing active
    badge.style.display = 'none';
  }
  elements.downloadButton?.classList.toggle('download-progress', count > 0);
};

// ---- toast (small bubble under address bar) ----
let toastEl = null;
const ensureToast = () => {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'download-toast';
    toastEl.innerHTML = `
      <div class="title">Download</div>
      <div class="meta"></div>
      <div class="progress"><span></span></div>
    `;
    document.body.appendChild(toastEl);
  }
  return toastEl;
};

let toastTimer = null;
const showToast = (title, meta, pct = null, sticky = false) => {
  const el = ensureToast();
  el.querySelector('.title').textContent = title || 'Download';
  el.querySelector('.meta').textContent = meta || '';
  const bar = el.querySelector('.progress > span');
  if (pct == null) {
    bar.style.width = '0%';
    el.querySelector('.progress').style.display = 'none';
  } else {
    el.querySelector('.progress').style.display = 'block';
    bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
  el.style.display = 'block';
  clearTimeout(toastTimer);
  if (!sticky) {
    toastTimer = setTimeout(() => (el.style.display = 'none'), 2200);
  }
};

const hideToast = () => {
  if (toastEl) toastEl.style.display = 'none';
  clearTimeout(toastTimer);
};

// ---- optional: in-window flyout (if you’re not using popup window) ----
let flyoutEl = null;
const ensureFlyout = () => {
  if (!flyoutEl) {
    flyoutEl = document.createElement('div');
    flyoutEl.id = 'downloadFlyout';
    document.body.appendChild(flyoutEl);
  }
  return flyoutEl;
};

const humanBytes = (n) => {
  if (!Number.isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let u = 0; let v = n;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
};

const renderFlyout = () => {
  if (!flyoutEl) return;
  const items = downloadsState.items.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  flyoutEl.innerHTML = items.map(d => {
    const total = d.totalBytes || 0;
    const got = d.receivedBytes || 0;
    const pct = total > 0 ? Math.round((got / total) * 100) : (d.state === 'completed' ? 100 : 0);
    const sub = [
      d.state === 'completed' ? 'Completed' :
        d.state === 'interrupted' ? 'Interrupted' :
          total ? `${humanBytes(got)} / ${humanBytes(total)}` : 'Starting…',
      d.fileName || d.name || ''
    ].filter(Boolean).join(' • ');

    return `
      <div class="download-item ${d.state || ''}" data-id="${d.id || ''}">
        <div class="icon">↓</div>
        <div>
          <div class="name" title="${(d.fileName || d.name || '').replace(/"/g, '&quot;')}">${d.fileName || d.name || '(file)'}</div>
          <div class="sub">${sub}</div>
        </div>
        <div class="actions">
          ${d.state === 'completed' ? `<button class="chip open" data-act="open">Open</button>` : ``}
          ${d.state === 'completed' ? `<button class="chip show" data-act="show">Show in folder</button>` : ``}
        </div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }).join('');

  // actions
  flyoutEl.querySelectorAll('.download-item .actions .chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const host = /** @type HTMLElement */(e.currentTarget).closest('.download-item');
      const id = host?.getAttribute('data-id');
      const act = e.currentTarget.getAttribute('data-act');

      const item = downloadsState.items.find(x => String(x.id) === String(id));
      if (!item) return;

      if (act === 'open' && window.browserBridge.openDownloadedItem) {
        window.browserBridge.openDownloadedItem(item.id).catch(() => { });
      }
      if (act === 'show') {
        if (item.savePath && window.browserBridge.revealInFolder) {
          window.browserBridge.revealInFolder(item.savePath).catch(() => { });
        } else if (window.browserBridge.openDownloadsFolder) {
          window.browserBridge.openDownloadsFolder().catch(() => { });
        }
      }
    });
  });
};

// toggle popup (preferred) or fallback to flyout
const toggleDownloadsUI = () => {
  if (elements.downloadButton && window.browserBridge.toggleDownloadsPopup) {
    const rect = elements.downloadButton.getBoundingClientRect();
    const bounds = { x: rect.left, y: rect.bottom + 8, width: rect.width, height: rect.height };
    window.browserBridge.toggleDownloadsPopup(bounds);
  } else {
    // fallback: in-window flyout
    const el = ensureFlyout();
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
    if (el.style.display === 'block') renderFlyout();
  }
};

elements.downloadButton?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDownloadsUI();
});



window.browserBridge?.onShortcutBookmark?.(() => {
  toggleBookmarkQuickPopup(elements.bookmarkStar || elements.addressBar);
});
window.browserBridge?.onShortcutDownloads?.(() => {
  toggleDownloadsUI();
});
window.browserBridge?.onShortcutHistory?.(() => {
  openHistoryPage();
});

// Seed history when app boots
if (window.browserBridge.getDownloadsHistory) {
  window.browserBridge.getDownloadsHistory().then((items) => {
    if (Array.isArray(items)) {
      downloadsState.items = items;
      downloadsState.activeCount = items.filter(d => d.state === 'progress' || d.state === 'started').length;
      renderBadge();
    }
  }).catch(() => { });
}

// Live updates from main
if (window.browserBridge.onDownloadsUpdate) {
  window.browserBridge.onDownloadsUpdate((payload) => {
    /**
     * Expected payload shapes (from main.js):
     *  { type:'started',   id, name, fileName, totalBytes, savePath, url, startedAt }
     *  { type:'progress',  id, receivedBytes, totalBytes }
     *  { type:'completed', id, savePath, fileName, completedAt }
     *  { type:'interrupted', id, reason }
     *  { type:'removed', id }  (optional)
     */
    const idx = downloadsState.items.findIndex(x => String(x.id) === String(payload.id));
    const upsert = (obj) => {
      if (idx >= 0) downloadsState.items[idx] = { ...downloadsState.items[idx], ...obj };
      else downloadsState.items.push(obj);
    };

    if (payload.type === 'started') {
      upsert({
        ...payload,
        state: 'progress',
        receivedBytes: 0,
        totalBytes: payload.totalBytes || 0
      });
      downloadsState.activeCount = Math.max(0, downloadsState.activeCount + 1);
      renderBadge();
      showToast('Download started', payload.fileName || payload.name || '', 0, true);
    }

    if (payload.type === 'progress') {
      upsert({
        ...downloadsState.items[idx],
        ...payload,
        state: 'progress'
      });
      const total = payload.totalBytes || downloadsState.items[idx]?.totalBytes || 0;
      const got = payload.receivedBytes || 0;
      const pct = total > 0 ? Math.round((got / total) * 100) : 0;
      showToast('Downloading…', `${humanBytes(got)} / ${humanBytes(total)}`, pct, true);
      renderFlyout();
    }

    if (payload.type === 'completed') {
      upsert({
        ...downloadsState.items[idx],
        ...payload,
        state: 'completed'
      });
      downloadsState.activeCount = Math.max(0, downloadsState.activeCount - 1);
      renderBadge();
      showToast('Download complete', payload.fileName || '', null, false);
      renderFlyout();
    }

    if (payload.type === 'interrupted') {
      upsert({
        ...downloadsState.items[idx],
        ...payload,
        state: 'interrupted'
      });
      downloadsState.activeCount = Math.max(0, downloadsState.activeCount - 1);
      renderBadge();
      showToast('Download failed', payload.reason || '', null, false);
      renderFlyout();
    }

    if (payload.type === 'removed') {
      if (idx >= 0) downloadsState.items.splice(idx, 1);
      renderFlyout();
    }
  });
}

/* ===================== [/ADDED ✨ DOWNLOADS] =========================== */
/* ===================================================================== */


