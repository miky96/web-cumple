import { useCallback, useEffect, useRef, useState } from 'react';
import { splitProfileEmail } from '../../domain/people/contact';
import { finalAnswers } from '../../domain/quiz/progress';
import { safeImageUrl } from '../../domain/safeUrl';
import { isValidToken } from '../../domain/tokens';
import type { Answers, Invite, PublicEdition, Reveal, RevealedMate } from '../../domain/types';
import type { AuthUser } from '../../data/ports';
import { getRepo, type Repo } from '../../data/repo';
import { LAST_TOKEN_KEY, progressKey, readJson, removeKey, writeJson } from '../../lib/storage';
import { BRAND, Logo } from '../../ui/brand';
import { preloadSvg } from '../../ui/InlineSvg';
import { useDocumentTheme } from '../../ui/ThemeScope';
import { ArcadeView } from './ArcadeView';
import { AuthPanel } from './AuthPanel';
import { LobbyView } from './LobbyView';
import { QuizRunner } from './QuizRunner';
import { ResultView } from './ResultView';
import { preloadRevealAssets, RevealAnimation } from './RevealAnimation';

type Phase =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | { kind: 'login' }
  | { kind: 'claim'; canPreview: boolean }
  | { kind: 'taken' }
  | { kind: 'welcome' }
  | { kind: 'quiz' }
  | { kind: 'submitting' }
  | { kind: 'revealing'; reveal: Reveal }
  | { kind: 'result'; reveal: Reveal; celebrate: boolean }
  | { kind: 'pending' }
  /** Sala arcade; `back` és la pantalla a la qual es torna (resultat o "encara decidint"). */
  | { kind: 'arcade'; back: { kind: 'result'; reveal: Reveal } | { kind: 'pending' } };

/**
 * Companys visibles en temps real: només els que ja han contestat.
 * També marca el participant com a contestat perquè els seus companys el vegin.
 */
function useRevealedMates(reveal: Reveal | null): string[] {
  const [mates, setMates] = useState<{ for: Reveal; list: RevealedMate[] } | null>(null);
  useEffect(() => {
    if (!reveal?.mateKeys) return; // format antic: tots els noms ja venen a la revelació
    let unsubscribe: (() => void) | null = null;
    let alive = true;
    (async () => {
      const repo = await getRepo();
      if (!alive) return;
      void repo.markAnswered(reveal.selfKey);
      unsubscribe = repo.watchRevealedMates(reveal.mateKeys, (list) => alive && setMates({ for: reveal, list }));
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [reveal]);
  if (!reveal) return [];
  if (!reveal.mateKeys) return reveal.mates ?? [];
  return mates?.for === reveal ? mates.list.map((m) => m.name) : [];
}

/** Les rules només deixen llegir la resposta al propietari de l'enllaç (o a l'admin). */
async function canRead(repo: Repo, token: string): Promise<boolean> {
  try {
    await repo.getResponse(token);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') return false;
    throw e;
  }
}

function AccountStrip({ repo, user }: { repo: Repo | null; user: AuthUser | null | undefined }) {
  if (!repo || !user) return null;
  return (
    <p className="account-strip">
      <span className="muted">Has entrat com a {user.email || user.name}</span>
      <button type="button" className="link-btn" onClick={() => repo.signOut()}>
        Sortir
      </button>
    </p>
  );
}

export function ParticipantPage({ token }: { token: string }) {
  const [rawPhase, setPhase] = useState<Phase>({ kind: 'loading' });
  const phase: Phase = isValidToken(token) ? rawPhase : { kind: 'invalid' };
  const [invite, setInvite] = useState<Invite | null>(null);
  const [edition, setEdition] = useState<PublicEdition | null>(null);
  const editionRef = useRef<PublicEdition | null>(null);
  useEffect(() => {
    editionRef.current = edition;
  }, [edition]);
  useDocumentTheme(edition?.theme ?? null);
  const currentReveal = rawPhase.kind === 'revealing' || rawPhase.kind === 'result' ? rawPhase.reveal : null;
  const mates = useRevealedMates(currentReveal);

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

  // Sessió (Firebase Auth): undefined = encara no ho sabem
  const [repo, setRepo] = useState<Repo | null>(null);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | null = null;
    getRepo()
      .then((r) => {
        if (!alive) return;
        setRepo(r);
        unsub = r.onAuthChange((u) => alive && setUser(u));
      })
      .catch((e) => alive && setPhase({ kind: 'error', message: (e as Error).message }));
    [BRAND.logo, BRAND.totem].forEach(preloadSvg);
    new Image().src = BRAND.silhouette;
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  const authKnown = user !== undefined;
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!isValidToken(token) || !repo || !authKnown) return; // el render ja mostra 'invalid' o 'loading'
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const inv = await repo.getInvite(token);
        if (!alive) return;
        if (!inv) return setPhase({ kind: 'invalid' });
        const pub = await repo.getPublicEdition(inv.editionId);
        if (!alive) return;
        setInvite(inv);
        setEdition(pub);
        editionRef.current = pub;
        // en temps real: si l'admin obre l'enquesta (o canvia el compte enrere), la pàgina reacciona sola
        unsubscribe = repo.watchPublicEdition(inv.editionId, (e) => alive && e && setEdition(e));

        // L'enllaç ja no és prou: cal entrar amb el compte que l'ha reclamat
        if (!uid) return setPhase({ kind: 'login' });
        if (inv.uid !== uid) {
          const canPreview = await canRead(repo, token); // només l'admin pot llegir enllaços d'altres
          if (!alive) return;
          if (!canPreview) return setPhase(inv.uid ? { kind: 'taken' } : { kind: 'claim', canPreview: false });
          if (!inv.uid && !previewing) return setPhase({ kind: 'claim', canPreview: true });
          // organitzador: mira l'enllaç sense vincular-lo
        }

        const response = await repo.getResponse(token);
        if (!alive) return;
        writeJson(LAST_TOKEN_KEY, token);
        if (response) await loadReveal(false);
        else setPhase({ kind: 'welcome' });
      } catch (e) {
        if (alive) setPhase({ kind: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [token, repo, authKnown, uid, previewing, attempt, loadReveal]);

  const claim = async () => {
    if (!repo || !invite) return;
    setClaimBusy(true);
    setClaimError(null);
    try {
      await repo.claimInvite(token, invite.editionId);
      setAttempt((n) => n + 1);
    } catch (e) {
      setClaimError(
        (e as { code?: string }).code === 'permission-denied'
          ? "No s'ha pogut vincular: aquest compte ja té un altre enllaç d'aquesta edició, o algú ja ha reclamat aquest. Prova amb un altre compte o avisa al miky."
          : (e as Error).message,
      );
    } finally {
      setClaimBusy(false);
    }
  };

  const complete = async (answers: Answers) => {
    if (!invite || !edition) return;
    setPhase({ kind: 'submitting' });
    try {
      const repo = await getRepo();
      // el correu no va amb les respostes: es desa a part, en un doc privat
      const { answers: toSave, email } = splitProfileEmail(finalAnswers(edition.quizSteps, answers));
      // crea o substitueix (si està repetint el qüestionari)
      await repo.submitResponse(token, invite.editionId, toSave);
      if (email) await repo.saveContact(token, invite.editionId, email).catch((e) => console.warn("No s'ha pogut desar el correu", e));
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
            <p className="muted">Comprova que l'has copiat sencer o demana'n un de nou al miky.</p>
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
    case 'login':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <Logo size={200} />
            <p className="welcome-hello">Hola, {invite?.displayName}!</p>
            <p>Per protegir les teves dades, entra amb un compte. Només cal fer-ho un cop.</p>
            <AuthPanel repo={repo!} />
          </div>
        </main>
      );
    case 'claim':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <Logo size={200} />
            <p className="welcome-hello">Ets {invite?.displayName}?</p>
            <p>
              Vincula aquest enllaç al compte <b>{user?.email || user?.name}</b>. A partir d'ara només s'hi podrà entrar amb aquest compte, i
              si perds l'enllaç, entrant a la portada podràs tornar a accedir.
            </p>
            <button className="btn btn-block" disabled={claimBusy} onClick={claim}>
              {claimBusy ? 'Vinculant...' : 'Sí, sóc jo: vincular'}
            </button>
            <button className="btn btn-ghost btn-block" disabled={claimBusy} onClick={() => repo?.signOut()}>
              Canviar de compte
            </button>
            {phase.canPreview && (
              <button className="link-btn" onClick={() => setPreviewing(true)}>
                Només mirar, sense vincular (organitzador)
              </button>
            )}
            {claimError && <p className="error-text">{claimError}</p>}
          </div>
        </main>
      );
    case 'taken':
      return (
        <main className="screen">
          <div className="screen-inner screen-center">
            <Logo size={200} />
            <h2>Aquest enllaç ja està vinculat a un altre compte</h2>
            <p className="muted">
              Has entrat com a {user?.email || user?.name}. Si és el teu enllaç, entra amb el compte que vas fer servir la primera vegada. Si no
              te'n surts, avisa al miky.
            </p>
            <button className="btn" onClick={() => repo?.signOut()}>
              Canviar de compte
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
            <AccountStrip repo={repo} user={user} />
          </div>
        </main>
      );
    case 'quiz':
      return (
        <main className="screen">
          <div className="screen-inner">
            <QuizRunner
              steps={edition?.quizSteps ?? []}
              ctx={{ displayName: invite?.displayName ?? '', email: user?.email || undefined }}
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
          mates={mates}
          name={invite?.displayName ?? ''}
          celebrate={phase.celebrate}
          background={safeImageUrl(phase.reveal.image ?? edition?.theme.resultBackground)}
          footer={edition?.theme.subtitle}
          onReplay={() => setPhase({ kind: 'revealing', reveal: phase.reveal })}
          onArcade={() => setPhase({ kind: 'arcade', back: { kind: 'result', reveal: phase.reveal } })}
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
            <h2>L'algoritme està encara debatint on has d'estar...</h2>
            <p className="muted">Felicitats per superar tot el que has superat, disfruta de la vida mentres no saps amb qui aniràs</p>
            <button className="btn" onClick={() => loadReveal(true)}>
              Tornar a mirar
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase({ kind: 'arcade', back: { kind: 'pending' } })}>
              🕹️ Mentrestant, sala arcade
            </button>
          </div>
        </main>
      );
    case 'arcade':
      return (
        <ArcadeView
          repo={repo!}
          token={token}
          editionId={invite?.editionId ?? ''}
          quizSteps={edition?.quizSteps ?? []}
          ctx={{ displayName: invite?.displayName ?? '', email: user?.email || undefined }}
          uid={user?.uid ?? null}
          leaderboardName={invite?.uid && invite.uid === user?.uid ? invite.displayName : null}
          onExit={() => setPhase(phase.back.kind === 'result' ? { ...phase.back, celebrate: false } : phase.back)}
        />
      );
  }
}
