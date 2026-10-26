import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { defaultBudgetLines, DEFAULT_PRICING } from './defaults';
import { computeMoney, stayUnits } from './engine';
import { parseDate, parseEuros } from './euros';
import { parseExpensesPaste, parsePaymentsPaste } from './importMoney';
import type { BudgetLine, MoneyInput, MoneyPerson, Pricing } from './types';

const N1 = ['2027-01-23'];
const N2 = ['2027-01-22', '2027-01-23'];
const person = (id: string, nights = N2, tags: string[] = [], confirmed = true): MoneyPerson => ({ id, name: id.toUpperCase(), nights, tags, confirmed });
const line = (patch: Partial<BudgetLine> & { id: string }): BudgetLine => ({
  name: patch.id,
  planned: 0,
  method: 'equal',
  scope: { kind: 'all' },
  closed: false,
  inAnnounced: true,
  order: 0,
  ...patch,
});
const input = (patch: Partial<MoneyInput>): MoneyInput => ({
  people: [],
  lines: [],
  expenses: [],
  payments: [],
  adjustments: [],
  pricing: { ...DEFAULT_PRICING },
  ...patch,
});

describe('allocate', () => {
  it('quadra sempre al cèntim i és determinista', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(100, [1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
    const parts = allocate(200000, [0.6, 1, 1, 1, 0.6, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(200000);
  });
  it('pesos zero no reben res', () => {
    expect(allocate(100, [1, 0, 1])).toEqual([50, 0, 50]);
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
  });
});

describe('preu de la casa', () => {
  it('reparteix per pes d’estada: 1 nit = 0,6', () => {
    const s = computeMoney(
      input({
        people: [person('a'), person('b'), person('c', N1)],
        lines: [line({ id: 'casa', planned: 2600_00, method: 'stay' })],
      }),
    );
    // 1 + 1 + 0,6 = 2,6 unitats → 1.000 € per unitat
    expect(s.people.map((p) => p.due)).toEqual([1000_00, 1000_00, 600_00]);
    expect(s.reference).toMatchObject({ '1': 600_00, '2': 1000_00 });
  });

  it('el preu es recalcula si algú es dona de baixa (no confirmat)', () => {
    const lines = [line({ id: 'casa', planned: 2000_00, method: 'stay' })];
    const before = computeMoney(input({ people: [person('a'), person('b'), person('c'), person('d')], lines }));
    const after = computeMoney(input({ people: [person('a'), person('b'), person('c'), person('d', N2, [], false)], lines }));
    expect(before.reference['2']).toBe(500_00);
    expect(after.reference['2']).toBe(666_67);
    expect(after.people.find((p) => p.id === 'd')!.due).toBe(0);
  });

  it('pes no configurat = proporcional a les nits', () => {
    const pricing: Pricing = { ...DEFAULT_PRICING, stayUnits: { '2': 1 } };
    expect(stayUnits(pricing, 1, 2)).toBe(0.5);
    expect(stayUnits(pricing, 3, 3)).toBe(1.5);
  });
});

describe('regles de repartiment per etiquetes', () => {
  const people = [person('a', N2, ['no beu']), person('b'), person('c', N2, ['vegà']), person('d', N1)];
  it('alcohol excepte «no beu», carn excepte «vegà», per nits', () => {
    const s = computeMoney(
      input({
        people,
        lines: [
          line({ id: 'alcohol', planned: 90_00, scope: { kind: 'withoutTags', tags: ['No Beu'] } }),
          line({ id: 'carn', planned: 50_00, method: 'nights', scope: { kind: 'withoutTags', tags: ['vegà'] } }),
          line({ id: 'cava', planned: 10_00, scope: { kind: 'people', ids: ['a', 'b'] } }),
          line({ id: 'tofu', planned: 7_00, scope: { kind: 'withTags', tags: ['vegà'] } }),
        ],
      }),
    );
    const by = Object.fromEntries(s.people.map((p) => [p.id, p.shares]));
    expect(by.a).toEqual({ carn: 20_00, cava: 5_00 });
    expect(by.b).toEqual({ alcohol: 30_00, carn: 20_00, cava: 5_00 });
    expect(by.c).toEqual({ alcohol: 30_00, tofu: 7_00 });
    expect(by.d).toEqual({ alcohol: 30_00, carn: 10_00 });
  });

  it('una partida sense ningú dins queda sense repartir i es marca', () => {
    const s = computeMoney(input({ people, lines: [line({ id: 'x', planned: 40_00, scope: { kind: 'withTags', tags: ['celíac'] } })] }));
    expect(s.totals.unallocated).toBe(40_00);
    expect(s.totals.surplus).toBe(-40_00);
  });
});

describe('previst vs real', () => {
  const people = [person('a'), person('b')];
  it('oberta: reparteix el màxim entre previst i gastat; tancada: el real', () => {
    const lines = [line({ id: 'menjar', planned: 100_00 })];
    const exp = (amount: number) => ({ id: 'e', date: '2027-01-20', concept: 'Súper', amount, lineId: 'menjar', paidBy: 'organizer', note: '' });
    expect(computeMoney(input({ people, lines, expenses: [exp(60_00)] })).lines[0]).toMatchObject({ allocated: 100_00, spent: 60_00, remaining: 40_00 });
    expect(computeMoney(input({ people, lines, expenses: [exp(130_00)] })).lines[0]).toMatchObject({ allocated: 130_00, remaining: -30_00 });
    const closed = computeMoney(input({ people, lines: [{ ...lines[0], closed: true }], expenses: [exp(60_00)] }));
    expect(closed.lines[0].allocated).toBe(60_00);
    expect(closed.people.map((p) => p.due)).toEqual([30_00, 30_00]);
  });
});

describe('pagaments, saldos i preu comunicat', () => {
  const people = [person('a'), person('b'), person('c', N1), person('z', N2, [], false)];
  const lines = [
    line({ id: 'casa', planned: 2000_00, method: 'stay' }),
    line({ id: 'alcohol', planned: 60_00, scope: { kind: 'withoutTags', tags: ['no beu'] }, inAnnounced: false }),
  ];
  const pricing: Pricing = { ...DEFAULT_PRICING, mode: 'announced', announced: { '2': 800_00, '1': 500_00 } };

  it('amb preu comunicat es cobra el comunicat + les partides no incloses + ajustos', () => {
    const s = computeMoney(
      input({
        people,
        lines,
        pricing,
        adjustments: [{ id: 'j', participantId: 'b', amount: -50_00, reason: 'Porta la barbacoa' }],
        payments: [
          { id: 'p1', participantId: 'a', amount: 820_00, date: '2026-10-20', method: 'bizum', note: '' },
          { id: 'p2', participantId: 'b', amount: 100_00, date: '2026-10-21', method: 'bizum', note: 'paga i senyal' },
          { id: 'p3', participantId: 'z', amount: 50_00, date: '2026-10-21', method: 'bizum', note: '' },
        ],
      }),
    );
    const a = s.people.find((p) => p.id === 'a')!;
    const b = s.people.find((p) => p.id === 'b')!;
    const c = s.people.find((p) => p.id === 'c')!;
    expect(a).toMatchObject({ announced: 800_00, extras: 20_00, due: 820_00, balance: 0, status: 'pagat' });
    expect(b).toMatchObject({ due: 770_00, paid: 100_00, balance: -670_00, status: 'parcial' });
    expect(c).toMatchObject({ announced: 500_00, due: 520_00, status: 'pendent' });
    // calculat: 2000/2,6 = 769,23 per a 2 nits → amb 800 € comunicats hi ha superàvit
    expect(s.reference['2']).toBe(769_23);
    expect(s.totals.surplus).toBe(820_00 + 770_00 + 520_00 - 2060_00);
    expect(s.paidButNotAttending.map((p) => p.id)).toEqual(['z']);
    expect(s.totals.toRefund).toBe(50_00);
  });

  it('una despesa avançada per un participant li compta com a pagada i no surt de la caixa', () => {
    const s = computeMoney(
      input({
        people: [person('a'), person('b')],
        lines: [line({ id: 'menjar', planned: 0 })],
        expenses: [
          { id: 'e1', date: '2027-01-21', concept: 'Súper', amount: 100_00, lineId: 'menjar', paidBy: 'a', note: '' },
          { id: 'e2', date: '2027-01-21', concept: 'Pa', amount: 20_00, lineId: 'menjar', paidBy: 'organizer', note: '' },
        ],
        payments: [{ id: 'p', participantId: 'b', amount: 60_00, date: '2027-01-21', method: 'efectiu', note: '' }],
      }),
    );
    const a = s.people.find((p) => p.id === 'a')!;
    expect(a).toMatchObject({ due: 60_00, expensesPaid: 100_00, balance: 40_00, status: 'a-retornar' });
    expect(s.totals.organizerCash).toBe(40_00); // 60 cobrats − 20 pagats
  });

  it('el total a cobrar quadra amb el cost en mode calculat', () => {
    const many = Array.from({ length: 41 }, (_, i) => person(`p${String(i).padStart(2, '0')}`, i % 5 === 0 ? N1 : N2, i % 7 === 0 ? ['no beu'] : []));
    const s = computeMoney(input({ people: many, lines: defaultBudgetLines().map((l, i) => ({ ...l, planned: [2333_33, 801_01, 299_99, 77_77][i] })) }));
    expect(s.totals.due).toBe(s.totals.cost);
    expect(s.totals.surplus).toBe(0);
  });
});

describe('lectura d’imports i dates', () => {
  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45.50', 4550],
    ['1.234,56 €', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['-20', -2000],
    ['−20 €', -2000],
    ['abc', null],
    ['', null],
  ])('%s → %s', (txt, cents) => expect(parseEuros(txt)).toBe(cents));
  it('dates', () => {
    expect(parseDate('26/10/2026')).toBe('2026-10-26');
    expect(parseDate('3/1/27')).toBe('2027-01-03');
    expect(parseDate('2026-10-26')).toBe('2026-10-26');
    expect(parseDate('32/1/2027')).toBeNull();
  });
});

describe('importació des de l’Excel', () => {
  const people = [
    { id: 'a', name: 'Anna Puig' },
    { id: 'b', name: 'Bernat' },
    { id: 'm1', name: 'Marc Soler' },
    { id: 'm2', name: 'Marc Vidal' },
  ];
  it('pagaments amb capçalera en qualsevol ordre', () => {
    const r = parsePaymentsPaste('Data\tNom\tImport\tMètode\n20/10/2026\tanna\t45,00 €\tBizum\n21/10/2026\tBernat\t20\ttransf\n\tMarc\t10\t\n\tQuim\t10', people, { today: '2026-10-26' });
    expect(r.rows).toEqual([
      { participantId: 'a', amount: 4500, date: '2026-10-20', method: 'bizum', note: '' },
      { participantId: 'b', amount: 2000, date: '2026-10-21', method: 'transferencia', note: '' },
    ]);
    expect(r.issues.map((i) => i.line)).toEqual([4, 5]); // Marc és ambigu; Quim no hi és
  });
  it('pagaments sense capçalera: Nom, Import, Data', () => {
    const r = parsePaymentsPaste('Marc Vidal;30;1/11/2026', people, { today: '2026-10-26' });
    expect(r.rows[0]).toMatchObject({ participantId: 'm2', amount: 3000, date: '2026-11-01', method: 'bizum' });
  });
  it('despeses: partida per nom i pagat per un participant', () => {
    const lines = defaultBudgetLines();
    const r = parseExpensesPaste(
      'Concepte\tImport\tPartida\tPagat per\nPaga i senyal casa\t500\tcasa\t\nCerveses\t62,40\tAlcohol\tBernat\nGlobus\t8\tDecoració\tjo',
      lines,
      people,
      { today: '2026-10-26', defaultLineId: 'activitats' },
    );
    expect(r.rows.map((x) => [x.concept, x.amount, x.lineId, x.paidBy])).toEqual([
      ['Paga i senyal casa', 50000, 'casa', 'organizer'],
      ['Cerveses', 6240, 'alcohol', 'b'],
      ['Globus', 800, 'activitats', 'organizer'],
    ]);
    expect(r.warnings).toHaveLength(1); // «Decoració» no existeix exactament
  });
});
