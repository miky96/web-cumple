/**
 * Motor de diners: a partir de les dades crues (persones, partides, despeses, pagaments i ajustos)
 * calcula què ha de pagar cadascú, què ha pagat i el resum global. Funció pura, sense estat.
 */
import { allocate } from './allocate';
import type {
  BudgetLine,
  Cents,
  LineSummary,
  MoneyInput,
  MoneyPerson,
  MoneySummary,
  PersonStatus,
  PersonSummary,
  Pricing,
  SplitMethod,
  SplitScope,
} from './types';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const norm = (t: string) => t.trim().toLowerCase();

/** Entra als repartiments: ha confirmat i ve almenys una nit. */
export const isAttending = (p: MoneyPerson) => p.confirmed && p.nights.length > 0;

export function inScope(p: MoneyPerson, scope: SplitScope): boolean {
  const tags = new Set(p.tags.map(norm));
  switch (scope.kind) {
    case 'all':
      return true;
    case 'withTags':
      return scope.tags.some((t) => tags.has(norm(t)));
    case 'withoutTags':
      return !scope.tags.some((t) => tags.has(norm(t)));
    case 'people':
      return scope.ids.includes(p.id);
  }
}

/**
 * Pes d'una estada de `n` nits. Si no està configurat, s'extrapola de l'estada configurada més llarga
 * (ex. amb { "2": 1 }, 1 nit = 0,5 i 3 nits = 1,5). Sense res configurat, n / nits màximes.
 */
export function stayUnits(pricing: Pick<Pricing, 'stayUnits'>, n: number, maxNights: number): number {
  if (n <= 0) return 0;
  const configured = pricing.stayUnits[String(n)];
  if (typeof configured === 'number' && configured >= 0) return configured;
  const keys = Object.keys(pricing.stayUnits)
    .map(Number)
    .filter((k) => k > 0 && typeof pricing.stayUnits[String(k)] === 'number');
  if (keys.length === 0) return n / Math.max(maxNights, 1);
  const longest = Math.max(...keys);
  return (n / longest) * pricing.stayUnits[String(longest)];
}

export function weightFor(method: SplitMethod, nights: number, pricing: Pick<Pricing, 'stayUnits'>, maxNights: number): number {
  if (nights <= 0) return 0;
  if (method === 'equal') return 1;
  if (method === 'nights') return nights;
  return stayUnits(pricing, nights, maxNights);
}

/** El que es reparteix d'una partida: si és tancada, el real; si no, el més gran entre previst i gastat. */
export function lineAllocated(line: BudgetLine, spent: Cents): Cents {
  return line.closed ? spent : Math.max(line.planned, spent);
}

function statusOf(due: Cents, paid: Cents): PersonStatus {
  const balance = paid - due;
  if (due === 0 && paid === 0) return 'sense-carrec';
  if (balance === 0) return 'pagat';
  if (balance > 0) return 'a-retornar';
  return paid > 0 ? 'parcial' : 'pendent';
}

export function computeMoney(input: MoneyInput): MoneySummary {
  const { pricing } = input;
  // ordre estable per id: el repartiment dels cèntims sobrants és sempre el mateix
  const people = [...input.people].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const attending = people.filter(isAttending);
  const maxNights = Math.max(0, ...people.map((p) => p.nights.length));
  const lines = [...input.lines].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const lineIds = new Set(lines.map((l) => l.id));

  const spentByLine = new Map<string, Cents>();
  for (const e of input.expenses) spentByLine.set(e.lineId, (spentByLine.get(e.lineId) ?? 0) + e.amount);
  const orphanExpenses = input.expenses.filter((e) => !lineIds.has(e.lineId));

  const shares = new Map<string, Record<string, Cents>>(people.map((p) => [p.id, {}]));
  const lineSummaries: LineSummary[] = lines.map((line) => {
    const spent = spentByLine.get(line.id) ?? 0;
    const allocated = lineAllocated(line, spent);
    const members = attending.filter((p) => inScope(p, line.scope));
    const weights = members.map((p) => weightFor(line.method, p.nights.length, pricing, maxNights));
    const parts = allocate(allocated, weights);
    members.forEach((p, i) => (shares.get(p.id)![line.id] = parts[i]));
    return { line, spent, allocated, members: members.filter((_, i) => weights[i] > 0).length, remaining: line.planned - spent };
  });
  const inAnnounced = new Set(lines.filter((l) => l.inAnnounced).map((l) => l.id));

  const adjBy = new Map<string, Cents>();
  for (const a of input.adjustments) adjBy.set(a.participantId, (adjBy.get(a.participantId) ?? 0) + a.amount);
  const payBy = new Map<string, Cents>();
  for (const p of input.payments) payBy.set(p.participantId, (payBy.get(p.participantId) ?? 0) + p.amount);
  const advancedBy = new Map<string, Cents>();
  for (const e of input.expenses) if (e.paidBy !== 'organizer') advancedBy.set(e.paidBy, (advancedBy.get(e.paidBy) ?? 0) + e.amount);

  const summaries: PersonSummary[] = people.map((p) => {
    const s = shares.get(p.id)!;
    const isIn = isAttending(p);
    const includedCalculated = sum(Object.entries(s).filter(([id]) => inAnnounced.has(id)).map(([, c]) => c));
    const extras = sum(Object.entries(s).filter(([id]) => !inAnnounced.has(id)).map(([, c]) => c));
    const announcedPrice = pricing.announced[String(p.nights.length)];
    const announced = isIn && pricing.mode === 'announced' && typeof announcedPrice === 'number' ? announcedPrice : null;
    const adjustments = adjBy.get(p.id) ?? 0;
    const due = (announced ?? includedCalculated) + extras + adjustments;
    const payments = payBy.get(p.id) ?? 0;
    const expensesPaid = advancedBy.get(p.id) ?? 0;
    const paid = payments + expensesPaid;
    return {
      id: p.id,
      name: p.name,
      nightsCount: p.nights.length,
      attending: isIn,
      shares: s,
      includedCalculated,
      announced,
      extras,
      adjustments,
      due,
      payments,
      expensesPaid,
      paid,
      balance: paid - due,
      status: statusOf(due, paid),
    };
  });

  const orphanTotal = sum(orphanExpenses.map((e) => e.amount));
  const cost = sum(lineSummaries.map((l) => l.allocated)) + orphanTotal;
  const due = sum(summaries.map((s) => s.due));
  const collected = sum(input.payments.map((p) => p.amount));
  const organizerSpent = sum(input.expenses.filter((e) => e.paidBy === 'organizer').map((e) => e.amount));

  return {
    people: summaries,
    lines: lineSummaries,
    orphanExpenses,
    totals: {
      planned: sum(lines.map((l) => l.planned)),
      spent: sum(input.expenses.map((e) => e.amount)),
      cost,
      unallocated: sum(lineSummaries.filter((l) => l.members === 0).map((l) => l.allocated)) + orphanTotal,
      due,
      paid: sum(summaries.map((s) => s.paid)),
      collected,
      pending: sum(summaries.map((s) => Math.max(0, -s.balance))),
      toRefund: sum(summaries.map((s) => Math.max(0, s.balance))),
      surplus: due - cost,
      organizerCash: collected - organizerSpent,
      attendees: attending.length,
    },
    reference: referencePrices(input, lineSummaries, attending, maxNights),
    paidButNotAttending: summaries.filter((s) => !s.attending && s.paid !== 0),
  };
}

/**
 * Preu calculat (partides incloses al preu comunicat) per a una persona sense etiquetes que vingués `n` nits,
 * amb l'assistència actual. Serveix per comparar amb el preu comunicat.
 */
function referencePrices(input: MoneyInput, lines: LineSummary[], attending: MoneyPerson[], maxNights: number): Record<string, Cents> {
  const { pricing } = input;
  const counts = new Set<number>([
    ...attending.map((p) => p.nights.length),
    ...Object.keys(pricing.announced).map(Number),
    ...Object.keys(pricing.stayUnits).map(Number),
  ]);
  const out: Record<string, Cents> = {};
  for (const n of [...counts].filter((k) => k > 0).sort((a, b) => a - b)) {
    let total = 0;
    for (const { line, allocated } of lines) {
      if (!line.inAnnounced) continue;
      if (line.scope.kind === 'withTags' || line.scope.kind === 'people') continue; // una persona sense etiquetes no hi entra
      const members = attending.filter((p) => inScope(p, line.scope));
      const totalWeight = sum(members.map((p) => weightFor(line.method, p.nights.length, pricing, maxNights)));
      if (totalWeight <= 0) continue;
      total += (allocated * weightFor(line.method, n, pricing, maxNights)) / totalWeight;
    }
    out[String(n)] = Math.round(total);
  }
  return out;
}
