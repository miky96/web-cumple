/** Normalitza per comparar noms: minúscules, sense accents ni espais repetits. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "0,23 s" amb coma decimal catalana. */
export function formatSeconds(ms: number, decimals = 2): string {
  return `${(ms / 1000).toFixed(decimals).replace('.', ',')} s`;
}

export function formatSignedSeconds(ms: number, decimals = 2): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '±';
  return `${sign}${formatSeconds(Math.abs(ms), decimals)}`;
}

export function slugId(prefix: string, rng: () => number = Math.random): string {
  return `${prefix}_${Math.floor(rng() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;
}
