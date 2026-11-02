import type { Answers } from '../types';

const isProfileAnswer = (v: unknown): v is { nickname: string; email?: unknown } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { nickname?: unknown }).nickname === 'string' && 'email' in v;

/**
 * Separa el correu del pas `profile` de la resta de respostes.
 * El correu es desa a `contacts/{token}` (privat); les respostes es poden llegir amb l'enllaç.
 */
export function splitProfileEmail(answers: Answers): { answers: Answers; email: string | null } {
  let email: string | null = null;
  const out: Answers = {};
  for (const [k, v] of Object.entries(answers)) {
    if (!isProfileAnswer(v)) {
      out[k] = v;
      continue;
    }
    const { email: raw, ...rest } = v;
    const e = typeof raw === 'string' ? raw.trim() : '';
    if (e && !email) email = e;
    out[k] = rest;
  }
  return { answers: out, email };
}

/** True si alguna resposta del registre encara porta el camp `email` (dades anteriors a la migració), encara que sigui buit. */
export const hasEmbeddedEmail = (answers: Answers) => Object.values(answers).some(isProfileAnswer);
