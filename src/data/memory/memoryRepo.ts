/**
 * Implementació en memòria dels ports. Serveix per al mode demo (`npm run dev:demo`)
 * i per provar la UI sense Firebase. Les dades es guarden a sessionStorage.
 */
import { generateToken } from '../../domain/tokens';
import { slugId } from '../../domain/text';
import type { Answers, Edition, Group, Invite, Participant, PublicEdition, QuizResponse, Reveal } from '../../domain/types';
import type { AdminRepo, AdminUser, PublicRepo, ResponseWithToken, Unsubscribe } from '../ports';
import { newEdition, newGroups, newPublicEdition, normalizePublicEdition } from '../defaults';
import { buildReveals, hashReveals } from '../../domain/groups/reveals';
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
  user: AdminUser | null;
}

const KEY = 'web-cumple-demo-store-v4';
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
    user: null,
  };
  // demo: portada activa amb compte enrere de 3 dies
  pub.lobby = { ...pub.lobby, surveyOpen: false, endsAt: Date.now() + 3 * 86400_000 + 5 * 3600_000, attendance: buildAttendance(Object.values(participants)) };
  const built = buildReveals(editionId, Object.values(participants), Object.values(groups));
  store.reveals = built.reveals;
  edition.publishedHash = hashReveals(built.reveals);
  edition.publishedAt = Date.now();
  edition.publishedTokens = Object.keys(built.reveals);
  return store;
}

export class MemoryRepo implements PublicRepo, AdminRepo {
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
  async publishReveals(editionId: string, reveals: Record<string, Reveal>, stale: string[], hash: string) {
    await delay(400);
    for (const t of stale) delete this.store.reveals[t];
    Object.assign(this.store.reveals, clone(reveals));
    const e = this.store.editions[editionId];
    e.publishedHash = hash;
    e.publishedAt = Date.now();
    e.publishedTokens = Object.keys(reveals);
    this.commit();
  }
  async resetResponse(token: string) {
    delete this.store.responses[token];
    this.commit();
  }

  /** Només demo: torna a l'estat inicial. */
  reset() {
    this.store = seed(this.defaultEditionId);
    this.commit();
  }
}
