/**
 * Entrada de diversos pagaments a la vegada: files d'esborrany (text tal com l'escriu l'admin)
 * que es validen i es converteixen en pagaments.
 */
import { parseEuros } from './euros';
import type { Cents, Payment, PaymentMethod } from './types';

export interface DraftPayment {
  key: string;
  participantId: string;
  amount: string;
  date: string;
  method: PaymentMethod;
  note: string;
}

export type DraftStatus = 'empty' | 'ok' | 'error';

export interface DraftCheck {
  status: DraftStatus;
  error: string | null;
  cents: Cents | null;
  /** La mateixa persona surt més d'una vegada a la llista (només és un avís). */
  duplicate: boolean;
}

export function checkDrafts(rows: readonly DraftPayment[]): DraftCheck[] {
  const count = new Map<string, number>();
  rows.forEach((r) => r.participantId && count.set(r.participantId, (count.get(r.participantId) ?? 0) + 1));
  return rows.map((r) => {
    const blank = !r.participantId && !r.amount.trim();
    const cents = r.amount.trim() ? parseEuros(r.amount) : null;
    const duplicate = !!r.participantId && (count.get(r.participantId) ?? 0) > 1;
    if (blank) return { status: 'empty', error: null, cents: null, duplicate: false };
    if (!r.participantId) return { status: 'error', error: 'Falta la persona', cents, duplicate };
    if (cents === null || cents === 0) return { status: 'error', error: r.amount.trim() ? 'Import no vàlid' : "Falta l'import", cents: null, duplicate };
    if (!r.date) return { status: 'error', error: 'Falta la data', cents, duplicate };
    return { status: 'ok', error: null, cents, duplicate };
  });
}

/** Converteix les files vàlides en pagaments. Les buides s'ignoren; si n'hi ha cap d'errònia, no en retorna cap. */
export function draftsToPayments(rows: readonly DraftPayment[], newId: () => string): { payments: Payment[]; errors: number } {
  const checks = checkDrafts(rows);
  const errors = checks.filter((c) => c.status === 'error').length;
  if (errors > 0) return { payments: [], errors };
  const payments = rows.flatMap((r, i) =>
    checks[i].status === 'ok'
      ? [{ id: newId(), participantId: r.participantId, amount: checks[i].cents!, date: r.date, method: r.method, note: r.note.trim() }]
      : [],
  );
  return { payments, errors: 0 };
}
