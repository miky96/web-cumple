import { useCallback, useState } from 'react';
import { EDITION_ID } from '../../../data/repo';
import { formatEuros, parseEuros, todayIso } from '../../../domain/money/euros';
import { parseExpensesPaste } from '../../../domain/money/importMoney';
import type { Expense } from '../../../domain/money/types';
import { slugId } from '../../../domain/text';
import { Link } from '../../../lib/router';
import { askConfirm } from '../../../ui/confirm';
import { EuroInput, PersonSelect, TextCell } from './fields';
import { ImportBox } from './ImportBox';
import type { MoneyTabProps } from './MoneyPage';

export function ExpensesTab({ repo, data, money }: MoneyTabProps) {
  const lines = money.lines;
  const [showImport, setShowImport] = useState(false);
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [paidBy, setPaidBy] = useState('organizer');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('');
  const cents = parseEuros(amount);
  const people = data.participants;
  const save = (e: Expense) => repo.saveMoneyDocs(EDITION_ID, 'expenses', [e]);
  const effectiveLine = lines.some((l) => l.id === lineId) ? lineId : (lines[0]?.id ?? '');

  const add = async () => {
    if (!concept.trim() || cents === null || cents === 0 || !effectiveLine) return;
    await save({ id: slugId('exp'), date, concept: concept.trim(), amount: cents, lineId: effectiveLine, paidBy, note: note.trim() });
    setConcept('');
    setAmount('');
    setNote('');
  };
  const parse = useCallback(
    (text: string) => parseExpensesPaste(text, lines, people, { today: todayIso(), defaultLineId: effectiveLine }),
    [lines, people, effectiveLine],
  );

  if (lines.length === 0)
    return (
      <div className="card stack">
        <p>Abans d'apuntar despeses cal tenir partides al pressupost (Casa, Menjar, Alcohol...).</p>
        <Link className="btn btn-sm" href="/admin/diners/pressupost">
          Anar al pressupost
        </Link>
      </div>
    );

  const visible = money.expenses.filter((e) => !filter || e.lineId === filter);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));

  return (
    <>
      {showImport && (
        <ImportBox
          title="Importar despeses de l'Excel"
          help={
            <>
              Amb capçaleres (<b>Data</b>, <b>Concepte</b>, <b>Import</b>, <b>Partida</b>, <b>Pagat per</b>, <b>Nota</b>) en qualsevol ordre; sense,
              en aquest ordre. <b>Partida</b> es busca pel nom; si no hi és, va a la partida triada a sota. <b>Pagat per</b> buit o «jo» = l'has
              pagat tu; si hi poses el nom d'un participant, li compta com a pagament seu.
            </>
          }
          extra={
            <label className="small">
              Partida per defecte:{' '}
              <select className="input input-sm" value={effectiveLine} onChange={(e) => setLineId(e.target.value)}>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          }
          placeholder={'Data\tConcepte\tImport\tPartida\tPagat per\n05/10/2026\tPaga i senyal casa\t800\tCasa\t\n22/10/2026\tGin\t64,50\tAlcohol\tBernat'}
          parse={parse}
          onImport={(rows) => repo.saveMoneyDocs(EDITION_ID, 'expenses', rows.map((r) => ({ ...r, id: slugId('exp') })))}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="card money-form">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input grow" placeholder="Concepte (súper, paga i senyal casa...)" value={concept} onChange={(e) => setConcept(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input
          className={`input num ${amount && cents === null ? 'invalid' : ''}`}
          inputMode="decimal"
          placeholder="Import €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select className="input" value={effectiveLine} onChange={(e) => setLineId(e.target.value)} aria-label="Partida">
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <PersonSelect className="input" value={paidBy} onChange={setPaidBy} people={people} allowOrganizer />
        <input className="input" placeholder="Nota / botiga" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-sm" disabled={!concept.trim() || !cents} onClick={add}>
          + Apuntar despesa
        </button>
      </div>

      <div className="admin-toolbar">
        <select className="input input-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Totes les partides</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span className="muted small">
          {visible.length} despeses · {formatEuros(visible.reduce((a, e) => a + e.amount, 0))}
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
              <th>Concepte</th>
              <th className="num" style={{ width: 120 }}>
                Import
              </th>
              <th style={{ width: 170 }}>Partida</th>
              <th style={{ width: 190 }}>Pagat per</th>
              <th>Nota</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td>
                  <input className="cell" type="date" value={e.date} onChange={(ev) => ev.target.value && save({ ...e, date: ev.target.value })} />
                </td>
                <td>
                  <TextCell value={e.concept} onCommit={(concept) => concept && save({ ...e, concept })} />
                </td>
                <td>
                  <EuroInput value={e.amount} allowNegative onCommit={(c) => c && save({ ...e, amount: c })} ariaLabel="Import" />
                </td>
                <td>
                  <select className={`cell ${lineName.has(e.lineId) ? '' : 'invalid'}`} value={e.lineId} onChange={(ev) => save({ ...e, lineId: ev.target.value })}>
                    {!lineName.has(e.lineId) && <option value={e.lineId}>⚠ partida esborrada</option>}
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <PersonSelect value={e.paidBy} onChange={(paidBy) => save({ ...e, paidBy })} people={people} allowOrganizer />
                </td>
                <td>
                  <TextCell value={e.note} onCommit={(note) => save({ ...e, note })} />
                </td>
                <td>
                  <button
                    className="icon-btn"
                    title="Eliminar"
                    onClick={async () =>
                      (await askConfirm({ title: 'ESBORRAR?', message: `Esborrar «${e.concept}» (${formatEuros(e.amount)})?`, confirmLabel: 'Esborrar', danger: true })) &&
                      repo.deleteMoneyDoc(EDITION_ID, 'expenses', e.id)
                    }
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="muted center" style={{ padding: 24 }}>
                  Encara no hi ha cap despesa apuntada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
