import { describeAnswer, minigameRankings } from '../../domain/insights/curiosities';
import { STEP_CATALOG } from '../../domain/quiz/catalog';
import type { AdminData } from './useAdminData';

const MEDALS = ['🥇', '🥈', '🥉'];

export function ResponsesPage({ data }: { data: AdminData }) {
  const steps = data.publicEdition?.quizSteps ?? [];
  const people = data.participants
    .map((p) => ({ p, r: data.responseByToken.get(p.token) }))
    .filter((x) => x.r)
    .map(({ p, r }) => ({ name: p.name, answers: r!.answers, at: r!.completedAt }));
  const rankings = minigameRankings(steps, people);

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

      <h2>Totes les respostes</h2>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Nom</th>
              {steps.map((s) => (
                <th key={s.id} title={s.title}>
                  {STEP_CATALOG[s.type].emoji} {s.title.length > 28 ? `${s.title.slice(0, 28)}…` : s.title}
                </th>
              ))}
              <th>Quan</th>
            </tr>
          </thead>
          <tbody>
            {people.map((x) => (
              <tr key={x.name}>
                <td>
                  <b>{x.name}</b>
                </td>
                {steps.map((s) => (
                  <td key={s.id}>{describeAnswer(s, x.answers[s.id])}</td>
                ))}
                <td className="muted small">{x.at ? new Date(x.at).toLocaleString('ca') : ''}</td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={steps.length + 2} className="muted center" style={{ padding: 24 }}>
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
