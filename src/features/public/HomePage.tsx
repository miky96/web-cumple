import { useEffect, useState } from 'react';
import { getRepo, EDITION_ID, IS_DEMO } from '../../data/repo';
import type { PublicEdition } from '../../domain/types';
import { Link } from '../../lib/router';
import { LAST_TOKEN_KEY, readJson } from '../../lib/storage';
import { Logo } from '../../ui/brand';
import { useDocumentTheme } from '../../ui/ThemeScope';
import { LobbyView } from './LobbyView';

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
        {last ? (
          <Link href={`/p/${last}`} className="btn btn-block">
            Continue
          </Link>
        ) : (
          <p className="lobby-hint">Per jugar necessites el teu enllaç personal. Busca'l al WhatsApp!</p>
        )}
        <p className="insert-coin blink" aria-hidden>
          Insert coin
        </p>
        {demoLinks}
      </div>
    </main>
  );
}
