import { describe, expect, it } from 'vitest';
import { createStep } from '../quiz/catalog';
import type { QuizStep } from '../types';
import { describeAnswer, minigameRankings } from './curiosities';

const steps: QuizStep[] = [
  createStep('choice', 'c'),
  createStep('stop-the-clock', 't'),
  createStep('reaction', 'r'),
  createStep('tap-race', 'x'),
];

const people = [
  { name: 'Anna', answers: { t: { targetMs: 5000, elapsedMs: 5300, deltaMs: 300 }, r: { ms: 280, earlyTaps: 0 }, x: { taps: 30, durationMs: 5000 } } },
  { name: 'Bernat', answers: { t: { targetMs: 5000, elapsedMs: 4950, deltaMs: -50 }, r: { ms: null, earlyTaps: 3 }, x: { taps: 41, durationMs: 5000 } } },
  { name: 'Carla', answers: {} },
];

describe('minigameRankings', () => {
  it('ordena cada minijoc del millor al pitjor i ignora qui no hi ha jugat', () => {
    const [stop, reaction, taps] = minigameRankings(steps, people);
    expect(stop.entries.map((e) => e.name)).toEqual(['Bernat', 'Anna']);
    expect(stop.entries[0].value).toBe('−0,05 s');
    expect(reaction.entries.map((e) => e.name)).toEqual(['Anna']);
    expect(taps.entries.map((e) => e.name)).toEqual(['Bernat', 'Anna']);
  });

  it('no inclou passos que no són minijocs', () => {
    expect(minigameRankings(steps, people).map((r) => r.stepId)).toEqual(['t', 'r', 'x']);
  });
});

describe('describeAnswer', () => {
  it('tradueix ids d’opcions a etiquetes', () => {
    expect(describeAnswer(steps[0], ['b'])).toBe('Fer de DJ');
    expect(describeAnswer(steps[2], { ms: null, earlyTaps: 3 })).toMatch(/impacient/);
    expect(describeAnswer(steps[1], undefined)).toBe('—');
  });
});
