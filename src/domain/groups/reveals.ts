import type { Group, MateCard, Participant, Reveal } from '../types';

export interface RevealBuild {
  reveals: Record<string, Reveal>; // per token
  /** Nom de cada membre per clau pública (es publica a `mateCards`). */
  cards: Record<string, MateCard>;
  unassigned: Participant[];
  emptyGroups: Group[];
}

const byName = (a: string, b: string) => a.localeCompare(b, 'ca');

/**
 * Clau pública d'un membre dins d'una edició. No és secreta com el token: només permet
 * saber si ha contestat i, un cop ha contestat, el seu nom. L'id del participant és aleatori.
 */
export const memberKey = (editionId: string, participantId: string) => `${editionId}_${participantId}`;

export function buildReveals(editionId: string, participants: readonly Participant[], groups: readonly Group[]): RevealBuild {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const members = new Map<string, Participant[]>();
  const unassigned: Participant[] = [];
  for (const p of participants) {
    if (p.groupId && groupById.has(p.groupId)) {
      const list = members.get(p.groupId) ?? [];
      list.push(p);
      members.set(p.groupId, list);
    } else unassigned.push(p);
  }
  const reveals: Record<string, Reveal> = {};
  const cards: Record<string, MateCard> = {};
  for (const [gid, list] of members) {
    const g = groupById.get(gid)!;
    for (const p of list) {
      cards[memberKey(editionId, p.id)] = { editionId, name: p.name };
      reveals[p.token] = {
        editionId,
        groupName: g.name,
        color: g.color,
        image: g.image,
        selfKey: memberKey(editionId, p.id),
        mateKeys: list
          .filter((m) => m.id !== p.id)
          .map((m) => memberKey(editionId, m.id))
          .sort(),
      };
    }
  }
  return {
    reveals,
    cards,
    unassigned: [...unassigned].sort((a, b) => byName(a.name, b.name)),
    emptyGroups: groups.filter((g) => !members.has(g.id)),
  };
}

/**
 * Qui ja havia contestat abans de publicar (o abans que existís aquesta funcionalitat):
 * clau → instant de la resposta. En publicar, l'admin els marca perquè els companys els vegin.
 */
export function answeredKeys(
  editionId: string,
  participants: readonly Participant[],
  completedAtByToken: ReadonlyMap<string, number | null>,
  build: Pick<RevealBuild, 'cards'>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of participants) {
    const key = memberKey(editionId, p.id);
    if (!(key in build.cards) || !completedAtByToken.has(p.token)) continue;
    out[key] = completedAtByToken.get(p.token) ?? 0;
  }
  return out;
}

/** Ordena els companys revelats per ordre d'arribada (i per nom si empaten). */
export function sortRevealedMates<T extends { name: string; answeredAt: number }>(mates: readonly T[]): T[] {
  return [...mates].sort((a, b) => a.answeredAt - b.answeredAt || byName(a.name, b.name));
}

/** Serialització estable (claus ordenades) per detectar canvis. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value ?? null);
}

type Publication = Pick<RevealBuild, 'reveals' | 'cards'>;

/** Hash FNV-1a 32 bits en hex: suficient per saber si cal tornar a publicar (inclou els noms). */
export function hashReveals(pub: Publication): string {
  const s = stableStringify({ reveals: pub.reveals, cards: pub.cards });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type PublishStatus = 'never' | 'up-to-date' | 'outdated';

export function publishStatus(publishedHash: string | null, current: Publication): PublishStatus {
  if (!publishedHash) return 'never';
  return publishedHash === hashReveals(current) ? 'up-to-date' : 'outdated';
}

/** Tokens publicats abans que ja no han de tenir revelació (participant eliminat o sense grup). */
export function staleRevealTokens(previousTokens: readonly string[], current: Record<string, Reveal>): string[] {
  return previousTokens.filter((t) => !(t in current));
}
