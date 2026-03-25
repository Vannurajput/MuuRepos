export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const normalizeThemeHex = (value) => {
  if (typeof value !== 'string') return null;
  let hex = value.trim();
  if (!hex.startsWith('#')) return null;
  hex = hex.slice(1);
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return null;
};

const hexToHsl = (hex) => {
  const normalized = normalizeThemeHex(hex);
  if (!normalized) return null;
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
};

const hslToHex = (h, s, l) => {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x) => {
    const hex = Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
    return hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const adjustThemeLightness = (hex, delta = 0) => {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const nextL = clamp(hsl.l + delta, 0, 1);
  return hslToHex(hsl.h, hsl.s, nextL);
};

export const applyThemePalette = (theme = {}) => {
  const baseColor = normalizeThemeHex(theme.color);
  if (!baseColor) {
    return;
  }
  const root = document.documentElement;
  const accentAlt = adjustThemeLightness(baseColor, -0.18);
  const accentMint = adjustThemeLightness(baseColor, 0.22);
  const gradient = `radial-gradient(circle at 18% 20%, ${adjustThemeLightness(baseColor, 0.48)} 0%, ${adjustThemeLightness(
    baseColor,
    0.15
  )} 48%, ${adjustThemeLightness(baseColor, -0.1)} 100%)`;
  root.style.setProperty('--accent', baseColor);
  root.style.setProperty('--accent-alt', accentAlt);
  root.style.setProperty('--accent-mint', accentMint);
  root.style.setProperty('--bg-gradient', gradient);
};

export const setHeroScale = (value = 1) => {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? Math.max(0, numeric) : 1;
  document.documentElement.style.setProperty('--hero-scale', safe);
};
