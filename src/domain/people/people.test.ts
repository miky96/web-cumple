import { describe, expect, it } from 'vitest';
import { generateToken, isValidToken, TOKEN_LENGTH } from '../tokens';
import { parseImportList, parseTags } from './importList';

describe('parseImportList', () => {
  it('accepta una llista simple de noms', () => {
    const r = parseImportList('Anna\nBernat\n\n  Carla  ');
    expect(r.rows.map((x) => x.name)).toEqual(['Anna', 'Bernat', 'Carla']);
  });

  it('accepta columnes de l’Excel (tabulador) i ignora la capçalera', () => {
    const r = parseImportList('Nom\tEtiquetes\nAnna\tvegà|No beu\nBernat\t');
    expect(r.rows).toEqual([
      { name: 'Anna', tags: ['vegà', 'no beu'] },
      { name: 'Bernat', tags: [] },
    ]);
  });

  it('detecta duplicats sense tenir en compte accents ni majúscules', () => {
    const r = parseImportList('Pau\npau\nJosé', ['Jose']);
    expect(r.rows.map((x) => x.name)).toEqual(['Pau']);
    expect(r.duplicates).toEqual(['pau', 'José']);
  });
});

describe('parseTags', () => {
  it('normalitza i treu duplicats', () => {
    expect(parseTags(' Vegà, no beu ,vegà,')).toEqual(['vegà', 'no beu']);
  });
});

describe('tokens', () => {
  it('genera tokens vàlids i diferents', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toHaveLength(TOKEN_LENGTH);
    expect(isValidToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('descarta bytes que introduirien biaix', () => {
    let calls = 0;
    const bytes = (n: number) => {
      calls++;
      return new Uint8Array(n).fill(calls === 1 ? 250 : 0);
    };
    expect(generateToken(bytes, 4)).toBe('0000');
  });

  it('rebutja tokens mal formats', () => {
    expect(isValidToken('curt')).toBe(false);
    expect(isValidToken('a'.repeat(21) + '!')).toBe(false);
  });
});
