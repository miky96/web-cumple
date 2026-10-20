import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { useRemoteDraft } from '../../lib/hooks';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { assignRemaining, defaultGroup } from '../../domain/groups/assign';
import { answeredKeys, buildReveals, hashReveals, publishStatus, staleRevealTokens } from '../../domain/groups/reveals';
import { similarColorPairs } from '../../domain/theme/palette';
import { slugId } from '../../domain/text';
import type { Group, Participant } from '../../domain/types';
import { askConfirm } from '../../ui/confirm';
import type { AdminData } from './useAdminData';

function PublishPanel({ repo, data }: { repo: Repo; data: AdminData }) {
  const [busy, setBusy] = useState(false);
  const build = useMemo(() => buildReveals(EDITION_ID, data.participants, data.groups), [data.participants, data.groups]);
  const status = publishStatus(data.edition?.publishedHash ?? null, build);
  const count = Object.keys(build.reveals).length;

  const publish = async () => {
    setBusy(true);
    try {
      const stale = staleRevealTokens(data.edition?.publishedTokens ?? [], build.reveals);
      const completedAt = new Map(data.responses.map((r) => [r.token, r.completedAt]));
      await repo.publishReveals(EDITION_ID, {
        reveals: build.reveals,
        cards: build.cards,
        answered: answeredKeys(EDITION_ID, data.participants, completedAt, build),
        staleTokens: stale,
        hash: hashReveals(build),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`admin-banner ${status === 'up-to-date' && build.unassigned.length === 0 ? 'ok' : 'warn'}`}>
      <div className="row">
        <div style={{ flex: 1 }}>
          {status === 'never' && "Encara no has publicat els grups. Qui acabi el qüestionari veurà «el tòtem encara està decidint»."}
          {status === 'outdated' && 'Hi ha canvis als grups que encara no estan publicats.'}
          {status === 'up-to-date' &&
            `Grups publicats ✓ ${data.edition?.publishedAt ? `(${new Date(data.edition.publishedAt).toLocaleString('ca')})` : ''}`}
          {build.unassigned.length > 0 && (
            <div>
              ⚠️ Sense grup ({build.unassigned.length}): {build.unassigned.map((p) => p.name).join(', ')}
            </div>
          )}
        </div>
        <button className="btn btn-sm" disabled={busy || count === 0 || status === 'up-to-date'} onClick={publish}>
          {busy ? 'Publicant...' : `Publicar ${count} revelacions`}
        </button>
      </div>
    </div>
  );
}

function GroupColumn({
  repo,
  group,
  members,
  doneTokens,
  onDropPerson,
}: {
  repo: Repo;
  group: Group | null;
  members: Participant[];
  doneTokens: Set<string>;
  onDropPerson: (pid: string, gid: string | null) => void;
}) {
  const [over, setOver] = useState(false);
  const [name, setName] = useRemoteDraft(group?.name, (v) => v ?? '');
  const [color, setColor] = useRemoteDraft(group?.color, (v) => v ?? '#999999');
  const [image, setImage] = useRemoteDraft(group?.image, (v) => v ?? '');
  const debounce = useRef<number>(0);

  const save = (patch: Partial<Group>) => group && repo.saveGroup(EDITION_ID, { ...group, ...patch });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const pid = e.dataTransfer.getData('text/plain');
    if (pid) onDropPerson(pid, group?.id ?? null);
  };

  const colStyle = group ? ({ '--group-color': color } as CSSProperties) : undefined;

  return (
    <section
      className={`group-col ${group ? '' : 'unassigned'} ${over ? 'drop' : ''}`}
      style={colStyle}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="group-head">
        {group ? (
          <>
            <div className="group-title">
              <input
                type="color"
                className="group-swatch"
                value={color}
                title="Color del grup (clica per canviar-lo)"
                onChange={(e) => {
                  const v = e.target.value;
                  setColor(v);
                  window.clearTimeout(debounce.current);
                  debounce.current = window.setTimeout(() => save({ color: v }), 400);
                }}
              />
              <input className="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== group.name && save({ name: name.trim() })} />
            </div>
            <div className="row">
              <span className="group-count">{members.length} persones</span>
              <span className="spacer" />
              <button
                className="icon-btn"
                title="Eliminar grup"
                onClick={async () =>
                  (await askConfirm({ title: 'ELIMINAR GRUP?', message: `Eliminar ${group.name}? Els seus membres quedaran sense grup.`, confirmLabel: 'Eliminar grup', danger: true })) &&
                  repo.deleteGroup(EDITION_ID, group.id, members.map((m) => m.id))
                }
              >
                🗑
              </button>
            </div>
            <input
              className="input"
              style={{ minHeight: 30, fontSize: '0.8rem', padding: '2px 6px', borderWidth: 1, color: 'var(--ink)' }}
              placeholder="Fons del resultat (opcional): /editions/2027/fons.webp"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              onBlur={() => (image.trim() || null) !== group.image && save({ image: image.trim() || null })}
            />
          </>
        ) : (
          <strong>Sense grup ({members.length})</strong>
        )}
      </div>
      <div className="group-members">
        {members.map((m) => (
          <span
            key={m.id}
            className={`chip member ${doneTokens.has(m.token) ? 'done' : ''}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', m.id)}
            title={doneTokens.has(m.token) ? 'Ja ha fet el qüestionari' : 'Arrossega a un altre grup'}
          >
            {m.name}
          </span>
        ))}
        {members.length === 0 && <span className="muted small">Arrossega persones aquí</span>}
      </div>
    </section>
  );
}

export function GroupsPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const doneTokens = new Set(data.responses.map((r) => r.token));
  const byGroup = (gid: string | null) => data.participants.filter((p) => (gid ? p.groupId === gid : !p.groupId || !data.groups.some((g) => g.id === p.groupId)));
  const similar = similarColorPairs(data.groups.map((g) => ({ id: g.id, color: g.color })));
  const nameOf = (id: string) => data.groups.find((g) => g.id === id)?.name ?? id;

  const move = (pid: string, gid: string | null) => {
    const p = data.participants.find((x) => x.id === pid);
    if (p && p.groupId !== gid) repo.updateParticipant(EDITION_ID, p, { groupId: gid });
  };

  const addGroup = () => {
    const order = Math.max(-1, ...data.groups.map((g) => g.order)) + 1;
    repo.saveGroup(EDITION_ID, defaultGroup(order, slugId('g')));
  };

  const autoAssign = () => {
    const result = assignRemaining(data.participants, data.groups, Math.random);
    if (Object.keys(result).length) repo.setGroups(EDITION_ID, result);
  };

  return (
    <>
      <h1>Grups</h1>
      <PublishPanel repo={repo} data={data} />
      {similar.length > 0 && (
        <div className="admin-banner warn">
          Colors massa semblants: {similar.map(([a, b]) => `${nameOf(a)} i ${nameOf(b)}`).join(' · ')}
        </div>
      )}
      <div className="admin-toolbar">
        <button className="btn btn-sm" onClick={addGroup}>
          + Afegir grup
        </button>
        <button className="btn btn-ghost btn-sm" disabled={byGroup(null).length === 0 || data.groups.length === 0} onClick={autoAssign}>
          🎲 Repartir a l'atzar els que falten
        </button>
        <span className="muted small">Arrossega les persones entre grups. ✓ = ja ha fet el qüestionari.</span>
      </div>
      <GroupColumn repo={repo} group={null} members={byGroup(null)} doneTokens={doneTokens} onDropPerson={move} />
      <div className="board">
        {data.groups.map((g) => (
          <GroupColumn key={g.id} repo={repo} group={g} members={byGroup(g.id)} doneTokens={doneTokens} onDropPerson={move} />
        ))}
      </div>
    </>
  );
}
