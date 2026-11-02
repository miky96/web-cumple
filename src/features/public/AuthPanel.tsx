import { useState, type FormEvent } from 'react';
import type { Repo } from '../../data/repo';

/** Missatges entenedors per als errors més habituals de Firebase Auth. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correu o contrasenya incorrectes. Si és el primer cop, tria «Crear compte».';
    case 'auth/email-already-in-use':
      return 'Ja hi ha un compte amb aquest correu: tria «Ja tinc compte».';
    case 'auth/weak-password':
      return 'La contrasenya ha de tenir com a mínim 6 caràcters.';
    case 'auth/invalid-email':
      return 'Aquest correu no té bona pinta.';
    case 'auth/too-many-requests':
      return 'Massa intents. Espera una estona i torna-ho a provar.';
    case 'auth/network-request-failed':
      return 'Sense connexió. Torna-ho a provar.';
    case 'auth/operation-not-allowed':
      return "Aquest mètode d'entrada encara no està activat. Avisa al miky i molesta'l una mica.";
    default:
      return (e as Error)?.message ?? 'Alguna cosa ha fallat';
  }
}

/**
 * Entrar amb Google o amb correu + contrasenya (tots dos gratuïts al pla Spark de Firebase).
 * Quan s'entra, `onAuthChange` del repo avisa la pàgina; aquí no cal fer res més.
 */
export function AuthPanel({ repo }: { repo: Repo }) {
  const [mode, setMode] = useState<'choose' | 'login' | 'signup'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => (mode === 'signup' ? repo.signUpWithEmail(email, password) : repo.signInWithEmail(email, password)));
  };

  if (mode === 'choose')
    return (
      <div className="stack auth-panel">
        <button className="btn btn-block" disabled={busy} onClick={() => run(() => repo.signIn())}>
          Entrar amb Google
        </button>
        <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setMode('login')}>
          Amb correu i contrasenya
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    );

  return (
    <form className="stack auth-panel" onSubmit={submit}>
      <div className="row auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={`btn btn-sm ${mode === 'login' ? '' : 'btn-ghost'}`} onClick={() => setMode('login')}>
          Ja tinc compte
        </button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={`btn btn-sm ${mode === 'signup' ? '' : 'btn-ghost'}`} onClick={() => setMode('signup')}>
          Crear compte
        </button>
      </div>
      <label className="field">
        <span>Correu</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Contrasenya {mode === 'signup' && <span className="muted small">(mínim 6 caràcters)</span>}</span>
        <input
          className="input"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button className="btn btn-block" type="submit" disabled={busy}>
        {mode === 'signup' ? 'Crear compte' : 'Entrar'}
      </button>
      {mode === 'login' && (
        <button
          type="button"
          className="link-btn"
          disabled={busy}
          onClick={() =>
            email.trim()
              ? run(async () => {
                  await repo.sendPasswordReset(email);
                  setInfo(`T'he enviat un correu a ${email.trim()} per canviar la contrasenya (mira també el correu brossa).`);
                })
              : setError('Escriu el teu correu i torna a clicar.')
          }
        >
          He oblidat la contrasenya
        </button>
      )}
      <button type="button" className="link-btn" onClick={() => setMode('choose')}>
        ← Entrar amb Google
      </button>
      {error && <p className="error-text">{error}</p>}
      {info && <p className="muted small">{info}</p>}
    </form>
  );
}
