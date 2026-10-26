/**
 * Implementació en memòria dels ports. Serveix per al mode demo (`npm run dev:demo`)
 * i per provar la UI sense Firebase. Les dades es guarden a sessionStorage.
 */
import { generateToken } from '../../domain/tokens';
import { slugId } from '../../domain/text';
import type { Answers, Edition, Group, Invite, MateCard, Participant, PublicEdition, QuizResponse, Reveal, RevealedMate } from '../../domain/types';
import type { AdminRepo, AdminUser, MoneyCol, MoneyCollections, MoneyRepo, Publication, PublicRepo, ResponseWithToken, Unsubscribe } from '../ports';
import { defaultBudgetLines, DEFAULT_PRICING, normalizePricing } from '../../domain/money/defaults';
import type { Pricing } from '../../domain/money/types';
import { newEdition, newGroups, newPublicEdition, normalizePublicEdition } from '../defaults';
import { buildReveals, hashReveals, memberKey, sortRevealedMates } from '../../domain/groups/reveals';
import { buildAttendance } from '../../domain/lobby/lobby';
import type { ImportRow } from '../../domain/people/importList';

export const DEMO_TOKEN = 'DemoTotemDemoTotem2027';

interface Store {
  editions: Record<string, Edition>;
  publicEditions: Record<string, PublicEdition>;
  participants: Record<string, Record<string, Participant>>;
  groups: Record<string, Record<string, Group>>;
  invites: Record<string, Invite>;
  responses: Record<string, QuizResponse>;
  reveals: Record<string, Reveal>;
  mateCards: Record<string, MateCard>;
  /** clau → instant en què va contestar (null = encara no). */
  mateStatus: Record<string, number | null>;
  money: Record<string, MoneyStore>;
  user: AdminUser | null;
}

type MoneyStore = { [K in MoneyCol]: Record<string, MoneyCollections[K]> } & { pricing: Pricing };

const emptyMoney = (): MoneyStore => ({ budgetLines: {}, expenses: {}, payments: {}, adjustments: {}, pricing: clone(DEFAULT_PRICING) });

/** Demo: un pressupost a mig fer, amb paga i senyal d'alguns participants i les primeres compres. */
function seedMoney(people: Participant[]): MoneyStore {
  const m = emptyMoney();
  const planned: Record<string, number> = { casa: 1800_00, menjar: 450_00, alcohol: 250_00, activitats: 90_00 };
  for (const l of defaultBudgetLines()) m.budgetLines[l.id] = { ...l, planned: planned[l.id] ?? 0 };
  m.pricing = { ...m.pricing, mode: 'announced', announced: { '1': 120_00, '2': 190_00 } };
  const add = <K extends MoneyCol>(col: K, d: MoneyCollections[K]) => ((m[col] as Record<string, MoneyCollections[K]>)[d.id] = d);
  add('expenses', { id: 'e1', date: '2026-10-05', concept: 'Paga i senyal de la casa', amount: 800_00, lineId: 'casa', paidBy: 'organizer', note: '' });
  add('expenses', { id: 'e2', date: '2026-10-20', concept: 'Llums i garlandes', amount: 34_90, lineId: 'activitats', paidBy: 'organizer', note: 'Amazon' });
  add('expenses', { id: 'e3', date: '2026-10-22', concept: 'Ampolles de gin', amount: 64_50, lineId: 'alcohol', paidBy: people[1]?.id ?? 'organizer', note: '' });
  people.slice(0, 12).forEach((p, i) =>
    add('payments', { id: `pay${i}`, participantId: p.id, amount: i % 3 === 0 ? 190_00 : 50_00, date: `2026-10-${String(10 + i).padStart(2, '0')}`, method: i % 4 === 0 ? 'transferencia' : 'bizum', note: i % 3 === 0 ? '' : 'Paga i senyal' }),
  );
  return m;
}

const KEY = 'web-cumple-demo-store-v6';
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const DEMO_NAMES = [
  'Anna', 'Bernat', 'Carla', 'David', 'Elna', 'Ferran', 'Gemma', 'Hug', 'Irene', 'Jordi',
  'Laia', 'Marc', 'Núria', 'Oriol', 'Paula', 'Quim', 'Roser', 'Sergi', 'Txell', 'Uri',
];

function seed(editionId: string): Store {
  const edition = newEdition(editionId);
  const pub = newPublicEdition(editionId);
  const groups = Object.fromEntries(newGroups().map((g) => [g.id, g]));
  groups.g3.image = '/editions/2027/pixar.webp'; // exemple de fons personalitzat
  const gids = Object.keys(groups);
  const participants: Record<string, Participant> = {};
  const invites: Record<string, Invite> = {};
  [...DEMO_NAMES, 'Miquel'].forEach((name, i) => {
    const id = `p${i + 1}`;
    const token = name === 'Miquel' ? DEMO_TOKEN : generateToken();
    participants[id] = {
      id,
      personId: id,
      name,
      nights: i % 5 === 0 ? [edition.nights[1]] : [...edition.nights],
      tags: i % 4 === 0 ? ['vegà'] : i % 7 === 0 ? ['no beu'] : [],
      notes: '',
      token,
      groupId: i < 18 || name === 'Miquel' ? gids[i % gids.length] : null,
      confirmed: i % 3 !== 2,
    };
    invites[token] = { editionId, displayName: name };
  });
  const store: Store = {
    editions: { [editionId]: edition },
    publicEditions: { [editionId]: pub },
    participants: { [editionId]: participants },
    groups: { [editionId]: groups },
    invites,
    responses: {},
    reveals: {},
    mateCards: {},
    mateStatus: {},
    money: { [editionId]: seedMoney(Object.values(participants)) },
    user: null,
  };
  // demo: portada activa amb compte enrere de 3 dies
  pub.lobby = { ...pub.lobby, surveyOpen: false, endsAt: Date.now() + 3 * 86400_000 + 5 * 3600_000, attendance: buildAttendance(Object.values(participants)) };
  const built = buildReveals(editionId, Object.values(participants), Object.values(groups));
  store.reveals = built.reveals;
  store.mateCards = built.cards;
  // demo: alguns companys ja han contestat (la resta apareixeran a mesura que juguin)
  const t0 = Date.now() - 3600_000;
  Object.keys(built.cards).forEach((k, i) => (store.mateStatus[k] = i % 3 === 0 ? t0 + i * 60_000 : null));
  edition.publishedHash = hashReveals(built);
  edition.publishedAt = Date.now();
  edition.publishedTokens = Object.keys(built.reveals);
  return store;
}

export class MemoryRepo implements PublicRepo, AdminRepo, MoneyRepo {
  private store: Store;
  private listeners = new Set<() => void>();

  constructor(private readonly defaultEditionId: string) {
    let loaded: Store | null = null;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) loaded = JSON.parse(raw) as Store;
    } catch {
      /* sense storage: comencem de zero */
    }
    this.store = loaded ?? seed(defaultEditionId);
    if (!loaded) this.persist();
  }

  private persist() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.store));
    } catch {
      /* ignora */
    }
  }

  private commit() {
    this.persist();
    for (const l of this.listeners) l();
  }

  private watch<T>(read: () => T, cb: (v: T) => void): Unsubscribe {
    const fn = () => cb(clone(read()));
    this.listeners.add(fn);
    queueMicrotask(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- PublicRepo ----------
  async getInvite(token: string) {
    await delay();
    return clone(this.store.invites[token] ?? null);
  }
  async getPublicEdition(editionId: string) {
    await delay();
    const e = this.store.publicEditions[editionId];
    return e ? normalizePublicEdition(editionId, clone(e)) : null;
  }
  async getResponse(token: string) {
    await delay();
    return clone(this.store.responses[token] ?? null);
  }
  async submitResponse(token: string, editionId: string, answers: Answers) {
    await delay(300);
    if (!this.store.invites[token]) throw new Error('Invitació desconeguda');
    if (!this.store.publicEditions[editionId]?.lobby?.surveyOpen) throw new Error("L'enquesta encara no és oberta");
    this.store.responses[token] = { editionId, answers: clone(answers), completedAt: Date.now() };
    this.commit();
  }
  async getReveal(token: string) {
    await delay();
    if (!this.store.responses[token]) return null; // imita les rules
    return clone(this.store.reveals[token] ?? null);
  }

  async markAnswered(selfKey: string) {
    if (selfKey in this.store.mateStatus && this.store.mateStatus[selfKey] === null) {
      this.store.mateStatus[selfKey] = Date.now();
      this.commit();
    }
  }
  watchRevealedMates(mateKeys: string[], cb: (mates: RevealedMate[]) => void) {
    return this.watch(
      () =>
        sortRevealedMates(
          mateKeys.flatMap((key) => {
            const at = this.store.mateStatus[key];
            const card = this.store.mateCards[key];
            return at != null && card ? [{ key, name: card.name, answeredAt: at }] : [];
          }),
        ),
      cb,
    );
  }

  // ---------- AdminRepo ----------
  onAuthChange(cb: (u: AdminUser | null) => void) {
    return this.watch(() => this.store.user, cb);
  }
  async signIn() {
    this.store.user = { email: 'demo@totem.cat', name: 'Admin demo' };
    this.commit();
  }
  async signOut() {
    this.store.user = null;
    this.commit();
  }

  async ensureEdition(editionId: string) {
    if (!this.store.editions[editionId]) {
      this.store.editions[editionId] = newEdition(editionId);
      this.store.publicEditions[editionId] = newPublicEdition(editionId);
      this.store.groups[editionId] = Object.fromEntries(newGroups().map((g) => [g.id, g]));
      this.store.participants[editionId] = {};
      this.commit();
    }
  }
  watchEdition(id: string, cb: (e: Edition | null) => void) {
    return this.watch(() => this.store.editions[id] ?? null, cb);
  }
  watchPublicEdition(id: string, cb: (e: PublicEdition | null) => void) {
    return this.watch(() => this.store.publicEditions[id] ?? null, (e) => cb(e ? normalizePublicEdition(id, e) : null));
  }
  watchParticipants(id: string, cb: (ps: Participant[]) => void) {
    return this.watch(() => Object.values(this.store.participants[id] ?? {}), cb);
  }
  watchGroups(id: string, cb: (gs: Group[]) => void) {
    return this.watch(() => Object.values(this.store.groups[id] ?? {}).sort((a, b) => a.order - b.order), cb);
  }
  watchResponses(id: string, cb: (rs: ResponseWithToken[]) => void) {
    return this.watch(
      () =>
        Object.entries(this.store.responses)
          .filter(([, r]) => r.editionId === id)
          .map(([token, r]) => ({ token, ...r })),
      cb,
    );
  }

  async updateEdition(id: string, patch: Partial<Pick<Edition, 'title' | 'nights'>>) {
    Object.assign(this.store.editions[id], patch);
    this.commit();
  }
  async savePublicEdition(id: string, patch: Partial<Omit<PublicEdition, 'id'>>) {
    Object.assign(this.store.publicEditions[id], clone(patch));
    this.commit();
  }

  async addParticipants(editionId: string, rows: ImportRow[], nights: string[]) {
    const ps = (this.store.participants[editionId] ??= {});
    for (const row of rows) {
      const id = slugId('p');
      const token = generateToken();
      ps[id] = { id, personId: id, name: row.name, nights: [...nights], tags: row.tags, notes: '', token, groupId: null, confirmed: false };
      this.store.invites[token] = { editionId, displayName: row.name };
    }
    this.commit();
  }
  async updateParticipant(editionId: string, p: Participant, patch: Partial<Participant>) {
    const cur = this.store.participants[editionId][p.id];
    Object.assign(cur, patch);
    if (patch.name) this.store.invites[cur.token].displayName = patch.name;
    this.commit();
  }
  async removeParticipant(editionId: string, p: Participant) {
    delete this.store.participants[editionId][p.id];
    delete this.store.invites[p.token];
    delete this.store.responses[p.token];
    delete this.store.reveals[p.token];
    delete this.store.mateCards[memberKey(editionId, p.id)];
    delete this.store.mateStatus[memberKey(editionId, p.id)];
    this.commit();
  }
  async regenerateToken(editionId: string, p: Participant) {
    const cur = this.store.participants[editionId][p.id];
    delete this.store.invites[cur.token];
    delete this.store.reveals[cur.token];
    const response = this.store.responses[cur.token];
    delete this.store.responses[cur.token];
    cur.token = generateToken();
    this.store.invites[cur.token] = { editionId, displayName: cur.name };
    if (response) this.store.responses[cur.token] = response;
    this.commit();
  }
  async setGroups(editionId: string, assignments: Record<string, string | null>) {
    for (const [pid, gid] of Object.entries(assignments)) {
      const p = this.store.participants[editionId][pid];
      if (p) p.groupId = gid;
    }
    this.commit();
  }
  async saveGroup(editionId: string, g: Group) {
    this.store.groups[editionId][g.id] = clone(g);
    this.commit();
  }
  async deleteGroup(editionId: string, groupId: string, memberIds: string[]) {
    delete this.store.groups[editionId][groupId];
    for (const id of memberIds) {
      const p = this.store.participants[editionId][id];
      if (p) p.groupId = null;
    }
    this.commit();
  }
  async publishReveals(editionId: string, pub: Publication) {
    await delay(400);
    for (const t of pub.staleTokens) delete this.store.reveals[t];
    Object.assign(this.store.reveals, clone(pub.reveals));
    Object.assign(this.store.mateCards, clone(pub.cards));
    for (const k of Object.keys(pub.cards)) {
      if (this.store.mateStatus[k] != null) continue;
      this.store.mateStatus[k] = k in pub.answered ? pub.answered[k] || Date.now() : null;
    }
    const e = this.store.editions[editionId];
    e.publishedHash = pub.hash;
    e.publishedAt = Date.now();
    e.publishedTokens = Object.keys(pub.reveals);
    this.commit();
  }
  async resetResponse(editionId: string, p: Participant) {
    delete this.store.responses[p.token];
    this.store.mateStatus[memberKey(editionId, p.id)] = null;
    this.commit();
  }

  // ---------- Diners ----------
  private moneyOf(editionId: string): MoneyStore {
    return (this.store.money[editionId] ??= emptyMoney());
  }
  watchMoney<K extends MoneyCol>(editionId: string, col: K, cb: (docs: MoneyCollections[K][]) => void) {
    return this.watch(() => Object.values(this.moneyOf(editionId)[col]) as MoneyCollections[K][], cb);
  }
  async saveMoneyDocs<K extends MoneyCol>(editionId: string, col: K, docs: MoneyCollections[K][]) {
    const target = this.moneyOf(editionId)[col] as Record<string, MoneyCollections[K]>;
    for (const d of docs) target[d.id] = clone(d);
    this.commit();
  }
  async deleteMoneyDoc(editionId: string, col: MoneyCol, id: string) {
    delete this.moneyOf(editionId)[col][id];
    this.commit();
  }
  watchPricing(editionId: string, cb: (p: Pricing) => void) {
    return this.watch(() => this.moneyOf(editionId).pricing, (p) => cb(normalizePricing(p)));
  }
  async savePricing(editionId: string, patch: Partial<Pricing>) {
    const m = this.moneyOf(editionId);
    m.pricing = { ...m.pricing, ...clone(patch) };
    this.commit();
  }

  /** Només demo: torna a l'estat inicial. */
  reset() {
    this.store = seed(this.defaultEditionId);
    this.commit();
  }
}
