import { useEffect, useRef, useState } from 'react';
import { useLatest } from '../lib/hooks';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Acció destructiva: el botó de confirmar surt en vermell. */
  danger?: boolean;
  /** Compte enrere tipus "CONTINUE? 9..." (segons). En arribar a 0 es cancel·la. */
  countdown?: number;
}

/** Diàleg de confirmació amb estil de recreativa (substitueix el confirm() del sistema). */
export function ArcadeDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, countdown, danger }: Props) {
  const [left, setLeft] = useState(countdown ?? 0);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useLatest(onCancel);

  useEffect(() => {
    (danger ? cancelBtnRef : confirmRef).current?.focus(); // en accions destructives, el focus va a "cancel·lar"
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!countdown) return;
    if (left <= 0) {
      cancelRef.current();
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, countdown, cancelRef]);

  return (
    <div className="arcade-dialog-back" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="arcade-dialog" role="dialog" aria-modal="true" aria-labelledby="arcade-dialog-title">
        <h2 id="arcade-dialog-title" className="arcade-dialog-title">
          {title}
          {countdown ? <span className="arcade-dialog-count">{left}</span> : null}
        </h2>
        <p>{message}</p>
        <div className="arcade-dialog-actions">
          <button ref={confirmRef} type="button" className={`btn btn-block ${danger ? 'btn-danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button ref={cancelBtnRef} type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
