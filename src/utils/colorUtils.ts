/** Enhanced color utilities for the properties panel */

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'transparent';

export interface ColorValue {
  hex: string;
  rgb: { r: number; g: number; b: number; a: number };
  hsl: { h: number; s: number; l: number; a: number };
  alpha: number;
}

// Convert any CSS color to hex
export function parseColor(color: string): ColorValue | null {
  if (!color || color === 'transparent') {
    return {
      hex: '#000000',
      rgb: { r: 0, g: 0, b: 0, a: 0 },
      hsl: { h: 0, s: 0, l: 0, a: 0 },
      alpha: 0
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = color;
  const computedColor = ctx.fillStyle;
  
  // Parse hex
  const r = parseInt(computedColor.slice(1, 3), 16);
  const g = parseInt(computedColor.slice(3, 5), 16);
  const b = parseInt(computedColor.slice(5, 7), 16);
  const alpha = computedColor.length === 9 ? parseInt(computedColor.slice(7, 9), 16) / 255 : 1;

  return {
    hex: computedColor.slice(0, 7),
    rgb: { r, g, b, a: alpha },
    hsl: rgbToHsl(r, g, b, alpha),
    alpha
  };
}

export function rgbToHsl(r: number, g: number, b: number, a: number): { h: number; s: number; l: number; a: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), a };
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function formatColor(hex: string, alpha: number): string {
  if (alpha === 0) return 'transparent';
  if (alpha < 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  return hex.toUpperCase();
}

// Preset colors inspired by Figma and modern design tools
export const COLOR_PRESETS = [
  // Row 1 - Grayscale
  '#000000', '#1A1A1A', '#333333', '#666666', '#999999', '#CCCCCC', '#E5E5E5', '#FFFFFF',
  // Row 2 - Primary
  '#FF4444', '#FF8844', '#FFCC44', '#88DD44', '#44CC88', '#44BBFF', '#8844FF', '#FF44CC',
  // Row 3 - Pastels
  '#FFB3B3', '#FFE0B3', '#FFFFB3', '#C8E6C9', '#B3E5FC', '#B3D9FF', '#D1B3FF', '#FFB3E6',
  // Row 4 - Brand/Dark
  '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2', '#2563EB', '#7C3AED', '#DB2777',
];

// Common CSS color keywords
export const NAMED_COLORS: Record<string, string> = {
  transparent: '#00000000',
  white: '#FFFFFF',
  black: '#000000',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  silver: '#C0C0C0',
  gray: '#808080',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00FF00',
  aqua: '#00FFFF',
  teal: '#008080',
  navy: '#000080',
  fuchsia: '#FF00FF',
  purple: '#800080',
};

// Convert named color to hex
export function normalizeColor(color: string): string {
  if (color.startsWith('#')) return color;
  if (NAMED_COLORS[color.toLowerCase()]) return NAMED_COLORS[color.toLowerCase()];
  
  // Try to parse rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }
  
  return color;
}
