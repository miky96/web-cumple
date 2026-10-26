import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLatest } from '../../../lib/hooks';
import { evaluateStop, isClockHidden, stopTimeoutMs, type StopResult } from '../../../domain/minigames/stopTheClock';
import { countRating, createCountRound, LANES, normalizeLevel, type CountRound } from '../../../domain/minigames/countCharacters';
import { countTaps, tapRating } from '../../../domain/minigames/tapRace';
import {
  createMemoryGame,
  currentSequence,
  finishShowing,
  levelReached,
  memoryRating,
  pressColor,
  type MemoryState,
} from '../../../domain/minigames/memorySequence';
import { formatSeconds, formatSignedSeconds } from '../../../domain/text';
import { now, vibrate } from '../../../lib/device';
import { GameResult, NextButton, StepShell, type StepProps } from './common';

/** Requisit: estat que s'actualitza cada frame mentre `active`. */
function useFrame(active: boolean, onFrame: (t: number) => void) {
  const cb = useLatest(onFrame);
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      cb.current(now());
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active, cb]);
}

// ======================= Atura el rellotge =======================

export function StopClockStep({ step, onSubmit }: StepProps<'stop-the-clock'>) {
  const { targetMs, hideAfterMs } = step.config;
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<StopResult | null>(null);
  const startRef = useRef(0);

  const stop = (t: number) => {
    const r = evaluateStop(targetMs, t - startRef.current);
    setResult(r);
    setPhase('done');
    vibrate(Math.abs(r.deltaMs) < 100 ? [40, 40, 120] : 60);
  };

  useFrame(phase === 'running', (t) => {
    const e = t - startRef.current;
    setElapsed(e);
    if (e > stopTimeoutMs(targetMs)) stop(t);
  });

  const onPad = () => {
    if (phase === 'ready') {
      startRef.current = now();
      setElapsed(0);
      setPhase('running');
      vibrate(20);
    } else if (phase === 'running') stop(now());
  };

  if (phase === 'done' && result)
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <GameResult
          headline={formatSignedSeconds(result.deltaMs)}
          detail={`Has aturat a ${formatSeconds(result.elapsedMs)} (objectiu ${formatSeconds(targetMs, 0)})`}
          rating={result.rating}
          onNext={() => onSubmit({ targetMs, elapsedMs: result.elapsedMs, deltaMs: result.deltaMs })}
        />
      </StepShell>
    );

  const hidden = phase === 'running' && isClockHidden(elapsed, hideAfterMs);
  return (
    <StepShell kicker="Minijoc" title={step.title}>
      <div className="game">
        <button type="button" className="game-pad" onPointerDown={onPad}>
          <div className={`game-big ${hidden ? 'clock-hidden' : ''}`}>{formatSeconds(phase === 'ready' ? 0 : elapsed)}</div>
          <div className="game-hint">
            {phase === 'ready' ? 'Toca per començar' : hidden ? 'Ara a cegues... toca per aturar!' : 'Toca per aturar!'}
          </div>
          {hideAfterMs !== null && phase === 'ready' && (
            <div className="muted small">Compte: el rellotge desapareixerà als {formatSeconds(hideAfterMs, 1)}</div>
          )}
        </button>
      </div>
    </StepShell>
  );
}

// ======================= Compta personatges =======================

export function CountCharactersStep({ step, onSubmit }: StepProps<'count-characters'>) {
  const { durationMs } = step.config;
  const target = step.config.target.trim() || '🗿';
  const decoys = step.config.decoys.filter((d) => d && d !== target);
  const level = normalizeLevel(step.config.level);
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'running' | 'answer' | 'done'>('intro');
  const [count, setCount] = useState(3);
  const [round, setRound] = useState<CountRound | null>(null);
  const [guess, setGuess] = useState(0);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = window.setTimeout(() => {
      if (count > 1) return setCount((c) => c - 1);
      setRound(createCountRound(Math.random, durationMs, level, decoys.length));
      setPhase('running');
      vibrate(50);
    }, 700);
    return () => window.clearTimeout(id);
  }, [phase, count]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'running' || !round) return;
    const id = window.setTimeout(() => {
      setPhase('answer');
      vibrate([60, 60, 60]);
    }, round.totalMs);
    return () => window.clearTimeout(id);
  }, [phase, round]);

  const bump = (d: number) => {
    setGuess((g) => Math.max(0, Math.min(99, g + d)));
    vibrate(10);
  };

  if (phase === 'done' && round)
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <GameResult
          headline={`${round.actual} ${target}`}
          detail={guess === round.actual ? `Has dit ${guess}. Clavat!` : `Has dit ${guess}`}
          rating={countRating(guess, round.actual)}
          onNext={() => onSubmit({ guess, actual: round.actual })}
        />
      </StepShell>
    );

  if (phase === 'answer')
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <div className="game">
          <div className="game-hint">Quants {target} han passat?</div>
          <div className="count-stepper">
            <button type="button" className="btn btn-ghost" onClick={() => bump(-1)} disabled={guess === 0} aria-label="Un menys">−</button>
            <div className="game-big">{guess}</div>
            <button type="button" className="btn btn-ghost" onClick={() => bump(1)} aria-label="Un més">+</button>
          </div>
          <div className="step-actions" style={{ width: '100%' }}>
            <NextButton label="Confirmar" onClick={() => setPhase('done')} />
          </div>
        </div>
      </StepShell>
    );

  return (
    <StepShell kicker="Minijoc" title={step.title}>
      <div className="game">
        {phase === 'intro' && (
          <>
            <div className="count-target">{target}</div>
            <div className="game-hint">Compta només aquest</div>
            {decoys.length > 0 && <div className="muted small">Ignora: {decoys.join(' ')}</div>}
            <button type="button" className="btn btn-block" onClick={() => { setCount(3); setPhase('countdown'); }}>
              Començar
            </button>
          </>
        )}
        {phase === 'countdown' && (
          <>
            <div className="count-target">{target}</div>
            <div className="game-big">{count}</div>
          </>
        )}
        {phase === 'running' && round && (
          <>
            <div className="count-hud">
              <span className="game-hint">Compta:</span> <span className="count-hud-target">{target}</span>
            </div>
            <div className="count-timer" style={{ '--total': `${round.totalMs}ms` } as CSSProperties}>
              <i />
            </div>
            <div className="count-arena" aria-hidden>
              {round.spawns.map((s, i) => (
                <div
                  key={i}
                  className="count-sprite"
                  style={
                    {
                      top: `${((s.lane + 0.5) / LANES) * 100}%`,
                      '--cross': `${round.crossMs}ms`,
                      animationDelay: `${s.at}ms`,
                      animationDirection: s.leftToRight ? 'normal' : 'reverse',
                    } as CSSProperties
                  }
                >
                  <span>
                    <span className="count-hop">{s.isTarget ? target : decoys[s.decoy]}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </StepShell>
  );
}

// ======================= Toca ràpid =======================

export function TapRaceStep({ step, onSubmit }: StepProps<'tap-race'>) {
  const { durationMs } = step.config;
  const [phase, setPhase] = useState<'ready' | 'countdown' | 'running' | 'done'>('ready');
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(durationMs);
  const [pulse, setPulse] = useState(false);
  const taps = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const startAt = useRef(0);
  const [final, setFinal] = useState(0);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = window.setTimeout(() => {
      if (count > 1) return setCount((c) => c - 1);
      startAt.current = now();
      taps.current = [];
      setTapCount(0);
      setPhase('running');
      vibrate(50);
    }, 700);
    return () => window.clearTimeout(id);
  }, [phase, count]);

  useFrame(phase === 'running', (t) => {
    const remaining = startAt.current + durationMs - t;
    setLeft(Math.max(0, remaining));
    if (remaining <= 0) {
      setFinal(countTaps(startAt.current, durationMs, taps.current));
      setPhase('done');
      vibrate([60, 60, 60]);
    }
  });

  const onTap = () => {
    if (phase === 'ready') {
      setCount(3);
      setPhase('countdown');
    } else if (phase === 'running') {
      taps.current.push(now());
      setTapCount(taps.current.length);
      setPulse(true);
      window.setTimeout(() => setPulse(false), 50);
    }
  };

  if (phase === 'done')
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <GameResult
          headline={`${final} tocs`}
          detail={`en ${formatSeconds(durationMs, 0)}`}
          rating={tapRating(final, durationMs)}
          onNext={() => onSubmit({ taps: final, durationMs })}
        />
      </StepShell>
    );

  return (
    <StepShell kicker="Minijoc" title={step.title}>
      <div className="game">
        <div className="game-hint">
          {phase === 'ready' && 'Toca el botó per començar'}
          {phase === 'countdown' && 'Preparat...'}
          {phase === 'running' && `Queden ${formatSeconds(left, 1)}`}
        </div>
        <button type="button" className={`tap-target ${pulse ? 'pulse' : ''}`} onPointerDown={onTap}>
          {phase === 'ready' ? 'GO' : phase === 'countdown' ? count || '!' : tapCount}
        </button>
      </div>
    </StepShell>
  );
}

// ======================= Memòria =======================

const PADS = [
  { color: '#ff2e93', emoji: '🌋' },
  { color: '#2ef2ff', emoji: '🌊' },
  { color: '#7cff4f', emoji: '🌴' },
  { color: '#ffe94d', emoji: '🍍' },
];

export function MemoryStep({ step, onSubmit }: StepProps<'memory-sequence'>) {
  const { levels, startLength } = step.config;
  const [game, setGame] = useState<MemoryState | null>(null);
  const [lit, setLit] = useState<number | null>(null);

  // Reprodueix la seqüència quan toca
  useEffect(() => {
    if (!game || game.status !== 'showing') return;
    const seq = currentSequence(game);
    const timers: number[] = [];
    const on = 550, off = 220, lead = 700;
    seq.forEach((c, i) => {
      timers.push(window.setTimeout(() => setLit(c), lead + i * (on + off)));
      timers.push(window.setTimeout(() => setLit(null), lead + i * (on + off) + on));
    });
    timers.push(window.setTimeout(() => setGame((g) => (g ? finishShowing(g) : g)), lead + seq.length * (on + off)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [game?.status, game?.level]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (c: number) => {
    if (!game || game.status !== 'input') return;
    setLit(c);
    window.setTimeout(() => setLit(null), 180);
    const next = pressColor(game, c);
    vibrate(next.status === 'failed' ? [120, 60, 120] : 15);
    setGame(next);
  };

  if (game && (game.status === 'failed' || game.status === 'won')) {
    const reached = levelReached(game);
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <GameResult
          headline={`Nivell ${reached}/${levels}`}
          rating={memoryRating(reached, levels)}
          onNext={() => onSubmit({ levelReached: reached, levels })}
        />
      </StepShell>
    );
  }

  return (
    <StepShell kicker="Minijoc" title={step.title}>
      <div className="game">
        <div className="game-hint">
          {!game && 'Mira la seqüència i repeteix-la'}
          {game?.status === 'showing' && `Nivell ${game.level}: mira bé...`}
          {game?.status === 'input' && `El teu torn (${game.inputIndex}/${currentSequence(game).length})`}
        </div>
        <div className="memory-grid">
          {PADS.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`memory-pad ${lit === i ? 'lit' : ''}`}
              style={{ '--pad': p.color } as CSSProperties}
              disabled={game?.status !== 'input'}
              onPointerDown={() => press(i)}
              aria-label={p.emoji}
            >
              {p.emoji}
            </button>
          ))}
        </div>
        {!game && (
          <button type="button" className="btn btn-block" onClick={() => setGame(createMemoryGame(Math.random, levels, startLength))}>
            Començar
          </button>
        )}
      </div>
    </StepShell>
  );
}
