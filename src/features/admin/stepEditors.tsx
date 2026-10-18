import type { ComponentType } from 'react';
import { slugId } from '../../domain/text';
import type { StepConfigs, StepType } from '../../domain/types';

interface EditorProps<T extends StepType> {
  config: StepConfigs[T];
  onChange: (c: StepConfigs[T]) => void;
}

const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== '' ? Number(v) : fallback);

function NumField({ label, value, onChange, step = 1, min }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type="number" step={step} min={min} value={value} onChange={(e) => onChange(num(e.target.value, value))} />
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const ProfileEditor = ({ config, onChange }: EditorProps<'profile'>) => (
  <label className="row">
    <input type="checkbox" checked={config.askEmail} onChange={(e) => onChange({ ...config, askEmail: e.target.checked })} />
    Demanar correu (opcional per al participant)
  </label>
);

const TextEditor = ({ config, onChange }: EditorProps<'text'>) => (
  <div className="two-col">
    <TextField label="Placeholder" value={config.placeholder} onChange={(placeholder) => onChange({ ...config, placeholder })} />
    <NumField label="Màxim de caràcters" value={config.maxLength} min={10} onChange={(maxLength) => onChange({ ...config, maxLength })} />
  </div>
);

const ChoiceEditor = ({ config, onChange }: EditorProps<'choice'>) => (
  <div>
    {config.options.map((o, i) => (
      <div key={o.id} className="opt-row simple">
        <input
          className="input"
          value={o.label}
          onChange={(e) => onChange({ ...config, options: config.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
        />
        <button className="icon-btn" title="Treure" disabled={config.options.length <= 2} onClick={() => onChange({ ...config, options: config.options.filter((_, j) => j !== i) })}>
          ✕
        </button>
      </div>
    ))}
    <div className="row">
      <button className="btn btn-ghost btn-sm" onClick={() => onChange({ ...config, options: [...config.options, { id: slugId('o'), label: 'Nova opció' }] })}>
        + Opció
      </button>
      <label className="row small">
        <input type="checkbox" checked={config.multiple} onChange={(e) => onChange({ ...config, multiple: e.target.checked })} />
        Permetre'n diverses
      </label>
    </div>
  </div>
);

const ImageChoiceEditor = ({ config, onChange }: EditorProps<'image-choice'>) => {
  const set = (i: number, patch: Partial<(typeof config.options)[number]>) =>
    onChange({ ...config, options: config.options.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div>
      <div className="opt-row muted small" style={{ marginBottom: 2 }}>
        <span>Emoji</span>
        <span>Text</span>
        <span>Imatge (opcional, ruta a /public)</span>
        <span />
      </div>
      {config.options.map((o, i) => (
        <div key={o.id} className="opt-row">
          <input className="input" value={o.emoji ?? ''} onChange={(e) => set(i, { emoji: e.target.value || null })} />
          <input className="input" value={o.label} onChange={(e) => set(i, { label: e.target.value })} />
          <input className="input" value={o.image ?? ''} placeholder="/editions/2027/quiz/x.webp" onChange={(e) => set(i, { image: e.target.value.trim() || null })} />
          <button className="icon-btn" disabled={config.options.length <= 2} onClick={() => onChange({ ...config, options: config.options.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        disabled={config.options.length >= 6}
        onClick={() => onChange({ ...config, options: [...config.options, { id: slugId('o'), label: 'Nova', emoji: '🌺', image: null }] })}
      >
        + Opció
      </button>
    </div>
  );
};

const SliderEditor = ({ config, onChange }: EditorProps<'slider'>) => (
  <div className="two-col">
    <NumField label="Mínim" value={config.min} onChange={(min) => onChange({ ...config, min })} />
    <NumField label="Màxim" value={config.max} onChange={(max) => onChange({ ...config, max })} />
    <TextField label="Etiqueta mínim" value={config.minLabel} onChange={(minLabel) => onChange({ ...config, minLabel })} />
    <TextField label="Etiqueta màxim" value={config.maxLabel} onChange={(maxLabel) => onChange({ ...config, maxLabel })} />
  </div>
);

const StopEditor = ({ config, onChange }: EditorProps<'stop-the-clock'>) => (
  <div className="two-col">
    <NumField label="Objectiu (segons)" step={0.5} min={1} value={config.targetMs / 1000} onChange={(s) => onChange({ ...config, targetMs: Math.round(s * 1000) })} />
    <label className="field">
      <span>Amagar el rellotge als (s) — buit = mai</span>
      <input
        className="input"
        type="number"
        step={0.5}
        min={0}
        value={config.hideAfterMs === null ? '' : config.hideAfterMs / 1000}
        onChange={(e) => onChange({ ...config, hideAfterMs: e.target.value === '' ? null : Math.round(Number(e.target.value) * 1000) })}
      />
    </label>
  </div>
);

const ReactionEditor = ({ config, onChange }: EditorProps<'reaction'>) => (
  <div className="two-col">
    <NumField label="Espera mínima (s)" step={0.5} min={0.5} value={config.minDelayMs / 1000} onChange={(s) => onChange({ ...config, minDelayMs: Math.round(s * 1000) })} />
    <NumField label="Espera màxima (s)" step={0.5} min={1} value={config.maxDelayMs / 1000} onChange={(s) => onChange({ ...config, maxDelayMs: Math.round(s * 1000) })} />
  </div>
);

const TapEditor = ({ config, onChange }: EditorProps<'tap-race'>) => (
  <NumField label="Durada (segons)" min={2} value={config.durationMs / 1000} onChange={(s) => onChange({ ...config, durationMs: Math.round(s * 1000) })} />
);

const MemoryEditor = ({ config, onChange }: EditorProps<'memory-sequence'>) => (
  <div className="two-col">
    <NumField label="Nivells" min={1} value={config.levels} onChange={(levels) => onChange({ ...config, levels: Math.max(1, levels) })} />
    <NumField label="Llargada inicial" min={1} value={config.startLength} onChange={(startLength) => onChange({ ...config, startLength: Math.max(1, startLength) })} />
  </div>
);

export const STEP_EDITORS: { [T in StepType]: ComponentType<EditorProps<T>> } = {
  profile: ProfileEditor,
  text: TextEditor,
  choice: ChoiceEditor,
  'image-choice': ImageChoiceEditor,
  slider: SliderEditor,
  'stop-the-clock': StopEditor,
  reaction: ReactionEditor,
  'tap-race': TapEditor,
  'memory-sequence': MemoryEditor,
};
