import { describe, expect, it } from 'vitest';
import { seededRng } from '../random';
import { evaluateStop, isClockHidden, stopRating } from './stopTheClock';
import { countRating, createCountRound, LANES, MIN_TARGETS, normalizeLevel, parseEmojiList } from './countCharacters';
import { countTaps, tapRating } from './tapRace';
import {
  createMemoryGame,
  currentSequence,
  finishShowing,
  levelReached,
  pressColor,
  type MemoryState,
} from './memorySequence';

describe('stop-the-clock', () => {
  it('calcula la diferència amb signe', () => {
    expect(evaluateStop(5000, 5230).deltaMs).toBe(230);
    expect(evaluateStop(5000, 4900).deltaMs).toBe(-100);
  });
  it('dona una valoració segons la precisió', () => {
    expect(stopRating(0)).toMatch(/quin nivell/);
    expect(stopRating(5000)).toMatch(/Prova-ho més cops/);
  });
  it('amaga el cronòmetre a partir del llindar', () => {
    expect(isClockHidden(2999, 3000)).toBe(false);
    expect(isClockHidden(3000, 3000)).toBe(true);
    expect(isClockHidden(99999, null)).toBe(false);
  });
});

describe('count-characters', () => {
  it('genera rondes jugables a tots els nivells', () => {
    for (const level of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const r = createCountRound(seededRng(seed), 15000, level, 5);
        expect(r.actual).toBe(r.spawns.filter((s) => s.isTarget).length);
        expect(r.actual).toBeGreaterThanOrEqual(MIN_TARGETS);
        expect(r.spawns.every((s) => s.lane >= 0 && s.lane < LANES)).toBe(true);
        expect(r.spawns.every((s) => s.isTarget || (s.decoy >= 0 && s.decoy < 5))).toBe(true);
        // Ningú surt després de la durada configurada
        expect(r.totalMs).toBeLessThanOrEqual(15000 + 300);
      }
    }
  });
  it('no repeteix carril massa seguit', () => {
    const r = createCountRound(seededRng(7), 20000, 3, 4);
    const lastAt = new Map<number, number>();
    for (const s of r.spawns) {
      const prev = lastAt.get(s.lane);
      if (prev !== undefined) expect(s.at - prev).toBeGreaterThanOrEqual(r.crossMs * 0.3 - 1);
      lastAt.set(s.lane, s.at);
    }
  });
  it('sense despistadors tots són el personatge a comptar', () => {
    const r = createCountRound(seededRng(3), 10000, 2, 0);
    expect(r.spawns.every((s) => s.isTarget)).toBe(true);
  });
  it('el nivell difícil treu més personatges que el fàcil', () => {
    const n = (level: 1 | 3) => createCountRound(seededRng(11), 20000, level, 4).spawns.length;
    expect(n(3)).toBeGreaterThan(n(1));
  });
  it('valora segons la diferència', () => {
    expect(countRating(7, 7)).toMatch(/quina manera de comptar/);
    expect(countRating(6, 7)).toMatch(/per 1/);
    expect(countRating(20, 7)).toMatch(/tajat/);
  });
  it('llegeix llistes d’emojis', () => {
    expect(parseEmojiList(' 🗿 👾,🦩  ')).toEqual(['🗿', '👾', '🦩']);
    expect(normalizeLevel(5)).toBe(2);
  });
});

describe('tap-race', () => {
  it('només compta els tocs dins la finestra', () => {
    expect(countTaps(1000, 5000, [999, 1000, 3000, 5999, 6000, 7000])).toBe(3);
  });
  it('valora segons tocs per segon', () => {
    expect(tapRating(50, 5000)).toMatch(/velocitat de dit/);
    expect(tapRating(5, 5000)).toMatch(/Prova-ho més cops/);
  });
});

describe('memory-sequence', () => {
  const play = (s: MemoryState) => {
    let st = finishShowing(s);
    for (const c of currentSequence(st)) st = pressColor(st, c);
    return st;
  };

  it('la seqüència creix un element per nivell', () => {
    const g = createMemoryGame(seededRng(7), 4, 3);
    expect(g.sequence).toHaveLength(6);
    expect(currentSequence(g)).toHaveLength(3);
    const g2 = play(g);
    expect(g2.level).toBe(2);
    expect(g2.status).toBe('showing');
    expect(currentSequence(g2)).toHaveLength(4);
  });

  it('guanya després de superar tots els nivells', () => {
    let g = createMemoryGame(seededRng(3), 3, 2);
    g = play(play(play(g)));
    expect(g.status).toBe('won');
    expect(levelReached(g)).toBe(3);
  });

  it('falla amb un color incorrecte i guarda els nivells superats', () => {
    let g = play(createMemoryGame(seededRng(3), 3, 2)); // nivell 1 superat
    g = finishShowing(g);
    const wrong = (currentSequence(g)[0] + 1) % 4;
    g = pressColor(g, wrong);
    expect(g.status).toBe('failed');
    expect(levelReached(g)).toBe(1);
  });

  it('ignora tocs mentre es mostra la seqüència', () => {
    const g = createMemoryGame(seededRng(3), 3, 2);
    expect(pressColor(g, 0)).toBe(g);
  });
});
