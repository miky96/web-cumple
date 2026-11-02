/**
 * Ports (interfícies) de dades. La UI només parla amb aquestes interfícies;
 * hi ha dues implementacions: Firestore (producció) i memòria (mode demo / proves).
 */
import type { ArcadeBoard } from '../domain/arcade/arcade';
import type { Adjustment, BudgetLine, Expense, Payment, Pricing } from '../domain/money/types';
import type { ImportRow } from '../domain/people/importList';
import type {
  Answers,
  Contact,
  Edition,
  Group,
  Invite,
  LinkedAccount,
  MateCard,
  Participant,
  PublicEdition,
  QuizResponse,
  Reveal,
  RevealedMate,
} from '../domain/types';

export type Unsubscribe = () => void;

export interface ArcadeImport {
  token: string;
  board: ArcadeBoard;
  /** Si té compte vinculat: on publicar-lo al leaderboard. */
  leaderboard: { uid: string; name: string } | null;
}

export interface LeaderboardRow {
  uid: string;
  name: string;
  board: ArcadeBoard;
}

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
}
export type AdminUser = AuthUser;

/** Inici de sessió (participants i admin comparteixen Firebase Auth). */
export interface AuthRepo {
  onAuthChange(cb: (user: AuthUser | null) => void): Unsubscribe;
  /** Google (popup, o redirecció si el navegador bloqueja el popup). */
  signIn(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface PublicRepo extends AuthRepo {
  /** Vincula l'enllaç al compte actual (un sol cop; un compte = un enllaç per edició). */
  claimInvite(token: string, editionId: string): Promise<void>;
  /** L'enllaç vinculat al compte actual, si n'hi ha. */
  getMyAccount(): Promise<{ token: string; editionId: string } | null>;
  /** Desa el correu de contacte en privat (`contacts/{token}`). */
  saveContact(token: string, editionId: string, email: string): Promise<void>;
  /** Millors marques de la sala arcade (buit si encara no hi ha jugat). */
  getArcade(token: string): Promise<ArcadeBoard>;
  /**
   * Desa el tauler sencer (les rules exigeixen haver fet el qüestionari).
   * Si `leaderboardName` no és null, també el publica al leaderboard (`leaderboard/{uid}`) amb aquest nom.
   */
  saveArcade(token: string, editionId: string, board: ArcadeBoard, leaderboardName: string | null): Promise<void>;
  /** Leaderboard de la sala (només per a comptes amb un enllaç vinculat). */
  watchLeaderboard(editionId: string, cb: (rows: LeaderboardRow[]) => void, onError?: (e: Error) => void): Unsubscribe;
  getInvite(token: string): Promise<Invite | null>;
  getPublicEdition(editionId: string): Promise<PublicEdition | null>;
  getResponse(token: string): Promise<QuizResponse | null>;
  submitResponse(token: string, editionId: string, answers: Answers): Promise<void>;
  /** Escolta els canvis de la configuració pública (tema, portada, enquesta oberta...). */
  watchPublicEdition(editionId: string, cb: (e: PublicEdition | null) => void): Unsubscribe;
  /** null si encara no s'ha publicat (o no hi ha permís perquè no s'ha respost). */
  getReveal(token: string): Promise<Reveal | null>;
  /** Marca que aquest membre ja ha contestat (els companys el començaran a veure). Idempotent. */
  markAnswered(selfKey: string): Promise<void>;
  /** Escolta quins companys ja han contestat i en retorna el nom, per ordre d'arribada. */
  watchRevealedMates(mateKeys: string[], cb: (mates: RevealedMate[]) => void): Unsubscribe;
}

export interface Publication {
  reveals: Record<string, Reveal>;
  cards: Record<string, MateCard>;
  /** Qui ja havia contestat abans de publicar: clau → instant (ms). */
  answered: Record<string, number>;
  staleTokens: string[];
  hash: string;
}

export interface ResponseWithToken extends QuizResponse {
  token: string;
}

export interface AdminRepo extends AuthRepo {
  /** Crea l'edició amb valors per defecte si no existeix. */
  ensureEdition(editionId: string): Promise<void>;
  watchEdition(editionId: string, cb: (e: Edition | null) => void): Unsubscribe;
  watchPublicEdition(editionId: string, cb: (e: PublicEdition | null) => void): Unsubscribe;
  watchParticipants(editionId: string, cb: (ps: Participant[]) => void): Unsubscribe;
  watchGroups(editionId: string, cb: (gs: Group[]) => void): Unsubscribe;
  watchResponses(editionId: string, cb: (rs: ResponseWithToken[]) => void): Unsubscribe;
  watchAccounts(editionId: string, cb: (as: LinkedAccount[]) => void): Unsubscribe;
  watchContacts(editionId: string, cb: (cs: Contact[]) => void): Unsubscribe;
  watchArcade(editionId: string, cb: (boards: { token: string; board: ArcadeBoard }[]) => void): Unsubscribe;
  /** Admin: desa taulers de la sala (i el leaderboard dels que tenen compte), en lots. */
  saveArcadeBoards(editionId: string, entries: ArcadeImport[]): Promise<void>;

  updateEdition(editionId: string, patch: Partial<Pick<Edition, 'title' | 'nights'>>): Promise<void>;
  savePublicEdition(editionId: string, patch: Partial<Omit<PublicEdition, 'id'>>): Promise<void>;

  addParticipants(editionId: string, rows: ImportRow[], nights: string[]): Promise<void>;
  updateParticipant(editionId: string, p: Participant, patch: Partial<Pick<Participant, 'name' | 'nights' | 'tags' | 'notes' | 'groupId' | 'confirmed'>>): Promise<void>;
  removeParticipant(editionId: string, p: Participant): Promise<void>;
  /** Enllaç nou i lliure (l'antic i el compte vinculat deixen de valer). */
  regenerateToken(editionId: string, p: Participant): Promise<void>;
  /** Allibera l'enllaç: el podrà tornar a reclamar un altre compte. */
  unlinkAccount(editionId: string, p: Participant): Promise<void>;
  /** Migració: treu el correu de dins les respostes i el passa a `contacts`. Retorna quants n'ha mogut. */
  moveEmailsToContacts(editionId: string, rs: ResponseWithToken[]): Promise<number>;
  setGroups(editionId: string, assignments: Record<string, string | null>): Promise<void>;

  saveGroup(editionId: string, g: Group): Promise<void>;
  deleteGroup(editionId: string, groupId: string, memberIds: string[]): Promise<void>;

  publishReveals(editionId: string, pub: Publication): Promise<void>;
  /** Esborra la resposta i torna a amagar el participant als seus companys. */
  resetResponse(editionId: string, p: Participant): Promise<void>;
  /** Com `resetResponse`, però per a diverses persones de cop (ex. netejar respostes de prova). */
  resetResponses(editionId: string, ps: Participant[]): Promise<void>;
}

// ---------- Diners ----------

/** Col·leccions del mòdul de diners (subcol·leccions de `editions/{id}`). */
export interface MoneyCollections {
  budgetLines: BudgetLine;
  expenses: Expense;
  payments: Payment;
  adjustments: Adjustment;
}
export type MoneyCol = keyof MoneyCollections;

export interface MoneyRepo {
  watchMoney<K extends MoneyCol>(editionId: string, col: K, cb: (docs: MoneyCollections[K][]) => void): Unsubscribe;
  /** Crea o substitueix documents (en lots). */
  saveMoneyDocs<K extends MoneyCol>(editionId: string, col: K, docs: MoneyCollections[K][]): Promise<void>;
  deleteMoneyDoc(editionId: string, col: MoneyCol, id: string): Promise<void>;
  watchPricing(editionId: string, cb: (p: Pricing) => void): Unsubscribe;
  savePricing(editionId: string, patch: Partial<Pricing>): Promise<void>;
}
