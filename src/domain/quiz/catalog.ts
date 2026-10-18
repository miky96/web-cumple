import type { QuizStep, QuizStepOf, StepConfigs, StepType } from '../types';

export interface StepTypeInfo<T extends StepType = StepType> {
  type: T;
  label: string;
  emoji: string;
  isMinigame: boolean;
  defaultTitle: string;
  defaultConfig: () => StepConfigs[T];
}

type Catalog = { [T in StepType]: StepTypeInfo<T> };

export const STEP_CATALOG: Catalog = {
  profile: {
    type: 'profile',
    label: 'Registre',
    emoji: '🪪',
    isMinigame: false,
    defaultTitle: 'Primer de tot, com vols que et diguem?',
    defaultConfig: () => ({ askEmail: true }),
  },
  text: {
    type: 'text',
    label: 'Text lliure',
    emoji: '✍️',
    isMinigame: false,
    defaultTitle: 'Descriu el teu cap de setmana ideal en tres paraules',
    defaultConfig: () => ({ placeholder: 'Escriu aquí...', maxLength: 140 }),
  },
  choice: {
    type: 'choice',
    label: 'Opcions',
    emoji: '🔘',
    isMinigame: false,
    defaultTitle: 'Quin és el teu superpoder a les festes?',
    defaultConfig: () => ({
      multiple: false,
      options: [
        { id: 'a', label: 'Ballar fins a les 6' },
        { id: 'b', label: 'Fer de DJ' },
        { id: 'c', label: 'Cuinar per a 40' },
        { id: 'd', label: 'Desaparèixer a les 12' },
      ],
    }),
  },
  'image-choice': {
    type: 'image-choice',
    label: 'Tria una imatge',
    emoji: '🖼️',
    isMinigame: false,
    defaultTitle: 'Quin tòtem et representa?',
    defaultConfig: () => ({
      options: [
        { id: 'a', label: 'Palmera', image: null, emoji: '🌴' },
        { id: 'b', label: 'Volcà', image: null, emoji: '🌋' },
        { id: 'c', label: 'Onada', image: null, emoji: '🌊' },
        { id: 'd', label: 'Pinya', image: null, emoji: '🍍' },
      ],
    }),
  },
  slider: {
    type: 'slider',
    label: 'Escala',
    emoji: '🎚️',
    isMinigame: false,
    defaultTitle: 'Del 0 al 10, quanta energia portes?',
    defaultConfig: () => ({ min: 0, max: 10, minLabel: 'Zombi', maxLabel: 'Volcà' }),
  },
  'stop-the-clock': {
    type: 'stop-the-clock',
    label: 'Atura el rellotge',
    emoji: '⏱️',
    isMinigame: true,
    defaultTitle: 'Atura el rellotge just als 5 segons',
    defaultConfig: () => ({ targetMs: 5000, hideAfterMs: 2500 }),
  },
  reaction: {
    type: 'reaction',
    label: 'Reflexos',
    emoji: '⚡',
    isMinigame: true,
    defaultTitle: 'Toca quan el tòtem canviï de color',
    defaultConfig: () => ({ minDelayMs: 1500, maxDelayMs: 4500 }),
  },
  'tap-race': {
    type: 'tap-race',
    label: 'Toca ràpid',
    emoji: '👆',
    isMinigame: true,
    defaultTitle: 'Desperta el tòtem: toca tant com puguis!',
    defaultConfig: () => ({ durationMs: 5000 }),
  },
  'memory-sequence': {
    type: 'memory-sequence',
    label: 'Memòria',
    emoji: '🧠',
    isMinigame: true,
    defaultTitle: 'Repeteix la dansa del tòtem',
    defaultConfig: () => ({ levels: 5, startLength: 3 }),
  },
};

export const STEP_TYPES = Object.keys(STEP_CATALOG) as StepType[];

export function createStep<T extends StepType>(type: T, id: string): QuizStepOf<T> {
  const info = STEP_CATALOG[type] as StepTypeInfo<T>;
  return { id, type, title: info.defaultTitle, config: info.defaultConfig() };
}

export function defaultQuiz(): QuizStep[] {
  const types: StepType[] = ['profile', 'image-choice', 'stop-the-clock', 'choice', 'reaction', 'slider', 'tap-race'];
  return types.map((t, i) => createStep(t, `s${i + 1}`) as QuizStep);
}
