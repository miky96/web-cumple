import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLatest } from '../../../lib/hooks';
import { evaluateStop, isClockHidden, stopTimeoutMs, type StopResult } from '../../../domain/minigames/stopTheClock';
import { pickDelay, reactionRating, startReaction, tapReaction, type ReactionState } from '../../../domain/minigames/reaction';
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
import { Totem } from '../../../ui/brand';
import { GameResult, StepShell, type StepProps } from './common';

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

// ======================= Reflexos =======================

export function ReactionStep({ step, onSubmit }: StepProps<'reaction'>) {
  const { minDelayMs, maxDelayMs } = step.config;
  const [state, setState] = useState<ReactionState | null>(null);
  const [go, setGo] = useState(false);
  const [warn, setWarn] = useState(false);
  const timer = useRef<number>(0);

  const schedule = (s: ReactionState) => {
    window.clearTimeout(timer.current);
    if (s.phase !== 'waiting') return;
    setGo(false);
    timer.current = window.setTimeout(() => {
      setGo(true);
      vibrate(30);
    }, Math.max(0, s.goAt - now()));
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const delay = () => pickDelay(Math.random, minDelayMs, maxDelayMs);

  const onPad = () => {
    if (!state) {
      const s = startReaction(now(), delay());
      setState(s);
      schedule(s);
      return;
    }
    if (state.phase === 'done') return;
    const next = tapReaction(state, now(), delay());
    setState(next);
    if (next.phase === 'waiting') {
      setWarn(true);
      vibrate([80, 40, 80]);
      window.setTimeout(() => setWarn(false), 600);
      schedule(next);
    } else window.clearTimeout(timer.current);
  };

  if (state?.phase === 'done')
    return (
      <StepShell kicker="Minijoc" title={step.title}>
        <GameResult
          headline={state.ms === null ? '😬' : `${state.ms} ms`}
          detail={state.earlyTaps > 0 ? `T'has precipitat ${state.earlyTaps} ${state.earlyTaps === 1 ? 'vegada' : 'vegades'}` : undefined}
          rating={reactionRating(state.ms)}
          onNext={() => onSubmit({ ms: state.ms, earlyTaps: state.earlyTaps })}
        />
      </StepShell>
    );

  return (
    <StepShell kicker="Minijoc" title={step.title}>
      <div className="game">
        <button type="button" className={`game-pad ${go ? 'go' : ''} ${warn ? 'warn' : ''}`} onPointerDown={onPad}>
          <Totem height={150} className="totem-eyes" />
          <div className="game-big" style={{ fontSize: 'clamp(1.1rem, 6vw, 1.5rem)' }}>
            {!state ? 'Ready?' : warn ? 'Massa aviat!' : go ? 'ARA!' : 'Espera...'}
          </div>
          <div className="game-hint">{!state ? 'Toca per començar' : go ? 'Toca!' : 'Quan canviï de color, toca'}</div>
        </button>
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
