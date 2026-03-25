// src/renderer/theme/palettes.js
// Light/Dark palette tokens keyed to the CSS variables used across main.css.
export const buildPalettes = (accent = '#8b5cf6') => {
  const light = {
    scheme: 'light',
    bg: '#ffffff',
    bgGradient: 'linear-gradient(#ffffff, #ffffff)',
    chrome: '#eedcfb',
    chromeBorder: 'rgba(205, 165, 255, 0.45)',
    border: 'rgba(205, 165, 255, 0.55)',
    borderStrong: '#cda5ff',
    tab: 'rgba(255, 255, 255, 0.9)',
    tabActive: '#ffffff',
    text: '#2c1a4a',
    muted: '#5a4185',
    shadowSoft: '0 16px 30px rgba(67, 40, 102, 0.12)',
    shadowCard: '0 12px 32px rgba(93, 63, 131, 0.1)',
    gradientPill: 'linear-gradient(130deg, #a855f7, #f472b6)',
    gradientSoft: 'linear-gradient(150deg, rgba(255, 255, 255, 0.95), rgba(244, 234, 255, 0.9))',
    blur: 'saturate(140%) blur(8px)'
  };

  const dark = {
    scheme: 'dark',
    bg: '#0f1118',
    bgGradient: 'linear-gradient(180deg, #0f1118 0%, #0f121a 60%, #0a0c14 100%)',
    chrome: '#161926',
    chromeBorder: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    tab: 'rgba(28, 32, 48, 0.85)',
    tabActive: '#1c2030',
    text: '#e9ecf8',
    muted: '#9aa3c7',
    shadowSoft: '0 16px 30px rgba(0, 0, 0, 0.4)',
    shadowCard: '0 12px 32px rgba(0, 0, 0, 0.45)',
    gradientPill: 'linear-gradient(130deg, #8f7aff, #66d5ff)',
    gradientSoft: 'linear-gradient(150deg, rgba(28, 32, 48, 0.95), rgba(18, 22, 36, 0.9))',
    blur: 'saturate(140%) blur(8px)'
  };

  return { light, dark, accent };
};
