import { useCallback, useState } from 'react';
import { EDITION_ID } from '../../../data/repo';
import { PAYMENT_METHOD_LABELS } from '../../../domain/money/defaults';
import { formatEuros, todayIso } from '../../../domain/money/euros';
import { parsePaymentsPaste } from '../../../domain/money/importMoney';
import type { Payment, PaymentMethod } from '../../../domain/money/types';
import { slugId } from '../../../domain/text';
import { askConfirm } from '../../../ui/confirm';
import { BatchPayments } from './BatchPayments';
import { EuroInput, PersonSelect, TextCell } from './fields';
import { ImportBox } from './ImportBox';
import type { MoneyTabProps } from './MoneyPage';

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export function PaymentsTab({ repo, data, money }: MoneyTabProps) {
  const [showImport, setShowImport] = useState(false);
  const method: PaymentMethod = 'bizum';
  const [filter, setFilter] = useState('');
  const people = data.participants;
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const save = (p: Payment) => repo.saveMoneyDocs(EDITION_ID, 'payments', [p]);

  const parse = useCallback((text: string) => parsePaymentsPaste(text, people, { today: todayIso(), defaultMethod: method }), [people, method]);
  const visible = money.payments.filter((p) => !filter || p.participantId === filter);
  const balanceOf = new Map(money.summary.people.map((s) => [s.id, s]));

  return (
    <>
      {showImport && (
        <ImportBox
          title="Importar pagaments de l'Excel"
          help={
            <>
              Copia les columnes de l'Excel i enganxa-les aquí. Si la primera fila té capçaleres (<b>Nom</b>, <b>Import</b>, <b>Data</b>, <b>Mètode</b>,{' '}
              <b>Nota</b>) l'ordre no importa; si no, l'ordre ha de ser Nom · Import · Data · Mètode · Nota. Els noms es busquen entre els
              participants (n'hi ha prou amb el nom de pila si no es repeteix). Sense mètode, es posa {PAYMENT_METHOD_LABELS[method]}.
            </>
          }
          placeholder={'Nom\tImport\tData\tMètode\nAnna\t45\t20/10/2026\tBizum\nBernat\t20\t21/10/2026\tTransferència'}
          parse={parse}
          onImport={(rows) => repo.saveMoneyDocs(EDITION_ID, 'payments', rows.map((r) => ({ ...r, id: slugId('pay') })))}
          onClose={() => setShowImport(false)}
        />
      )}

      <BatchPayments repo={repo} people={people} balances={balanceOf} />

      <div className="admin-toolbar">
        <PersonSelect className="input input-sm" value={filter} onChange={setFilter} people={people} placeholder="Totes les persones" />
        <span className="muted small">
          {visible.length} pagaments · {formatEuros(visible.reduce((a, p) => a + p.amount, 0))}
        </span>
        <div className="spacer" />
        {!showImport && (
          <button className="btn btn-sm" onClick={() => setShowImport(true)}>
            📋 Enganxar de l'Excel
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="grid money-grid">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Data</th>
              <th style={{ width: '22%' }}>Persona</th>
              <th className="num" style={{ width: 120 }}>
                Import
              </th>
              <th style={{ width: 150 }}>Mètode</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td>
                  <input className="cell" type="date" value={p.date} onChange={(e) => e.target.value && save({ ...p, date: e.target.value })} />
                </td>
                <td>
                  <PersonSelect value={p.participantId} onChange={(id) => id && save({ ...p, participantId: id })} people={people} />
                  {!nameOf.has(p.participantId) && <span className="error-text small">Persona eliminada</span>}
                </td>
                <td>
                  <EuroInput value={p.amount} allowNegative onCommit={(c) => c && save({ ...p, amount: c })} ariaLabel="Import" />
                </td>
                <td>
                  <select className="cell" value={p.method} onChange={(e) => save({ ...p, method: e.target.value as PaymentMethod })}>
                    {METHODS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <TextCell value={p.note} onCommit={(note) => save({ ...p, note })} />
                </td>
                <td>
                  <button
                    className="icon-btn"
                    title="Eliminar"
                    onClick={async () =>
                      (await askConfirm({
                        title: 'ESBORRAR?',
                        message: `Esborrar el pagament de ${formatEuros(p.amount)} de ${nameOf.get(p.participantId) ?? '?'}?`,
                        confirmLabel: 'Esborrar',
                        danger: true,
                      })) && repo.deleteMoneyDoc(EDITION_ID, 'payments', p.id)
                    }
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center" style={{ padding: 24 }}>
                  Encara no hi ha cap pagament apuntat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">Una devolució s'apunta com a pagament negatiu (ex. −20).</p>
    </>
  );
}
