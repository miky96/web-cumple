/** Camps compartits de la pàgina de diners. */
import { useState } from 'react';
import { formatEurosPlain, parseEuros } from '../../../domain/money/euros';
import type { Cents, SplitScope } from '../../../domain/money/types';
import { parseTags } from '../../../domain/people/importList';
import type { Participant } from '../../../domain/types';

/** Input d'import en euros: s'edita com a text i es desa en cèntims en sortir del camp (o amb Enter). */
export function EuroInput({
  value,
  onCommit,
  className = 'cell num',
  placeholder = '0,00',
  allowNegative = false,
  ariaLabel,
}: {
  value: Cents | null;
  onCommit: (cents: Cents | null) => void;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
  ariaLabel?: string;
}) {
  const shown = value === null ? '' : formatEurosPlain(value);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const parsed = text.trim() === '' ? null : parseEuros(text);
  const invalid = text.trim() !== '' && (parsed === null || (!allowNegative && parsed < 0));
  return (
    <input
      className={`${className} ${invalid ? 'invalid' : ''}`}
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={editing ? text : shown}
      onFocus={(e) => {
        setText(shown);
        setEditing(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={() => {
        setEditing(false);
        if (invalid) return;
        if (parsed !== value) onCommit(parsed);
      }}
    />
  );
}

/** Text que es desa en sortir del camp. */
export function TextCell({ value, onCommit, placeholder = '—', className = 'cell' }: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  return (
    <input
      className={className}
      placeholder={placeholder}
      value={editing ? text : value}
      onFocus={() => {
        setText(value);
        setEditing(true);
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onBlur={() => {
        setEditing(false);
        if (text.trim() !== value) onCommit(text.trim());
      }}
    />
  );
}

export function PersonSelect({
  value,
  onChange,
  people,
  className = 'cell',
  allowOrganizer = false,
  placeholder = '— tria —',
}: {
  value: string;
  onChange: (id: string) => void;
  people: Participant[];
  className?: string;
  allowOrganizer?: boolean;
  placeholder?: string;
}) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowOrganizer ? <option value="organizer">Organització (jo)</option> : <option value="">{placeholder}</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {!p.confirmed ? ' (no confirmat)' : ''}
        </option>
      ))}
    </select>
  );
}

/** Editor de l'abast d'una partida: tothom, amb/sense etiquetes, o llista de persones. */
export function ScopeEditor({ scope, onChange, people, knownTags }: { scope: SplitScope; onChange: (s: SplitScope) => void; people: Participant[]; knownTags: string[] }) {
  const [tagText, setTagText] = useState(scope.kind === 'withTags' || scope.kind === 'withoutTags' ? scope.tags.join(', ') : '');
  const tags = scope.kind === 'withTags' || scope.kind === 'withoutTags' ? scope.tags : [];
  return (
    <div className="scope-editor">
      <select
        className="cell"
        value={scope.kind}
        onChange={(e) => {
          const kind = e.target.value as SplitScope['kind'];
          if (kind === 'all') onChange({ kind });
          else if (kind === 'people') onChange({ kind, ids: people.map((p) => p.id) });
          else onChange({ kind, tags });
        }}
      >
        <option value="all">Tothom</option>
        <option value="withoutTags">Tothom excepte…</option>
        <option value="withTags">Només qui té…</option>
        <option value="people">Persones concretes</option>
      </select>
      {(scope.kind === 'withTags' || scope.kind === 'withoutTags') && (
        <input
          className="cell"
          list="known-tags"
          placeholder="etiquetes: no beu, vegà"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          onBlur={() => {
            const next = parseTags(tagText);
            setTagText(next.join(', '));
            if (next.join('|') !== tags.join('|')) onChange({ kind: scope.kind, tags: next });
          }}
        />
      )}
      {scope.kind === 'people' && (
        <details className="scope-people">
          <summary>{scope.ids.length} persones</summary>
          <div className="scope-people-list">
            {people.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={scope.ids.includes(p.id)}
                  onChange={(e) => onChange({ kind: 'people', ids: e.target.checked ? [...scope.ids, p.id] : scope.ids.filter((x) => x !== p.id) })}
                />
                {p.name}
              </label>
            ))}
          </div>
        </details>
      )}
      <datalist id="known-tags">
        {knownTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
