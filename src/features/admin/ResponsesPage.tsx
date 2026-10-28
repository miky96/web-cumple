import { useState } from 'react';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { describeAnswer, minigameRankings } from '../../domain/insights/curiosities';
import { STEP_CATALOG } from '../../domain/quiz/catalog';
import type { Participant } from '../../domain/types';
import { askConfirm } from '../../ui/confirm';
import type { AdminData } from './useAdminData';

const MEDALS = ['🥇', '🥈', '🥉'];

export function ResponsesPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const steps = data.publicEdition?.quizSteps ?? [];
  const people = data.participants
    .map((p) => ({ p, r: data.responseByToken.get(p.token) }))
    .filter((x) => x.r)
    .map(({ p, r }) => ({ p, name: p.name, answers: r!.answers, at: r!.completedAt }));
  const rankings = minigameRankings(steps, people);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // només comptem les seleccionades que encara tenen resposta
  const chosen = people.filter((x) => selected.has(x.p.id)).map((x) => x.p);
  const allChosen = people.length > 0 && chosen.length === people.length;
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const reset = async (ps: Participant[]) => {
    if (ps.length === 0) return;
    const who = ps.length === 1 ? `la resposta de ${ps[0].name}` : `${ps.length} respostes`;
    const ok = await askConfirm({
      title: 'RESET?',
      message: `Esborrar ${who}? Podran tornar a fer el qüestionari i deixaran de sortir com a «contestat» als seus companys.`,
      confirmLabel: 'Esborrar',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await repo.resetResponses(EDITION_ID, ps);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Respostes</h1>
      <p className="muted">
        {people.length} de {data.participants.length} han fet el qüestionari.
      </p>

      {rankings.length > 0 && (
        <>
          <h2>Curiositats dels minijocs</h2>
          <div className="board" style={{ marginBottom: 24 }}>
            {rankings.map((rk) => (
              <section key={rk.stepId} className="card" style={{ padding: 14 }}>
                <h3>
                  {STEP_CATALOG[rk.type].emoji} {STEP_CATALOG[rk.type].label}
                </h3>
                <p className="muted small">{rk.title}</p>
                {rk.entries.length === 0 ? (
                  <p className="muted small">Encara ningú.</p>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 22 }}>
                    {rk.entries.slice(0, 10).map((e, i) => (
                      <li key={e.name}>
                        {MEDALS[i] ?? ''} <b>{e.name}</b> — {e.value}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Totes les respostes</h2>
        <span className="spacer" />
        <button type="button" className="btn btn-sm btn-danger" disabled={busy || chosen.length === 0} onClick={() => reset(chosen)}>
          Esborrar seleccionades{chosen.length > 0 ? ` (${chosen.length})` : ''}
        </button>
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="center">
                <input
                  type="checkbox"
                  aria-label="Seleccionar-les totes"
                  checked={allChosen}
                  disabled={people.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set(people.map((x) => x.p.id)) : new Set())}
                />
              </th>
              <th>Nom</th>
              {steps.map((s) => (
                <th key={s.id} title={s.title}>
                  {STEP_CATALOG[s.type].emoji} {s.title.length > 28 ? `${s.title.slice(0, 28)}…` : s.title}
                </th>
              ))}
              <th>Quan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((x) => (
              <tr key={x.p.id}>
                <td className="center">
                  <input type="checkbox" aria-label={`Seleccionar ${x.name}`} checked={selected.has(x.p.id)} onChange={(e) => toggle(x.p.id, e.target.checked)} />
                </td>
                <td>
                  <b>{x.name}</b>
                </td>
                {steps.map((s) => (
                  <td key={s.id}>{describeAnswer(s, x.answers[s.id])}</td>
                ))}
                <td className="muted small">{x.at ? new Date(x.at).toLocaleString('ca') : ''}</td>
                <td>
                  <button type="button" className="icon-btn" title="Esborrar la resposta (podrà tornar a jugar)" disabled={busy} onClick={() => reset([x.p])}>
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={steps.length + 4} className="muted center" style={{ padding: 24 }}>
                  Encara no ha respost ningú.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
