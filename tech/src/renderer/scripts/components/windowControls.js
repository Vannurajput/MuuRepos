// src/renderer/scripts/components/windowControls.js
// Wire window control buttons to the main process via browserBridge.

const bind = (id, handler) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', handler);
  }
};

const initWindowControls = () => {
  if (!window.browserBridge) return;
  bind('winMinimize', () => window.browserBridge.minimizeWindow?.());
  bind('winMaxRestore', () => window.browserBridge.toggleMaximize?.());
  bind('winClose', () => window.browserBridge.closeWindow?.());

  const updateMaxRestoreIcon = (state = {}) => {
    const useEl = document.querySelector('#winMaxRestore use');
    if (!useEl) return;
    const restore = state.isFullScreen || state.isMaximized;
    useEl.setAttribute('href', restore ? 'assets/icons/mono.svg#window-restore' : 'assets/icons/mono.svg#window-maximize');
  };

  // Sync icon with window state changes (maximize/fullscreen vs restored)
  window.browserBridge.onWindowState?.(updateMaxRestoreIcon);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWindowControls, { once: true });
} else {
  initWindowControls();
}
