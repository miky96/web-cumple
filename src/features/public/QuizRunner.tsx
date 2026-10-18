import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { currentStepIndex, sanitizeAnswers } from '../../domain/quiz/progress';
import type { Answers, QuizStep, StepType } from '../../domain/types';
import type { StepContext, StepProps } from './steps/common';
import { STEP_COMPONENTS } from './steps/registry';

interface Props {
  steps: QuizStep[];
  ctx: StepContext;
  initialAnswers?: unknown;
  onProgress?: (answers: Answers) => void;
  onComplete: (answers: Answers) => void;
}

export function QuizRunner({ steps, ctx, initialAnswers, onProgress, onComplete }: Props) {
  const [answers, setAnswers] = useState<Answers>(() => sanitizeAnswers(steps, initialAnswers));
  const index = useMemo(() => currentStepIndex(steps, answers), [steps, answers]);
  const done = index >= steps.length;

  useEffect(() => {
    if (done && steps.length > 0) onComplete(answers);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (done) return null;
  const step = steps[index];
  const Component = STEP_COMPONENTS[step.type] as ComponentType<StepProps<StepType>>;

  const submit = (value: unknown) => {
    const next = { ...answers, [step.id]: value };
    setAnswers(next);
    onProgress?.(next);
  };

  return (
    <>
      <div className="quiz-top" aria-label={`Pas ${index + 1} de ${steps.length}`}>
        <div className="progress-label">
          <span>STAGE {index + 1}/{steps.length}</span>
          <span>{String(Math.round((index / steps.length) * 1000) * 10).padStart(6, '0')}</span>
        </div>
        <div className="progress">
          <div style={{ width: `${(index / steps.length) * 100}%` }} />
        </div>
      </div>
      <Component key={step.id} step={step as never} ctx={ctx} onSubmit={submit} />
    </>
  );
}
