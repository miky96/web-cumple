import type { AttendanceEntry, Lobby, Participant } from '../types';

export const DEFAULT_LOBBY: Lobby = {
  surveyOpen: false,
  endsAt: null,
  message: "Algoritme carregant-se...",
  attendance: [],
};

export function normalizeLobby(raw: Partial<Lobby> | null | undefined): Lobby {
  return { ...DEFAULT_LOBBY, ...(raw ?? {}), attendance: raw?.attendance ?? [] };
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Ja s'ha arribat a 0 (o no hi ha data). */
  done: boolean;
}

/** Desglossa el temps que falta fins a `endsAt`. Mai negatiu. */
export function countdownParts(endsAt: number | null, now: number): CountdownParts {
  if (endsAt === null) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const total = Math.max(0, Math.floor((endsAt - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total === 0,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Llista pública d'assistència (només nom i si ha confirmat), ordenada per nom. */
export function buildAttendance(participants: readonly Participant[]): AttendanceEntry[] {
  return participants
    .map((p) => ({ name: p.name, confirmed: !!p.confirmed }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ca'));
}

export function sameAttendance(a: readonly AttendanceEntry[], b: readonly AttendanceEntry[]): boolean {
  return a.length === b.length && a.every((x, i) => x.name === b[i].name && x.confirmed === b[i].confirmed);
}

export function splitAttendance(list: readonly AttendanceEntry[]): { confirmed: string[]; pending: string[] } {
  return {
    confirmed: list.filter((x) => x.confirmed).map((x) => x.name),
    pending: list.filter((x) => !x.confirmed).map((x) => x.name),
  };
}

/** Valor per a <input type="datetime-local"> (hora local del navegador). */
export function toLocalInput(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}
