import { EDITION_ID } from '../../../data/repo';
import { defaultBudgetLines, METHOD_LABELS } from '../../../domain/money/defaults';
import { formatEuros, formatSignedEuros } from '../../../domain/money/euros';
import type { BudgetLine, SplitMethod } from '../../../domain/money/types';
import { slugId } from '../../../domain/text';
import { askConfirm } from '../../../ui/confirm';
import { EuroInput, ScopeEditor, TextCell } from './fields';
import type { MoneyTabProps } from './MoneyPage';

export function BudgetTab({ repo, data, money }: MoneyTabProps) {
  const { summary } = money;
  const save = (l: BudgetLine) => repo.saveMoneyDocs(EDITION_ID, 'budgetLines', [l]);
  const knownTags = [...new Set(data.participants.flatMap((p) => p.tags))].sort();
  const usedBy = (id: string) => money.expenses.filter((e) => e.lineId === id).length;

  if (money.lines.length === 0)
    return (
      <div className="card stack">
        <h3>Encara no hi ha pressupost</h3>
        <p className="muted">
          Crea les partides per començar (Casa, Menjar, Alcohol excepte «no beu», Activitats i decoració). Després hi poses l'import previst i
          les pots canviar, afegir-ne o esborrar-ne.
        </p>
        <div className="row">
          <button className="btn btn-sm" onClick={() => repo.saveMoneyDocs(EDITION_ID, 'budgetLines', defaultBudgetLines())}>
            Crear partides per defecte
          </button>
        </div>
      </div>
    );

  const t = summary.totals;
  return (
    <>
      <div className="table-wrap">
        <table className="grid money-grid budget-grid">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Partida</th>
              <th style={{ width: 180 }}>Repartiment</th>
              <th style={{ width: '20%' }}>Qui hi entra</th>
              <th className="num" style={{ width: 120 }}>
                Previst
              </th>
              <th className="num">Gastat</th>
              <th style={{ width: 140 }}>Execució</th>
              <th className="num">Queda</th>
              <th className="num" title="El que es reparteix entre la gent">
                Es reparteix
              </th>
              <th className="center" title="Persones confirmades que hi entren">
                Pers.
              </th>
              <th className="center" title="Inclosa al preu comunicat (si no, es cobra a part)">
                Al preu
              </th>
              <th className="center" title="Tancada: ja no hi haurà més despeses i es reparteix el real">
                Tancada
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summary.lines.map(({ line, spent, allocated, members, remaining }, index) => {
              const pct = line.planned > 0 ? Math.round((spent / line.planned) * 100) : spent > 0 ? 100 : 0;
              return (
                <tr key={line.id}>
                  <td>
                    <TextCell value={line.name} onCommit={(name) => name && save({ ...line, name })} />
                  </td>
                  <td>
                    <select className="cell" value={line.method} onChange={(e) => save({ ...line, method: e.target.value as SplitMethod })}>
                      {Object.entries(METHOD_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <ScopeEditor key={line.scope.kind} scope={line.scope} onChange={(scope) => save({ ...line, scope })} people={data.participants} knownTags={knownTags} />
                  </td>
                  <td>
                    <EuroInput value={line.planned} onCommit={(c) => save({ ...line, planned: c ?? 0 })} ariaLabel={`Previst ${line.name}`} />
                  </td>
                  <td className="num">{formatEuros(spent)}</td>
                  <td>
                    <div className={`bar ${pct > 100 ? 'over' : ''}`} title={`${pct}% del previst`}>
                      <span style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="muted small">{pct}%</span>
                  </td>
                  <td className={`num ${remaining < 0 ? 'neg' : ''}`}>{formatSignedEuros(remaining)}</td>
                  <td className="num strong">{formatEuros(allocated)}</td>
                  <td className={`center ${members === 0 && allocated > 0 ? 'neg' : ''}`}>{members}</td>
                  <td className="center">
                    <input type="checkbox" checked={line.inAnnounced} onChange={(e) => save({ ...line, inAnnounced: e.target.checked })} aria-label="Inclosa al preu comunicat" />
                  </td>
                  <td className="center">
                    <input type="checkbox" checked={line.closed} onChange={(e) => save({ ...line, closed: e.target.checked })} aria-label="Tancada" />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn" title="Pujar" disabled={index === 0} onClick={() => move(line, -1)}>
                        ↑
                      </button>
                      <button
                        className="icon-btn"
                        title="Eliminar"
                        onClick={async () => {
                          const n = usedBy(line.id);
                          if (n > 0)
                            return askConfirm({ title: 'NO ES POT', message: `«${line.name}» té ${n} despeses. Mou-les a una altra partida abans d'esborrar-la.`, confirmLabel: "D'acord" });
                          if (await askConfirm({ title: 'ESBORRAR?', message: `Esborrar la partida «${line.name}»?`, confirmLabel: 'Esborrar', danger: true }))
                            await repo.deleteMoneyDoc(EDITION_ID, 'budgetLines', line.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="num">{formatEuros(t.planned)}</td>
              <td className="num">{formatEuros(t.spent)}</td>
              <td />
              <td className={`num ${t.planned - t.spent < 0 ? 'neg' : ''}`}>{formatSignedEuros(t.planned - t.spent)}</td>
              <td className="num">{formatEuros(t.cost)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <button
          className="btn btn-sm"
          onClick={() =>
            save({
              id: slugId('line'),
              name: 'Nova partida',
              planned: 0,
              method: 'equal',
              scope: { kind: 'all' },
              closed: false,
              inAnnounced: true,
              order: Math.max(-1, ...money.lines.map((l) => l.order)) + 1,
            })
          }
        >
          + Afegir partida
        </button>
      </div>
      <div className="card small muted stack">
        <p style={{ margin: 0 }}>
          <b>Es reparteix:</b> mentre una partida és oberta, es reparteix el més gran entre el previst i el gastat (així el preu no baixa abans d'hora).
          Quan la tanques, es reparteix només el que has gastat de debò.
        </p>
        <p style={{ margin: 0 }}>
          <b>Repartiment:</b> a parts iguals; per nits (qui ve 2 nits paga el doble que qui en ve 1); o per pes d'estada, configurable a «Preu i
          ajustos» (per defecte 1 nit = 0,6). Només entren els participants <b>confirmats</b> i amb alguna nit.
        </p>
        <p style={{ margin: 0 }}>
          <b>Al preu:</b> si està marcada, la partida va dins del preu que has comunicat. Si no, es cobra a part (ex. alcohol només per a qui
          beu).
        </p>
      </div>
    </>
  );

  async function move(line: BudgetLine, dir: -1) {
    const sorted = [...money.lines].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((l) => l.id === line.id);
    const other = sorted[i + dir];
    if (!other) return;
    const reordered = sorted.map((l, k) => ({ ...l, order: k }));
    reordered[i] = { ...reordered[i], order: i + dir };
    reordered[i + dir] = { ...reordered[i + dir], order: i };
    await repo.saveMoneyDocs(EDITION_ID, 'budgetLines', reordered);
  }
}
