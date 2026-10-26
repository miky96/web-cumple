import { useCallback, useState } from 'react';
import { EDITION_ID } from '../../../data/repo';
import { PAYMENT_METHOD_LABELS } from '../../../domain/money/defaults';
import { formatEuros, formatEurosPlain, parseEuros, todayIso } from '../../../domain/money/euros';
import { parsePaymentsPaste } from '../../../domain/money/importMoney';
import type { Payment, PaymentMethod } from '../../../domain/money/types';
import { slugId } from '../../../domain/text';
import { askConfirm } from '../../../ui/confirm';
import { EuroInput, PersonSelect, TextCell } from './fields';
import { ImportBox } from './ImportBox';
import type { MoneyTabProps } from './MoneyPage';

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export function PaymentsTab({ repo, data, money }: MoneyTabProps) {
  const [showImport, setShowImport] = useState(false);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod>('bizum');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('');
  const people = data.participants;
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const cents = parseEuros(amount);
  const save = (p: Payment) => repo.saveMoneyDocs(EDITION_ID, 'payments', [p]);

  const add = async () => {
    if (!person || cents === null || cents === 0) return;
    await save({ id: slugId('pay'), participantId: person, amount: cents, date, method, note: note.trim() });
    setPerson('');
    setAmount('');
    setNote('');
  };

  const parse = useCallback((text: string) => parsePaymentsPaste(text, people, { today: todayIso(), defaultMethod: method }), [people, method]);
  const visible = money.payments.filter((p) => !filter || p.participantId === filter);
  const balanceOf = new Map(money.summary.people.map((s) => [s.id, s]));
  const selected = person ? balanceOf.get(person) : undefined;

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

      <div className="card money-form">
        <PersonSelect className="input" value={person} onChange={setPerson} people={people} placeholder="Qui ha pagat?" />
        <input
          className={`input num ${amount && cents === null ? 'invalid' : ''}`}
          inputMode="decimal"
          placeholder="Import €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Nota (paga i senyal...)" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-sm" disabled={!person || !cents} onClick={add}>
          + Apuntar pagament
        </button>
        {selected && (
          <p className="muted small form-hint">
            {selected.name}: a pagar {formatEuros(selected.due)}, pagat {formatEuros(selected.paid)} →{' '}
            {selected.balance < 0 ? (
              <>
                falten <b>{formatEuros(-selected.balance)}</b>{' '}
                <button className="link-btn" onClick={() => setAmount(formatEurosPlain(-selected.balance))}>
                  (posar-ho)
                </button>
              </>
            ) : selected.balance > 0 ? (
              <>li has de tornar {formatEuros(selected.balance)}</>
            ) : (
              'ja està quadrat'
            )}
          </p>
        )}
      </div>

      <div className="admin-toolbar">
        <PersonSelect className="input input-sm" value={filter} onChange={setFilter} people={people} placeholder="Totes les persones" />
        <span className="muted small">
          {visible.length} pagaments · {formatEuros(visible.reduce((a, p) => a + p.amount, 0))}
        </span>
        <div className="spacer" />
        {!showImport && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
            📋 Importar de l'Excel
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
