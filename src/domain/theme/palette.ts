import type { Theme } from '../types';
import { colorDistance, contrastRatio, hsl, parseHex, rgbToHsl } from './color';

/**
 * Tema "Arcade 1987": fons gairebé negre, dos neons (principal + secundari) i un groc de marcador.
 * Només el color principal i el secundari són editables per edició; la resta es deriva.
 */
export interface Palette {
  /** Neó principal (botons, títols, seleccions). */
  primary: string;
  /** Versió del principal llegible com a text petit sobre el fons. */
  primaryText: string;
  onPrimary: string;
  /** Neó secundari (vores, HUD, tòtem). */
  accent: string;
  onAccent: string;
  /** Groc de marcador (puntuacions, avisos). */
  score: string;
  bg: string;
  /** Color de l'horitzó (degradat del fons). */
  horizon: string;
  surface: string;
  field: string;
  ink: string;
  muted: string;
  line: string;
  danger: string;
  success: string;
}

export const DEFAULT_THEME: Theme = {
  base: '#ff2e93',
  accent: '#2ef2ff',
  pattern: 'grid',
  patternOpacity: 0.5,
  title: 'Totem of Happiness',
  subtitle: 'El tòtem ha tornat',
  resultBackground: null,
};

/** Omple camps que falten i migra temes desats amb versions anteriors de l'app. */
export function normalizeTheme(theme: Partial<Theme> | Record<string, unknown> | null | undefined): Theme {
  const t = { ...DEFAULT_THEME, ...((theme ?? {}) as Partial<Theme>) };
  if (t.pattern !== 'grid' && t.pattern !== 'none') t.pattern = 'grid';
  delete (t as Record<string, unknown>).mode;
  return t;
}

const FALLBACK = '#ff2e93';
const DARK = '#0b0414';

/** Puja la lluminositat fins que el color es llegeixi sobre `bg`. */
function lift(h: number, s: number, l: number, bg: string, min: number): string {
  let cur = l;
  let out = hsl(h, s, cur);
  while (contrastRatio(out, bg) < min && cur < 95) {
    cur += 3;
    out = hsl(h, s, cur);
  }
  return out;
}

function onColor(c: string): string {
  return contrastRatio(c, DARK) >= contrastRatio(c, '#ffffff') ? DARK : '#ffffff';
}

export function derivePalette(base: string, accent: string | null = null): Palette {
  const primary = parseHex(base) ? base.toLowerCase() : FALLBACK;
  const { h, s, l } = rgbToHsl(parseHex(primary)!);
  const accentHex = accent && parseHex(accent) ? accent.toLowerCase() : hsl(h + 180, 100, 58);
  const bg = hsl(h + 20, Math.min(s, 60), 4);
  return {
    primary,
    primaryText: lift(h, Math.max(s, 70), Math.max(l, 60), bg, 5),
    onPrimary: onColor(primary),
    accent: accentHex,
    onAccent: onColor(accentHex),
    score: '#ffe94d',
    bg,
    horizon: hsl(h + 10, Math.min(s, 80), 14),
    surface: hsl(h + 20, Math.min(s, 45), 8),
    field: hsl(h + 20, Math.min(s, 45), 6),
    ink: '#f4ecff',
    muted: hsl(h + 20, 25, 72),
    line: hsl(h + 20, 35, 20),
    danger: '#ff5a5a',
    success: '#7cff4f',
  };
}

export interface ThemeWarning {
  code: 'low-contrast-primary' | 'low-contrast-accent' | 'invalid-color' | 'dark-neon';
  message: string;
}

export function themeWarnings(theme: Theme): ThemeWarning[] {
  const out: ThemeWarning[] = [];
  if (!parseHex(theme.base)) out.push({ code: 'invalid-color', message: 'El color principal no és un hex vàlid.' });
  if (theme.accent && !parseHex(theme.accent))
    out.push({ code: 'invalid-color', message: 'El color secundari no és un hex vàlid.' });
  const p = derivePalette(theme.base, theme.accent);
  if (contrastRatio(p.primary, p.bg) < 4)
    out.push({ code: 'dark-neon', message: 'El color principal és massa fosc: un neó ha de brillar sobre negre.' });
  if (contrastRatio(p.accent, p.bg) < 4)
    out.push({ code: 'dark-neon', message: 'El color secundari és massa fosc per fer de neó.' });
  return out;
}

/** Colors de grup massa semblants entre ells. */
export function similarColorPairs(colors: { id: string; color: string }[], threshold = 90): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++)
      if (colorDistance(colors[i].color, colors[j].color) < threshold) pairs.push([colors[i].id, colors[j].id]);
  return pairs;
}

export function paletteToCssVars(p: Palette): Record<string, string> {
  return {
    '--primary': p.primary,
    '--primary-text': p.primaryText,
    '--on-primary': p.onPrimary,
    '--accent': p.accent,
    '--on-accent': p.onAccent,
    '--score': p.score,
    '--bg': p.bg,
    '--horizon': p.horizon,
    '--surface': p.surface,
    '--field': p.field,
    '--ink': p.ink,
    '--muted': p.muted,
    '--line': p.line,
    '--danger': p.danger,
    '--success': p.success,
  };
}
