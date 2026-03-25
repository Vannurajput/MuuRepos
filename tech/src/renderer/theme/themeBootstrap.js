import { applyTheme } from './applyTheme.js';
import { applySkin, getStoredMode, getStoredSkin, listenForThemeStorage } from './preferences.js';

const resolveAccent = async () => {
  try {
    const theme = await window.browserBridge?.getTheme?.();
    return theme?.color;
  } catch (_) {
    return undefined;
  }
};

const applyThemeState = async () => {
  const mode = getStoredMode();
  const accent = await resolveAccent();
  applyTheme({ mode, accent });
  applySkin(getStoredSkin());
};

const init = () => {
  applyThemeState();
  listenForThemeStorage(() => applyThemeState());
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
