import type { Cents } from './types';

/**
 * Reparteix `amount` cèntims proporcionalment als pesos, de manera que la suma quadri exactament.
 * Mètode del residu més gran: primer s'arrodoneix cap avall i els cèntims sobrants van a qui té
 * el residu més gran; en cas d'empat, a qui surt abans a la llista (determinista).
 */
export function allocate(amount: Cents, weights: readonly number[]): Cents[] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (weights.length === 0 || total <= 0) return weights.map(() => 0);
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(amount));
  const raw = weights.map((w) => (abs * Math.max(0, w)) / total);
  const base = raw.map((r) => Math.floor(r + 1e-9));
  let left = abs - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - base[i] }))
    .filter((x) => weights[x.i] > 0)
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length, left--) base[order[k].i] += 1;
  return base.map((c) => (c === 0 ? 0 : c * sign));
}
