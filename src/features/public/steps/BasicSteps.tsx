import { useState } from 'react';
import { validateAnswer } from '../../../domain/quiz/validate';
import { safeImageUrl } from '../../../domain/safeUrl';
import { NextButton, StepShell, type StepProps } from './common';

export function ProfileStep({ step, ctx, onSubmit }: StepProps<'profile'>) {
  const [nickname, setNickname] = useState(ctx.displayName);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const value = { nickname: nickname.trim(), email: email.trim() };
  const error = validateAnswer(step, value);
  return (
    <StepShell
      kicker="Registre"
      title={step.title}
      actions={<NextButton disabled={!!error} onClick={() => onSubmit(value)} />}
    >
      <label className="field">
        <span>Com vols que et diguem?</span>
        <input className="input" value={nickname} maxLength={40} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} onBlur={() => setTouched(true)} />
      </label>
      {step.config.askEmail && (
        <label className="field">
          <span>
            Correu <span className="muted small">(opcional, per poder gestionar encara més coses l'any que ve)</span>
          </span>
          <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
        </label>
      )}
      {touched && error && <p className="error-text">{error}</p>}
    </StepShell>
  );
}

export function TextStep({ step, onSubmit }: StepProps<'text'>) {
  const [text, setText] = useState('');
  const error = validateAnswer(step, text);
  return (
    <StepShell title={step.title} actions={<NextButton disabled={!!error} onClick={() => onSubmit(text.trim())} />}>
      <textarea
        className="textarea"
        value={text}
        maxLength={step.config.maxLength}
        placeholder={step.config.placeholder}
        onChange={(e) => setText(e.target.value)}
      />
      <span className="muted small" style={{ textAlign: 'right' }}>
        {text.length}/{step.config.maxLength}
      </span>
    </StepShell>
  );
}

export function ChoiceStep({ step, onSubmit }: StepProps<'choice'>) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((cur) => (step.config.multiple ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  return (
    <StepShell
      kicker={step.config.multiple ? 'Pots triar-ne diverses' : undefined}
      title={step.title}
      actions={<NextButton disabled={!!validateAnswer(step, selected)} onClick={() => onSubmit(selected)} />}
    >
      {step.config.options.map((o, i) => {
        const on = selected.includes(o.id);
        return (
          <button key={o.id} type="button" className="option" aria-pressed={on} onClick={() => toggle(o.id)} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="option-mark">{on ? '✓' : ''}</span>
            {o.label}
          </button>
        );
      })}
    </StepShell>
  );
}

export function ImageChoiceStep({ step, onSubmit }: StepProps<'image-choice'>) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <StepShell title={step.title} actions={<NextButton disabled={!selected} onClick={() => selected && onSubmit(selected)} />}>
      <div className="image-grid">
        {step.config.options.map((o) => (
          <button key={o.id} type="button" className="image-option" aria-pressed={selected === o.id} onClick={() => setSelected(o.id)}>
            {safeImageUrl(o.image) ? <img src={safeImageUrl(o.image)!} alt="" loading="eager" /> : <span className="emoji">{o.emoji ?? '🗿'}</span>}
            <span className="label">{o.label}</span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}

const SLIDER_EMOJIS = ['😴', '🥱', '🙂', '😄', '🤩', '🔥', '🌋'];

export function SliderStep({ step, onSubmit }: StepProps<'slider'>) {
  const { min, max, minLabel, maxLabel } = step.config;
  const [value, setValue] = useState(Math.round((min + max) / 2));
  const t = max === min ? 0 : (value - min) / (max - min);
  const emoji = SLIDER_EMOJIS[Math.round(t * (SLIDER_EMOJIS.length - 1))];
  return (
    <StepShell title={step.title} actions={<NextButton onClick={() => onSubmit(value)} />}>
      <div className="slider-wrap card">
        <span className="slider-emoji" style={{ transform: `scale(${0.8 + t * 0.7}) rotate(${(t - 0.5) * 20}deg)` }}>
          {emoji}
        </span>
        <div className="slider-value">{value}</div>
        <input
          className="range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={step.title}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <div className="slider-labels">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </StepShell>
  );
}
