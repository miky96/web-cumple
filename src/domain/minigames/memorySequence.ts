import type { Rng } from '../types';

export const MEMORY_COLORS = 4;

export interface MemoryState {
  /** Seqüència completa per a tots els nivells (cada nivell n'agafa més). */
  sequence: number[];
  level: number; // 1-based
  levels: number;
  startLength: number;
  inputIndex: number;
  status: 'showing' | 'input' | 'failed' | 'won';
}

export function lengthForLevel(level: number, startLength: number): number {
  return startLength + level - 1;
}

export function createMemoryGame(rng: Rng, levels: number, startLength: number): MemoryState {
  const total = lengthForLevel(levels, startLength);
  const sequence = Array.from({ length: total }, () => Math.floor(rng() * MEMORY_COLORS));
  return { sequence, level: 1, levels, startLength, inputIndex: 0, status: 'showing' };
}

export function currentSequence(state: MemoryState): number[] {
  return state.sequence.slice(0, lengthForLevel(state.level, state.startLength));
}

export function finishShowing(state: MemoryState): MemoryState {
  return state.status === 'showing' ? { ...state, status: 'input', inputIndex: 0 } : state;
}

export function pressColor(state: MemoryState, color: number): MemoryState {
  if (state.status !== 'input') return state;
  const seq = currentSequence(state);
  if (seq[state.inputIndex] !== color) return { ...state, status: 'failed' };
  const inputIndex = state.inputIndex + 1;
  if (inputIndex < seq.length) return { ...state, inputIndex };
  if (state.level >= state.levels) return { ...state, inputIndex, status: 'won' };
  return { ...state, level: state.level + 1, inputIndex: 0, status: 'showing' };
}

/** Nivells superats completament. */
export function levelReached(state: MemoryState): number {
  if (state.status === 'won') return state.levels;
  return state.level - 1;
}

export function memoryRating(reached: number, levels: number): string {
  if (reached >= levels) return 'Memòria d\'elefant!';
  if (reached >= Math.ceil(levels * 0.6)) return 'Molt bé!';
  if (reached >= 1) return 'Has resistit una mica';
  return 'Peix de colors';
}
