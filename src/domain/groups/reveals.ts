import type { Group, Participant, Reveal } from '../types';

export interface RevealBuild {
  reveals: Record<string, Reveal>; // per token
  unassigned: Participant[];
  emptyGroups: Group[];
}

const byName = (a: string, b: string) => a.localeCompare(b, 'ca');

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
  for (const [gid, list] of members) {
    const g = groupById.get(gid)!;
    for (const p of list) {
      reveals[p.token] = {
        editionId,
        groupName: g.name,
        color: g.color,
        image: g.image,
        mates: list.filter((m) => m.id !== p.id).map((m) => m.name).sort(byName),
      };
    }
  }
  return {
    reveals,
    unassigned: [...unassigned].sort((a, b) => byName(a.name, b.name)),
    emptyGroups: groups.filter((g) => !members.has(g.id)),
  };
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

/** Hash FNV-1a 32 bits en hex: suficient per saber si cal tornar a publicar. */
export function hashReveals(reveals: Record<string, Reveal>): string {
  const s = stableStringify(reveals);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type PublishStatus = 'never' | 'up-to-date' | 'outdated';

export function publishStatus(publishedHash: string | null, current: Record<string, Reveal>): PublishStatus {
  if (!publishedHash) return 'never';
  return publishedHash === hashReveals(current) ? 'up-to-date' : 'outdated';
}

/** Tokens publicats abans que ja no han de tenir revelació (participant eliminat o sense grup). */
export function staleRevealTokens(previousTokens: readonly string[], current: Record<string, Reveal>): string[] {
  return previousTokens.filter((t) => !(t in current));
}
