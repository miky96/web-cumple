import { describe, expect, it } from 'vitest';
import type { QuizStep } from '../types';
import { createStep, defaultQuiz, normalizeQuizSteps, STEP_CATALOG, STEP_TYPES } from './catalog';
import { currentStepIndex, isQuizComplete, progressFraction, sanitizeAnswers } from './progress';
import { validateAnswer } from './validate';

const steps: QuizStep[] = [
  createStep('profile', 'p'),
  createStep('choice', 'c'),
  createStep('stop-the-clock', 't'),
];

describe('validateAnswer', () => {
  it('valida el registre', () => {
    expect(validateAnswer(steps[0], { nickname: 'Miki', email: '' })).toBeNull();
    expect(validateAnswer(steps[0], { nickname: 'M', email: '' })).not.toBeNull();
    expect(validateAnswer(steps[0], { nickname: 'Miki', email: 'no-es-un-mail' })).not.toBeNull();
    expect(validateAnswer(steps[0], { nickname: 'Miki', email: 'miki@example.com' })).toBeNull();
  });

  it('valida opcions úniques i múltiples', () => {
    const single = steps[1];
    expect(validateAnswer(single, ['a'])).toBeNull();
    expect(validateAnswer(single, ['a', 'b'])).not.toBeNull();
    expect(validateAnswer(single, ['zz'])).not.toBeNull();
    expect(validateAnswer(single, [])).not.toBeNull();
    const multi = { ...single, config: { ...single.config, multiple: true } } as QuizStep;
    expect(validateAnswer(multi, ['a', 'b'])).toBeNull();
  });

  it('valida slider dins el rang', () => {
    const s = createStep('slider', 's') as QuizStep;
    expect(validateAnswer(s, 5)).toBeNull();
    expect(validateAnswer(s, 11)).not.toBeNull();
    expect(validateAnswer(s, Number.NaN)).not.toBeNull();
  });

  it('valida compta personatges', () => {
    const s = createStep('count-characters', 'k') as QuizStep;
    expect(validateAnswer(s, { guess: 4, actual: 6 })).toBeNull();
    expect(validateAnswer(s, { guess: -1, actual: 6 })).not.toBeNull();
    expect(validateAnswer(s, { ms: 200 })).not.toBeNull();
  });

  it('migra el minijoc de reflexos antic i descarta tipus desconeguts', () => {
    const old = [createStep('choice', 'a'), { id: 'r', type: 'reaction', title: 'x', config: {} }, { id: 'z', type: 'nope' }, null];
    const steps = normalizeQuizSteps(old);
    expect(steps.map((s) => [s.id, s.type])).toEqual([
      ['a', 'choice'],
      ['r-count', 'count-characters'],
    ]);
  });

  it('totes les configuracions per defecte del catàleg són coherents', () => {
    for (const t of STEP_TYPES) expect(STEP_CATALOG[t].type).toBe(t);
    expect(defaultQuiz().length).toBeGreaterThan(3);
  });
});

describe('progrés', () => {
  it('avança pas a pas i detecta el final', () => {
    const answers: Record<string, unknown> = {};
    expect(currentStepIndex(steps, answers)).toBe(0);
    answers.p = { nickname: 'Miki', email: '' };
    answers.c = ['b'];
    expect(currentStepIndex(steps, answers)).toBe(2);
    expect(progressFraction(steps, answers)).toBeCloseTo(2 / 3);
    expect(isQuizComplete(steps, answers)).toBe(false);
    answers.t = { targetMs: 5000, elapsedMs: 5100, deltaMs: 100 };
    expect(isQuizComplete(steps, answers)).toBe(true);
  });

  it('un qüestionari buit no es considera completat', () => {
    expect(isQuizComplete([], {})).toBe(false);
  });

  it('neteja respostes guardades obsoletes', () => {
    const stored = { p: { nickname: 'Miki', email: '' }, c: ['opcio-esborrada'], vell: 'x' };
    expect(sanitizeAnswers(steps, stored)).toEqual({ p: { nickname: 'Miki', email: '' } });
    expect(sanitizeAnswers(steps, 'brossa')).toEqual({});
  });
});
