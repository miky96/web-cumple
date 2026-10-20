import { useState, type ComponentType } from 'react';
import { useRemoteDraft } from '../../lib/hooks';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { createStep, STEP_CATALOG, STEP_TYPES } from '../../domain/quiz/catalog';
import { slugId } from '../../domain/text';
import type { Group, QuizStep, StepConfigs, StepType, Theme } from '../../domain/types';
import { DEFAULT_THEME } from '../../domain/theme/palette';
import { QuizRunner } from '../public/QuizRunner';
import { ResultView } from '../public/ResultView';
import { RevealAnimation } from '../public/RevealAnimation';
import { ThemeScope } from '../../ui/ThemeScope';
import { STEP_EDITORS } from './stepEditors';
import type { AdminData } from './useAdminData';

function PreviewPhone({ steps, theme, group, onClose }: { steps: QuizStep[]; theme: Theme; group?: Group; onClose: () => void }) {
  const [phase, setPhase] = useState<'quiz' | 'reveal' | 'result'>('quiz');
  const [run, setRun] = useState(0);
  const sample = {
    editionId: EDITION_ID,
    groupName: group?.name ?? 'Grup de Prova',
    color: group?.color ?? '#8e24aa',
    image: group?.image ?? null,
    selfKey: 'prova_jo',
    mateKeys: ['prova_1', 'prova_2', 'prova_3', 'prova_4'],
  };
  return (
    <div className="preview-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button className="btn btn-ghost btn-sm preview-close" onClick={onClose}>
        Tancar prova ✕
      </button>
      <div className="phone">
        <ThemeScope theme={theme}>
          {phase === 'quiz' && (
            <main className="screen" key={run}>
              <div className="screen-inner">
                <QuizRunner steps={steps} ctx={{ displayName: 'Miquel' }} onComplete={() => setPhase('reveal')} />
              </div>
            </main>
          )}
          {phase === 'reveal' && <RevealAnimation color={sample.color} onDone={() => setPhase('result')} />}
          {phase === 'result' && (
            <ResultView
              reveal={sample}
              mates={['Anna', 'Bernat']}
              name="Miquel"
              celebrate
              background={sample.image ?? theme.resultBackground ?? null}
              footer="(Prova: no s'ha desat res)"
              onReplay={() => {
                setRun((r) => r + 1);
                setPhase('quiz');
              }}
            />
          )}
        </ThemeScope>
      </div>
    </div>
  );
}

export function QuizPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const remote = data.publicEdition?.quizSteps ?? [];
  const [dirty, setDirty] = useState(false);
  const [steps, setSteps] = useRemoteDraft(data.publicEdition?.quizSteps, (s): QuizStep[] => s ?? [], !dirty);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [newType, setNewType] = useState<StepType>('choice');
  const answered = data.responses.length;

  const update = (next: QuizStep[]) => {
    setSteps(next);
    setDirty(true);
  };
  const patchStep = (i: number, patch: Partial<QuizStep>) => update(steps.map((s, j) => (j === i ? ({ ...s, ...patch } as QuizStep) : s)));
  const moveStep = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };

  const save = async () => {
    setSaving(true);
    await repo.savePublicEdition(EDITION_ID, { quizSteps: steps });
    setSaving(false);
    setDirty(false);
  };

  return (
    <>
      <h1>Qüestionari</h1>
      {answered > 0 && (
        <div className="admin-banner warn">
          Ja hi ha {answered} respostes. Si canvies o esborres passos, les respostes antigues es mantenen però potser no quadraran.
        </div>
      )}
      <div className="admin-toolbar">
        <button className="btn btn-sm" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Desant...' : dirty ? 'Desar canvis' : 'Desat ✓'}
        </button>
        <button className="btn btn-accent btn-sm" disabled={steps.length === 0} onClick={() => setPreview(true)}>
          ▶ Provar al mòbil
        </button>
        {dirty && (
          <button className="link-btn" onClick={() => { setSteps(remote); setDirty(false); }}>
            Descartar canvis
          </button>
        )}
        <span className="spacer" />
        <select className="select" style={{ width: 220, minHeight: 38 }} value={newType} onChange={(e) => setNewType(e.target.value as StepType)}>
          {STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {STEP_CATALOG[t].emoji} {STEP_CATALOG[t].label}
              {STEP_CATALOG[t].isMinigame ? ' (minijoc)' : ''}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => update([...steps, createStep(newType, slugId('s')) as QuizStep])}>
          + Afegir pas
        </button>
      </div>

      {steps.map((s, i) => {
        const info = STEP_CATALOG[s.type];
        const Editor = STEP_EDITORS[s.type] as ComponentType<{ config: StepConfigs[StepType]; onChange: (c: StepConfigs[StepType]) => void }>;
        return (
          <article key={s.id} className="step-card">
            <header>
              <strong>{i + 1}.</strong>
              <span className="type">
                {info.emoji} {info.label}
              </span>
              <span className="spacer" />
              <button className="icon-btn" disabled={i === 0} onClick={() => moveStep(i, -1)} title="Pujar">
                ↑
              </button>
              <button className="icon-btn" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} title="Baixar">
                ↓
              </button>
              <button className="icon-btn" title="Eliminar" onClick={() => update(steps.filter((_, j) => j !== i))}>
                🗑
              </button>
            </header>
            <label className="field">
              <span>Pregunta / títol</span>
              <input className="input" value={s.title} onChange={(e) => patchStep(i, { title: e.target.value })} />
            </label>
            <Editor config={s.config} onChange={(config) => patchStep(i, { config } as Partial<QuizStep>)} />
          </article>
        );
      })}

      {preview && (
        <PreviewPhone steps={steps} theme={data.publicEdition?.theme ?? DEFAULT_THEME} group={data.groups[0]} onClose={() => setPreview(false)} />
      )}
    </>
  );
}
