import { useState } from 'react';
import { EDITION_ID } from '../../../data/repo';
import { formatEuros, formatSignedEuros, parseEuros } from '../../../domain/money/euros';
import { stayUnits } from '../../../domain/money/engine';
import type { Pricing, PricingMode } from '../../../domain/money/types';
import { slugId } from '../../../domain/text';
import { askConfirm } from '../../../ui/confirm';
import { EuroInput, PersonSelect, TextCell } from './fields';
import type { MoneyTabProps } from './MoneyPage';

export function PricingTab({ repo, data, money }: MoneyTabProps) {
  const { pricing, summary } = money;
  const maxNights = Math.max(1, data.edition?.nights.length ?? 2);
  const counts = Array.from({ length: maxNights }, (_, i) => i + 1);
  const savePricing = (patch: Partial<Pricing>) => repo.savePricing(EDITION_ID, patch);
  const attendeesWith = (n: number) => summary.people.filter((p) => p.attending && p.nightsCount === n).length;
  const [snapNote, setSnapNote] = useState('');

  const surplusIfAnnounced = summary.people
    .filter((p) => p.attending)
    .reduce((acc, p) => {
      const a = pricing.announced[String(p.nightsCount)];
      return acc + (typeof a === 'number' ? a - p.includedCalculated : 0);
    }, 0);

  return (
    <div className="pricing-layout">
      <section className="card stack">
        <h3>Preu per persona</h3>
        <div className="seg">
          {(
            [
              ['announced', 'Cobrar el preu comunicat'],
              ['calculated', 'Cobrar el preu calculat'],
            ] as [PricingMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className={pricing.mode === mode ? 'on' : ''}>
              <input type="radio" name="mode" checked={pricing.mode === mode} onChange={() => savePricing({ mode })} />
              {label}
            </label>
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {pricing.mode === 'announced'
            ? 'Cadascú paga el preu que has dit segons les nits que ve, més les partides que no van incloses al preu i els seus ajustos. La diferència amb el cost real és el teu superàvit o dèficit.'
            : 'Cadascú paga exactament la seva part del cost: canvia cada cop que algú es dona de baixa o puja una despesa.'}
        </p>
        <div className="table-wrap">
          <table className="grid money-grid" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Nits</th>
                <th className="center">Persones</th>
                <th className="num" title="Pes de l'estada per al repartiment «per pes d'estada»">
                  Pes
                </th>
                <th className="num">Calculat ara</th>
                <th className="num">Comunicat</th>
                <th className="num">Diferència</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((n) => {
                const ref = summary.reference[String(n)] ?? 0;
                const ann = pricing.announced[String(n)];
                return (
                  <tr key={n}>
                    <td className="nowrap">
                      {n} {n === 1 ? 'nit' : 'nits'}
                    </td>
                    <td className="center">{attendeesWith(n)}</td>
                    <td>
                      <input
                        className="cell num"
                        type="number"
                        step="0.05"
                        min="0"
                        value={pricing.stayUnits[String(n)] ?? ''}
                        placeholder={stayUnits(pricing, n, maxNights).toFixed(2)}
                        onChange={(e) => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          const next = { ...pricing.stayUnits };
                          if (v === null || Number.isNaN(v)) delete next[String(n)];
                          else next[String(n)] = v;
                          savePricing({ stayUnits: next });
                        }}
                      />
                    </td>
                    <td className="num">{formatEuros(ref)}</td>
                    <td>
                      <EuroInput
                        value={typeof ann === 'number' ? ann : null}
                        placeholder="—"
                        onCommit={(c) => {
                          const next = { ...pricing.announced };
                          if (c === null) delete next[String(n)];
                          else next[String(n)] = c;
                          savePricing({ announced: next });
                        }}
                        ariaLabel={`Preu comunicat ${n} nits`}
                      />
                    </td>
                    <td className={`num ${typeof ann === 'number' && ann < ref ? 'neg' : 'pos'}`}>{typeof ann === 'number' ? formatSignedEuros(ann - ref) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          <b>Calculat ara</b>: el que pagaria una persona sense etiquetes amb l'assistència confirmada d'ara, comptant només les partides
          incloses al preu. Amb el preu comunicat, el balanç total és <b className={surplusIfAnnounced < 0 ? 'neg' : 'pos'}>{formatSignedEuros(surplusIfAnnounced)}</b>{' '}
          respecte al calculat.
        </p>
      </section>

      <section className="card stack">
        <h3>Historial del preu</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Guarda una foto del preu calculat per veure com canvia amb les altes i baixes.
        </p>
        <div className="row">
          <input className="input" placeholder="Nota (ex. després de les baixes)" value={snapNote} onChange={(e) => setSnapNote(e.target.value)} />
          <button
            className="btn btn-sm"
            onClick={async () => {
              await savePricing({ snapshots: [...pricing.snapshots, { at: Date.now(), attendees: summary.totals.attendees, reference: summary.reference, note: snapNote.trim() }] });
              setSnapNote('');
            }}
          >
            📸 Guardar foto
          </button>
        </div>
        {pricing.snapshots.length > 0 && (
          <table className="grid money-grid" style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Quan</th>
                <th className="center">Persones</th>
                {counts.map((n) => (
                  <th key={n} className="num">
                    {n} {n === 1 ? 'nit' : 'nits'}
                  </th>
                ))}
                <th>Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...pricing.snapshots, null].reverse().map((s) => (
                <tr key={s?.at ?? 'now'} className={s ? '' : 'row-open'}>
                  <td>{s ? new Date(s.at).toLocaleDateString('ca', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ara'}</td>
                  <td className="center">{s ? s.attendees : summary.totals.attendees}</td>
                  {counts.map((n) => (
                    <td key={n} className="num">
                      {formatEuros((s ? s.reference : summary.reference)[String(n)] ?? 0)}
                    </td>
                  ))}
                  <td>{s?.note}</td>
                  <td>
                    {s && (
                      <button className="icon-btn" title="Esborrar" onClick={() => savePricing({ snapshots: pricing.snapshots.filter((x) => x !== s) })}>
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AdjustmentsSection repo={repo} data={data} money={money} />
    </div>
  );
}

function AdjustmentsSection({ repo, data, money }: MoneyTabProps) {
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const cents = parseEuros(amount);
  const nameOf = new Map(data.participants.map((p) => [p.id, p.name]));
  const add = async () => {
    if (!person || !cents) return;
    await repo.saveMoneyDocs(EDITION_ID, 'adjustments', [{ id: slugId('adj'), participantId: person, amount: cents, reason: reason.trim() }]);
    setPerson('');
    setAmount('');
    setReason('');
  };
  return (
    <section className="card stack">
      <h3>Ajustos manuals</h3>
      <p className="muted small" style={{ margin: 0 }}>
        Càrrecs extra (positiu) o descomptes (negatiu) per a una persona, amb el motiu. Ex. −20 € perquè porta la barbacoa.
      </p>
      <div className="money-form">
        <PersonSelect className="input" value={person} onChange={setPerson} people={data.participants} placeholder="Persona" />
        <input
          className={`input num ${amount && cents === null ? 'invalid' : ''}`}
          inputMode="decimal"
          placeholder="Import € (−20 = descompte)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input className="input grow" placeholder="Motiu" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-sm" disabled={!person || !cents} onClick={add}>
          + Afegir ajust
        </button>
      </div>
      {money.adjustments.length > 0 && (
        <table className="grid money-grid" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th>Persona</th>
              <th className="num">Import</th>
              <th>Motiu</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {money.adjustments.map((a) => (
              <tr key={a.id}>
                <td>{nameOf.get(a.participantId) ?? <span className="error-text">Persona eliminada</span>}</td>
                <td>
                  <EuroInput value={a.amount} allowNegative onCommit={(c) => c && repo.saveMoneyDocs(EDITION_ID, 'adjustments', [{ ...a, amount: c }])} />
                </td>
                <td>
                  <TextCell value={a.reason} onCommit={(r) => repo.saveMoneyDocs(EDITION_ID, 'adjustments', [{ ...a, reason: r }])} />
                </td>
                <td>
                  <button
                    className="icon-btn"
                    title="Eliminar"
                    onClick={async () =>
                      (await askConfirm({ title: 'ESBORRAR?', message: `Esborrar l'ajust de ${nameOf.get(a.participantId) ?? '?'}?`, confirmLabel: 'Esborrar', danger: true })) &&
                      repo.deleteMoneyDoc(EDITION_ID, 'adjustments', a.id)
                    }
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
