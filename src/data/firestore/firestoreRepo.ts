import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  Edition,
  Group,
  Invite,
  Participant,
  PublicEdition,
  QuizResponse,
  Reveal,
} from '../../domain/types';
import { newEdition, newGroups, newPublicEdition, normalizePublicEdition } from '../defaults';
import { reportRepoError } from '../errors';
import type { AdminRepo, AdminUser, PublicRepo, ResponseWithToken, Unsubscribe } from '../ports';
import { getFirebaseApp } from './firebaseApp';

const toMillis = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : null);

/** Firestore no accepta `undefined`: el netegem. */
function clean<T extends object>(obj: T): DocumentData {
  return JSON.parse(JSON.stringify(obj)) as DocumentData;
}

export class FirestoreRepo implements PublicRepo, AdminRepo {
  private readonly db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
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

  // ---------- Auth ----------
  onAuthChange(cb: (u: AdminUser | null) => void): Unsubscribe {
    return onAuthStateChanged(getAuth(getFirebaseApp()), (u) =>
      cb(u ? { email: u.email ?? '', name: u.displayName ?? u.email ?? '' } : null),
    );
  }

  async signIn(): Promise<void> {
    const auth = getAuth(getFirebaseApp());
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
    }
  }

  async signOut(): Promise<void> {
    await signOut(getAuth(getFirebaseApp()));
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

  async removeParticipant(editionId: string, p: Participant): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(this.participantRef(editionId, p.id));
    batch.delete(this.inviteRef(p.token));
    batch.delete(this.responseRef(p.token));
    batch.delete(this.revealRef(p.token));
    await batch.commit();
  }

  async regenerateToken(editionId: string, p: Participant): Promise<void> {
    const token = generateToken();
    const old = await getDoc(this.responseRef(p.token));
    const batch = writeBatch(this.db);
    batch.update(this.participantRef(editionId, p.id), { token });
    batch.set(this.inviteRef(token), { editionId, displayName: p.name });
    if (old.exists()) batch.set(this.responseRef(token), old.data());
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

  async publishReveals(editionId: string, reveals: Record<string, Reveal>, staleTokens: string[], hash: string): Promise<void> {
    const batch = writeBatch(this.db);
    for (const t of staleTokens) batch.delete(this.revealRef(t));
    for (const [t, r] of Object.entries(reveals)) batch.set(this.revealRef(t), clean(r));
    batch.update(this.editionRef(editionId), {
      publishedHash: hash,
      publishedAt: serverTimestamp(),
      publishedTokens: Object.keys(reveals),
    });
    await batch.commit();
  }

  async resetResponse(token: string): Promise<void> {
    await deleteDoc(this.responseRef(token));
  }
}
