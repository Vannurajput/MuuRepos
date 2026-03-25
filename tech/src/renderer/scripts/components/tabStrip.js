/**
 * components/tabStrip.js
 * Renders tab buttons in the custom toolbar.
 */
const TAB_MIN_WIDTH = 36;    // keep in sync with CSS --tab-min-scroll (favicon-only minimum)
const TAB_MAX_WIDTH = 120;   // cap so they don't balloon when few tabs
const TAB_COMPACT_THRESHOLD = 70;
const TAB_GAP = 4;
const DRAG_THRESHOLD = 12;
const SHRINK_AFTER_COUNT = 4;        // start reducing width once 4+ tabs are open
const NEW_TAB_INLINE_WIDTH = 56;     // reserve room for the inline "+" and gap
const MAX_VISIBLE_TABS = 28;         // render up to 28; beyond this, keep hidden until space frees

// [CHANGED - TABMENU POPUP] REMOVE the in-DOM context menu import
// import { createTabContextMenu } from './tabContextMenu.js';

export const initTabStrip = ({ tabContainer, newTabButton, bridge }) => {
  let latestState = null;
  const seenTabIds = new Set(); // track tabs we've already rendered to add a brief blink on new tabs

  // [CHANGED - TABMENU POPUP] REMOVE the shared in-DOM popup instance
  // const contextMenu = createTabContextMenu(bridge);

  // [kept] Build two internal strips (once): pinned (no scroll) + scrollable (others)
  let pinnedStrip = tabContainer.querySelector('#pinnedStrip');
  let scrollStrip = tabContainer.querySelector('#scrollStrip');
  if (!pinnedStrip || !scrollStrip) {
    pinnedStrip = document.createElement('div');
    pinnedStrip.id = 'pinnedStrip';
    scrollStrip = document.createElement('div');
    scrollStrip.id = 'scrollStrip';

    // Move any existing children into the scroll area initially
    while (tabContainer.firstChild) {
      scrollStrip.appendChild(tabContainer.firstChild);
    }
    tabContainer.appendChild(pinnedStrip);
    tabContainer.appendChild(scrollStrip);
  }

  // Optional UI bits present in your HTML template
  const tabSection = document.querySelector('.tab-section');

  const computeTabWidth = (count) => {
    // measure width of the SCROLLING area (not the whole container)
    if (!scrollStrip || count <= 0) return TAB_MAX_WIDTH;

    const containerWidth =
      scrollStrip.clientWidth || scrollStrip.offsetWidth || 0;
    if (!containerWidth) return TAB_MAX_WIDTH;

    const totalGap = Math.max(0, (count - 1) * TAB_GAP);
    const available = Math.max(0, containerWidth - totalGap - NEW_TAB_INLINE_WIDTH);
    const divisor = count > SHRINK_AFTER_COUNT ? count : SHRINK_AFTER_COUNT;
    const raw = Math.floor(available / divisor);

    // Clamp between MIN and MAX. If this returns the min, scrolling will kick in.
    return Math.max(TAB_MIN_WIDTH, Math.min(TAB_MAX_WIDTH, raw));
  };

  // Overflow handling: no arrow buttons; keep layout stable without toggling controls
  const updateOverflow = () => {
    if (!tabSection) return;
    tabSection.classList.remove('has-overflow');
  };

  const openMenuForTabId = (tabId) => {
    if (!tabId || !bridge?.toggleTabMenuPopup) return;
    const tabEl =
      scrollStrip?.querySelector(`[data-tab-id="${tabId}"]`) ||
      pinnedStrip?.querySelector(`[data-tab-id="${tabId}"]`);
    if (!tabEl) return;
    const rect = tabEl.getBoundingClientRect();
    bridge.toggleTabMenuPopup(
      { x: rect.left, y: rect.bottom + 6, width: rect.width, height: rect.height },
      { tabId, isPinned: tabEl.classList.contains('pinned') }
    );
  };

  // Fallback: right-click on empty tab strip opens menu for active tab
  tabSection?.addEventListener('contextmenu', (event) => {
    const targetTab = event.target?.closest?.('.tab');
    if (targetTab) return;
    if (!latestState?.activeTabId) return;
    event.preventDefault();
    openMenuForTabId(latestState.activeTabId);
  });

  const render = (state) => {
    latestState = state;

    // we render into two rows, so clear both (button reattached below)
    pinnedStrip.innerHTML = '';
    scrollStrip.innerHTML = '';

    let visibleTabs = state.tabs.slice(0, MAX_VISIBLE_TABS);
    if (state.tabs.length > MAX_VISIBLE_TABS && state.activeTabId != null) {
      const hasActiveVisible = visibleTabs.some((t) => t.id === state.activeTabId);
      if (!hasActiveVisible) {
        const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
        if (activeTab) {
          visibleTabs = visibleTabs.slice(0, MAX_VISIBLE_TABS - 1).concat(activeTab);
        }
      }
    }

    // compute width based ONLY on UNPINNED count of visible tabs
    const unpinnedCount = visibleTabs.filter(t => !t.isPinned).length;
    const width = computeTabWidth(unpinnedCount);
    const compact = width <= TAB_COMPACT_THRESHOLD;

    visibleTabs.forEach((tab, index) => {
      const tabWrapper = document.createElement('div');
      tabWrapper.className = 'tab-wrapper';

      const isNewTab = !seenTabIds.has(tab.id);

      // Prevent shrinking below the minimum.
      // pinned = small fixed chip; unpinned = computed basis
      if (tab.isPinned) {
        tabWrapper.style.flex = '0 0 36px';
        tabWrapper.style.minWidth = '36px';
      } else {
        const basis = Math.max(Math.min(width, TAB_MAX_WIDTH), TAB_MIN_WIDTH);
        tabWrapper.style.flex = `0 1 ${basis}px`;   // allow shrink; avoid forcing growth that hides '+'
        tabWrapper.style.minWidth = `${TAB_MIN_WIDTH}px`;
        tabWrapper.style.maxWidth = `${TAB_MAX_WIDTH}px`;
      }

      const tabElement = document.createElement('div');

      // add 'pinned' class when tab.isPinned is true
      const pinnedClass = tab.isPinned ? ' pinned' : '';
      tabElement.className =
        `tab${tab.id === state.activeTabId ? ' active' : ''}` +
        `${compact ? ' compact' : ''}` +
        `${pinnedClass}`;
      tabElement.dataset.tabId = String(tab.id);

      if (isNewTab) {
        tabElement.classList.add('tab-new');
        setTimeout(() => tabElement.classList.remove('tab-new'), 180);
        seenTabIds.add(tab.id);
        // If tab isn't rendered (above MAX_VISIBLE_TABS), flash the + button
        if (index === visibleTabs.length - 1 && state.tabs.length > MAX_VISIBLE_TABS && newTabButton) {
          newTabButton.classList.add('tab-new');
          setTimeout(() => newTabButton.classList.remove('tab-new'), 180);
        }
      }

      tabElement.setAttribute('draggable', 'true');

      const favicon = document.createElement('span');
      favicon.className = 'tab-favicon';
      // Default letter if we have no favicon; cleared immediately when a favicon URL exists.
      const fallbackGlyph = (tab.title || '').trim().charAt(0).toUpperCase() || 'N';
      favicon.textContent = fallbackGlyph;

      // Loading indicator lives inside the favicon slot so it appears where the
      // favicon will eventually render.
      const loader = document.createElement('span');
      loader.className = 'tab-loading-indicator';
      loader.style.display = tab.isLoading ? 'block' : 'none';
      favicon.appendChild(loader);
      favicon.classList.toggle('loading', !!tab.isLoading);

      const faviconUrl = (tab.faviconUrl || '').trim();
      if (faviconUrl) {
        // Clear the fallback letter so the image has a clean canvas.
        favicon.textContent = '';

        const img = document.createElement('img');
        img.className = 'tab-favicon-img';
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = faviconUrl;
        img.addEventListener('load', () => {
          favicon.classList.add('has-img');
          // Once the real favicon is ready, hide the loader.
          loader.style.display = 'none';
          favicon.classList.remove('loading');
        });
        img.addEventListener('error', () => {
          img.remove();
          favicon.classList.remove('has-img');
          // keep loader off on error to avoid a stuck spinner
          loader.style.display = 'none';
          favicon.classList.remove('loading');
          // fallback to the initial if favicon fails
          favicon.textContent = fallbackGlyph;
        });
        favicon.appendChild(img);
      }
      tabElement.appendChild(favicon);

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title || 'New Tab';
      tabElement.appendChild(title);

      if (!tab.isPinned) {
        const close = document.createElement('button');
        close.className = 'tab-close';
        close.innerHTML = '<i class="material-icons">close</i>';
        close.title = 'Close Tab';
        close.addEventListener('click', (event) => {
          event.stopPropagation();
          bridge.closeTab(tab.id);
        });
        tabElement.appendChild(close);
      }

      tabElement.addEventListener('click', () => {
        bridge.activateTab(tab.id);
      });

      // [CHANGED - TABMENU POPUP] right-click → ask MAIN to open the overlay popup window
      const openTabMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenuForTabId(tab.id);
      };

      // Show the custom tab menu on right-click (contextmenu).
      // Avoid duplicating with mousedown (button 2) because that double-calls toggle and instantly hides the popup.
      tabElement.addEventListener('contextmenu', openTabMenu);
      // Also allow right-click on the wrapper/gap to open the same menu
      tabWrapper.addEventListener('contextmenu', openTabMenu);

      tabElement.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/tab-id', String(tab.id));
        event.dataTransfer.effectAllowed = 'move';
      });

      const handleDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      };

      const handleDrop = (event) => {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer?.getData('text-tab-id') || event.dataTransfer?.getData('text/tab-id'));
        if (!draggedId || Number.isNaN(draggedId)) return;
        const rect = tabElement.getBoundingClientRect();
        const dropOnRight = event.clientX > rect.left + rect.width / 2;
        const tabs = latestState?.tabs || [];
        const targetIndex = tabs.findIndex((t) => t.id === tab.id);
        let beforeId;
        if (dropOnRight) {
          const nextTab = targetIndex >= 0 ? tabs[targetIndex + 1] : null;
          beforeId = nextTab ? nextTab.id : null;
        } else {
          beforeId = tab.id;
        }
        bridge.moveTab?.(draggedId, beforeId);
        bridge.activateTab?.(draggedId);
      };

      tabElement.addEventListener('dragover', handleDragOver);
      tabElement.addEventListener('drop', handleDrop);
      // Also allow dropping on the wrapper (gaps) to handle left/right moves reliably
      tabWrapper.addEventListener('dragover', handleDragOver);
      tabWrapper.addEventListener('drop', handleDrop);

      tabElement.addEventListener('dragend', (event) => {
        const { clientX, clientY } = event;
        const outside =
          clientX < -DRAG_THRESHOLD ||
          clientX > window.innerWidth + DRAG_THRESHOLD ||
          clientY < -DRAG_THRESHOLD ||
          clientY > window.innerHeight + DRAG_THRESHOLD;
        if (outside) {
          bridge.detachTab?.(tab.id);
        }
      });

      tabWrapper.appendChild(tabElement);

      // append to the correct strip so pinned tabs do NOT scroll
      if (tab.isPinned) {
        pinnedStrip.appendChild(tabWrapper);
      } else {
        scrollStrip.appendChild(tabWrapper);
      }
    });

    // Re-attach the inline "+" so it stays visible after rerender.
    if (newTabButton) {
      scrollStrip.appendChild(newTabButton);
    }

    // After DOM updates, refresh overflow state
    requestAnimationFrame(updateOverflow);
  };

  // Allow dropping onto empty area of scroll strip to place at end
  const stripDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  const stripDrop = (event) => {
    event.preventDefault();
    const draggedId = Number(event.dataTransfer?.getData('text/tab-id'));
    if (!draggedId || Number.isNaN(draggedId)) return;

    const x = event.clientX;
    const children = Array.from(scrollStrip.querySelectorAll('.tab-wrapper'));
    let beforeId = null;
    // Find drop target based on cursor position relative to each tab.
    for (const child of children) {
      const rect = child.getBoundingClientRect();
      if (x < rect.left + rect.width / 2) {
        const tabEl = child.querySelector('.tab');
        const tabId = Number(tabEl?.dataset?.tabId || tabEl?.getAttribute?.('data-tab-id'));
        if (tabId) {
          beforeId = tabId;
        }
        break;
      }
    }
    // If dropped beyond all tabs, move to end
    bridge.moveTab?.(draggedId, beforeId);
    bridge.activateTab?.(draggedId);
  };
  scrollStrip.addEventListener('dragover', stripDragOver);
  scrollStrip.addEventListener('drop', stripDrop);

  if (newTabButton) {
    newTabButton.addEventListener('click', () => bridge.createTab());
    // keep the "+" inline with the tabs
    scrollStrip?.appendChild(newTabButton);
  }

  window.addEventListener(
    'resize',
    () => {
      if (latestState) render(latestState);
    },
    { passive: true }
  );

  return { render };
};


