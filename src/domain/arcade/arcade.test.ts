import { describe, expect, it } from 'vitest';
import { createStep } from '../quiz/catalog';
import { arcadeRankings, arcadeStep, boardFromAnswers, describeBest, mergeBoards, recordPlay, sameBoard, type ArcadeBoard } from './arcade';

describe('arcadeStep', () => {
  it('fa servir la configuració del minijoc del qüestionari si hi és', () => {
    const quiz = createStep('tap-race', 'x');
    quiz.config = { durationMs: 8000 };
    quiz.title = 'Toca!';
    const s = arcadeStep('tap-race', [createStep('choice', 'c'), quiz]);
    expect(s.config).toEqual({ durationMs: 8000 });
    expect(s.title).toBe('Toca!');
    expect(s.id).toBe('arcade-tap-race');
  });

  it('si no hi és, la configuració per defecte', () => {
    expect(arcadeStep('memory-sequence', []).config).toEqual(createStep('memory-sequence', 'm').config);
  });
});

describe('recordPlay', () => {
  it('guarda la primera partida i només la substitueix si millora', () => {
    let board: ArcadeBoard = {};
    let r = recordPlay(board, 'tap-race', { taps: 30, durationMs: 5000 }, 1);
    expect(r).toMatchObject({ improved: true, first: true });
    board = r.board;
    r = recordPlay(board, 'tap-race', { taps: 25, durationMs: 5000 }, 2);
    expect(r.improved).toBe(false);
    expect(r.board['tap-race']?.at).toBe(1);
    r = recordPlay(board, 'tap-race', { taps: 30, durationMs: 5000 }, 3); // empat: es queda l'antiga
    expect(r.improved).toBe(false);
    r = recordPlay(board, 'tap-race', { taps: 41, durationMs: 5000 }, 4);
    expect(r).toMatchObject({ improved: true, first: false });
    expect(describeBest('tap-race', r.board['tap-race'])).toBe('41 tocs');
  });

  it('al rellotge, millor com més a prop (per sobre o per sota)', () => {
    const b = recordPlay({}, 'stop-the-clock', { targetMs: 5000, elapsedMs: 5300, deltaMs: 300 }, 1).board;
    expect(recordPlay(b, 'stop-the-clock', { targetMs: 5000, elapsedMs: 4900, deltaMs: -100 }, 2).improved).toBe(true);
  });

  it('ignora resultats no vàlids', () => {
    expect(recordPlay({}, 'tap-race', { nope: 1 }, 1)).toMatchObject({ improved: false, board: {} });
  });
});

describe('arcadeRankings', () => {
  it('ordena per marca i, en empat, per qui ho va fer abans', () => {
    const rk = arcadeRankings([
      { name: 'Anna', board: { 'count-characters': { answer: { guess: 7, actual: 7 }, score: 0, at: 20 } } },
      { name: 'Bernat', board: { 'count-characters': { answer: { guess: 7, actual: 7 }, score: 0, at: 10 } } },
      { name: 'Carla', board: { 'count-characters': { answer: { guess: 9, actual: 7 }, score: 2, at: 1 } } },
    ]);
    expect(rk.map((r) => r.game)).toEqual(['stop-the-clock', 'count-characters', 'tap-race', 'memory-sequence']);
    expect(rk[1].entries.map((e) => e.name)).toEqual(['Bernat', 'Anna', 'Carla']);
    expect(rk[1].entries[0].id).toBeUndefined();
    expect(rk[0].entries).toEqual([]);
  });
});

describe('marques del qüestionari', () => {
  const steps = [createStep('choice', 'c'), createStep('tap-race', 't1'), createStep('tap-race', 't2'), createStep('stop-the-clock', 's')];

  it('agafa els minijocs del qüestionari, i la millor si un joc hi surt dos cops', () => {
    const b = boardFromAnswers(steps, { c: ['a'], t1: { taps: 30, durationMs: 5000 }, t2: { taps: 35, durationMs: 5000 } }, 100);
    expect(Object.keys(b)).toEqual(['tap-race']);
    expect(b['tap-race']).toEqual({ answer: { taps: 35, durationMs: 5000 }, score: -35, at: 100 });
  });

  it('també compta resultats de passos que ja no són al qüestionari (pel tipus de resultat)', () => {
    const b = boardFromAnswers(steps, { vell: { levelReached: 4, levels: 5 }, altre: { guess: 8, actual: 8 }, txt: 'hola', p: { nickname: 'M' } }, 5);
    expect(b['memory-sequence']?.score).toBe(-4);
    expect(b['count-characters']?.score).toBe(0);
    expect(Object.keys(b)).toHaveLength(2);
  });

  it('combinar: es queda la millor de cada joc, i en empat la més antiga', () => {
    const quiz = boardFromAnswers(steps, { t1: { taps: 35, durationMs: 5000 }, s: { targetMs: 5000, elapsedMs: 5100, deltaMs: 100 } }, 100);
    const arcade: ArcadeBoard = { 'tap-race': { answer: { taps: 40, durationMs: 5000 }, score: -40, at: 200 }, 'stop-the-clock': { answer: {}, score: 100, at: 50 } };
    const m = mergeBoards(arcade, quiz);
    expect(m['tap-race']?.score).toBe(-40);
    expect(m['stop-the-clock']?.at).toBe(50);
    expect(sameBoard(m, arcade)).toBe(true);
    expect(sameBoard(mergeBoards({}, quiz), {})).toBe(false);
  });
});
