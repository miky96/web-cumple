import type { BudgetLine, Pricing, SplitScope } from './types';

export const DEFAULT_PRICING: Pricing = {
  stayUnits: { '1': 0.6, '2': 1 },
  announced: {},
  mode: 'calculated',
  snapshots: [],
};

export function normalizePricing(data: Partial<Pricing> | undefined | null): Pricing {
  return {
    stayUnits: data?.stayUnits ?? { ...DEFAULT_PRICING.stayUnits },
    announced: data?.announced ?? {},
    mode: data?.mode === 'announced' ? 'announced' : 'calculated',
    snapshots: Array.isArray(data?.snapshots) ? data.snapshots : [],
  };
}

const ALL: SplitScope = { kind: 'all' };

export function normalizeLine(id: string, data: Partial<BudgetLine>): BudgetLine {
  return {
    id,
    name: data.name ?? 'Partida',
    planned: Number(data.planned) || 0,
    method: data.method === 'nights' || data.method === 'stay' ? data.method : 'equal',
    scope: data.scope ?? ALL,
    closed: data.closed ?? false,
    inAnnounced: data.inAnnounced ?? true,
    order: data.order ?? 0,
  };
}

/** Partides per començar. Es poden editar o esborrar. */
export function defaultBudgetLines(): BudgetLine[] {
  const base = { planned: 0, closed: false, inAnnounced: true };
  return [
    { ...base, id: 'casa', name: 'Casa', method: 'stay', scope: ALL, order: 0 },
    { ...base, id: 'menjar', name: 'Menjar', method: 'nights', scope: ALL, order: 1 },
    { ...base, id: 'alcohol', name: 'Alcohol', method: 'equal', scope: { kind: 'withoutTags', tags: ['no beu'] }, order: 2 },
    { ...base, id: 'activitats', name: 'Activitats i decoració', method: 'equal', scope: ALL, order: 3 },
  ];
}

export const METHOD_LABELS = { equal: 'A parts iguals', nights: 'Per nits', stay: "Per pes d'estada" } as const;
export const PAYMENT_METHOD_LABELS = { bizum: 'Bizum', transferencia: 'Transferència', efectiu: 'Efectiu', altre: 'Altre' } as const;
export const STATUS_LABELS = {
  'sense-carrec': 'Sense càrrec',
  pendent: 'Pendent',
  parcial: 'Parcial',
  pagat: 'Pagat',
  'a-retornar': 'A retornar',
} as const;

export function scopeLabel(scope: SplitScope, nameOf: (id: string) => string = (id) => id): string {
  switch (scope.kind) {
    case 'all':
      return 'Tothom';
    case 'withTags':
      return `Només ${scope.tags.join(', ') || '—'}`;
    case 'withoutTags':
      return `Tothom excepte ${scope.tags.join(', ') || '—'}`;
    case 'people':
      return scope.ids.length <= 3 ? scope.ids.map(nameOf).join(', ') || 'Ningú' : `${scope.ids.length} persones`;
  }
}
