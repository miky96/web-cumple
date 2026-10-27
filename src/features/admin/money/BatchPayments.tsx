import { useEffect, useMemo, useState } from 'react';
import { EDITION_ID } from '../../../data/repo';
import type { Repo } from '../../../data/repo';
import { checkDrafts, draftsToPayments, type DraftPayment } from '../../../domain/money/batch';
import { PAYMENT_METHOD_LABELS } from '../../../domain/money/defaults';
import { formatEuros, formatEurosPlain, parseEuros, todayIso } from '../../../domain/money/euros';
import type { PaymentMethod, PersonSummary } from '../../../domain/money/types';
import { normalizeName, slugId } from '../../../domain/text';
import type { Participant } from '../../../domain/types';
import { PersonSelect } from './fields';

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

interface Defaults {
  date: string;
  method: PaymentMethod;
  note: string;
}

const newRow = (d: Defaults, patch: Partial<DraftPayment> = {}): DraftPayment => ({ key: slugId('row'), participantId: '', amount: '', ...d, ...patch });

/** L'esborrany sobreviu als canvis de pestanya (no es perd si surts i tornes). */
let cache: { rows: DraftPayment[]; defaults: Defaults } | null = null;

/** Graella per apuntar molts pagaments de cop: una fila per pagament, i es desen tots alhora. */
export function BatchPayments({ repo, people, balances }: { repo: Repo; people: Participant[]; balances: Map<string, PersonSummary> }) {
  const [defaults, setDefaults] = useState<Defaults>(() => cache?.defaults ?? { date: todayIso(), method: 'bizum', note: '' });
  const [rows, setRows] = useState<DraftPayment[]>(() => cache?.rows ?? [newRow(defaults)]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  useEffect(() => {
    cache = { rows, defaults };
  }, [rows, defaults]);

  const checks = useMemo(() => checkDrafts(rows), [rows]);
  const okCount = checks.filter((c) => c.status === 'ok').length;
  const errCount = checks.filter((c) => c.status === 'error').length;
  const total = checks.reduce((a, c) => a + (c.status === 'ok' ? c.cents! : 0), 0);

  /** Sempre hi ha una fila buida al final per continuar escrivint. */
  const withTrailing = (rs: DraftPayment[]) => (rs.length && !rs[rs.length - 1].participantId && !rs[rs.length - 1].amount ? rs : [...rs, newRow(defaults)]);
  const update = (key: string, patch: Partial<DraftPayment>) => {
    setSaved(null);
    setRows((rs) => withTrailing(rs.map((r) => (r.key === key ? { ...r, ...patch } : r))));
  };
  const remove = (key: string) => setRows((rs) => withTrailing(rs.filter((r) => r.key !== key)));
  const addPeople = (entries: { id: string; amount: string }[]) => {
    setSaved(null);
    setRows((rs) => withTrailing([...rs.filter((r) => r.participantId || r.amount), ...entries.map((e) => newRow(defaults, { participantId: e.id, amount: e.amount }))]));
  };

  const save = async () => {
    const { payments, errors } = draftsToPayments(rows, () => slugId('pay'));
    if (errors || payments.length === 0) return;
    setBusy(true);
    try {
      await repo.saveMoneyDocs(EDITION_ID, 'payments', payments);
      setSaved(`${payments.length} ${payments.length === 1 ? 'pagament desat' : 'pagaments desats'} (${formatEuros(payments.reduce((a, p) => a + p.amount, 0))}).`);
      setRows([newRow(defaults)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack batch">
      <div className="batch-head">
        <h3>Apuntar pagaments</h3>
        <span className="muted small">Una fila per pagament. Quan omples l'última, en surt una de nova. Es desen tots alhora.</span>
      </div>
      <div className="batch-defaults">
        <span className="muted small">Per defecte a les files noves:</span>
        <input className="input input-sm" type="date" value={defaults.date} onChange={(e) => setDefaults({ ...defaults, date: e.target.value })} aria-label="Data per defecte" />
        <select className="input input-sm" value={defaults.method} onChange={(e) => setDefaults({ ...defaults, method: e.target.value as PaymentMethod })} aria-label="Mètode per defecte">
          {METHODS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input className="input input-sm" placeholder="Nota (ex. paga i senyal)" value={defaults.note} onChange={(e) => setDefaults({ ...defaults, note: e.target.value })} />
        <button
          className="link-btn small"
          title="Posa aquesta data, mètode i nota a totes les files"
          onClick={() => setRows((rs) => rs.map((r) => ({ ...r, date: defaults.date, method: defaults.method, note: defaults.note })))}
        >
          aplicar a totes
        </button>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => setShowPicker((v) => !v)}>
          {showPicker ? 'Tancar selecció' : '👥 Triar diverses persones'}
        </button>
      </div>

      {showPicker && <PeoplePicker people={people} balances={balances} onAdd={(e) => (addPeople(e), setShowPicker(false))} />}

      <table className="grid money-grid batch-grid">
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Persona</th>
            <th className="num" style={{ width: 130 }}>
              Import
            </th>
            <th style={{ width: 160 }}>Data</th>
            <th style={{ width: 150 }}>Mètode</th>
            <th>Nota</th>
            <th style={{ width: '18%' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const c = checks[i];
            const b = r.participantId ? balances.get(r.participantId) : undefined;
            const missing = b && b.balance < 0 ? -b.balance : 0;
            // si només falta l'import, és més útil oferir «falten X €» que l'error
            const shownError = c.error === "Falta l'import" && missing > 0 ? null : c.error;
            return (
              <tr key={r.key} className={c.status === 'error' ? 'row-error' : ''}>
                <td>
                  <PersonSelect value={r.participantId} onChange={(id) => update(r.key, { participantId: id })} people={people} placeholder="— persona —" />
                </td>
                <td>
                  <input
                    className={`cell num ${c.error === 'Import no vàlid' ? 'invalid' : ''}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={r.amount}
                    onChange={(e) => update(r.key, { amount: e.target.value })}
                    aria-label="Import"
                  />
                </td>
                <td>
                  <input className="cell" type="date" value={r.date} onChange={(e) => update(r.key, { date: e.target.value })} />
                </td>
                <td>
                  <select className="cell" value={r.method} onChange={(e) => update(r.key, { method: e.target.value as PaymentMethod })}>
                    {METHODS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="cell" placeholder="—" value={r.note} onChange={(e) => update(r.key, { note: e.target.value })} />
                </td>
                <td>
                  <div className="batch-row-info">
                    {shownError ? (
                      <span className="error-text small">{shownError}</span>
                    ) : b && !b.attending && b.balance >= 0 ? (
                      <span className="muted small">no confirmat (no paga res encara)</span>
                    ) : b && c.cents !== null ? (
                      <span className={`small ${b.balance + c.cents === 0 ? 'pos' : 'muted'}`}>
                        {b.balance + c.cents === 0
                          ? 'quedarà quadrat ✓'
                          : b.balance + c.cents < 0
                            ? `en faltaran ${formatEuros(-(b.balance + c.cents))}`
                            : `li sobraran ${formatEuros(b.balance + c.cents)}`}
                      </span>
                    ) : b ? (
                      missing > 0 ? (
                        <button className="link-btn small" title="Posar el que li falta" onClick={() => update(r.key, { amount: formatEurosPlain(missing) })}>
                          falten {formatEuros(missing)}
                        </button>
                      ) : (
                        <span className="muted small">{b.balance > 0 ? `li has de tornar ${formatEuros(b.balance)}` : 'ja ho té pagat'}</span>
                      )
                    ) : null}
                    {c.duplicate && <span className="warn small">· repetit</span>}
                    {(r.participantId || r.amount) && (
                      <button className="icon-btn" title="Treure la fila" onClick={() => remove(r.key)}>
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="row batch-foot">
        <button className="btn btn-sm" disabled={busy || okCount === 0 || errCount > 0} onClick={save}>
          Desar {okCount || ''} {okCount === 1 ? 'pagament' : 'pagaments'} {okCount > 0 && `· ${formatEuros(total)}`}
        </button>
        {okCount + errCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setRows([newRow(defaults)])}>
            Buidar
          </button>
        )}
        {errCount > 0 && <span className="error-text small">Corregeix les {errCount} files marcades (o treu-les) per poder desar.</span>}
        {saved && <span className="pos small">✓ {saved}</span>}
      </div>
    </div>
  );
}

/** Selecció de diverses persones amb el mateix import, o amb el que li falta a cadascú. */
function PeoplePicker({ people, balances, onAdd }: { people: Participant[]; balances: Map<string, PersonSummary>; onAdd: (entries: { id: string; amount: string }[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlyOwing, setOnlyOwing] = useState(true);
  const [mode, setMode] = useState<'fixed' | 'missing'>('fixed');
  const [amount, setAmount] = useState('');
  const cents = parseEuros(amount);
  const owing = (id: string) => Math.max(0, -(balances.get(id)?.balance ?? 0));
  const visible = people.filter((p) => (!onlyOwing || owing(p.id) > 0) && (!search || normalizeName(p.name).includes(normalizeName(search))));
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s).add(id)));
  const ids = people.filter((p) => picked.has(p.id)).map((p) => p.id);
  const canAdd = ids.length > 0 && (mode === 'missing' || (cents !== null && cents !== 0));

  return (
    <div className="picker">
      <div className="picker-bar">
        <input className="input input-sm" placeholder="Cercar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="small">
          <input type="checkbox" checked={onlyOwing} onChange={(e) => setOnlyOwing(e.target.checked)} /> només qui deu diners
        </label>
        <button className="link-btn small" onClick={() => setPicked(new Set([...picked, ...visible.map((p) => p.id)]))}>
          marcar totes les visibles
        </button>
        <button className="link-btn small" onClick={() => setPicked(new Set())}>
          desmarcar
        </button>
      </div>
      <div className="picker-list">
        {visible.map((p) => (
          <label key={p.id} className={picked.has(p.id) ? 'on' : ''}>
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
            <span>{p.name}</span>
            <span className="muted small">{owing(p.id) > 0 ? `deu ${formatEuros(owing(p.id))}` : p.confirmed ? '' : 'no confirmat'}</span>
          </label>
        ))}
        {visible.length === 0 && <p className="muted small">Ningú amb aquest filtre.</p>}
      </div>
      <div className="picker-bar">
        <label className="small">
          <input type="radio" checked={mode === 'fixed'} onChange={() => setMode('fixed')} /> Tots el mateix import
        </label>
        {mode === 'fixed' && (
          <input className={`input input-sm num ${amount && cents === null ? 'invalid' : ''}`} inputMode="decimal" placeholder="Import €" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 110 }} />
        )}
        <label className="small">
          <input type="radio" checked={mode === 'missing'} onChange={() => setMode('missing')} /> El que li falta a cadascú
        </label>
        <div className="spacer" />
        <button
          className="btn btn-sm"
          disabled={!canAdd}
          onClick={() => onAdd(ids.map((id) => ({ id, amount: mode === 'fixed' ? amount : owing(id) > 0 ? formatEurosPlain(owing(id)) : '' })))}
        >
          Afegir {ids.length || ''} {ids.length === 1 ? 'fila' : 'files'}
        </button>
      </div>
    </div>
  );
}
