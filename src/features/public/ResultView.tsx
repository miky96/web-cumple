import { useMemo, type CSSProperties } from 'react';
import type { Reveal } from '../../domain/types';
import { askConfirm } from '../../ui/confirm';
import { Totem } from '../../ui/brand';

const PIXEL_COLORS = ['#ff2e93', '#2ef2ff', '#ffe94d', '#7cff4f', '#b14dff'];

/** Confeti de píxels de neó (inclou el color del grup). */
function Confetti({ color }: { color: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        c: i % 3 === 0 ? color : PIXEL_COLORS[i % PIXEL_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.2 + Math.random() * 2,
      })),
    [color],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, color: p.c, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

interface Props {
  reveal: Reveal;
  name: string;
  celebrate: boolean;
  /** Imatge de fons (la del grup o, si no en té, la de l'edició). */
  background: string | null;
  footer?: string;
  onReplay?: () => void;
  onRetake?: () => void;
}

export function ResultView({ reveal, name, celebrate, background, footer, onReplay, onRetake }: Props) {
  const style = { '--group': reveal.color } as CSSProperties;
  return (
    <main className={`screen result ${background ? 'has-bg' : ''}`} style={style}>
      {background && <div className="result-bg" style={{ backgroundImage: `url("${background}")` }} aria-hidden />}
      {celebrate && <Confetti color={reveal.color} />}
      <div className="screen-inner">
        <div className="result-kicker">{name} · l'algoritme ha processat el teu perfil com a quadro de persona</div>
        <h1 className="result-name">{reveal.groupName}</h1>
        <div className="result-art">
          <Totem height={230} />
        </div>
        <section className="mates">
          <h3>El teu estudi!</h3>
          {reveal.mates.length === 0 ? (
            <p className="muted">De moment ets l'únic membre... PRIMO! hahaha tranquil ja arribarà més individus que t'acompanyin en la teva aventura.</p>
          ) : (
            <ul>
              {reveal.mates.map((m, i) => (
                <li key={m} className="chip" style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
                  {m}
                </li>
              ))}
            </ul>
          )}
        </section>
        {footer && <p className="result-footer">{footer}</p>}
        <div className="result-actions">
          {onReplay && (
            <button type="button" className="link-btn" onClick={onReplay}>
              Tornar a fer el viatge astral
            </button>
          )}
          {onRetake && (
            <button type="button" className="link-btn" onClick={async () => {
                const ok = await askConfirm({
                  title: 'CONTINUE?',
                  countdown: 9,
                  message: 'Tornaràs a a passar les proves i els nous resultats substituiran els anteriors. Es una pena que l\'algoritme ja hagi decidit el teu destí. Pero pots guanyar als demés, suficient per el teu ego no?',
                  confirmLabel: 'Sí, tornar a fer el viatje intergalactic per donar pel cul als demés',
                  cancelLabel: 'No, tinc el ego suficientment bé i no necessito demostrar que soc superior a la gent',
                });
                if (ok) onRetake();
              }}>
              Continue? Tornar a jugar
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
