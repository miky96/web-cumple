/** Compta els tocs dins la finestra [startAt, startAt + durationMs). */
export function countTaps(startAt: number, durationMs: number, tapTimes: readonly number[]): number {
  const end = startAt + durationMs;
  return tapTimes.filter((t) => t >= startAt && t < end).length;
}

export function tapsPerSecond(taps: number, durationMs: number): number {
  return durationMs > 0 ? taps / (durationMs / 1000) : 0;
}

export function tapRating(taps: number, durationMs: number): string {
  const tps = tapsPerSecond(taps, durationMs);
  if (tps >= 9) return 'Collons, no ens posarem a preguntar per què tens aquesta velocitat de dit...';
  if (tps >= 7) return 'WTF? Sembles un jugador d\'eSports';
  if (tps >= 5) return 'Ei, ni tan malament: del muntó, ni olímpic ni penós';
  if (tps >= 3) return 'Vaja, que el botó te la bufa i només vols saber de quin equip ets...';
  return '... Sense comentaris, que malament que ho has fet. Prova-ho més cops!';
}
