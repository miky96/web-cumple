import { useState } from 'react';
import type { Repo } from '../../data/repo';
import { EDITION_ID } from '../../data/repo';
import { DEFAULT_LOBBY, fromLocalInput, toLocalInput } from '../../domain/lobby/lobby';
import { DEFAULT_THEME } from '../../domain/theme/palette';
import type { Lobby } from '../../domain/types';
import { copyText } from '../../lib/device';
import { useRemoteDraft } from '../../lib/hooks';
import { askConfirm } from '../../ui/confirm';
import { ThemeScope } from '../../ui/ThemeScope';
import { LobbyView } from '../public/LobbyView';
import type { AdminData } from './useAdminData';

export function LobbyPage({ repo, data }: { repo: Repo; data: AdminData }) {
  const lobby = data.publicEdition?.lobby ?? DEFAULT_LOBBY;
  const [dirty, setDirty] = useState(false);
  const [endsAt, setEndsAt] = useRemoteDraft(lobby.endsAt, toLocalInput, !dirty);
  const [message, setMessage] = useRemoteDraft(lobby.message, (m) => m, !dirty);

  const save = (patch: Partial<Lobby>) => repo.savePublicEdition(EDITION_ID, { lobby: { ...lobby, ...patch } });

  const toggleSurvey = async () => {
    const opening = !lobby.surveyOpen;
    const ok = await askConfirm(
      opening
        ? {
            title: 'OBRIR ENQUESTA?',
            message: "Tothom que tingui l'enllaç deixarà de veure la portada i podrà fer el qüestionari i descobrir el seu equip.",
            confirmLabel: 'Obrir enquesta',
          }
        : {
            title: 'TANCAR ENQUESTA?',
            message: 'Els participants tornaran a veure la portada amb el compte enrere i no podran respondre.',
            confirmLabel: 'Tancar i mostrar portada',
            danger: true,
          },
    );
    if (ok) await save({ surveyOpen: opening });
  };

  const confirmedCount = data.participants.filter((p) => p.confirmed).length;
  const sharedLink = `${location.origin}/`;
  const sharedMessage = `🗿🕹️ TOTEM OF HAPPINESS 🕹️🗿\nCompte enrere i llista d'assistència aquí: ${sharedLink}\nQuan s'obri l'enquesta, cadascú rebrà el seu enllaç personal per jugar.`;
  const preview: Lobby = { ...lobby, endsAt: fromLocalInput(endsAt), message };

  return (
    <>
      <h1>Portada</h1>
      <div className={`admin-banner ${lobby.surveyOpen ? 'ok' : 'warn'}`}>
        <div className="row">
          <div style={{ flex: 1 }}>
            {lobby.surveyOpen ? (
              <>
                <b>Enquesta oberta.</b> Els participants fan el qüestionari i veuen el seu equip.
              </>
            ) : (
              <>
                <b>Enquesta tancada.</b> Tothom (amb o sense enllaç) només veu la portada: compte enrere, missatge i
                assistència.
              </>
            )}
          </div>
          <button className={`btn btn-sm ${lobby.surveyOpen ? 'btn-ghost' : ''}`} onClick={toggleSurvey}>
            {lobby.surveyOpen ? 'Tancar enquesta' : 'Obrir enquesta'}
          </button>
        </div>
      </div>

      <div className="quiz-layout">
        <div className="stack">
          <section className="card">
            <h3>Enllaç compartit</h3>
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Un sol enllaç per al grup de WhatsApp. Mentre l'enquesta és tancada mostra la portada (compte enrere, missatge i
              assistència). Quan l'obris, torna a ser la pàgina d'inici normal i cadascú juga amb el seu enllaç personal.
            </p>
            <div className="row">
              <input className="input" readOnly value={sharedLink} style={{ flex: 1, minWidth: 0 }} onFocus={(e) => e.target.select()} />
              <button className="btn btn-sm" onClick={() => copyText(sharedLink)}>
                Copiar enllaç
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => copyText(sharedMessage)}>
                Copiar missatge
              </button>
              <a className="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">
                Obrir ↗
              </a>
            </div>
          </section>

          <section className="card">
            <h3>Compte enrere</h3>
            <label className="field">
              <span>Acaba el</span>
              <input
                id="lobby-ends"
                className="input"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  setDirty(true);
                }}
              />
              <span className="muted small">
                Quan arribi a 0, si encara no has obert l'enquesta, es queda a 00:00:00:00 amb el missatge i la llista.
              </span>
            </label>
            <label className="field">
              <span>Missatge</span>
              <textarea
                id="lobby-message"
                className="textarea"
                value={message}
                placeholder="Per a què serveix el compte enrere?"
                onChange={(e) => {
                  setMessage(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <button
              className="btn btn-sm"
              disabled={!dirty}
              onClick={async () => {
                await save({ endsAt: fromLocalInput(endsAt), message: message.trim() });
                setDirty(false);
              }}
            >
              {dirty ? 'Desar portada' : 'Desat ✓'}
            </button>
          </section>

          <section className="card">
            <h3>
              Assistència · {confirmedCount}/{data.participants.length} confirmats
            </h3>
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Marca qui t'ha confirmat. La llista es publica a la portada automàticament (només els noms).
            </p>
            <div className="attendance-admin">
              {data.participants.map((p) => (
                <label key={p.id} className={`attendance-toggle ${p.confirmed ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={p.confirmed}
                    onChange={(e) => repo.updateParticipant(EDITION_ID, p, { confirmed: e.target.checked })}
                  />
                  {p.name}
                </label>
              ))}
              {data.participants.length === 0 && <span className="muted small">Afegeix participants a la pestanya Participants.</span>}
            </div>
          </section>
        </div>

        <div className="phone">
          <ThemeScope theme={data.publicEdition?.theme ?? DEFAULT_THEME}>
            <LobbyView lobby={preview} name="Anna" />
          </ThemeScope>
        </div>
      </div>
    </>
  );
}
