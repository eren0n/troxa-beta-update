// Shared helpers for the Color Palette / Typography preset system — used by both Brand Kit
// (where presets are managed) and Prompt Studio (where they're picked per generation).

export const FONT_OPTIONS = ['Inter', 'Sora', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Sans', 'Montserrat', 'Manrope', 'Plus Jakarta Sans', 'Roboto', 'Helvetica'];

export const PALETTE_ROLES = [
  { key: 'primary',   label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent',    label: 'Highlight' },
  { key: 'neutral',   label: 'Neutral' },
];

// Helvetica isn't a licensed Google Font — it's a system font on most OSes, so it's loaded via a
// plain font-stack instead of a webfont fetch (which would 404 and silently fall back anyway).
const SYSTEM_FONTS = new Set(['Helvetica']);

export function fontStack(font) {
  if (font === 'Helvetica') return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  return `"${font}", sans-serif`;
}

// Google Fonts are loaded on demand as a preset's font is picked — Inter ships by default in index.css.
const loadedFonts = new Set(['Inter']);
export function ensureFontLoaded(font) {
  if (loadedFonts.has(font) || SYSTEM_FONTS.has(font)) return;
  loadedFonts.add(font);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function getContrastText(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#0f172a' : '#ffffff';
}
