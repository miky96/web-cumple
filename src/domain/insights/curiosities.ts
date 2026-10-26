import { formatSeconds, formatSignedSeconds } from '../text';
import type { Answers, QuizStep } from '../types';

export interface RankingEntry {
  name: string;
  value: string;
  /** Menor = millor (per ordenar). */
  score: number;
}

export interface StepRanking {
  stepId: string;
  title: string;
  type: QuizStep['type'];
  entries: RankingEntry[];
}

export interface NamedAnswers {
  name: string;
  answers: Answers;
}

type Obj = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function entryFor(step: QuizStep, raw: unknown): Omit<RankingEntry, 'name'> | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const a = raw as Obj;
  switch (step.type) {
    case 'stop-the-clock': {
      const d = num(a.deltaMs);
      return d === null ? null : { value: formatSignedSeconds(d), score: Math.abs(d) };
    }
    case 'count-characters': {
      const g = num(a.guess);
      const act = num(a.actual);
      if (g === null || act === null) return null;
      const d = g - act;
      return { value: d === 0 ? `exacte (${act})` : `${d > 0 ? '+' : '−'}${Math.abs(d)} (${g} de ${act})`, score: Math.abs(d) };
    }
    case 'tap-race': {
      const taps = num(a.taps);
      return taps === null ? null : { value: `${taps} tocs`, score: -taps };
    }
    case 'memory-sequence': {
      const l = num(a.levelReached);
      return l === null ? null : { value: `nivell ${l}`, score: -l };
    }
    default:
      return null;
  }
}

/** Rànquing per a cada minijoc (millor primer). Empats ordenats per nom. */
export function minigameRankings(steps: readonly QuizStep[], people: readonly NamedAnswers[]): StepRanking[] {
  return steps
    .filter((s) => ['stop-the-clock', 'count-characters', 'tap-race', 'memory-sequence'].includes(s.type))
    .map((s) => ({
      stepId: s.id,
      title: s.title,
      type: s.type,
      entries: people
        .flatMap((p) => {
          const e = entryFor(s, p.answers[s.id]);
          return e ? [{ name: p.name, ...e }] : [];
        })
        .sort((x, y) => x.score - y.score || x.name.localeCompare(y.name, 'ca')),
    }));
}

/** Text llegible d'una resposta per a la vista d'admin. */
export function describeAnswer(step: QuizStep, raw: unknown): string {
  if (raw === undefined || raw === null) return '—';
  switch (step.type) {
    case 'profile': {
      const a = raw as Obj;
      return [a.nickname, a.email].filter(Boolean).join(' · ');
    }
    case 'text':
      return String(raw);
    case 'choice': {
      const ids = Array.isArray(raw) ? raw : [];
      return ids.map((id) => step.config.options.find((o) => o.id === id)?.label ?? id).join(', ');
    }
    case 'image-choice': {
      const o = step.config.options.find((x) => x.id === raw);
      return o ? `${o.emoji ?? ''} ${o.label}`.trim() : String(raw);
    }
    case 'slider':
      return `${raw} / ${step.config.max}`;
    case 'stop-the-clock': {
      const a = raw as Obj;
      return `${formatSeconds(num(a.elapsedMs) ?? 0)} (${formatSignedSeconds(num(a.deltaMs) ?? 0)})`;
    }
    case 'count-characters': {
      const a = raw as Obj;
      return `ha dit ${a.guess}, eren ${a.actual}`;
    }
    case 'tap-race':
      return `${(raw as Obj).taps} tocs`;
    case 'memory-sequence':
      return `nivell ${(raw as Obj).levelReached}/${(raw as Obj).levels}`;
  }
}
