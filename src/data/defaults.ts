import { defaultGroup } from '../domain/groups/assign';
import { defaultQuiz, normalizeQuizSteps } from '../domain/quiz/catalog';
import { DEFAULT_LOBBY, normalizeLobby } from '../domain/lobby/lobby';
import { DEFAULT_THEME, normalizeTheme } from '../domain/theme/palette';
import type { Edition, Group, PublicEdition } from '../domain/types';

export const DEFAULT_GROUP_COUNT = 6;

/** Per defecte: divendres i dissabte a partir de la data d'inici. */
export function defaultNights(editionId: string): string[] {
  if (editionId === '2027') return ['2027-01-22', '2027-01-23'];
  return [`${editionId}-01-01`, `${editionId}-01-02`];
}

export function newEdition(editionId: string): Edition {
  return {
    id: editionId,
    title: `Totem of Happiness ${editionId}`,
    nights: defaultNights(editionId),
    publishedHash: null,
    publishedAt: null,
    publishedTokens: [],
  };
}

export function newPublicEdition(editionId: string): PublicEdition {
  return {
    id: editionId,
    title: `Totem of Happiness ${editionId}`,
    theme: { ...DEFAULT_THEME, title: 'Totem of Happiness', subtitle: `Edició ${editionId}` },
    quizSteps: defaultQuiz(),
    allowRetake: true,
    lobby: { ...DEFAULT_LOBBY },
  };
}

/** Omple camps nous si el document és d'una versió anterior de l'app. */
export function normalizePublicEdition(id: string, data: Partial<PublicEdition>): PublicEdition {
  return {
    id,
    title: data.title ?? '',
    theme: normalizeTheme(data.theme),
    quizSteps: normalizeQuizSteps(data.quizSteps),
    allowRetake: data.allowRetake ?? true,
    lobby: normalizeLobby(data.lobby),
  };
}

export function newGroups(): Group[] {
  return Array.from({ length: DEFAULT_GROUP_COUNT }, (_, i) => defaultGroup(i, `g${i + 1}`));
}

export function nightLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ca', { weekday: 'short', day: 'numeric', month: 'short' });
}
