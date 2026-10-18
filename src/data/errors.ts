type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function onRepoError(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function reportRepoError(err: unknown): void {
  const code = (err as { code?: string })?.code ?? '';
  const message =
    code === 'permission-denied'
      ? 'Sense permís: aquest compte no és administrador.'
      : code === 'unavailable'
        ? 'Sense connexió amb el servidor. Es reintentarà automàticament.'
        : `Error: ${(err as Error)?.message ?? String(err)}`;
  console.error('[repo]', err);
  for (const l of listeners) l(message);
}
