export const THEME_MODE_KEY = 'mobrowser-theme-mode';
export const THEME_SKIN_KEY = 'mobrowser-theme-skin';
export const DEFAULT_SKIN = 'glass';

export const getStoredMode = () => (localStorage.getItem(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light');

export const setStoredMode = (mode) => {
  localStorage.setItem(THEME_MODE_KEY, mode === 'dark' ? 'dark' : 'light');
};

export const getStoredSkin = () => localStorage.getItem(THEME_SKIN_KEY) || DEFAULT_SKIN;

export const setStoredSkin = (skin) => {
  localStorage.setItem(THEME_SKIN_KEY, skin || DEFAULT_SKIN);
};

export const applySkin = (skin = getStoredSkin()) => {
  document.documentElement.dataset.skin = skin || DEFAULT_SKIN;
};

export const listenForThemeStorage = (handler) => {
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_MODE_KEY || event.key === THEME_SKIN_KEY) {
      handler?.({ mode: getStoredMode(), skin: getStoredSkin() });
    }
  });
};
