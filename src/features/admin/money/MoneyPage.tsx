import { useMemo, useState } from 'react';
import type { Repo } from '../../../data/repo';
import { EDITION_ID } from '../../../data/repo';
import { summaryRows, toCsv } from '../../../domain/money/csv';
import { PAYMENT_METHOD_LABELS, STATUS_LABELS } from '../../../domain/money/defaults';
import { formatEuros, formatSignedEuros, todayIso } from '../../../domain/money/euros';
import type { PaymentMethod, PersonStatus, PersonSummary } from '../../../domain/money/types';
import { normalizeName, slugId } from '../../../domain/text';
import { downloadText } from '../../../lib/download';
import { Link } from '../../../lib/router';
import { askConfirm } from '../../../ui/confirm';
import type { AdminData } from '../useAdminData';
import { BudgetTab } from './BudgetTab';
import { ExpensesTab } from './ExpensesTab';
import './money.css';
import { PaymentsTab } from './PaymentsTab';
import { PricingTab } from './PricingTab';
import { useMoneyData, type MoneyData } from './useMoneyData';

const TABS = [
  { id: 'resum', label: 'Resum per persona' },
  { id: 'pagaments', label: 'Pagaments' },
  { id: 'despeses', label: 'Despeses i compres' },
  { id: 'pressupost', label: 'Pressupost' },
  { id: 'preu', label: 'Preu i ajustos' },
] as const;
export type MoneyTabId = (typeof TABS)[number]['id'];

export interface MoneyTabProps {
  repo: Repo;
  data: AdminData;
  money: MoneyData;
}

export function MoneyPage({ repo, data, path }: { repo: Repo; data: AdminData; path: string }) {
  const money = useMoneyData(repo, EDITION_ID, data.participants);
  const tab = (TABS.find((t) => t.id === path.split('/')[3])?.id ?? 'resum') as MoneyTabId;
  const props = { repo, data, money };
  return (
    <>
      <h1>Diners</h1>
      <TotalsBar money={money} />
      <nav className="money-tabs">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/diners/${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {!money.ready ? (
        <div className="spinner" />
      ) : tab === 'pagaments' ? (
        <PaymentsTab {...props} />
      ) : tab === 'despeses' ? (
        <ExpensesTab {...props} />
      ) : tab === 'pressupost' ? (
        <BudgetTab {...props} />
      ) : tab === 'preu' ? (
        <PricingTab {...props} />
      ) : (
        <SummaryTab {...props} />
      )}
    </>
  );
}

function TotalsBar({ money }: { money: MoneyData }) {
  const t = money.summary.totals;
  return (
    <div className="stats money-stats">
      <div className="stat">
        <b>{formatEuros(t.cost)}</b>
        <span>cost total previst</span>
      </div>
      <div className="stat">
        <b>{formatEuros(t.spent)}</b>
        <span>gastat fins ara</span>
      </div>
      <div className="stat">
        <b>{formatEuros(t.due)}</b>
        <span>a cobrar ({t.attendees} persones)</span>
      </div>
      <div className="stat">
        <b>{formatEuros(t.paid)}</b>
        <span>pagat per la gent</span>
      </div>
      <div className="stat">
        <b className={t.pending > 0 ? 'neg' : ''}>{formatEuros(t.pending)}</b>
        <span>pendent de cobrar</span>
      </div>
      {t.toRefund > 0 && (
        <div className="stat">
          <b className="warn">{formatEuros(t.toRefund)}</b>
          <span>a retornar</span>
        </div>
      )}
      <div className="stat" title="Pagaments rebuts menys les despeses que has pagat tu">
        <b>{formatEuros(t.organizerCash)}</b>
        <span>caixa de l'organització</span>
      </div>
      <div className="stat" title="El que cobraràs menys el cost total previst">
        <b className={t.surplus < 0 ? 'neg' : 'pos'}>{formatSignedEuros(t.surplus)}</b>
        <span>{t.surplus < 0 ? 'dèficit' : 'superàvit'}</span>
      </div>
    </div>
  );
}

const STATUS_ORDER: PersonStatus[] = ['pendent', 'parcial', 'pagat', 'a-retornar', 'sense-carrec'];

function SummaryTab({ repo, data, money }: MoneyTabProps) {
  const { summary } = money;
  const [filter, setFilter] = useState<PersonStatus | 'tots'>('tots');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [quickMethod, setQuickMethod] = useState<PaymentMethod>('bizum');
  const counts = useMemo(() => {
    const c = new Map<PersonStatus, number>();
    summary.people.forEach((p) => c.set(p.status, (c.get(p.status) ?? 0) + 1));
    return c;
  }, [summary.people]);
  const participantById = new Map(data.participants.map((p) => [p.id, p]));

  const visible = summary.people
    .filter((p) => filter === 'tots' || p.status === filter)
    .filter((p) => !search || normalizeName(p.name).includes(normalizeName(search)))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, 'ca'));

  const markPaid = async (p: PersonSummary) => {
    const amount = -p.balance;
    const verb = amount > 0 ? `Apuntar un pagament de ${formatEuros(amount)}` : `Apuntar una devolució de ${formatEuros(-amount)}`;
    if (!(await askConfirm({ title: 'QUADRAR?', message: `${verb} de ${p.name} (${PAYMENT_METHOD_LABELS[quickMethod]}, avui)?`, confirmLabel: 'Apuntar' }))) return;
    await repo.saveMoneyDocs(EDITION_ID, 'payments', [
      { id: slugId('pay'), participantId: p.id, amount, date: todayIso(), method: quickMethod, note: amount > 0 ? 'Quadrat des del resum' : 'Devolució' },
    ]);
  };

  return (
    <>
      {summary.paidButNotAttending.length > 0 && (
        <div className="admin-banner warn">
          Han pagat però no surten al repartiment (no confirmats o sense nits): {summary.paidButNotAttending.map((p) => p.name).join(', ')}.{' '}
          <button
            className="link-btn"
            onClick={() =>
              summary.paidButNotAttending.forEach((s) => {
                const p = participantById.get(s.id);
                if (p && !p.confirmed && p.nights.length > 0) repo.updateParticipant(EDITION_ID, p, { confirmed: true });
              })
            }
          >
            Marcar-los com a confirmats
          </button>
        </div>
      )}
      {summary.lines.some((l) => l.members === 0 && l.allocated > 0) && (
        <div className="admin-banner warn">
          Partides sense ningú per repartir-les: {summary.lines.filter((l) => l.members === 0 && l.allocated > 0).map((l) => l.line.name).join(', ')}. Revisa'n l'abast al pressupost.
        </div>
      )}
      {summary.orphanExpenses.length > 0 && (
        <div className="admin-banner warn">Hi ha {summary.orphanExpenses.length} despeses d'una partida esborrada. Canvia'ls la partida a «Despeses i compres».</div>
      )}

      <div className="admin-toolbar">
        <div className="chips">
          <button className={`chip-btn ${filter === 'tots' ? 'on' : ''}`} onClick={() => setFilter('tots')}>
            Tots ({summary.people.length})
          </button>
          {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
            <button key={s} className={`chip-btn st-${s} ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
              {STATUS_LABELS[s]} ({counts.get(s)})
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 220, minHeight: 38 }} placeholder="Cercar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="spacer" />
        <label className="small muted">
          Quadrar amb{' '}
          <select className="input input-sm" value={quickMethod} onChange={(e) => setQuickMethod(e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-ghost btn-sm" onClick={() => downloadText(`diners-${EDITION_ID}-${todayIso()}.csv`, toCsv(summaryRows(summary)))}>
          ⬇ Exportar CSV
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title="Còpia de seguretat de tot el mòdul de diners"
          onClick={() =>
            downloadText(
              `diners-${EDITION_ID}-${todayIso()}.json`,
              JSON.stringify({ lines: money.lines, expenses: money.expenses, payments: money.payments, adjustments: money.adjustments, pricing: money.pricing }, null, 2),
              'application/json',
            )
          }
        >
          ⬇ Còpia JSON
        </button>
      </div>

      <div className="table-wrap">
        <table className="grid money-grid">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="center">Nits</th>
              <th className="num">Preu</th>
              <th className="num">A part</th>
              <th className="num">Ajustos</th>
              <th className="num">A pagar</th>
              <th className="num">Pagat</th>
              <th className="num">Saldo</th>
              <th>Estat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <SummaryRow key={p.id} p={p} money={money} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onSettle={() => markPaid(p)} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="muted center" style={{ padding: 24 }}>
                  Ningú amb aquest filtre.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total</td>
              <td className="num">{formatEuros(summary.totals.due)}</td>
              <td className="num">{formatEuros(summary.totals.paid)}</td>
              <td className="num">{formatSignedEuros(summary.totals.paid - summary.totals.due)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small">
        <sup>c</sup> = preu comunicat. Saldo = pagat − a pagar. Negatiu: et deu diners; positiu: li has de tornar. Les despeses que ha avançat un participant li compten com a
        pagades. Clica un nom per veure'n el desglossament.
      </p>
    </>
  );
}

function SummaryRow({ p, money, open, onToggle, onSettle }: { p: PersonSummary; money: MoneyData; open: boolean; onToggle: () => void; onSettle: () => void }) {
  const myPayments = open ? money.payments.filter((x) => x.participantId === p.id) : [];
  const myExpenses = open ? money.expenses.filter((x) => x.paidBy === p.id) : [];
  const myAdj = open ? money.adjustments.filter((x) => x.participantId === p.id) : [];
  return (
    <>
      <tr className={open ? 'row-open' : ''}>
        <td>
          <button className="link-btn name-btn" onClick={onToggle} aria-expanded={open}>
            {open ? '▾' : '▸'} {p.name}
          </button>
          {!p.attending && <span className="muted small"> · no entra al repartiment</span>}
        </td>
        <td className="center">{p.nightsCount}</td>
        <td className="num" title={p.announced !== null ? `Preu comunicat. Calculat: ${formatEuros(p.includedCalculated)}` : 'Preu calculat'}>
          {formatEuros(p.announced ?? p.includedCalculated)}
          {p.announced !== null && <sup className="muted"> c</sup>}
        </td>
        <td className="num">{p.extras ? formatEuros(p.extras) : '—'}</td>
        <td className="num">{p.adjustments ? formatSignedEuros(p.adjustments) : '—'}</td>
        <td className="num strong">{formatEuros(p.due)}</td>
        <td className="num">{formatEuros(p.paid)}</td>
        <td className={`num strong ${p.balance < 0 ? 'neg' : p.balance > 0 ? 'warn' : ''}`}>{formatSignedEuros(p.balance)}</td>
        <td>
          <span className={`money-status st-${p.status}`}>{STATUS_LABELS[p.status]}</span>
        </td>
        <td>
          {p.balance !== 0 && (
            <button className="icon-btn" title={p.balance < 0 ? 'Apuntar que ha pagat el que falta' : 'Apuntar la devolució'} onClick={onSettle}>
              {p.balance < 0 ? '✓ €' : '↩ €'}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="row-detail">
          <td colSpan={10}>
            <div className="detail-cols">
              <div>
                <h4>Partides (calculat)</h4>
                {money.summary.lines.map((l) =>
                  p.shares[l.line.id] !== undefined ? (
                    <div key={l.line.id} className="kv">
                      <span>
                        {l.line.name}
                        {!l.line.inAnnounced && <em className="muted"> (a part)</em>}
                      </span>
                      <b>{formatEuros(p.shares[l.line.id])}</b>
                    </div>
                  ) : null,
                )}
                {p.announced !== null && (
                  <div className="kv muted">
                    <span>Preu comunicat aplicat</span>
                    <b>{formatEuros(p.announced)}</b>
                  </div>
                )}
              </div>
              <div>
                <h4>Pagaments</h4>
                {myPayments.length === 0 && <p className="muted small">Cap pagament.</p>}
                {myPayments.map((x) => (
                  <div key={x.id} className="kv">
                    <span>
                      {x.date.split('-').reverse().join('/')} · {PAYMENT_METHOD_LABELS[x.method]} {x.note && `· ${x.note}`}
                    </span>
                    <b>{formatEuros(x.amount)}</b>
                  </div>
                ))}
                {myExpenses.map((x) => (
                  <div key={x.id} className="kv">
                    <span>Ha avançat: {x.concept}</span>
                    <b>{formatEuros(x.amount)}</b>
                  </div>
                ))}
              </div>
              {myAdj.length > 0 && (
                <div>
                  <h4>Ajustos</h4>
                  {myAdj.map((a) => (
                    <div key={a.id} className="kv">
                      <span>{a.reason || 'Ajust'}</span>
                      <b>{formatSignedEuros(a.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
