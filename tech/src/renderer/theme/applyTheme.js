// src/renderer/theme/applyTheme.js
import { adjustThemeLightness, normalizeThemeHex } from '../scripts/helpers/theme.js';
import { buildPalettes } from './palettes.js';

const applyVars = (palette, accentColor) => {
  const root = document.documentElement;
  if (!root) return;

  const accent = normalizeThemeHex(accentColor) || '#8b5cf6';
  const accentAlt = adjustThemeLightness(accent, -0.18);
  const accentMint = adjustThemeLightness(accent, 0.22);
  const gradientBg = `radial-gradient(circle at 18% 20%, ${adjustThemeLightness(
    accent,
    0.48
  )} 0%, ${adjustThemeLightness(accent, 0.15)} 48%, ${adjustThemeLightness(accent, -0.1)} 100%)`;

  const tokens = {
    ...palette,
    accent,
    accentAlt,
    accentMint,
    bgGradient: palette.bgGradient || gradientBg,
    gradientPill: palette.gradientPill,
    gradientSoft: palette.gradientSoft
  };

  Object.entries(tokens).forEach(([key, value]) => {
    if (value == null) return;
    const varName = `--${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`;
    root.style.setProperty(varName, value);
  });

  // Normalize color scheme and a smooth transition for background/text.
  root.style.setProperty('color-scheme', palette.scheme === 'dark' ? 'dark' : 'light');
  document.body.style.transition = 'background-color 150ms ease, color 150ms ease';
};

export const applyTheme = ({ mode = 'light', accent } = {}) => {
  const { light, dark, accent: defaultAccent } = buildPalettes(accent);
  const palette = mode === 'dark' ? dark : light;
  document.documentElement.dataset.theme = mode;
  applyVars(palette, accent || defaultAccent);
};
