import { useEffect, useState } from 'react';
import type { AuthUser } from '../../data/ports';
import { getRepo, EDITION_ID, IS_DEMO, type Repo } from '../../data/repo';
import type { PublicEdition } from '../../domain/types';
import { Link } from '../../lib/router';
import { LAST_TOKEN_KEY, readJson } from '../../lib/storage';
import { Logo } from '../../ui/brand';
import { useDocumentTheme } from '../../ui/ThemeScope';
import { AuthPanel } from './AuthPanel';
import { LobbyView } from './LobbyView';

/**
 * Botó per continuar: l'enllaç vinculat al compte (si ha entrat) o l'últim enllaç d'aquest navegador.
 * Si ha perdut l'enllaç, pot entrar amb el seu compte i el portem al seu.
 */
function AccountEntry({ last }: { last: string | null }) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [account, setAccount] = useState<{ uid: string; token: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | null = null;
    getRepo()
      .then((r) => {
        if (!alive) return;
        setRepo(r);
        unsub = r.onAuthChange((u) => alive && setUser(u));
      })
      .catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  useEffect(() => {
    if (!repo || !user) return;
    let alive = true;
    repo.getMyAccount().then((a) => alive && setAccount({ uid: user.uid, token: a?.token ?? null }));
    return () => {
      alive = false;
    };
  }, [repo, user]);

  const linked = user && account?.uid === user.uid ? account.token : undefined; // undefined = encara carregant
  if (user && linked === undefined) return <div className="spinner" />;
  if (user && linked)
    return (
      <>
        <Link href={`/p/${linked}`} className="btn btn-block">
          Continue
        </Link>
        <p className="account-strip">
          <span className="muted">{user.email || user.name}</span>
          <button type="button" className="link-btn" onClick={() => repo?.signOut()}>
            Sortir
          </button>
        </p>
      </>
    );

  return (
    <>
      {last ? (
        <Link href={`/p/${last}`} className="btn btn-block">
          Continue
        </Link>
      ) : (
        <p className="lobby-hint">Per jugar necessites el teu enllaç personal. Busca'l al WhatsApp!</p>
      )}
      {user ? (
        <p className="account-strip">
          <span className="muted">El compte {user.email || user.name} encara no té cap enllaç vinculat: obre el teu enllaç del WhatsApp.</span>
          <button type="button" className="link-btn" onClick={() => repo?.signOut()}>
            Sortir
          </button>
        </p>
      ) : repo && user === null && open ? (
        <AuthPanel repo={repo} />
      ) : (
        repo && (
          <button type="button" className="link-btn account-strip" onClick={() => setOpen(true)}>
            Has perdut l'enllaç? Entra amb el teu compte
          </button>
        )
      )}
    </>
  );
}

/**
 * Pàgina pública compartida (enllaç únic per al grup de WhatsApp): `/` o `/portada`.
 * Enquesta tancada: portada (compte enrere, missatge i assistència).
 * Enquesta oberta: la pàgina d'inici normal; per jugar cal l'enllaç personal.
 */
export function HomePage() {
  const last = readJson<string>(LAST_TOKEN_KEY);
  const [edition, setEdition] = useState<PublicEdition | null>(null);
  useDocumentTheme(edition?.theme ?? null);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    getRepo()
      .then((r) => {
        if (alive) unsub = r.watchPublicEdition(EDITION_ID, setEdition);
      })
      .catch(() => {});
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  if (!edition)
    return (
      <main className="screen">
        <div className="screen-inner screen-center">
          <div className="spinner" />
          <p className="insert-coin">Loading...</p>
        </div>
      </main>
    );

  const demoLinks = IS_DEMO && (
    <div className="card stack" style={{ marginTop: 12, textAlign: 'left' }}>
      <strong>Mode demo</strong>
      <Link href="/p/DemoTotemDemoTotem2027">Provar com a participant</Link>
      <Link href="/admin">Anar a l'admin</Link>
    </div>
  );

  // Enquesta tancada: portada amb compte enrere i assistència
  if (!edition.lobby.surveyOpen) return <LobbyView lobby={edition.lobby}>{demoLinks}</LobbyView>;

  // Enquesta oberta: la pàgina d'inici de sempre (cal l'enllaç personal per jugar)
  return (
    <main className="screen">
      <div className="screen-inner welcome">
        <div className="hud" aria-hidden>
          <span>1UP 000000</span>
          <span>HI 999990</span>
        </div>
        <Logo size={290} />
        <p className="welcome-hello">{edition.theme.subtitle || 'Totem of Happiness'}</p>
        <div className="grow" />
        <AccountEntry last={last} />
        <p className="insert-coin blink" aria-hidden>
          Insert coin
        </p>
        {demoLinks}
      </div>
    </main>
  );
}
