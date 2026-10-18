export interface StopResult {
  targetMs: number;
  elapsedMs: number;
  /** positiu = t'has passat; negatiu = t'has quedat curt */
  deltaMs: number;
  rating: string;
}

export function stopRating(absDeltaMs: number): string {
  if (absDeltaMs <= 30) return 'PERFECTE! El tòtem està impressionat';
  if (absDeltaMs <= 120) return 'Molt bé!';
  if (absDeltaMs <= 350) return 'No està gens malament';
  if (absDeltaMs <= 1000) return 'Uf... justet';
  return 'El tòtem plora';
}

export function evaluateStop(targetMs: number, elapsedMs: number): StopResult {
  const deltaMs = Math.round(elapsedMs - targetMs);
  return { targetMs, elapsedMs: Math.round(elapsedMs), deltaMs, rating: stopRating(Math.abs(deltaMs)) };
}

/** Si el cronòmetre s'ha d'amagar en aquest instant. */
export function isClockHidden(elapsedMs: number, hideAfterMs: number | null): boolean {
  return hideAfterMs !== null && elapsedMs >= hideAfterMs;
}

/** A partir de quan donem el joc per perdut si no toques (target × 2 + 3 s). */
export function stopTimeoutMs(targetMs: number): number {
  return targetMs * 2 + 3000;
}
