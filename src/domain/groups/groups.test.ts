import { describe, expect, it } from 'vitest';
import { seededRng } from '../random';
import type { Group, Participant } from '../types';
import { assignRemaining, defaultGroup } from './assign';
import { buildReveals, hashReveals, publishStatus, staleRevealTokens } from './reveals';

const person = (id: string, groupId: string | null = null): Participant => ({
  id,
  personId: id,
  name: id.toUpperCase(),
  nights: [],
  tags: [],
  notes: '',
  token: `tok_${id}`,
  groupId,
  confirmed: false,
});

const groups: Group[] = [defaultGroup(0, 'g1'), defaultGroup(1, 'g2'), defaultGroup(2, 'g3')];

describe('buildReveals', () => {
  it('genera una revelació per token amb els companys ordenats i sense un mateix', () => {
    const ps = [person('c', 'g1'), person('a', 'g1'), person('b', 'g1'), person('d', 'g2'), person('e')];
    const r = buildReveals('2027', ps, groups);
    expect(r.reveals.tok_c.mates).toEqual(['A', 'B']);
    expect(r.reveals.tok_c.groupName).toBe(groups[0].name);
    expect(r.reveals.tok_d.mates).toEqual([]);
    expect(r.unassigned.map((p) => p.id)).toEqual(['e']);
    expect(r.emptyGroups.map((g) => g.id)).toEqual(['g3']);
    expect(r.reveals.tok_e).toBeUndefined();
  });

  it('tracta un grup inexistent com a sense assignar', () => {
    const r = buildReveals('2027', [person('a', 'esborrat')], groups);
    expect(r.unassigned).toHaveLength(1);
  });
});

describe('publicació', () => {
  it('el hash és estable i detecta canvis', () => {
    const ps = [person('a', 'g1'), person('b', 'g2')];
    const r1 = buildReveals('2027', ps, groups).reveals;
    const r2 = buildReveals('2027', [...ps].reverse(), groups).reveals;
    expect(hashReveals(r1)).toBe(hashReveals(r2));
    const moved = buildReveals('2027', [person('a', 'g2'), person('b', 'g2')], groups).reveals;
    expect(publishStatus(hashReveals(r1), moved)).toBe('outdated');
    expect(publishStatus(hashReveals(r1), r1)).toBe('up-to-date');
    expect(publishStatus(null, r1)).toBe('never');
  });

  it('detecta revelacions que s’han d’esborrar', () => {
    const current = buildReveals('2027', [person('a', 'g1')], groups).reveals;
    expect(staleRevealTokens(['tok_a', 'tok_vell'], current)).toEqual(['tok_vell']);
  });
});

describe('assignRemaining', () => {
  it('equilibra els grups sense tocar els ja assignats', () => {
    const ps = [person('a', 'g1'), person('b', 'g1'), ...'cdefghi'.split('').map((x) => person(x))];
    const result = assignRemaining(ps, groups, seededRng(42));
    expect(Object.keys(result).sort()).toEqual('cdefghi'.split(''));
    const sizes: Record<string, number> = { g1: 2, g2: 0, g3: 0 };
    for (const gid of Object.values(result)) sizes[gid]++;
    expect(sizes).toEqual({ g1: 3, g2: 3, g3: 3 });
  });

  it('sense grups no assigna res', () => {
    expect(assignRemaining([person('a')], [], seededRng(1))).toEqual({});
  });
});
