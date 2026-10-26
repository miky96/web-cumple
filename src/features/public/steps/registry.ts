import type { ComponentType } from 'react';
import type { StepType } from '../../../domain/types';
import { ChoiceStep, ImageChoiceStep, ProfileStep, SliderStep, TextStep } from './BasicSteps';
import { CountCharactersStep, MemoryStep, StopClockStep, TapRaceStep } from './GameSteps';
import type { StepProps } from './common';

/** Afegir un tipus de pas nou = afegir-lo al catàleg de domini + aquí + un editor d'admin. */
export const STEP_COMPONENTS: { [T in StepType]: ComponentType<StepProps<T>> } = {
  profile: ProfileStep,
  text: TextStep,
  choice: ChoiceStep,
  'image-choice': ImageChoiceStep,
  slider: SliderStep,
  'stop-the-clock': StopClockStep,
  'count-characters': CountCharactersStep,
  'tap-race': TapRaceStep,
  'memory-sequence': MemoryStep,
};
