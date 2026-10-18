import { describe, expect, it } from 'vitest';
import { safeImageUrl } from './safeUrl';

describe('safeImageUrl', () => {
  it('accepta rutes pròpies i https', () => {
    expect(safeImageUrl('/editions/2027/pixar.webp')).toBe('/editions/2027/pixar.webp');
    expect(safeImageUrl(' https://exemple.com/a.png ')).toBe('https://exemple.com/a.png');
  });
  it('rebutja esquemes perillosos, http i URLs que trenquen el CSS', () => {
    for (const bad of ['javascript:alert(1)', 'data:image/svg+xml,<svg>', 'http://x.com/a.png', '//evil.com/a.png', '/a.png")', "/a'.png", 'https://x.com/a b.png', '', null, undefined])
      expect(safeImageUrl(bad)).toBeNull();
  });
});
