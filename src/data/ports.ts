/**
 * Ports (interfícies) de dades. La UI només parla amb aquestes interfícies;
 * hi ha dues implementacions: Firestore (producció) i memòria (mode demo / proves).
 */
import type { Adjustment, BudgetLine, Expense, Payment, Pricing } from '../domain/money/types';
import type { ImportRow } from '../domain/people/importList';
import type {
  Answers,
  Edition,
  Group,
  Invite,
  MateCard,
  Participant,
  PublicEdition,
  QuizResponse,
  Reveal,
  RevealedMate,
} from '../domain/types';

export type Unsubscribe = () => void;

export interface PublicRepo {
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

export interface AdminUser {
  email: string;
  name: string;
}

export interface ResponseWithToken extends QuizResponse {
  token: string;
}

export interface AdminRepo {
  onAuthChange(cb: (user: AdminUser | null) => void): Unsubscribe;
  signIn(): Promise<void>;
  signOut(): Promise<void>;

  /** Crea l'edició amb valors per defecte si no existeix. */
  ensureEdition(editionId: string): Promise<void>;
  watchEdition(editionId: string, cb: (e: Edition | null) => void): Unsubscribe;
  watchPublicEdition(editionId: string, cb: (e: PublicEdition | null) => void): Unsubscribe;
  watchParticipants(editionId: string, cb: (ps: Participant[]) => void): Unsubscribe;
  watchGroups(editionId: string, cb: (gs: Group[]) => void): Unsubscribe;
  watchResponses(editionId: string, cb: (rs: ResponseWithToken[]) => void): Unsubscribe;

  updateEdition(editionId: string, patch: Partial<Pick<Edition, 'title' | 'nights'>>): Promise<void>;
  savePublicEdition(editionId: string, patch: Partial<Omit<PublicEdition, 'id'>>): Promise<void>;

  addParticipants(editionId: string, rows: ImportRow[], nights: string[]): Promise<void>;
  updateParticipant(editionId: string, p: Participant, patch: Partial<Pick<Participant, 'name' | 'nights' | 'tags' | 'notes' | 'groupId' | 'confirmed'>>): Promise<void>;
  removeParticipant(editionId: string, p: Participant): Promise<void>;
  regenerateToken(editionId: string, p: Participant): Promise<void>;
  setGroups(editionId: string, assignments: Record<string, string | null>): Promise<void>;

  saveGroup(editionId: string, g: Group): Promise<void>;
  deleteGroup(editionId: string, groupId: string, memberIds: string[]): Promise<void>;

  publishReveals(editionId: string, pub: Publication): Promise<void>;
  /** Esborra la resposta i torna a amagar el participant als seus companys. */
  resetResponse(editionId: string, p: Participant): Promise<void>;
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
