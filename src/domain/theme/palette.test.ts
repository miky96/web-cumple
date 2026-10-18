import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, toHex } from './color';
import { derivePalette, normalizeTheme, similarColorPairs, themeWarnings, DEFAULT_THEME } from './palette';

describe('color', () => {
  it('parseja hex de 3 i 6 xifres', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('e8642c')).toEqual({ r: 232, g: 100, b: 44 });
    expect(parseHex('vermell')).toBeNull();
    expect(toHex({ r: 232, g: 100, b: 44 })).toBe('#e8642c');
  });

  it('calcula el contrast WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('derivePalette (arcade)', () => {
  const NEONS = ['#ff2e93', '#2ef2ff', '#ffe94d', '#7cff4f', '#b14dff', '#ff8a2e', '#e8642c'];
  it.each(NEONS)('genera una paleta llegible amb el neó %s', (base: string) => {
    const p = derivePalette(base);
    expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(12);
    expect(contrastRatio(p.ink, p.surface)).toBeGreaterThanOrEqual(10);
    expect(contrastRatio(p.ink, p.field)).toBeGreaterThanOrEqual(10);
    expect(contrastRatio(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.primaryText, p.bg)).toBeGreaterThanOrEqual(5);
    expect(contrastRatio(p.primary, p.onPrimary)).toBeGreaterThanOrEqual(4);
    expect(contrastRatio(p.accent, p.onAccent)).toBeGreaterThanOrEqual(4);
  });

  it('el fons és gairebé negre', () => {
    expect(contrastRatio(derivePalette('#ff2e93').bg, '#000000')).toBeLessThan(1.2);
  });

  it('respecta el secundari explícit o el deriva (complementari)', () => {
    expect(derivePalette('#ff2e93', '#00AA88').accent).toBe('#00aa88');
    expect(derivePalette('#ff2e93', null).accent).not.toBe('#ff2e93');
  });

  it('fa servir un color per defecte si el principal és invàlid', () => {
    expect(derivePalette('xx').primary).toBe('#ff2e93');
  });
});

describe('normalizeTheme', () => {
  it('omple camps nous i migra temes antics', () => {
    const t = normalizeTheme({ base: '#123456', pattern: 'totems', mode: 'light' } as never);
    expect(t.base).toBe('#123456');
    expect(t.pattern).toBe('grid');
    expect('mode' in t).toBe(false);
    expect(t.resultBackground).toBeNull();
  });
});

describe('themeWarnings', () => {
  it('no avisa amb el tema per defecte', () => {
    expect(themeWarnings(DEFAULT_THEME)).toEqual([]);
  });
  it('avisa de colors invàlids', () => {
    expect(themeWarnings({ ...DEFAULT_THEME, base: 'nope' }).map((w) => w.code)).toContain('invalid-color');
  });
  it('avisa si el neó és massa fosc', () => {
    expect(themeWarnings({ ...DEFAULT_THEME, base: '#1a0010' }).map((w) => w.code)).toContain('dark-neon');
  });
});

describe('similarColorPairs', () => {
  it('detecta colors massa semblants', () => {
    const pairs = similarColorPairs([
      { id: 'a', color: '#ff0000' },
      { id: 'b', color: '#fa0505' },
      { id: 'c', color: '#0000ff' },
    ]);
    expect(pairs).toEqual([['a', 'b']]);
  });
});
