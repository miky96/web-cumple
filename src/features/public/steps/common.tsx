import type { ReactNode } from 'react';
import type { AnswerOf, QuizStepOf, StepType } from '../../../domain/types';

export interface StepContext {
  displayName: string;
}

export interface StepProps<T extends StepType> {
  step: QuizStepOf<T>;
  ctx: StepContext;
  onSubmit: (value: AnswerOf<T>) => void;
}

export function StepShell({ kicker, title, children, actions }: { kicker?: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="step">
      {kicker && <span className="step-kicker">{kicker}</span>}
      <h2 className="step-title">{title}</h2>
      <div className="step-body">{children}</div>
      {actions && <div className="step-actions">{actions}</div>}
    </section>
  );
}

export function NextButton({ disabled, onClick, label = 'Següent' }: { disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-block" disabled={disabled} onClick={onClick}>
      {label} →
    </button>
  );
}

/** Targeta de resultat d'un minijoc ("has fet 0,23 s!"). */
export function GameResult({ headline, detail, rating, onNext }: { headline: string; detail?: string; rating: string; onNext: () => void }) {
  return (
    <div className="game">
      <div className="card result-card stack">
        <div className="game-big">{headline}</div>
        {detail && <div className="muted">{detail}</div>}
        <div className="result-rating">{rating}</div>
      </div>
      <div className="step-actions" style={{ width: '100%' }}>
        <NextButton onClick={onNext} />
      </div>
    </div>
  );
}
