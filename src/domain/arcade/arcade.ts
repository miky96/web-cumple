/**
 * Sala arcade: un cop fet el qüestionari, cada participant pot jugar qualsevol minijoc per separat
 * tantes vegades com vulgui. Només es guarda la millor marca de cada joc.
 */
import { minigameScore, type RankingEntry } from '../insights/curiosities';
import { createStep } from '../quiz/catalog';
import type { Answers, QuizStep, QuizStepOf } from '../types';

export const ARCADE_GAMES = ['stop-the-clock', 'count-characters', 'tap-race', 'memory-sequence'] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];

export const isArcadeGame = (t: string): t is ArcadeGame => (ARCADE_GAMES as readonly string[]).includes(t);

export interface ArcadeScore {
  /** El resultat tal com el retorna el minijoc (mateix format que al qüestionari). */
  answer: unknown;
  /** Menor = millor. */
  score: number;
  /** Instant (ms) en què es va fer la marca. */
  at: number;
}

export type ArcadeBoard = Partial<Record<ArcadeGame, ArcadeScore>>;

/**
 * El pas que es juga a la sala: la mateixa configuració que el minijoc del qüestionari
 * (si n'hi ha), perquè les marques siguin comparables. Si no, la configuració per defecte.
 */
export function arcadeStep(game: ArcadeGame, quizSteps: readonly QuizStep[]): QuizStepOf<ArcadeGame> {
  const fromQuiz = quizSteps.find((s) => s.type === game) as QuizStepOf<ArcadeGame> | undefined;
  const base = createStep(game, `arcade-${game}`) as QuizStepOf<ArcadeGame>;
  return fromQuiz ? { ...base, title: fromQuiz.title, config: fromQuiz.config } : base;
}

/** Text de la millor marca ("+0,12 s", "41 tocs"...) o null si encara no hi ha jugat. */
export function describeBest(game: ArcadeGame, best: ArcadeScore | undefined): string | null {
  return best ? (minigameScore(game, best.answer)?.value ?? null) : null;
}

/**
 * Afegeix una partida al tauler i es queda la millor. En cas d'empat es manté la marca antiga
 * (qui la va fer primer guanya).
 */
export function recordPlay(board: ArcadeBoard, game: ArcadeGame, answer: unknown, now: number): { board: ArcadeBoard; improved: boolean; first: boolean } {
  const s = minigameScore(game, answer);
  if (!s) return { board, improved: false, first: false };
  const prev = board[game];
  if (prev && prev.score <= s.score) return { board, improved: false, first: false };
  return { board: { ...board, [game]: { answer, score: s.score, at: now } }, improved: true, first: !prev };
}

const better = (a: ArcadeScore, b: ArcadeScore) => a.score < b.score || (a.score === b.score && a.at < b.at);

/** Combina dos taulers quedant-se la millor marca de cada joc (empat: la més antiga). */
export function mergeBoards(a: ArcadeBoard, b: ArcadeBoard): ArcadeBoard {
  const out: ArcadeBoard = { ...a };
  for (const g of ARCADE_GAMES) {
    const x = b[g];
    if (x && (!out[g] || better(x, out[g]!))) out[g] = x;
  }
  return out;
}

/** Endevina de quin minijoc és un resultat per la seva forma (per a passos que ja no existeixen al qüestionari). */
export function inferGame(raw: unknown): ArcadeGame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const has = (k: string) => k in raw;
  if (has('deltaMs') && has('elapsedMs')) return 'stop-the-clock';
  if (has('guess') && has('actual')) return 'count-characters';
  if (has('taps')) return 'tap-race';
  if (has('levelReached')) return 'memory-sequence';
  return null;
}

/**
 * Marques que surten dels minijocs del qüestionari (si un joc hi surt dos cops, la millor).
 * Mira totes les respostes, no només els passos actuals: si s'ha editat el qüestionari després
 * que algú contestés (passos esborrats o recreats amb un altre id), el joc es dedueix de la forma del resultat.
 */
export function boardFromAnswers(quizSteps: readonly QuizStep[], answers: Answers, completedAt: number | null): ArcadeBoard {
  const typeById = new Map(quizSteps.map((s) => [s.id, s.type]));
  let board: ArcadeBoard = {};
  for (const [id, raw] of Object.entries(answers)) {
    const t = typeById.get(id);
    const game = t ? (isArcadeGame(t) ? t : null) : inferGame(raw);
    if (!game) continue;
    const sc = minigameScore(game, raw);
    if (sc) board = mergeBoards(board, { [game]: { answer: raw, score: sc.score, at: completedAt ?? 0 } });
  }
  return board;
}

export const sameBoard = (a: ArcadeBoard, b: ArcadeBoard) =>
  ARCADE_GAMES.every((g) => JSON.stringify(a[g] ?? null) === JSON.stringify(b[g] ?? null));

export interface ArcadeRanking {
  game: ArcadeGame;
  entries: (RankingEntry & { at: number; id?: string })[];
}

/** Rànquing de la sala per joc (millor primer; empat: qui ho va fer abans). `id` serveix per marcar "tu". */
export function arcadeRankings(people: readonly { id?: string; name: string; board: ArcadeBoard }[]): ArcadeRanking[] {
  return ARCADE_GAMES.map((game) => ({
    game,
    entries: people
      .flatMap((p) => {
        const best = p.board[game];
        const s = best && minigameScore(game, best.answer);
        return s ? [{ id: p.id, name: p.name, ...s, at: best.at }] : [];
      })
      .sort((x, y) => x.score - y.score || x.at - y.at || x.name.localeCompare(y.name, 'ca')),
  }));
}
