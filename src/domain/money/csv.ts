import { formatEurosPlain } from './euros';
import { STATUS_LABELS } from './defaults';
import type { MoneySummary } from './types';

/** CSV per a l'Excel en català: separador ; i BOM perquè llegeixi bé els accents. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function summaryRows(summary: MoneySummary): (string | number)[][] {
  const lines = summary.lines.map((l) => l.line);
  const header = ['Nom', 'Nits', 'Ve', ...lines.map((l) => l.name), 'Preu comunicat', 'Ajustos', 'A pagar', 'Pagaments', 'Despeses avançades', 'Pagat', 'Saldo', 'Estat'];
  const rows = summary.people.map((p) => [
    p.name,
    p.nightsCount,
    p.attending ? 'Sí' : 'No',
    ...lines.map((l) => formatEurosPlain(p.shares[l.id] ?? 0)),
    p.announced === null ? '' : formatEurosPlain(p.announced),
    formatEurosPlain(p.adjustments),
    formatEurosPlain(p.due),
    formatEurosPlain(p.payments),
    formatEurosPlain(p.expensesPaid),
    formatEurosPlain(p.paid),
    formatEurosPlain(p.balance),
    STATUS_LABELS[p.status],
  ]);
  return [header, ...rows];
}
