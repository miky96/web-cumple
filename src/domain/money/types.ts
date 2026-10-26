/**
 * Tipus del mòdul de diners. Tots els imports són en cèntims (enters) per evitar errors de coma flotant.
 */

export type Cents = number;

/** Com es reparteix una partida entre les persones que hi entren. */
export type SplitMethod =
  /** Tothom paga el mateix. */
  | 'equal'
  /** Proporcional al nombre de nits. */
  | 'nights'
  /** Proporcional al pes de l'estada (ex. 1 nit = 0,6 d'una estada de 2 nits). */
  | 'stay';

/** Qui entra al repartiment d'una partida. */
export type SplitScope =
  | { kind: 'all' }
  /** Només qui té alguna d'aquestes etiquetes. */
  | { kind: 'withTags'; tags: string[] }
  /** Tothom excepte qui té alguna d'aquestes etiquetes. */
  | { kind: 'withoutTags'; tags: string[] }
  /** Llista explícita de participants. */
  | { kind: 'people'; ids: string[] };

/** Partida del pressupost (Casa, Menjar, Alcohol...). Les despeses s'hi imputen. */
export interface BudgetLine {
  id: string;
  name: string;
  /** Import previst. */
  planned: Cents;
  method: SplitMethod;
  scope: SplitScope;
  /**
   * Tancada: ja no hi haurà més despeses i es reparteix el gastat real.
   * Oberta: es reparteix el més gran entre el previst i el gastat.
   */
  closed: boolean;
  /** Inclosa al preu comunicat. Si no, es cobra a part (ex. alcohol només per a qui beu). */
  inAnnounced: boolean;
  order: number;
}

export type PaidBy = 'organizer' | string; // string = id de participant

export interface Expense {
  id: string;
  /** Data ISO (YYYY-MM-DD). */
  date: string;
  concept: string;
  amount: Cents;
  lineId: string;
  /** Si l'ha pagat un participant, li compta com a pagament seu. */
  paidBy: PaidBy;
  note: string;
}

export type PaymentMethod = 'bizum' | 'transferencia' | 'efectiu' | 'altre';

export interface Payment {
  id: string;
  participantId: string;
  /** Positiu = ens paga; negatiu = li retornem diners. */
  amount: Cents;
  date: string;
  method: PaymentMethod;
  note: string;
}

/** Ajust manual per persona: positiu = càrrec extra, negatiu = descompte. */
export interface Adjustment {
  id: string;
  participantId: string;
  amount: Cents;
  reason: string;
}

export type PricingMode = 'calculated' | 'announced';

export interface PriceSnapshot {
  at: number;
  attendees: number;
  /** Preu de referència calculat per nombre de nits ("1", "2"...). */
  reference: Record<string, Cents>;
  note: string;
}

export interface Pricing {
  /** Pes de l'estada segons el nombre de nits: { "1": 0.6, "2": 1 }. */
  stayUnits: Record<string, number>;
  /** Preu comunicat a la gent segons el nombre de nits: { "2": 4500 }. */
  announced: Record<string, Cents>;
  /** calculated: es cobra el calculat. announced: es cobra el preu comunicat (+ les partides que no hi són incloses). */
  mode: PricingMode;
  snapshots: PriceSnapshot[];
}

/** Dades mínimes d'un participant que necessita el motor. */
export interface MoneyPerson {
  id: string;
  name: string;
  nights: string[];
  tags: string[];
  confirmed: boolean;
}

export interface MoneyInput {
  people: MoneyPerson[];
  lines: BudgetLine[];
  expenses: Expense[];
  payments: Payment[];
  adjustments: Adjustment[];
  pricing: Pricing;
}

export type PersonStatus = 'sense-carrec' | 'pendent' | 'parcial' | 'pagat' | 'a-retornar';

export interface PersonSummary {
  id: string;
  name: string;
  nightsCount: number;
  /** Entra al repartiment (confirmat i almenys una nit). */
  attending: boolean;
  /** Part calculada de cada partida (id → cèntims). */
  shares: Record<string, Cents>;
  /** Suma de les partides incloses al preu comunicat (calculat). */
  includedCalculated: Cents;
  /** Preu comunicat que se li aplica (null si no n'hi ha o el mode és calculat). */
  announced: Cents | null;
  /** Partides no incloses al preu comunicat. */
  extras: Cents;
  adjustments: Cents;
  due: Cents;
  payments: Cents;
  /** Despeses que ha avançat ell. */
  expensesPaid: Cents;
  paid: Cents;
  /** paid − due. Negatiu = ens deu; positiu = li hem de tornar. */
  balance: Cents;
  status: PersonStatus;
}

export interface LineSummary {
  line: BudgetLine;
  spent: Cents;
  /** El que es reparteix ara mateix. */
  allocated: Cents;
  /** Persones que hi entren. */
  members: number;
  /** El que queda per gastar respecte al previst (pot ser negatiu si ens hem passat). */
  remaining: Cents;
}

export interface MoneySummary {
  people: PersonSummary[];
  lines: LineSummary[];
  /** Despeses imputades a partides que ja no existeixen. */
  orphanExpenses: Expense[];
  totals: {
    planned: Cents;
    spent: Cents;
    /** Cost que es reparteix (Σ allocated). */
    cost: Cents;
    /** Partides sense ningú dins: no es poden repartir. */
    unallocated: Cents;
    due: Cents;
    paid: Cents;
    /** Pagaments rebuts (sense les despeses avançades). */
    collected: Cents;
    /** Σ del que encara deu la gent. */
    pending: Cents;
    /** Σ del que s'ha de retornar. */
    toRefund: Cents;
    /** due − cost: positiu = superàvit, negatiu = dèficit. */
    surplus: Cents;
    /** Diners que ha de tenir l'organitzador: cobrat − despeses que ha pagat ell. */
    organizerCash: Cents;
    attendees: number;
  };
  /** Preu calculat per a una persona sense etiquetes, segons el nombre de nits. */
  reference: Record<string, Cents>;
  /** Persones que han pagat alguna cosa però no entren al repartiment. */
  paidButNotAttending: PersonSummary[];
}
