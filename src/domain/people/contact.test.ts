import { describe, expect, it } from 'vitest';
import { hasEmbeddedEmail, splitProfileEmail } from './contact';

describe('splitProfileEmail', () => {
  it('treu el correu del pas de registre i el retorna a part', () => {
    const r = splitProfileEmail({ p: { nickname: 'Miki', email: ' miki@example.com ' }, c: ['a'], s: 3 });
    expect(r.email).toBe('miki@example.com');
    expect(r.answers).toEqual({ p: { nickname: 'Miki' }, c: ['a'], s: 3 });
  });

  it('correu buit: null, però també el treu', () => {
    const r = splitProfileEmail({ p: { nickname: 'Miki', email: '' } });
    expect(r.email).toBeNull();
    expect(r.answers).toEqual({ p: { nickname: 'Miki' } });
  });

  it('no toca respostes sense correu ni objectes de minijocs', () => {
    const answers = { p: { nickname: 'Miki' }, g: { guess: 3, actual: 4 } };
    expect(splitProfileEmail(answers)).toEqual({ answers, email: null });
    expect(hasEmbeddedEmail(answers)).toBe(false);
    expect(hasEmbeddedEmail({ p: { nickname: 'M', email: 'a@b.cat' } })).toBe(true);
    expect(hasEmbeddedEmail({ p: { nickname: 'M', email: '' } })).toBe(true);
  });
});
