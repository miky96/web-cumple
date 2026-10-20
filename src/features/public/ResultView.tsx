import { useMemo, type CSSProperties } from 'react';
import type { Reveal } from '../../domain/types';
import { askConfirm } from '../../ui/confirm';
import { Totem } from '../../ui/brand';

const PIXEL_COLORS = ['#ff2e93', '#2ef2ff', '#ffe94d', '#7cff4f', '#b14dff'];

/** Confeti de píxels de neó (inclou el color del grup). */
// Posicions aleatòries generades un sol cop (fora del render, que ha de ser pur).
const CONFETTI_LAYOUT = Array.from({ length: 36 }, () => ({
  left: Math.random() * 100,
  delay: Math.random() * 1.2,
  dur: 2.2 + Math.random() * 2,
}));

function Confetti({ color }: { color: string }) {
  const pieces = useMemo(
    () => CONFETTI_LAYOUT.map((p, i) => ({ ...p, c: i % 3 === 0 ? color : PIXEL_COLORS[i % PIXEL_COLORS.length] })),
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
  /** Noms dels companys que ja han contestat, per ordre d'arribada. */
  mates: string[];
  name: string;
  celebrate: boolean;
  /** Imatge de fons (la del grup o, si no en té, la de l'edició). */
  background: string | null;
  footer?: string;
  onReplay?: () => void;
  onRetake?: () => void;
}

export function ResultView({ reveal, mates, name, celebrate, background, footer, onReplay, onRetake }: Props) {
  const style = { '--group': reveal.color } as CSSProperties;
  const total = reveal.mateKeys?.length ?? reveal.mates?.length ?? 0;
  const pending = Math.max(0, total - mates.length);
  return (
    <main className={`screen result ${background ? 'has-bg' : ''}`} style={style}>
      {background && <div className="result-bg" style={{ backgroundImage: `url("${background}")` }} aria-hidden />}
      {celebrate && <Confetti color={reveal.color} />}
      <div className="screen-inner">
        <div className="result-kicker">{name} · l'algoritme ha processat el teu perfil com a quadro de persona i t'ha tocat l'estudi...</div>
        <h1 className="result-name">{reveal.groupName}</h1>
        <div className="result-art">
          <Totem height={230} />
        </div>
        <section className="mates">
          <h3>I aqui els teus companys que han estat assignats amb tu!</h3>
          {total === 0 ? (
            <p className="muted">De moment ets l'únic membre... PRIMO! hahaha tranquil ja arribaràn més individus que t'acompanyin en la teva aventura.</p>
          ) : (
            <>
              {mates.length === 0 && (
                <p className="muted">Ets el primer de l'estudi en arribar! Els teus companys aniran apareixent aquí a mesura que superin les proves.</p>
              )}
              <ul>
                {mates.map((m, i) => (
                  <li key={`${m}-${i}`} className="chip" style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
                    {m}
                  </li>
                ))}
                {Array.from({ length: pending }, (_, i) => (
                  <li key={`pending-${i}`} className="chip chip-locked" aria-hidden>
                    ???
                  </li>
                ))}
              </ul>
              {pending > 0 && (
                <p className="muted mates-pending">
                  {pending === 1 ? 'Falta 1 company per descobrir...' : `Falten ${pending} companys per descobrir...`} Torna més tard!
                </p>
              )}
            </>
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
                  countdown: 15,
                  message: 'Tornaràs a a passar les proves i els nous resultats substituiran als anteriors. Es una pena que l\'algoritme ja hagi decidit el teu destí i aquest no canviarà. Pero pots guanyar als demés i intentar ser la millor, suficient per omplir el teu ego no?',
                  confirmLabel: 'Sí, tornar a fer el viatje intergalactic per donar pel cul als demés i poder dir que vaig guanyar als minijocs fent un record guiness',
                  cancelLabel: 'No, tinc l\'ego suficientment bé i no necessito demostrar que soc superior a la gent, em comformo sabent el meu estudi.',
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
