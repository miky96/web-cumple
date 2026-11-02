import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { LeaderboardRow } from '../../data/ports';
import type { Repo } from '../../data/repo';
import { ARCADE_GAMES, arcadeRankings, arcadeStep, boardFromAnswers, describeBest, mergeBoards, recordPlay, sameBoard, type ArcadeBoard, type ArcadeGame, type ArcadeRanking } from '../../domain/arcade/arcade';
import { minigameScore } from '../../domain/insights/curiosities';
import { STEP_CATALOG } from '../../domain/quiz/catalog';
import type { QuizStep, StepType } from '../../domain/types';
import type { StepContext, StepProps } from './steps/common';
import { STEP_COMPONENTS } from './steps/registry';

type Mode =
  | { kind: 'menu' }
  | { kind: 'play'; game: ArcadeGame; round: number }
  | { kind: 'outcome'; game: ArcadeGame; round: number; improved: boolean; first: boolean; value: string | null };

interface Props {
  repo: Repo;
  token: string;
  editionId: string;
  quizSteps: QuizStep[];
  ctx: StepContext;
  /** uid del compte actual (per marcar "tu" al leaderboard). */
  uid: string | null;
  /** Nom amb què surt al leaderboard; null si no s'hi ha de publicar (l'admin mirant l'enllaç d'un altre). */
  leaderboardName: string | null;
  onExit: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** HIGH SCORES: top 10 de cada joc, amb la teva posició encara que no hi entris. */
function Leaderboard({ rankings, uid, game, onGame }: { rankings: ArcadeRanking[]; uid: string | null; game: ArcadeGame; onGame: (g: ArcadeGame) => void }) {
  const rk = rankings.find((r) => r.game === game)!;
  const meIdx = uid ? rk.entries.findIndex((e) => e.id === uid) : -1;
  const row = (e: ArcadeRanking['entries'][number], i: number) => (
    <li key={e.id ?? e.name} className={e.id && e.id === uid ? 'me' : undefined}>
      <span className="hs-rank">{pad(i + 1)}</span>
      <span className="hs-name">
        {e.name}
        {e.id && e.id === uid ? ' (tu)' : ''}
      </span>
      <span className="hs-value">{e.value}</span>
    </li>
  );
  return (
    <section className="highscores" aria-label="Leaderboard">
      <h3>High scores</h3>
      <div className="hs-tabs" role="tablist">
        {ARCADE_GAMES.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={g === game} title={STEP_CATALOG[g].label} className={g === game ? 'active' : undefined} onClick={() => onGame(g)}>
            {STEP_CATALOG[g].emoji}
          </button>
        ))}
      </div>
      <p className="hs-game">{STEP_CATALOG[game].label}</p>
      {rk.entries.length === 0 ? (
        <p className="muted small">Encara no hi ha jugat ningú. El primer rècord el pot fer tu, neeerviiis!</p>
      ) : (
        <ol className="hs-list">
          {rk.entries.slice(0, 10).map(row)}
          {meIdx >= 10 && (
            <>
              <li className="hs-gap" aria-hidden>
                ···
              </li>
              {row(rk.entries[meIdx], meIdx)}
            </>
          )}
        </ol>
      )}
    </section>
  );
}

/** Sala arcade: tria un minijoc, juga'l sol i es guarda la millor marca. */
export function ArcadeView({ repo, token, editionId, quizSteps, ctx, uid, leaderboardName, onExit }: Props) {
  const [board, setBoard] = useState<ArcadeBoard | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'menu' });
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [pickedGame, setHsGame] = useState<ArcadeGame | null>(null);
  const rankings = useMemo(() => arcadeRankings((rows ?? []).map((r) => ({ id: r.uid, name: r.name, board: r.board }))), [rows]);
  // Per defecte, la primera pestanya que tingui marques (no una de buida)
  const hsGame = pickedGame ?? rankings.find((r) => r.entries.length > 0)?.game ?? 'stop-the-clock';

  const [hsError, setHsError] = useState(false);
  useEffect(
    () =>
      repo.watchLeaderboard(
        editionId,
        (r) => {
          setRows(r);
          setHsError(false);
        },
        () => setHsError(true),
      ),
    [repo, editionId],
  );

  // Si tens marques però no surts al leaderboard (p. ex. t'han regenerat l'enllaç), et tornem a publicar un cop.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || leaderboardName === null || !uid || !board || !rows || Object.keys(board).length === 0) return;
    synced.current = true;
    const mine = rows.find((r) => r.uid === uid);
    if (!mine || mine.name !== leaderboardName || JSON.stringify(mine.board) !== JSON.stringify(board))
      repo.saveArcade(token, editionId, board, leaderboardName).catch((e) => console.warn('No es pot publicar al leaderboard', e));
  }, [repo, token, editionId, uid, leaderboardName, board, rows]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [saved, response] = await Promise.all([repo.getArcade(token), repo.getResponse(token)]);
        if (!alive) return;
        // Les marques dels minijocs del qüestionari compten com a punt de partida
        const merged = response ? mergeBoards(saved, boardFromAnswers(quizSteps, response.answers, response.completedAt)) : saved;
        setBoard(merged);
        if (!sameBoard(merged, saved)) await repo.saveArcade(token, editionId, merged, leaderboardName);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
    // només en entrar a la sala
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, token]);

  const finish = async (game: ArcadeGame, round: number, answer: unknown) => {
    const r = recordPlay(board ?? {}, game, answer, Date.now());
    setMode({ kind: 'outcome', game, round, improved: r.improved, first: r.first, value: minigameScore(game, answer)?.value ?? null });
    if (!r.improved) return;
    setBoard(r.board);
    try {
      await repo.saveArcade(token, editionId, r.board, leaderboardName);
      setError(null);
    } catch (e) {
      setError(`No s'ha pogut desar la marca: ${(e as Error).message}`);
    }
  };

  if (mode.kind === 'play') {
    const step = arcadeStep(mode.game, quizSteps);
    const Component = STEP_COMPONENTS[step.type] as ComponentType<StepProps<StepType>>;
    return (
      <main className="screen">
        <div className="screen-inner">
          <div className="arcade-top">
            <button type="button" className="link-btn" onClick={() => setMode({ kind: 'menu' })}>
              ← Sala arcade
            </button>
            <span className="insert-coin">{STEP_CATALOG[mode.game].label}</span>
          </div>
          <Component key={mode.round} step={step as never} ctx={ctx} onSubmit={(v) => finish(mode.game, mode.round, v)} />
        </div>
      </main>
    );
  }

  if (mode.kind === 'outcome') {
    const info = STEP_CATALOG[mode.game];
    const best = describeBest(mode.game, board?.[mode.game]);
    const entries = rankings.find((r) => r.game === mode.game)?.entries ?? [];
    const pos = uid ? entries.findIndex((e) => e.id === uid) : -1;
    return (
      <main className="screen">
        <div className="screen-inner screen-center">
          <div className="arcade-emoji" aria-hidden>
            {info.emoji}
          </div>
          <h2 className={mode.improved ? 'arcade-record' : undefined}>
            {mode.first ? 'Primera marca!' : mode.improved ? 'NEW HIGH SCORE!' : 'Gairebé...'}
          </h2>
          <div className="card stack arcade-summary">
            <div>
              Aquesta partida: <b>{mode.value ?? '—'}</b>
            </div>
            <div>
              El teu rècord: <b>{best ?? '—'}</b>
            </div>
            {pos >= 0 && (
              <div>
                Posició: <b>#{pos + 1}</b> de {entries.length}
              </div>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-block" onClick={() => setMode({ kind: 'play', game: mode.game, round: mode.round + 1 })}>
            Tornar a jugar
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              setHsGame(mode.game);
              setMode({ kind: 'menu' });
            }}
          >
            Triar un altre joc / High scores
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="screen-inner">
        <div className="arcade-top">
          <button type="button" className="link-btn" onClick={onExit}>
            ← Tornar
          </button>
        </div>
        <h2 className="arcade-title">Sala arcade</h2>
        <p className="muted">Tria un joc i juga tantes vegades com vulguis. Es guarda la teva millor marca.</p>
        {error && <p className="error-text">{error}</p>}
        {!board && !error ? (
          <div className="spinner" />
        ) : (
          <div className="arcade-grid">
            {ARCADE_GAMES.map((g, i) => {
              const info = STEP_CATALOG[g];
              const best = describeBest(g, board?.[g]);
              return (
                <button key={g} type="button" className="arcade-card" style={{ animationDelay: `${i * 0.06}s` }} onClick={() => setMode({ kind: 'play', game: g, round: 0 })}>
                  <span className="arcade-emoji" aria-hidden>
                    {info.emoji}
                  </span>
                  <span className="arcade-label">{info.label}</span>
                  <span className="arcade-best">{best ? `Rècord: ${best}` : 'Sense jugar'}</span>
                </button>
              );
            })}
          </div>
        )}
        {rows && <Leaderboard rankings={rankings} uid={uid} game={hsGame} onGame={setHsGame} />}
        {hsError && !rows && <p className="error-text center">No s'ha pogut carregar el leaderboard. Torna-ho a provar d'aquí una estona.</p>}
        <p className="insert-coin blink center" aria-hidden>
          Insert coin
        </p>
      </div>
    </main>
  );
}
