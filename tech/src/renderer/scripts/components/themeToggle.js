// src/renderer/scripts/components/themeToggle.js
// Lightweight renderer-only theme toggle (light/dark) using CSS variables.
import { applyTheme } from '../../theme/applyTheme.js';
import {
  applySkin,
  getStoredMode,
  getStoredSkin,
  listenForThemeStorage,
  setStoredMode
} from '../../theme/preferences.js';

const updateButtonIcon = (btn, mode) => {
  if (!btn) return;
  const icon = btn.querySelector('.theme-icon use');
  if (icon) {
    icon.setAttribute(
      'href',
      mode === 'dark' ? 'assets/icons/mono.svg#moon' : 'assets/icons/mono.svg#sun'
    );
  }
  btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
};

const applyCurrentTheme = async (mode) => {
  let accent = '#8b5cf6';
  try {
    const theme = await window.browserBridge?.getTheme?.();
    if (theme?.color) accent = theme.color;
  } catch (_) {
    // best-effort
  }
  applySkin(getStoredSkin());
  applyTheme({ mode, accent });
  window.browserBridge?.setThemeMode?.(mode);
};

const toggleMode = (mode) => (mode === 'dark' ? 'light' : 'dark');

const init = () => {
  const btn = document.getElementById('themeToggle');
  if (!btn || !window.browserBridge) return;

  let mode = getStoredMode();
  applySkin(getStoredSkin());
  updateButtonIcon(btn, mode);
  applyCurrentTheme(mode);

  window.browserBridge.onThemeUpdate?.((payload = {}) => {
    applyTheme({ mode, accent: payload.color });
  });

  btn.addEventListener('click', () => {
    mode = toggleMode(mode);
    setStoredMode(mode);
    updateButtonIcon(btn, mode);
    applyCurrentTheme(mode);
  });

  listenForThemeStorage(({ mode: nextMode, skin }) => {
    applySkin(skin);
    if (nextMode !== mode) {
      mode = nextMode;
      updateButtonIcon(btn, mode);
      applyCurrentTheme(mode);
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
