/**
 * Importació de pagaments i despeses enganxats de l'Excel (columnes separades per tabulador o ;).
 * Si la primera fila és una capçalera, les columnes es reconeixen pel nom i poden anar en qualsevol ordre.
 */
import { normalizeName } from '../text';
import { parseDate, parseEuros } from './euros';
import type { BudgetLine, Expense, PaidBy, Payment, PaymentMethod } from './types';

export interface ImportIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedImport<T> {
  rows: T[];
  issues: ImportIssue[];
  /** Avisos que no impedeixen importar la fila (ex. partida desconeguda → per defecte). */
  warnings: ImportIssue[];
}

/** `words`: noms de capçalera acceptats (la cel·la ha de ser la paraula o començar per «paraula »). */
type Field<K extends string> = { key: K; words: string[] };

const matchesHeader = (cell: string, words: string[]) => words.some((w) => cell === w || cell.startsWith(`${w} `) || cell === `${w}s`);

function splitRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .map((l) => (l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : [l]).map((c) => c.trim().replace(/^"|"$/g, '')));
}

/** Retorna l'ordre de columnes: per capçalera si n'hi ha, si no l'ordre per defecte. */
function columnMap<K extends string>(first: string[], fields: Field<K>[]): { map: Partial<Record<K, number>>; header: boolean } {
  const map: Partial<Record<K, number>> = {};
  first.forEach((cell, i) => {
    const n = normalizeName(cell);
    const f = fields.find((f) => matchesHeader(n, f.words) && map[f.key] === undefined);
    if (f && n) map[f.key] = i;
  });
  const header = Object.keys(map).length >= 2 && first.every((c) => parseEuros(c) === null || c === '');
  if (header) return { map, header: true };
  const byOrder: Partial<Record<K, number>> = {};
  fields.forEach((f, i) => (byOrder[f.key] = i));
  return { map: byOrder, header: false };
}

/** Busca un participant pel nom: exacte, o si no, per nom de pila / inici del nom quan només n'hi ha un. */
export function matchPerson<T extends { id: string; name: string }>(name: string, people: readonly T[]): T | null {
  const n = normalizeName(name);
  if (!n) return null;
  const exact = people.filter((p) => normalizeName(p.name) === n);
  if (exact.length === 1) return exact[0];
  const partial = people.filter((p) => {
    const pn = normalizeName(p.name);
    return pn.startsWith(`${n} `) || pn.split(' ')[0] === n || n.startsWith(`${pn} `);
  });
  return partial.length === 1 ? partial[0] : null;
}

export function parseMethod(input: string, fallback: PaymentMethod): PaymentMethod {
  const n = normalizeName(input);
  if (!n) return fallback;
  if (n.startsWith('biz')) return 'bizum';
  if (n.startsWith('trans') || n.startsWith('banc') || n.includes('iban')) return 'transferencia';
  if (n.startsWith('efect') || n.startsWith('cash') || n.startsWith('meta')) return 'efectiu';
  return 'altre';
}

const PAYMENT_FIELDS: Field<'name' | 'amount' | 'date' | 'method' | 'note'>[] = [
  { key: 'name', words: ['nom', 'persona', 'qui', 'name', 'participant'] },
  { key: 'amount', words: ['import', 'quantitat', 'euro', 'euros', '€', 'pagat', 'amount', 'diners'] },
  { key: 'date', words: ['data', 'dia', 'date', 'quan'] },
  { key: 'method', words: ['metode', 'via', 'forma', 'metodo', 'method', 'com'] },
  { key: 'note', words: ['nota', 'notes', 'comentari', 'concepte', 'observacions'] },
];

export function parsePaymentsPaste(
  text: string,
  people: readonly { id: string; name: string }[],
  opts: { today: string; defaultMethod?: PaymentMethod },
): ParsedImport<Omit<Payment, 'id'>> {
  const all = splitRows(text);
  const out: ParsedImport<Omit<Payment, 'id'>> = { rows: [], issues: [], warnings: [] };
  if (all.length === 0) return out;
  const { map, header } = columnMap(all[0], PAYMENT_FIELDS);
  all.forEach((cells, i) => {
    if (i === 0 && header) return;
    const raw = cells.join(' · ');
    if (!cells.some(Boolean)) return;
    const get = (k: keyof typeof map) => (map[k] !== undefined ? (cells[map[k]!] ?? '') : '');
    const person = matchPerson(get('name'), people);
    if (!person) return out.issues.push({ line: i + 1, text: raw, reason: `No trobo «${get('name')}» entre els participants` });
    const amount = parseEuros(get('amount'));
    if (amount === null || amount === 0) return out.issues.push({ line: i + 1, text: raw, reason: `Import no vàlid: «${get('amount')}»` });
    const dateRaw = get('date');
    const date = dateRaw ? parseDate(dateRaw) : opts.today;
    if (!date) out.warnings.push({ line: i + 1, text: raw, reason: `Data no reconeguda («${dateRaw}»): poso avui` });
    out.rows.push({
      participantId: person.id,
      amount,
      date: date ?? opts.today,
      method: parseMethod(get('method'), opts.defaultMethod ?? 'bizum'),
      note: get('note'),
    });
  });
  return out;
}

const EXPENSE_FIELDS: Field<'date' | 'concept' | 'amount' | 'line' | 'paidBy' | 'note'>[] = [
  { key: 'date', words: ['data', 'dia', 'date', 'quan'] },
  { key: 'concept', words: ['concepte', 'descripcio', 'que', 'item', 'producte', 'compra', 'despesa'] },
  { key: 'amount', words: ['import', 'preu', 'cost', 'total', 'euro', 'euros', '€', 'amount'] },
  { key: 'line', words: ['partida', 'categoria', 'tipus', 'grup'] },
  { key: 'paidBy', words: ['pagat per', 'pagador', 'qui', 'paga'] },
  { key: 'note', words: ['nota', 'notes', 'comentari', 'observ', 'botiga'] },
];

const ORGANIZER_WORDS = new Set(['', 'jo', 'organitzador', 'organitzacio', 'org', 'pot', 'caixa', 'bote']);

export function parsePaidBy(input: string, people: readonly { id: string; name: string }[]): PaidBy | null {
  if (ORGANIZER_WORDS.has(normalizeName(input))) return 'organizer';
  return matchPerson(input, people)?.id ?? null;
}

export function matchLine(name: string, lines: readonly BudgetLine[]): BudgetLine | null {
  const n = normalizeName(name);
  if (!n) return null;
  return lines.find((l) => normalizeName(l.name) === n) ?? lines.find((l) => normalizeName(l.name).startsWith(n) || n.startsWith(normalizeName(l.name))) ?? null;
}

export function parseExpensesPaste(
  text: string,
  lines: readonly BudgetLine[],
  people: readonly { id: string; name: string }[],
  opts: { today: string; defaultLineId: string },
): ParsedImport<Omit<Expense, 'id'>> {
  const all = splitRows(text);
  const out: ParsedImport<Omit<Expense, 'id'>> = { rows: [], issues: [], warnings: [] };
  if (all.length === 0) return out;
  const { map, header } = columnMap(all[0], EXPENSE_FIELDS);
  all.forEach((cells, i) => {
    if (i === 0 && header) return;
    const raw = cells.join(' · ');
    if (!cells.some(Boolean)) return;
    const get = (k: keyof typeof map) => (map[k] !== undefined ? (cells[map[k]!] ?? '') : '');
    const amount = parseEuros(get('amount'));
    if (amount === null || amount === 0) return out.issues.push({ line: i + 1, text: raw, reason: `Import no vàlid: «${get('amount')}»` });
    const concept = get('concept') || 'Despesa';
    const dateRaw = get('date');
    const date = dateRaw ? parseDate(dateRaw) : opts.today;
    if (!date) out.warnings.push({ line: i + 1, text: raw, reason: `Data no reconeguda («${dateRaw}»): poso avui` });
    const lineRaw = get('line');
    const line = matchLine(lineRaw, lines);
    if (lineRaw && !line) out.warnings.push({ line: i + 1, text: raw, reason: `Partida «${lineRaw}» desconeguda: va a la partida per defecte` });
    const paidBy = parsePaidBy(get('paidBy'), people);
    if (paidBy === null) out.warnings.push({ line: i + 1, text: raw, reason: `No trobo «${get('paidBy')}»: la poso com a pagada per l'organitzador` });
    out.rows.push({ date: date ?? opts.today, concept, amount, lineId: line?.id ?? opts.defaultLineId, paidBy: paidBy ?? 'organizer', note: get('note') });
  });
  return out;
}
