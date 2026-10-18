import { describe, expect, it } from 'vitest';
import { seededRng } from '../random';
import { evaluateStop, isClockHidden, stopRating } from './stopTheClock';
import { MAX_EARLY_TAPS, pickDelay, startReaction, tapReaction } from './reaction';
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
    expect(stopRating(0)).toMatch(/PERFECTE/);
    expect(stopRating(5000)).toMatch(/plora/);
  });
  it('amaga el cronòmetre a partir del llindar', () => {
    expect(isClockHidden(2999, 3000)).toBe(false);
    expect(isClockHidden(3000, 3000)).toBe(true);
    expect(isClockHidden(99999, null)).toBe(false);
  });
});

describe('reaction', () => {
  it('pickDelay queda dins el rang', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 100; i++) {
      const d = pickDelay(rng, 1000, 4000);
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThanOrEqual(4000);
    }
  });
  it('mesura el temps de reacció', () => {
    const s = startReaction(0, 2000);
    expect(tapReaction(s, 2250, 1000)).toEqual({ phase: 'done', ms: 250, earlyTaps: 0 });
  });
  it('penalitza tocar massa aviat i reprograma el senyal', () => {
    const s1 = tapReaction(startReaction(0, 2000), 500, 1500);
    expect(s1).toEqual({ phase: 'waiting', goAt: 2000, earlyTaps: 1 });
    expect(tapReaction(s1, 2100, 0)).toEqual({ phase: 'done', ms: 100, earlyTaps: 1 });
  });
  it('acaba sense temps després de massa precipitacions', () => {
    let s = startReaction(0, 10_000);
    for (let i = 0; i < MAX_EARLY_TAPS; i++) s = tapReaction(s, i, 10_000);
    expect(s).toEqual({ phase: 'done', ms: null, earlyTaps: MAX_EARLY_TAPS });
  });
});

describe('tap-race', () => {
  it('només compta els tocs dins la finestra', () => {
    expect(countTaps(1000, 5000, [999, 1000, 3000, 5999, 6000, 7000])).toBe(3);
  });
  it('valora segons tocs per segon', () => {
    expect(tapRating(50, 5000)).toBe('Dit biònic!');
    expect(tapRating(5, 5000)).toBe('Tens els dits de vacances');
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
