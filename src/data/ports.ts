/**
 * Ports (interfícies) de dades. La UI només parla amb aquestes interfícies;
 * hi ha dues implementacions: Firestore (producció) i memòria (mode demo / proves).
 */
import type { ImportRow } from '../domain/people/importList';
import type {
  Answers,
  Edition,
  Group,
  Invite,
  Participant,
  PublicEdition,
  QuizResponse,
  Reveal,
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

  publishReveals(
    editionId: string,
    reveals: Record<string, Reveal>,
    staleTokens: string[],
    hash: string,
  ): Promise<void>;
  resetResponse(token: string): Promise<void>;
}
