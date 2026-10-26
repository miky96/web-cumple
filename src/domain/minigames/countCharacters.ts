import type { Rng } from '../types';

/**
 * "Compta personatges" (estil Mario Party): passen personatges aleatoris per la pantalla
 * i només n'has de comptar un. Al final dius quants n'han passat.
 */

export type CountLevel = 1 | 2 | 3;

export interface Spawn {
  /** ms des de l'inici de la ronda */
  at: number;
  /** true = el personatge que s'ha de comptar */
  isTarget: boolean;
  /** índex dins de `decoys` (només si no és target) */
  decoy: number;
  /** carril vertical, 0..LANES-1 */
  lane: number;
  /** els carrils parells van d'esquerra a dreta */
  leftToRight: boolean;
}

export interface CountRound {
  spawns: Spawn[];
  /** ms que triga un personatge a creuar la pantalla */
  crossMs: number;
  /** durada total: quan surt de pantalla l'últim */
  totalMs: number;
  actual: number;
}

export const LANES = 5;
export const MIN_TARGETS = 3;
const LEAD_MS = 500;

interface LevelParams {
  crossMs: number;
  /** interval mitjà entre aparicions */
  gapMs: number;
  targetShare: number;
  /** probabilitat que n'apareguin dos alhora */
  burst: number;
}

export const LEVELS: Record<CountLevel, LevelParams> = {
  1: { crossMs: 2600, gapMs: 750, targetShare: 0.4, burst: 0 },
  2: { crossMs: 2000, gapMs: 480, targetShare: 0.32, burst: 0.2 },
  3: { crossMs: 1500, gapMs: 320, targetShare: 0.28, burst: 0.35 },
};

export function normalizeLevel(n: unknown): CountLevel {
  return n === 1 || n === 3 ? n : 2;
}

/**
 * Genera la ronda. `durationMs` és el temps durant el qual van apareixent personatges;
 * la ronda acaba quan l'últim surt de pantalla.
 */
export function createCountRound(rng: Rng, durationMs: number, level: CountLevel, decoyCount: number): CountRound {
  const p = LEVELS[level];
  const lastSpawnAt = Math.max(LEAD_MS, durationMs - p.crossMs);
  const laneFreeAt = Array<number>(LANES).fill(0);
  // Un mateix carril no torna a sortir fins que el personatge anterior ha fet camí
  const laneGap = p.crossMs * 0.3;
  const spawns: Spawn[] = [];

  const place = (at: number): boolean => {
    const free = laneFreeAt.map((t, i) => (t <= at ? i : -1)).filter((i) => i >= 0);
    if (free.length === 0) return false;
    const lane = free[Math.floor(rng() * free.length)];
    laneFreeAt[lane] = at + laneGap;
    const isTarget = decoyCount === 0 || rng() < p.targetShare;
    spawns.push({ at: Math.round(at), isTarget, decoy: isTarget ? 0 : Math.floor(rng() * decoyCount), lane, leftToRight: lane % 2 === 0 });
    return true;
  };

  let t = LEAD_MS;
  while (t <= lastSpawnAt) {
    if (place(t) && rng() < p.burst) place(t);
    t += p.gapMs * (0.6 + rng() * 0.8);
  }

  // Mínim de personatges a comptar: convertim alguns despistats
  let actual = spawns.filter((s) => s.isTarget).length;
  const decoys = spawns.filter((s) => !s.isTarget);
  while (actual < MIN_TARGETS && decoys.length > 0) {
    const s = decoys.splice(Math.floor(rng() * decoys.length), 1)[0];
    s.isTarget = true;
    s.decoy = 0;
    actual++;
  }

  const last = spawns.reduce((m, s) => Math.max(m, s.at), 0);
  return { spawns, crossMs: p.crossMs, totalMs: last + p.crossMs + 300, actual };
}

/** Separa una cadena d'emojis per espais o comes ("🗿 👾, 🦩" → ["🗿","👾","🦩"]). */
export function parseEmojiList(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

export function countRating(guess: number, actual: number): string {
  const d = Math.abs(guess - actual);
  if (d === 0) return 'EXACTE! Ulls de falcó';
  if (d === 1) return 'Per un pèl!';
  if (d <= 3) return 'No està malament';
  return 'Has comptat ovelles?';
}
