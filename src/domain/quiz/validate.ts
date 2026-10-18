import type { QuizStep } from '../types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Retorna un missatge d'error o null si la resposta és vàlida per al pas. */
export function validateAnswer(step: QuizStep, value: unknown): string | null {
  switch (step.type) {
    case 'profile': {
      if (!isObj(value) || typeof value.nickname !== 'string') return 'Falta el nom';
      if (value.nickname.trim().length < 2) return 'Posa un nom una mica més llarg';
      if (value.nickname.length > 40) return 'Massa llarg';
      const email = typeof value.email === 'string' ? value.email.trim() : '';
      if (email && !EMAIL_RE.test(email)) return 'Aquest correu no té bona pinta';
      return null;
    }
    case 'text':
      if (typeof value !== 'string' || value.trim().length === 0) return 'Escriu alguna cosa';
      if (value.length > step.config.maxLength) return `Màxim ${step.config.maxLength} caràcters`;
      return null;
    case 'choice': {
      const ids = new Set(step.config.options.map((o) => o.id));
      if (!Array.isArray(value) || value.length === 0) return 'Tria una opció';
      if (!step.config.multiple && value.length > 1) return 'Només una opció';
      if (!value.every((v) => typeof v === 'string' && ids.has(v))) return 'Opció desconeguda';
      return null;
    }
    case 'image-choice':
      return typeof value === 'string' && step.config.options.some((o) => o.id === value) ? null : 'Tria una imatge';
    case 'slider':
      return isNum(value) && value >= step.config.min && value <= step.config.max ? null : 'Valor fora de rang';
    case 'stop-the-clock':
      return isObj(value) && isNum(value.elapsedMs) && isNum(value.deltaMs) ? null : 'Joc no completat';
    case 'reaction':
      return isObj(value) && (value.ms === null || isNum(value.ms)) && isNum(value.earlyTaps) ? null : 'Joc no completat';
    case 'tap-race':
      return isObj(value) && isNum(value.taps) ? null : 'Joc no completat';
    case 'memory-sequence':
      return isObj(value) && isNum(value.levelReached) ? null : 'Joc no completat';
  }
}

export const isAnswerValid = (step: QuizStep, value: unknown) => validateAnswer(step, value) === null;
