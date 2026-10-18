import { describe, expect, it } from 'vitest';
import type { Participant } from '../types';
import {
  buildAttendance,
  countdownParts,
  fromLocalInput,
  normalizeLobby,
  sameAttendance,
  splitAttendance,
  toLocalInput,
} from './lobby';

const p = (name: string, confirmed: boolean): Participant => ({
  id: name,
  personId: name,
  name,
  nights: [],
  tags: [],
  notes: '',
  token: `t_${name}`,
  groupId: null,
  confirmed,
});

describe('countdownParts', () => {
  it('desglossa dies, hores, minuts i segons', () => {
    const now = 0;
    const end = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(countdownParts(end, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
  });
  it('no baixa de zero quan ja ha passat', () => {
    expect(countdownParts(1000, 999_999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
  it('sense data es considera acabat', () => {
    expect(countdownParts(null, 0).done).toBe(true);
  });
  it('arrodoneix cap avall els mil·lisegons', () => {
    expect(countdownParts(1999, 0).seconds).toBe(1);
  });
});

describe('assistència', () => {
  it('genera la llista pública ordenada i sense dades privades', () => {
    const list = buildAttendance([p('Carla', false), p('Àlex', true), p('Bernat', true)]);
    expect(list).toEqual([
      { name: 'Àlex', confirmed: true },
      { name: 'Bernat', confirmed: true },
      { name: 'Carla', confirmed: false },
    ]);
    expect(Object.keys(list[0])).toEqual(['name', 'confirmed']);
  });
  it('detecta canvis per sincronitzar', () => {
    const a = buildAttendance([p('A', true)]);
    expect(sameAttendance(a, [{ name: 'A', confirmed: true }])).toBe(true);
    expect(sameAttendance(a, [{ name: 'A', confirmed: false }])).toBe(false);
    expect(sameAttendance(a, [])).toBe(false);
  });
  it('separa confirmats i pendents', () => {
    expect(splitAttendance(buildAttendance([p('A', true), p('B', false)]))).toEqual({ confirmed: ['A'], pending: ['B'] });
  });
  it('tracta participants antics sense camp confirmed com a pendents', () => {
    const old = { ...p('Z', false) } as Partial<Participant>;
    delete old.confirmed;
    expect(buildAttendance([old as Participant])[0].confirmed).toBe(false);
  });
});

describe('lobby', () => {
  it('per defecte l’enquesta és tancada', () => {
    expect(normalizeLobby(undefined).surveyOpen).toBe(false);
    expect(normalizeLobby({ surveyOpen: true }).attendance).toEqual([]);
  });
  it('converteix data local i torna', () => {
    const ms = new Date(2027, 0, 22, 19, 30).getTime();
    expect(toLocalInput(ms)).toBe('2027-01-22T19:30');
    expect(fromLocalInput('2027-01-22T19:30')).toBe(ms);
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });
});
