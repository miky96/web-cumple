import { useCallback, useEffect, useRef, useState } from 'react';
import { finalAnswers } from '../../domain/quiz/progress';
import { safeImageUrl } from '../../domain/safeUrl';
import { isValidToken } from '../../domain/tokens';
import type { Answers, Invite, PublicEdition, Reveal } from '../../domain/types';
import { getRepo } from '../../data/repo';
import { LAST_TOKEN_KEY, progressKey, readJson, removeKey, writeJson } from '../../lib/storage';
import { BRAND, Logo } from '../../ui/brand';
import { preloadSvg } from '../../ui/InlineSvg';
import { useDocumentTheme } from '../../ui/ThemeScope';
import { LobbyView } from './LobbyView';
import { QuizRunner } from './QuizRunner';
import { ResultView } from './ResultView';
import { preloadRevealAssets, RevealAnimation } from './RevealAnimation';

type Phase =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'welcome' }
  | { kind: 'quiz' }
  | { kind: 'submitting' }
  | { kind: 'revealing'; reveal: Reveal }
  | { kind: 'result'; reveal: Reveal; celebrate: boolean }
  | { kind: 'pending' };

export function ParticipantPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [edition, setEdition] = useState<PublicEdition | null>(null);
  const editionRef = useRef<PublicEdition | null>(null);
  editionRef.current = edition;
  useDocumentTheme(edition?.theme ?? null);

  // mentre juga, precarreguem el tòtem de l'animació (els colors del tema ja estan aplicats)
  useEffect(() => {
    if (phase.kind === 'quiz' || phase.kind === 'result') preloadRevealAssets();
  }, [phase.kind]);

  const loadReveal = useCallback(async (animate: boolean) => {
    const repo = await getRepo();
    const reveal = await repo.getReveal(token);
    if (!reveal) return setPhase({ kind: 'pending' });
    // precarrega el fons perquè surti a l'instant en acabar l'animació
    const bg = safeImageUrl(reveal.image ?? editionRef.current?.theme.resultBackground);
    if (bg) new Image().src = bg;
    setPhase(animate ? { kind: 'revealing', reveal } : { kind: 'result', reveal, celebrate: false });
  }, [token]);

  useEffect(() => {
    if (!isValidToken(token)) return setPhase({ kind: 'invalid' });
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const repo = await getRepo();
        const inv = await repo.getInvite(token);
        if (!alive) return;
        if (!inv) return setPhase({ kind: 'invalid' });
        const [pub, response] = await Promise.all([repo.getPublicEdition(inv.editionId), repo.getResponse(token)]);
        if (!alive) return;
        setInvite(inv);
        setEdition(pub);
        editionRef.current = pub;
        // en temps real: si l'admin obre l'enquesta (o canvia el compte enrere), la pàgina reacciona sola
        unsubscribe = repo.watchPublicEdition(inv.editionId, (e) => alive && e && setEdition(e));
        writeJson(LAST_TOKEN_KEY, token);
        if (response) await loadReveal(false);
        else setPhase({ kind: 'welcome' });
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message });
      }
    })();
    [BRAND.logo, BRAND.totem].forEach(preloadSvg);
    new Image().src = BRAND.silhouette;
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [token, loadReveal]);

  const complete = async (answers: Answers) => {
    if (!invite || !edition) return;
    setPhase({ kind: 'submitting' });
    try {
      const repo = await getRepo();
      // crea o substitueix (si està repetint el qüestionari)
      await repo.submitResponse(token, invite.editionId, finalAnswers(edition.quizSteps, answers));
      removeKey(progressKey(token));
      await loadReveal(true);
    } catch (e) {
      setPhase({ kind: 'error', message: `No s'ha pogut enviar: ${(e as Error).message}. Torna-ho a provar.` });
    }
  };

  // Portada: mentre l'enquesta és tancada, qui encara no ha jugat només veu el compte enrere i l'assistència.
  // Qui ja ha jugat continua veient el seu equip (resultat, animació o "encara decidint").
  const surveyOpen = edition?.lobby.surveyOpen ?? false;
  const showLobby = edition && !surveyOpen && ['welcome', 'quiz', 'submitting'].includes(phase.kind);
  if (showLobby) return <LobbyView lobby={edition.lobby} name={invite?.displayName} />;

  switch (phase.kind) {
    case 'loading':
    case 'submitting':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <div className="spinner" />
            <p className="insert-coin">{phase.kind === 'submitting' ? 'Desant la partida...' : 'Loading...'}</p>
          </div>
        </main>
      );
    case 'invalid':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <Logo size={200} />
            <h2>Aquest enllaç no funciona</h2>
            <p className="muted">Comprova que l'has copiat sencer o demana'n un de nou a l'organitzador.</p>
          </div>
        </main>
      );
    case 'error':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <h2>Ups!</h2>
            <p>{phase.message}</p>
            <button className="btn" onClick={() => location.reload()}>
              Tornar-ho a provar
            </button>
          </div>
        </main>
      );
    case 'welcome':
      return (
        <main className="screen">
          <div className="screen-inner welcome">
            <div className="hud" aria-hidden>
              <span>1UP 000000</span>
              <span>HI 999990</span>
            </div>
            <Logo size={290} />
            <p className="welcome-hello">Benvinguda, {invite?.displayName}</p>
            <p>
              L'algoritme està preparat per assignar-te el teu estudi. Segueix les proves i prepara't, serà un viatge intens. 
            </p>
            <p className="insert-coin">{edition?.theme.subtitle}</p>
            <div className="grow" />
            <button className="btn btn-block" onClick={() => setPhase({ kind: 'quiz' })}>
              Press start
            </button>
            <p className="insert-coin blink" aria-hidden>
              Insert coin
            </p>
          </div>
        </main>
      );
    case 'quiz':
      return (
        <main className="screen">
          <div className="screen-inner">
            <QuizRunner
              steps={edition?.quizSteps ?? []}
              ctx={{ displayName: invite?.displayName ?? '' }}
              initialAnswers={readJson(progressKey(token))}
              onProgress={(a) => writeJson(progressKey(token), a)}
              onComplete={complete}
            />
          </div>
        </main>
      );
    case 'revealing':
      return (
        <RevealAnimation color={phase.reveal.color} onDone={() => setPhase({ kind: 'result', reveal: phase.reveal, celebrate: true })} />
      );
    case 'result':
      return (
        <ResultView
          reveal={phase.reveal}
          name={invite?.displayName ?? ''}
          celebrate={phase.celebrate}
          background={safeImageUrl(phase.reveal.image ?? edition?.theme.resultBackground)}
          footer={edition?.theme.subtitle}
          onReplay={() => setPhase({ kind: 'revealing', reveal: phase.reveal })}
          onRetake={
            edition?.allowRetake && surveyOpen
              ? () => {
                  removeKey(progressKey(token));
                  setPhase({ kind: 'quiz' });
                }
              : undefined
          }
        />
      );
    case 'pending':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <Logo size={220} />
            <h2>L'algoritme està encarra debatint on has d'estar...</h2>
            <p className="muted">Felicitats per superar tot el que has superat, disfruta de la vida mentres no saps amb qui aniràs</p>
            <button className="btn" onClick={() => loadReveal(true)}>
              Tornar a mirar
            </button>
          </div>
        </main>
      );
  }
}
