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
  if (tps >= 9) return 'Dit biònic!';
  if (tps >= 7) return 'Bestial!';
  if (tps >= 5) return 'Molt bé!';
  if (tps >= 3) return 'Pots fer-ho millor';
  return 'Tens els dits de vacances';
}
