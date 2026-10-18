import type { Rng } from '../types';

export type ReactionState =
  | { phase: 'waiting'; goAt: number; earlyTaps: number }
  | { phase: 'done'; ms: number | null; earlyTaps: number };

export const MAX_EARLY_TAPS = 3;

export function pickDelay(rng: Rng, minMs: number, maxMs: number): number {
  return Math.round(minMs + rng() * Math.max(0, maxMs - minMs));
}

export function startReaction(now: number, delayMs: number): ReactionState {
  return { phase: 'waiting', goAt: now + delayMs, earlyTaps: 0 };
}

/**
 * Processa un toc. Si és abans del senyal compta com a "massa aviat" i reprograma.
 * Després de MAX_EARLY_TAPS precipitats, el joc s'acaba sense temps.
 */
export function tapReaction(state: ReactionState, tapAt: number, nextDelayMs: number): ReactionState {
  if (state.phase === 'done') return state;
  if (tapAt < state.goAt) {
    const earlyTaps = state.earlyTaps + 1;
    if (earlyTaps >= MAX_EARLY_TAPS) return { phase: 'done', ms: null, earlyTaps };
    return { phase: 'waiting', goAt: tapAt + nextDelayMs, earlyTaps };
  }
  return { phase: 'done', ms: Math.round(tapAt - state.goAt), earlyTaps: state.earlyTaps };
}

export function reactionRating(ms: number | null): string {
  if (ms === null) return 'Massa impacient! El tòtem ho apunta';
  if (ms < 220) return 'Reflexos de felí!';
  if (ms < 300) return 'Molt ràpid!';
  if (ms < 420) return 'Correcte';
  return 'Encara estàs dormint?';
}
