import type { Answers, QuizStep } from '../types';
import { isAnswerValid } from './validate';

/** Índex del primer pas sense resposta vàlida; steps.length si està tot fet. */
export function currentStepIndex(steps: readonly QuizStep[], answers: Answers): number {
  const i = steps.findIndex((s) => !isAnswerValid(s, answers[s.id]));
  return i === -1 ? steps.length : i;
}

export function isQuizComplete(steps: readonly QuizStep[], answers: Answers): boolean {
  return steps.length > 0 && currentStepIndex(steps, answers) === steps.length;
}

/** 0..1 */
export function progressFraction(steps: readonly QuizStep[], answers: Answers): number {
  return steps.length === 0 ? 1 : currentStepIndex(steps, answers) / steps.length;
}

/**
 * Neteja un progrés guardat (localStorage) per si l'admin ha canviat el qüestionari:
 * descarta respostes de passos que ja no existeixen o que ja no són vàlides.
 */
export function sanitizeAnswers(steps: readonly QuizStep[], stored: unknown): Answers {
  if (typeof stored !== 'object' || stored === null) return {};
  const src = stored as Record<string, unknown>;
  const out: Answers = {};
  for (const s of steps) if (s.id in src && isAnswerValid(s, src[s.id])) out[s.id] = src[s.id];
  return out;
}

/** Retorna només les respostes dels passos actuals (el que es desa a Firestore). */
export function finalAnswers(steps: readonly QuizStep[], answers: Answers): Answers {
  return sanitizeAnswers(steps, answers);
}
