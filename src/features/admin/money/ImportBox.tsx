import { useMemo, useState } from 'react';
import type { ParsedImport } from '../../../domain/money/importMoney';

/** Caixa per enganxar files de l'Excel amb previsualització d'errors abans d'importar. */
export function ImportBox<T>({
  title,
  help,
  placeholder,
  parse,
  onImport,
  onClose,
  extra,
}: {
  title: string;
  help: React.ReactNode;
  placeholder: string;
  parse: (text: string) => ParsedImport<T>;
  onImport: (rows: T[]) => Promise<void>;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parse(text), [parse, text]);
  return (
    <div className="card stack" style={{ marginBottom: 16 }}>
      <h3>{title}</h3>
      <div className="muted small">{help}</div>
      {extra}
      <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      {parsed.issues.length > 0 && (
        <div className="import-issues error-text">
          <b>No s'importaran ({parsed.issues.length}):</b>
          <ul>
            {parsed.issues.map((i) => (
              <li key={i.line}>
                Fila {i.line}: {i.reason} <span className="muted">— {i.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {parsed.warnings.length > 0 && (
        <div className="import-issues">
          <b>Avisos:</b>
          <ul>
            {parsed.warnings.map((i, k) => (
              <li key={k}>
                Fila {i.line}: {i.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row">
        <button
          className="btn btn-sm"
          disabled={busy || parsed.rows.length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await onImport(parsed.rows);
              setText('');
            } finally {
              setBusy(false);
            }
          }}
        >
          Importar {parsed.rows.length || ''} {parsed.rows.length === 1 ? 'fila' : 'files'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Tancar
        </button>
      </div>
    </div>
  );
}
