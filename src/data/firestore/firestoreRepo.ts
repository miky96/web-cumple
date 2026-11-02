import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { ImportRow } from '../../domain/people/importList';
import { generateToken } from '../../domain/tokens';
import type {
  Answers,
  Contact,
  Edition,
  Group,
  Invite,
  LinkedAccount,
  Participant,
  PublicEdition,
  QuizResponse,
  Reveal,
  RevealedMate,
} from '../../domain/types';
import { memberKey, sortRevealedMates } from '../../domain/groups/reveals';
import { hasEmbeddedEmail, splitProfileEmail } from '../../domain/people/contact';
import type { ArcadeBoard } from '../../domain/arcade/arcade';
import { normalizeLine, normalizePricing } from '../../domain/money/defaults';
import type { Pricing } from '../../domain/money/types';
import { newEdition, newGroups, newPublicEdition, normalizePublicEdition } from '../defaults';
import { reportRepoError } from '../errors';
import type { AdminRepo, ArcadeImport, AuthUser, LeaderboardRow, MoneyCol, MoneyCollections, MoneyRepo, Publication, PublicRepo, ResponseWithToken, Unsubscribe } from '../ports';
import { getFirebaseApp } from './firebaseApp';

const toMillis = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : null);

/** Firestore no accepta `undefined`: el netegem. */
function clean<T extends object>(obj: T): DocumentData {
  return JSON.parse(JSON.stringify(obj)) as DocumentData;
}

export class FirestoreRepo implements PublicRepo, AdminRepo, MoneyRepo {
  private readonly db: Firestore;

  private readonly auth: Auth;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
    this.auth = getAuth(getFirebaseApp());
    this.auth.languageCode = 'ca'; // correus de restablir contrasenya en català
  }

  // ---------- refs ----------
  private editionRef = (e: string) => doc(this.db, 'editions', e);
  private publicEditionRef = (e: string) => doc(this.db, 'publicEditions', e);
  private participantsCol = (e: string) => collection(this.db, 'editions', e, 'participants');
  private participantRef = (e: string, id: string) => doc(this.db, 'editions', e, 'participants', id);
  private groupsCol = (e: string) => collection(this.db, 'editions', e, 'groups');
  private groupRef = (e: string, id: string) => doc(this.db, 'editions', e, 'groups', id);
  private inviteRef = (t: string) => doc(this.db, 'invites', t);
  private responseRef = (t: string) => doc(this.db, 'responses', t);
  private revealRef = (t: string) => doc(this.db, 'reveals', t);
  private personRef = (id: string) => doc(this.db, 'people', id);
  private mateStatusRef = (k: string) => doc(this.db, 'mateStatus', k);
  private mateCardRef = (k: string) => doc(this.db, 'mateCards', k);
  private contactRef = (t: string) => doc(this.db, 'contacts', t);
  private accountRef = (uid: string) => doc(this.db, 'accounts', uid);
  private arcadeRef = (t: string) => doc(this.db, 'arcade', t);
  private leaderboardRef = (uid: string) => doc(this.db, 'leaderboard', uid);
  private moneyCol = (e: string, col: MoneyCol) => collection(this.db, 'editions', e, col);
  private pricingRef = (e: string) => doc(this.db, 'editions', e, 'money', 'pricing');

  // ---------- PublicRepo ----------
  async getInvite(token: string): Promise<Invite | null> {
    try {
      const s = await getDoc(this.inviteRef(token));
      return s.exists() ? (s.data() as Invite) : null;
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') return null;
      throw e;
    }
  }

  async getPublicEdition(editionId: string): Promise<PublicEdition | null> {
    const s = await getDoc(this.publicEditionRef(editionId));
    return s.exists() ? normalizePublicEdition(s.id, s.data() as Partial<PublicEdition>) : null;
  }

  async getResponse(token: string): Promise<QuizResponse | null> {
    const s = await getDoc(this.responseRef(token));
    if (!s.exists()) return null;
    const d = s.data();
    return { editionId: d.editionId, answers: d.answers ?? {}, completedAt: toMillis(d.completedAt) };
  }

  /** Crea o substitueix la resposta (repetir el qüestionari). */
  async submitResponse(token: string, editionId: string, answers: Answers): Promise<void> {
    await setDoc(this.responseRef(token), { editionId, answers: clean(answers), completedAt: serverTimestamp() });
  }

  async getReveal(token: string): Promise<Reveal | null> {
    try {
      const s = await getDoc(this.revealRef(token));
      return s.exists() ? (s.data() as Reveal) : null;
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') return null;
      throw e;
    }
  }

  async markAnswered(selfKey: string): Promise<void> {
    try {
      const s = await getDoc(this.mateStatusRef(selfKey));
      // si encara no s'ha publicat amb claus, no hi ha res a marcar (ho farà l'admin en publicar)
      if (!s.exists() || s.data().answeredAt) return;
      await updateDoc(this.mateStatusRef(selfKey), { answeredAt: serverTimestamp() });
    } catch (e) {
      console.warn("No s'ha pogut marcar com a contestat", e);
    }
  }

  watchRevealedMates(mateKeys: string[], cb: (mates: RevealedMate[]) => void): Unsubscribe {
    const revealed = new Map<string, RevealedMate>();
    const names = new Map<string, Promise<string | null>>();
    let alive = true;
    const emit = () => alive && cb(sortRevealedMates([...revealed.values()]));
    const fetchName = (k: string) => {
      if (!names.has(k))
        names.set(
          k,
          getDoc(this.mateCardRef(k)).then(
            (c) => (c.exists() ? ((c.data() as { name?: string }).name ?? null) : null),
            () => (names.delete(k), null), // permís denegat: es tornarà a provar al següent canvi
          ),
        );
      return names.get(k)!;
    };
    const unsubs = mateKeys.map((k) =>
      onSnapshot(
        this.mateStatusRef(k),
        async (s) => {
          // estimate: el serverTimestamp encara pendent es veu com a hora local
          const at = s.exists() ? toMillis(s.get('answeredAt', { serverTimestamps: 'estimate' })) : null;
          if (at === null) {
            if (revealed.delete(k)) emit(); // l'admin li ha esborrat la resposta
            return;
          }
          const name = await fetchName(k);
          if (name) revealed.set(k, { key: k, name, answeredAt: at });
          emit();
        },
        (e) => console.warn('No es pot escoltar un company', e),
      ),
    );
    if (mateKeys.length === 0) queueMicrotask(emit);
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }

  // ---------- Auth ----------
  onAuthChange(cb: (u: AuthUser | null) => void): Unsubscribe {
    return onAuthStateChanged(this.auth, (u) =>
      cb(u ? { uid: u.uid, email: u.email ?? '', name: u.displayName ?? u.email ?? '' } : null),
    );
  }

  async signIn(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(this.auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(this.auth, provider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  // ---------- Comptes i contacte (participant) ----------
  async claimInvite(token: string, editionId: string): Promise<void> {
    const u = this.auth.currentUser;
    if (!u) throw new Error('Cal entrar amb un compte');
    // les rules exigeixen les dues escriptures juntes
    const batch = writeBatch(this.db);
    batch.update(this.inviteRef(token), { uid: u.uid });
    batch.set(this.accountRef(u.uid), { token, editionId, email: u.email ?? '', claimedAt: serverTimestamp() });
    await batch.commit();
  }

  async getMyAccount(): Promise<{ token: string; editionId: string } | null> {
    const u = this.auth.currentUser;
    if (!u) return null;
    try {
      const s = await getDoc(this.accountRef(u.uid));
      return s.exists() ? { token: s.data().token, editionId: s.data().editionId } : null;
    } catch {
      return null;
    }
  }

  async saveContact(token: string, editionId: string, email: string): Promise<void> {
    await setDoc(this.contactRef(token), { editionId, email: email.trim() });
  }

  async getArcade(token: string): Promise<ArcadeBoard> {
    const s = await getDoc(this.arcadeRef(token));
    return s.exists() ? ((s.data().scores ?? {}) as ArcadeBoard) : {};
  }

  async saveArcade(token: string, editionId: string, board: ArcadeBoard, leaderboardName: string | null): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(this.arcadeRef(token), { editionId, scores: clean(board) });
    const u = this.auth.currentUser;
    if (leaderboardName !== null && u) batch.set(this.leaderboardRef(u.uid), { editionId, name: leaderboardName, scores: clean(board) });
    await batch.commit();
  }

  watchLeaderboard(editionId: string, cb: (rows: LeaderboardRow[]) => void, onError?: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'leaderboard'), where('editionId', '==', editionId)),
      (qs) => cb(qs.docs.map((d) => ({ uid: d.id, name: d.data().name ?? '', board: (d.data().scores ?? {}) as ArcadeBoard }))),
      (e) => {
        console.warn('No es pot llegir el leaderboard', e);
        onError?.(e);
      },
    );
  }

  // ---------- Admin: lectures en temps real ----------
  async ensureEdition(editionId: string): Promise<void> {
    const s = await getDoc(this.editionRef(editionId));
    if (s.exists()) return;
    const { id: _e, ...edition } = newEdition(editionId);
    const { id: _p, ...pub } = newPublicEdition(editionId);
    const batch = writeBatch(this.db);
    batch.set(this.editionRef(editionId), clean(edition));
    batch.set(this.publicEditionRef(editionId), clean(pub));
    for (const g of newGroups()) {
      const { id, ...data } = g;
      batch.set(this.groupRef(editionId, id), clean(data));
    }
    await batch.commit();
  }

  watchEdition(editionId: string, cb: (e: Edition | null) => void): Unsubscribe {
    return onSnapshot(
      this.editionRef(editionId),
      (s) => {
        if (!s.exists()) return cb(null);
        const d = s.data();
        cb({
          id: s.id,
          title: d.title ?? '',
          nights: d.nights ?? [],
          publishedHash: d.publishedHash ?? null,
          publishedAt: toMillis(d.publishedAt),
          publishedTokens: d.publishedTokens ?? [],
        });
      },
      reportRepoError,
    );
  }

  watchPublicEdition(editionId: string, cb: (e: PublicEdition | null) => void): Unsubscribe {
    return onSnapshot(
      this.publicEditionRef(editionId),
      (s) => cb(s.exists() ? normalizePublicEdition(s.id, s.data() as Partial<PublicEdition>) : null),
      reportRepoError,
    );
  }

  watchParticipants(editionId: string, cb: (ps: Participant[]) => void): Unsubscribe {
    return onSnapshot(
      this.participantsCol(editionId),
      (qs) => cb(qs.docs.map((d) => ({ confirmed: false, id: d.id, ...d.data() }) as Participant)),
      reportRepoError,
    );
  }

  watchGroups(editionId: string, cb: (gs: Group[]) => void): Unsubscribe {
    return onSnapshot(
      this.groupsCol(editionId),
      (qs) => cb(qs.docs.map((d) => ({ id: d.id, ...d.data() }) as Group).sort((a, b) => a.order - b.order)),
      reportRepoError,
    );
  }

  watchResponses(editionId: string, cb: (rs: ResponseWithToken[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'responses'), where('editionId', '==', editionId)),
      (qs) =>
        cb(
          qs.docs.map((d) => {
            const x = d.data();
            return { token: d.id, editionId: x.editionId, answers: x.answers ?? {}, completedAt: toMillis(x.completedAt) };
          }),
        ),
      reportRepoError,
    );
  }

  watchAccounts(editionId: string, cb: (as: LinkedAccount[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'accounts'), where('editionId', '==', editionId)),
      (qs) =>
        cb(
          qs.docs.map((d) => {
            const x = d.data();
            return { uid: d.id, token: x.token, editionId: x.editionId, email: x.email ?? '', claimedAt: toMillis(x.claimedAt) };
          }),
        ),
      reportRepoError,
    );
  }

  watchContacts(editionId: string, cb: (cs: Contact[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'contacts'), where('editionId', '==', editionId)),
      (qs) => cb(qs.docs.map((d) => ({ token: d.id, editionId: d.data().editionId, email: d.data().email ?? '' }))),
      reportRepoError,
    );
  }

  watchArcade(editionId: string, cb: (boards: { token: string; board: ArcadeBoard }[]) => void): Unsubscribe {
    return onSnapshot(
      query(collection(this.db, 'arcade'), where('editionId', '==', editionId)),
      (qs) => cb(qs.docs.map((d) => ({ token: d.id, board: (d.data().scores ?? {}) as ArcadeBoard }))),
      reportRepoError,
    );
  }

  async saveArcadeBoards(editionId: string, entries: ArcadeImport[]): Promise<void> {
    for (let i = 0; i < entries.length; i += 200) {
      const batch = writeBatch(this.db);
      for (const e of entries.slice(i, i + 200)) {
        batch.set(this.arcadeRef(e.token), { editionId, scores: clean(e.board) });
        if (e.leaderboard) batch.set(this.leaderboardRef(e.leaderboard.uid), { editionId, name: e.leaderboard.name, scores: clean(e.board) });
      }
      await batch.commit();
    }
  }

  // ---------- Admin: escriptures ----------
  async updateEdition(editionId: string, patch: Partial<Pick<Edition, 'title' | 'nights'>>): Promise<void> {
    await updateDoc(this.editionRef(editionId), clean(patch));
  }

  async savePublicEdition(editionId: string, patch: Partial<Omit<PublicEdition, 'id'>>): Promise<void> {
    await setDoc(this.publicEditionRef(editionId), clean(patch), { merge: true });
  }

  async addParticipants(editionId: string, rows: ImportRow[], nights: string[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const row of rows) {
      const personRef = doc(collection(this.db, 'people'));
      const token = generateToken();
      batch.set(personRef, { name: row.name });
      batch.set(this.participantRef(editionId, personRef.id), {
        personId: personRef.id,
        name: row.name,
        nights,
        tags: row.tags,
        notes: '',
        token,
        groupId: null,
        confirmed: false,
      });
      batch.set(this.inviteRef(token), { editionId, displayName: row.name });
    }
    await batch.commit();
  }

  async updateParticipant(
    editionId: string,
    p: Participant,
    patch: Partial<Pick<Participant, 'name' | 'nights' | 'tags' | 'notes' | 'groupId' | 'confirmed'>>,
  ): Promise<void> {
    const batch = writeBatch(this.db);
    batch.update(this.participantRef(editionId, p.id), clean(patch));
    if (patch.name !== undefined && patch.name !== p.name) {
      batch.update(this.inviteRef(p.token), { displayName: patch.name });
      batch.set(this.personRef(p.personId), { name: patch.name }, { merge: true });
    }
    await batch.commit();
  }

  /** uid del compte que ha reclamat l'enllaç (si n'hi ha). */
  private async claimedUid(token: string): Promise<string | null> {
    const s = await getDoc(this.inviteRef(token));
    return s.exists() ? ((s.data() as Invite).uid ?? null) : null;
  }

  /** Esborra `accounts/{uid}` només si encara apunta a aquest enllaç. */
  private async releaseAccount(batch: ReturnType<typeof writeBatch>, token: string): Promise<void> {
    const uid = await this.claimedUid(token);
    if (!uid) return;
    const acc = await getDoc(this.accountRef(uid));
    if (acc.exists() && acc.data().token === token) {
      batch.delete(this.accountRef(uid));
      batch.delete(this.leaderboardRef(uid)); // es tornarà a publicar quan el nou propietari entri a la sala
    }
  }

  async unlinkAccount(_editionId: string, p: Participant): Promise<void> {
    const batch = writeBatch(this.db);
    await this.releaseAccount(batch, p.token);
    batch.update(this.inviteRef(p.token), { uid: deleteField() });
    await batch.commit();
  }

  async moveEmailsToContacts(editionId: string, rs: ResponseWithToken[]): Promise<number> {
    const moves = rs.filter((r) => hasEmbeddedEmail(r.answers)).map((r) => ({ token: r.token, ...splitProfileEmail(r.answers) }));
    for (let i = 0; i < moves.length; i += 200) {
      const batch = writeBatch(this.db);
      for (const m of moves.slice(i, i + 200)) {
        if (m.email) batch.set(this.contactRef(m.token), { editionId, email: m.email });
        batch.update(this.responseRef(m.token), { answers: clean(m.answers) });
      }
      await batch.commit();
    }
    return moves.filter((m) => m.email).length;
  }

  async removeParticipant(editionId: string, p: Participant): Promise<void> {
    const batch = writeBatch(this.db);
    await this.releaseAccount(batch, p.token);
    batch.delete(this.contactRef(p.token));
    batch.delete(this.arcadeRef(p.token));
    batch.delete(this.participantRef(editionId, p.id));
    batch.delete(this.inviteRef(p.token));
    batch.delete(this.responseRef(p.token));
    batch.delete(this.revealRef(p.token));
    batch.delete(this.mateStatusRef(memberKey(editionId, p.id)));
    batch.delete(this.mateCardRef(memberKey(editionId, p.id)));
    await batch.commit();
  }

  async regenerateToken(editionId: string, p: Participant): Promise<void> {
    const token = generateToken();
    const [old, contact, arcade] = await Promise.all([getDoc(this.responseRef(p.token)), getDoc(this.contactRef(p.token)), getDoc(this.arcadeRef(p.token))]);
    const batch = writeBatch(this.db);
    // l'enllaç nou neix lliure: s'haurà de tornar a reclamar (serveix si l'antic s'ha filtrat)
    await this.releaseAccount(batch, p.token);
    batch.update(this.participantRef(editionId, p.id), { token });
    batch.set(this.inviteRef(token), { editionId, displayName: p.name });
    if (old.exists()) batch.set(this.responseRef(token), old.data());
    if (contact.exists()) batch.set(this.contactRef(token), contact.data());
    if (arcade.exists()) batch.set(this.arcadeRef(token), arcade.data());
    batch.delete(this.contactRef(p.token));
    batch.delete(this.arcadeRef(p.token));
    batch.delete(this.inviteRef(p.token));
    batch.delete(this.responseRef(p.token));
    batch.delete(this.revealRef(p.token));
    await batch.commit();
  }

  async setGroups(editionId: string, assignments: Record<string, string | null>): Promise<void> {
    const batch = writeBatch(this.db);
    for (const [pid, gid] of Object.entries(assignments)) batch.update(this.participantRef(editionId, pid), { groupId: gid });
    await batch.commit();
  }

  async saveGroup(editionId: string, g: Group): Promise<void> {
    const { id, ...data } = g;
    await setDoc(this.groupRef(editionId, id), clean(data));
  }

  async deleteGroup(editionId: string, groupId: string, memberIds: string[]): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(this.groupRef(editionId, groupId));
    for (const id of memberIds) batch.update(this.participantRef(editionId, id), { groupId: null });
    await batch.commit();
  }

  async publishReveals(editionId: string, pub: Publication): Promise<void> {
    // estat actual: no trepitgem l'hora d'arribada de qui ja estava marcat
    const existing = await getDocs(query(collection(this.db, 'mateStatus'), where('editionId', '==', editionId)));
    const alreadyAnswered = new Set(existing.docs.filter((d) => d.data().answeredAt).map((d) => d.id));
    const batch = writeBatch(this.db);
    for (const t of pub.staleTokens) batch.delete(this.revealRef(t));
    for (const [t, r] of Object.entries(pub.reveals)) batch.set(this.revealRef(t), clean(r));
    for (const [k, card] of Object.entries(pub.cards)) {
      batch.set(this.mateCardRef(k), clean(card));
      const at = pub.answered[k];
      const backfill = at !== undefined && !alreadyAnswered.has(k);
      batch.set(
        this.mateStatusRef(k),
        backfill ? { editionId, answeredAt: Timestamp.fromMillis(at || Date.now()) } : existing.docs.some((d) => d.id === k) ? { editionId } : { editionId, answeredAt: null },
        { merge: true },
      );
    }
    batch.update(this.editionRef(editionId), {
      publishedHash: pub.hash,
      publishedAt: serverTimestamp(),
      publishedTokens: Object.keys(pub.reveals),
    });
    await batch.commit();
  }

  async resetResponse(editionId: string, p: Participant): Promise<void> {
    await this.resetResponses(editionId, [p]);
  }

  async resetResponses(editionId: string, ps: Participant[]): Promise<void> {
    // 2 operacions per persona; Firestore limita els lots a 500
    for (let i = 0; i < ps.length; i += 200) {
      const batch = writeBatch(this.db);
      for (const p of ps.slice(i, i + 200)) {
        batch.delete(this.responseRef(p.token));
        batch.set(this.mateStatusRef(memberKey(editionId, p.id)), { editionId, answeredAt: null }, { merge: true });
      }
      await batch.commit();
    }
  }

  // ---------- Diners ----------
  watchMoney<K extends MoneyCol>(editionId: string, col: K, cb: (docs: MoneyCollections[K][]) => void): Unsubscribe {
    return onSnapshot(
      this.moneyCol(editionId, col),
      (qs) =>
        cb(
          qs.docs.map((d) =>
            col === 'budgetLines' ? normalizeLine(d.id, d.data()) : { ...d.data(), id: d.id },
          ) as MoneyCollections[K][],
        ),
      reportRepoError,
    );
  }

  async saveMoneyDocs<K extends MoneyCol>(editionId: string, col: K, docs: MoneyCollections[K][]): Promise<void> {
    // Firestore limita els lots a 500 operacions
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(this.db);
      for (const d of docs.slice(i, i + 450)) {
        const { id, ...data } = d;
        batch.set(doc(this.moneyCol(editionId, col), id), clean(data));
      }
      await batch.commit();
    }
  }

  async deleteMoneyDoc(editionId: string, col: MoneyCol, id: string): Promise<void> {
    await deleteDoc(doc(this.moneyCol(editionId, col), id));
  }

  watchPricing(editionId: string, cb: (p: Pricing) => void): Unsubscribe {
    return onSnapshot(this.pricingRef(editionId), (s) => cb(normalizePricing(s.exists() ? (s.data() as Partial<Pricing>) : null)), reportRepoError);
  }

  async savePricing(editionId: string, patch: Partial<Pricing>): Promise<void> {
    // mergeFields: cada camp es substitueix sencer (si no, els mapes es fusionarien i no es podria esborrar una clau)
    await setDoc(this.pricingRef(editionId), clean(patch), { mergeFields: Object.keys(patch) });
  }
}
