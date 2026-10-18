import { useEffect, useState } from 'react';
import { ArcadeDialog } from './ArcadeDialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acció destructiva (eliminar, regenerar...): el botó surt en vermell. */
  danger?: boolean;
  /** Compte enrere en segons (en arribar a 0 es cancel·la). */
  countdown?: number;
}

interface Request extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let show: ((req: Request | null) => void) | null = null;

/**
 * Substitut de `window.confirm()` amb el diàleg arcade de l'app.
 * Ús: `if (await askConfirm({ title: 'ELIMINAR?', message: '...' })) { ... }`
 */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(opts.message)); // sense DialogHost muntat
    show({ ...opts, resolve });
  });
}

/** Es munta una sola vegada a l'arrel de l'app. */
export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    show = setReq;
    return () => {
      show = null;
    };
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  return (
    <ArcadeDialog
      key={`${req.title}|${req.message}`}
      title={req.title}
      message={req.message}
      confirmLabel={req.confirmLabel ?? 'Sí'}
      cancelLabel={req.cancelLabel ?? 'Cancel·lar'}
      danger={req.danger}
      countdown={req.countdown}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}
