import { shuffle } from '../random';
import type { Group, Participant, Rng } from '../types';

/**
 * Reparteix els participants sense grup omplint primer els grups més petits.
 * No toca els que ja tenen grup. Retorna personId → groupId només dels nous.
 */
export function assignRemaining(
  participants: readonly Participant[],
  groups: readonly Group[],
  rng: Rng,
): Record<string, string> {
  if (groups.length === 0) return {};
  const validIds = new Set(groups.map((g) => g.id));
  const size = new Map(groups.map((g) => [g.id, 0]));
  const pending: Participant[] = [];
  for (const p of participants) {
    if (p.groupId && validIds.has(p.groupId)) size.set(p.groupId, size.get(p.groupId)! + 1);
    else pending.push(p);
  }
  const out: Record<string, string> = {};
  for (const p of shuffle(pending, rng)) {
    const min = Math.min(...size.values());
    const candidates = groups.filter((g) => size.get(g.id) === min);
    const g = candidates[Math.floor(rng() * candidates.length)];
    out[p.id] = g.id;
    size.set(g.id, min + 1);
  }
  return out;
}

/** Neons ben diferenciats entre ells (tema arcade). */
export const GROUP_COLORS = ['#ff3b3b', '#2ef2ff', '#7cff4f', '#ffe94d', '#b14dff', '#ff8a2e', '#ff2e93', '#3b7bff'];
export const GROUP_NAMES = ['Pixar', 'Disney', 'Ghibli', 'Sony Pictures Animation', 'Illumination', 'Dreamworks'];

export function defaultGroup(index: number, id: string): Group {
  return {
    id,
    name: GROUP_NAMES[index % GROUP_NAMES.length],
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    image: null,
    order: index,
  };
}
