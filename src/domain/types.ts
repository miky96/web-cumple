/**
 * Tipus de domini compartits. Sense dependències de Firebase ni de React.
 */

export type Rng = () => number; // [0, 1)

// ---------- Tema ----------

/** Fons: graella de neó en perspectiva o res. */
export type PatternKind = 'grid' | 'none';

export interface Theme {
  /** Neó principal de l'any (hex). */
  base: string;
  /** Neó secundari; si és null es deriva del principal. */
  accent: string | null;
  pattern: PatternKind;
  /** Intensitat de la graella, 0..1 */
  patternOpacity: number;
  /** Text gran de la portada, ex. "Totem of Happiness 2027". */
  title: string;
  subtitle: string;
  /** Imatge de fons per defecte de la pantalla de resultat (ruta dins /public). Un grup la pot sobreescriure. */
  resultBackground: string | null;
}

// ---------- Qüestionari ----------

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface ImageOption extends ChoiceOption {
  /** Ruta dins /public, ex. "/editions/2027/quiz/platja.webp". */
  image: string | null;
  /** Alternativa ràpida si no hi ha imatge. */
  emoji: string | null;
}

export interface StepConfigs {
  profile: { askEmail: boolean };
  text: { placeholder: string; maxLength: number };
  choice: { options: ChoiceOption[]; multiple: boolean };
  'image-choice': { options: ImageOption[] };
  slider: { min: number; max: number; minLabel: string; maxLabel: string };
  'stop-the-clock': { targetMs: number; hideAfterMs: number | null };
  /** Compta personatges: `target` i `decoys` són emojis; `level` 1 (fàcil) a 3 (difícil). */
  'count-characters': { durationMs: number; target: string; decoys: string[]; level: number };
  'tap-race': { durationMs: number };
  'memory-sequence': { levels: number; startLength: number };
}

export interface StepAnswers {
  profile: { nickname: string; email: string };
  text: string;
  choice: string[];
  'image-choice': string;
  slider: number;
  'stop-the-clock': { targetMs: number; elapsedMs: number; deltaMs: number };
  'count-characters': { guess: number; actual: number };
  'tap-race': { taps: number; durationMs: number };
  'memory-sequence': { levelReached: number; levels: number };
}

export type StepType = keyof StepConfigs;

export type QuizStepOf<T extends StepType> = {
  id: string;
  type: T;
  title: string;
  config: StepConfigs[T];
};

export type QuizStep = { [T in StepType]: QuizStepOf<T> }[StepType];

export type AnswerOf<T extends StepType> = StepAnswers[T];
export type Answers = Record<string, unknown>;

// ---------- Edició / participants / grups ----------

export interface AttendanceEntry {
  name: string;
  confirmed: boolean;
}

/** Portada prèvia: mentre l'enquesta és tancada només es veu el compte enrere, el missatge i l'assistència. */
export interface Lobby {
  surveyOpen: boolean;
  /** Fi del compte enrere (ms epoch) o null. */
  endsAt: number | null;
  message: string;
  /** Còpia pública (només noms) generada des de l'admin. */
  attendance: AttendanceEntry[];
}

export interface PublicEdition {
  id: string;
  title: string;
  theme: Theme;
  quizSteps: QuizStep[];
  /** Si el participant pot tornar a fer el qüestionari (substitueix les respostes). */
  allowRetake: boolean;
  lobby: Lobby;
}

export interface Participant {
  id: string;
  personId: string;
  name: string;
  /** Dates ISO de les nits que ve (subconjunt de Edition.nights). */
  nights: string[];
  tags: string[];
  notes: string;
  token: string;
  groupId: string | null;
  /** L'admin ha marcat que ha confirmat assistència. */
  confirmed: boolean;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  /** Imatge de fons de la pantalla de resultat d'aquest grup (ruta dins /public). */
  image: string | null;
  order: number;
}

export interface Edition {
  id: string;
  title: string;
  /** Dates ISO de les nits de l'esdeveniment, ordenades. */
  nights: string[];
  publishedHash: string | null;
  publishedAt: number | null;
  /** Tokens amb revelació publicada (per esborrar les obsoletes en republicar). */
  publishedTokens: string[];
}

// ---------- Documents públics ----------

export interface Invite {
  editionId: string;
  displayName: string;
}

export interface Reveal {
  editionId: string;
  groupName: string;
  color: string;
  image: string | null;
  /** Clau pública pròpia: en obrir el resultat es marca com a «ha contestat». */
  selfKey: string;
  /** Claus dels companys. Els noms NO hi són: només es poden llegir quan el company ja ha contestat. */
  mateKeys: string[];
  /** Format antic (abans de les claus). Només per compatibilitat fins que es torni a publicar. */
  mates?: string[];
}

/** `mateCards/{key}`: el nom d'un membre, llegible només quan `mateStatus/{key}` té `answeredAt`. */
export interface MateCard {
  editionId: string;
  name: string;
}

/** Company que ja ha contestat (el que veu el participant). */
export interface RevealedMate {
  key: string;
  name: string;
  answeredAt: number;
}

export interface QuizResponse {
  editionId: string;
  answers: Answers;
  completedAt: number | null;
}
