import type { Cents } from './types';

const fmt = new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

/** 123456 → "1.234,56 €" */
export function formatEuros(cents: Cents): string {
  return fmt.format(cents / 100);
}

/** 123456 → "1234,56" (per editar en un input o exportar a l'Excel). */
export function formatEurosPlain(cents: Cents): string {
  return fmtShort.format(cents / 100).replace(/\./g, '').replace(/\s/g, '');
}

/** Amb signe explícit: "+12,00 €" / "−3,50 €". */
export function formatSignedEuros(cents: Cents): string {
  if (cents === 0) return formatEuros(0);
  return `${cents > 0 ? '+' : '−'}${formatEuros(Math.abs(cents))}`;
}

/**
 * Llegeix un import escrit a mà o enganxat de l'Excel i el retorna en cèntims.
 * Accepta "45", "45,5", "45.50", "1.234,56 €", "1,234.56", "-20", "−20 €". Retorna null si no és un número.
 */
export function parseEuros(input: string): Cents | null {
  let s = input.trim().replace(/[€\s\u00a0]/g, '').replace(/^−/, '-').replace(/EUR$/i, '');
  if (!s) return null;
  const neg = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/^[-+(]|\)$/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // el separador que surt més tard és el decimal
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // una sola coma = decimal (estil català); diverses = separadors de milers
    normalized = s.match(/,/g)!.length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    const dots = s.match(/\./g)!.length;
    const decimals = s.length - lastDot - 1;
    // "1.234" o "1.234.567" → milers (estil català); "45.5" → decimal
    normalized = dots > 1 || decimals === 3 ? s.replace(/\./g, '') : s;
  } else normalized = s;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return neg ? -cents : cents;
}

/**
 * Llegeix una data en format "26/10/2026", "26/10/26", "26-10-2026" o "2026-10-26". Retorna ISO o null.
 */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
    if (!m) return null;
    d = Number(m[1]);
    mo = Number(m[2]);
    y = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "2026-10-26" → "26/10/2026" */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
