import { useEffect, useState, type ReactNode } from 'react';
import { countdownParts, pad2, splitAttendance } from '../../domain/lobby/lobby';
import { normalizeName } from '../../domain/text';
import type { Lobby } from '../../domain/types';
import { Logo } from '../../ui/brand';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({ endsAt }: { endsAt: number | null }) {
  const now = useNow();
  const c = countdownParts(endsAt, now);
  const cells: [number, string][] = [
    [c.days, 'Dies'],
    [c.hours, 'Hores'],
    [c.minutes, 'Min'],
    [c.seconds, 'Seg'],
  ];
  return (
    <div className={`countdown ${c.done ? 'done' : ''}`} role="timer" aria-live="off">
      {cells.map(([v, label], i) => (
        <div key={label} className="countdown-cell">
          <span className="countdown-num">{i === 0 && v > 99 ? v : pad2(v)}</span>
          <span className="countdown-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Portada (també és la pàgina compartida `/`). Mentre l'enquesta és tancada: compte enrere, missatge de l'organitzador i llista d'assistència.
 * Quan l'admin obre l'enquesta, la pàgina passa sola al flux normal (escolta en temps real).
 */
export function LobbyView({ lobby, name, children }: { lobby: Lobby; name?: string | null; children?: ReactNode }) {
  const done = countdownParts(lobby.endsAt, useNow()).done;
  const { confirmed, pending } = splitAttendance(lobby.attendance);
  const me = name ? normalizeName(name) : null;
  const chip = (n: string) => (
    <li key={n} className={`chip ${me && normalizeName(n) === me ? 'me' : ''}`}>
      {n}
    </li>
  );

  return (
    <main className="screen lobby">
      <div className="screen-inner">
        <div className="hud" aria-hidden>
          <span>1UP 000000</span>
          <span>HI 999990</span>
        </div>
        <Logo size={190} className="lobby-logo" />
        {name && <p className="lobby-hello">Hola, {name}</p>}

        {lobby.surveyOpen ? (
          <div className="lobby-open" role="status">
            <span className="lobby-open-title">Enquesta oberta!</span>
            <span className="lobby-open-sub">El tòtem s'ha despertat</span>
          </div>
        ) : (
          <>
            <Countdown endsAt={lobby.endsAt} />
            {done && <p className="insert-coin blink center">El tòtem s'està despertant...</p>}
          </>
        )}

        {!lobby.surveyOpen && lobby.message && <p className="lobby-message">{lobby.message}</p>}

        {lobby.attendance.length > 0 && (
          <section className="attendance" aria-label="Assistència">
            <div className="attendance-col ok">
              <h3>
                Confirmats <span>{confirmed.length}</span>
              </h3>
              <ul>{confirmed.map(chip)}</ul>
            </div>
            <div className="attendance-col wait">
              <h3>
                Es perden aquesta edició de moment <span>{pending.length}</span>
              </h3>
              <ul>{pending.map(chip)}</ul>
            </div>
          </section>
        )}

        {children}
        <p className="insert-coin blink center" aria-hidden style={{ marginTop: 18 }}>
          Insert coin
        </p>
      </div>
    </main>
  );
}
