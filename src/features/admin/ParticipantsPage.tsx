import { useMemo, useState } from 'react';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { nightLabel } from '../../data/defaults';
import { parseImportList, parseTags } from '../../domain/people/importList';
import { normalizeName } from '../../domain/text';
import type { Group, Participant } from '../../domain/types';
import { copyText } from '../../lib/device';
import { askConfirm } from '../../ui/confirm';
import type { AdminData } from './useAdminData';

export const participantLink = (token: string) => `${location.origin}/p/${token}`;
export const whatsappMessage = (p: Participant) =>
  `Hola ${p.name}! 🗿🌴 El tòtem té una missió per a tu. Entra aquí (és el teu enllaç personal, no el comparteixis): ${participantLink(p.token)}`;

function CopyButton({ text, label, title }: { text: string; label: string; title: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={`icon-btn ${ok ? 'copied' : ''}`}
      title={title}
      onClick={async () => {
        if (await copyText(text)) {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        }
      }}
    >
      {ok ? '✓' : label}
    </button>
  );
}

function ParticipantRow({ repo, p, nights, groups, done }: { repo: Repo; p: Participant; nights: string[]; groups: Group[]; done: boolean }) {
  const [name, setName] = useState(p.name);
  const [tags, setTags] = useState(p.tags.join(', '));
  const [notes, setNotes] = useState(p.notes);
  const save = (patch: Parameters<Repo['updateParticipant']>[2]) => repo.updateParticipant(EDITION_ID, p, patch);

  return (
    <tr>
      <td>
        <input
          className="cell"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== p.name && save({ name: name.trim() })}
        />
      </td>
      <td className="center">
        <input
          type="checkbox"
          aria-label={`${p.name} ha confirmat`}
          checked={p.confirmed}
          onChange={(e) => save({ confirmed: e.target.checked })}
        />
      </td>
      {nights.map((n) => (
        <td key={n} className="center">
          <input
            type="checkbox"
            aria-label={`${p.name} ${nightLabel(n)}`}
            checked={p.nights.includes(n)}
            onChange={(e) =>
              save({ nights: e.target.checked ? [...p.nights, n].sort() : p.nights.filter((x) => x !== n) })
            }
          />
        </td>
      ))}
      <td>
        <input
          className="cell"
          value={tags}
          placeholder="vegà, no beu..."
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => {
            const next = parseTags(tags);
            if (next.join('|') !== p.tags.join('|')) save({ tags: next });
            setTags(next.join(', '));
          }}
        />
      </td>
      <td>
        <select className="cell" value={p.groupId ?? ''} onChange={(e) => save({ groupId: e.target.value || null })}>
          <option value="">— sense grup —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className={`status ${done ? 'done' : 'pending'}`}>{done ? '✅ Fet' : '⏳ Pendent'}</span>
      </td>
      <td>
        <input className="cell" value={notes} placeholder="—" onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== p.notes && save({ notes })} />
      </td>
      <td>
        <div className="actions">
          <CopyButton text={whatsappMessage(p)} label="💬" title="Copiar missatge de WhatsApp" />
          <CopyButton text={participantLink(p.token)} label="🔗" title="Copiar enllaç" />
          <a className="icon-btn" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={`/p/${p.token}`} target="_blank" rel="noreferrer" title="Obrir com a participant">
            ↗
          </a>
          {done && (
            <button
              type="button"
              className="icon-btn"
              title="Esborrar la resposta (podrà tornar a jugar)"
              onClick={async () =>
                (await askConfirm({ title: 'RESET?', message: `Esborrar la resposta de ${p.name}? Podrà tornar a fer el qüestionari.`, confirmLabel: 'Esborrar resposta', danger: true })) &&
                repo.resetResponse(p.token)
              }
            >
              ⟲
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            title="Generar un enllaç nou (l'antic deixarà de funcionar)"
            onClick={async () =>
              (await askConfirm({ title: 'NOU ENLLAÇ?', message: `Generar un enllaç nou per a ${p.name}? L'antic deixarà de funcionar i hauràs de tornar a publicar els grups.`, confirmLabel: 'Generar enllaç nou', danger: true })) &&
              repo.regenerateToken(EDITION_ID, p)
            }
          >
            ♻️
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Eliminar"
            onClick={async () =>
              (await askConfirm({ title: 'GAME OVER?', message: `Eliminar ${p.name} d'aquesta edició? S'esborraran també la seva resposta i el seu enllaç.`, confirmLabel: 'Eliminar', danger: true })) &&
              repo.removeParticipant(EDITION_ID, p)
            }
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}

function ImportPanel({ repo, data, onDone }: { repo: Repo; data: AdminData; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseImportList(text, data.participants.map((p) => p.name)), [text, data.participants]);
  return (
    <div className="card stack" style={{ marginBottom: 16 }}>
      <h3>Afegir persones</h3>
      <p className="muted small" style={{ margin: 0 }}>
        Un nom per línia, o enganxa dues columnes de l'Excel: <b>Nom</b> i <b>Etiquetes</b> (separades per |). Per defecte vindran
        totes les nits.
      </p>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Anna\nBernat\tvegà\nCarla\tno beu|vegà'} />
      {parsed.duplicates.length > 0 && <p className="error-text">Ja hi són (s'ometran): {parsed.duplicates.join(', ')}</p>}
      <div className="row">
        <button
          className="btn btn-sm"
          disabled={busy || parsed.rows.length === 0}
          onClick={async () => {
            setBusy(true);
            await repo.addParticipants(EDITION_ID, parsed.rows, data.edition?.nights ?? []);
            setBusy(false);
            setText('');
            onDone();
          }}
        >
          Afegir {parsed.rows.length || ''} {parsed.rows.length === 1 ? 'persona' : 'persones'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          Tancar
        </button>
      </div>
    </div>
  );
}

export function ParticipantsPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const [showImport, setShowImport] = useState(data.participants.length === 0);
  const [filter, setFilter] = useState('');
  const nights = data.edition?.nights ?? [];
  const done = (p: Participant) => data.responseByToken.has(p.token);

  const visible = data.participants.filter((p) => !filter || normalizeName(p.name).includes(normalizeName(filter)));
  const completed = data.participants.filter(done).length;
  const tagCounts = new Map<string, number>();
  data.participants.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));

  const allMessages = data.participants.map((p) => `${p.name}: ${participantLink(p.token)}`).join('\n');

  return (
    <>
      <h1>Participants</h1>
      <div className="stats">
        <div className="stat">
          <b>{data.participants.length}</b>
          <span>persones</span>
        </div>
        <div className="stat">
          <b>
            {data.participants.filter((p) => p.confirmed).length}/{data.participants.length}
          </b>
          <span>han confirmat</span>
        </div>
        <div className="stat">
          <b>
            {completed}/{data.participants.length}
          </b>
          <span>qüestionaris fets</span>
        </div>
        {nights.map((n) => (
          <div className="stat" key={n}>
            <b>{data.participants.filter((p) => p.nights.includes(n)).length}</b>
            <span>dormen {nightLabel(n)}</span>
          </div>
        ))}
        {[...tagCounts].map(([t, c]) => (
          <div className="stat" key={t}>
            <b>{c}</b>
            <span>{t}</span>
          </div>
        ))}
      </div>

      {showImport ? (
        <ImportPanel repo={repo} data={data} onDone={() => setShowImport(false)} />
      ) : null}

      <div className="admin-toolbar">
        {!showImport && (
          <button className="btn btn-sm" onClick={() => setShowImport(true)}>
            + Afegir persones
          </button>
        )}
        <input className="input" style={{ maxWidth: 260, minHeight: 38 }} placeholder="Cercar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="spacer" />
        <CopyButton text={allMessages} label="📋 Copiar tots els enllaços" title="Llista Nom: enllaç de tothom" />
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Nom</th>
              <th className="center">Confirmat</th>
              {nights.map((n) => (
                <th key={n} className="center">
                  {nightLabel(n)}
                </th>
              ))}
              <th style={{ width: '16%' }}>Etiquetes</th>
              <th style={{ width: '14%' }}>Grup</th>
              <th>Qüestionari</th>
              <th>Notes</th>
              <th>Enllaç i accions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <ParticipantRow key={`${p.id}-${p.token}`} repo={repo} p={p} nights={nights} groups={data.groups} done={done(p)} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8 + nights.length} className="muted center" style={{ padding: 24 }}>
                  Encara no hi ha ningú. Afegeix persones a dalt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
