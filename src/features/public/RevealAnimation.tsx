import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLatest } from '../../lib/hooks';
import { prefersReducedMotion, vibrate } from '../../lib/device';
import { BRAND } from '../../ui/brand';

const PHRASES = ['ALGORITME INICIANT-SE...', 'NERVIS...', 'LA MARE DEL TANO SI QUE TRIGA...', 'JOODEEERR QUINA ANSIETAT...', 'OSTI JA ESTÀ? NO T\'ESPERAVES AQUESTA VELOCITAT EEEEE'];

const DURATION = 6200;
const FLASH_MS = 1000;
const MAX_PIXELS = 1_400_000; // limita la resolució del canvas (rendiment)

const easeIn = (p: number) => p * p * p;

interface Colors {
  primary: string;
  accent: string;
  score: string;
  bg: string;
  horizon: string;
}

function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    primary: v('--primary', '#ff2e93'),
    accent: v('--accent', '#2ef2ff'),
    score: v('--score', '#ffe94d'),
    bg: v('--bg', '#07050f'),
    horizon: v('--horizon', '#2a0a33'),
  };
}

let svgText: Promise<string | null> | null = null;
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

/** Carrega el tòtem de línia (SVG) pintat d'un color, per dibuixar-lo com a tub de neó. Amb memòria cau. */
function loadTotem(color: string, fill = 'none'): Promise<HTMLImageElement | null> {
  const key = `${color}|${fill}`;
  let p = imageCache.get(key);
  if (!p) {
    svgText ??= fetch(BRAND.totem)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    p = svgText.then(
      (svg) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          if (!svg) return resolve(null);
          const colored = svg.replace(/currentColor/g, color).replace(/var\(--logo-fill,#fff\)/g, fill);
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = URL.createObjectURL(new Blob([colored], { type: 'image/svg+xml' }));
        }),
    );
    imageCache.set(key, p);
  }
  return p;
}

function loadAll(col: Colors) {
  return Promise.all([loadTotem(col.accent, col.bg), loadTotem(col.primary), loadTotem(col.score)]);
}

/**
 * Precarrega els recursos de l'animació (cridar-ho mentre el participant juga),
 * perquè el tòtem surti des del primer instant.
 */
export function preloadRevealAssets(): void {
  void loadAll(readColors());
}

/** Pre-renderitza el tòtem amb resplendor una sola vegada (el blur per frame és car). */
function neonSprite(img: HTMLImageElement, height: number): HTMLCanvasElement {
  const pad = Math.round(height * 0.12);
  const h = Math.round(height);
  const w = Math.round(h * (img.naturalWidth / img.naturalHeight || 0.47));
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const g = c.getContext('2d')!;
  if ('filter' in g) {
    g.filter = `blur(${Math.round(height / 40)}px)`;
    g.drawImage(img, pad, pad, w, h);
    g.drawImage(img, pad, pad, w, h);
    g.filter = 'none';
  }
  g.drawImage(img, pad, pad, w, h);
  return c;
}

export function RevealAnimation({ color, onDone }: { color: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phrase, setPhrase] = useState(0);
  const [flash, setFlash] = useState(false);
  const doneRef = useLatest(onDone);
  const finished = useRef(false);
  const reduced = prefersReducedMotion();
  const [assets, setAssets] = useState<(HTMLImageElement | null)[] | null>(null);

  // No arrenquem fins que el tòtem estigui carregat (normalment ja ve precarregat). Màxim 1,5 s d'espera.
  useEffect(() => {
    let alive = true;
    const timeout = window.setTimeout(() => alive && setAssets((a) => a ?? []), 1500);
    loadAll(readColors()).then((imgs) => alive && setAssets((a) => a ?? imgs));
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, []);
  const ready = assets !== null;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };

  // Línia de temps lligada al rellotge real: si el mòbil va lent, el text i el final no es desincronitzen.
  useEffect(() => {
    if (!ready) return;
    const total = reduced ? 2200 : DURATION;
    const start = performance.now();
    let raf = 0;
    let lastPhrase = -1;
    let flashed = false;
    vibrate(40);
    const tick = (now: number) => {
      const t = now - start;
      const idx = Math.min(PHRASES.length - 1, Math.floor((t / (total - FLASH_MS)) * PHRASES.length));
      if (idx !== lastPhrase) {
        lastPhrase = idx;
        setPhrase(idx);
      }
      if (!flashed && t >= total - FLASH_MS) {
        flashed = true;
        setFlash(true);
        vibrate([100, 50, 100, 50, 300]);
      }
      if (t >= total) return finish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = window.setTimeout(finish, total + 2000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [reduced, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escena synthwave: sol de ratlles, graella que corre, estrelles i tòtem de neó
  useEffect(() => {
    if (reduced || !assets) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const col = readColors();
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spriteH = Math.min(h * 0.46, w * 0.95);
    const [a, b, c] = assets;
    const sprite = a ? neonSprite(a, spriteH) : null;
    const ghostA = b ? neonSprite(b, spriteH) : null;
    const ghostB = c ? neonSprite(c, spriteH) : null;

    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, tw: Math.random() * Math.PI * 2 }));
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = now - start;
      const p = Math.min(1, t / DURATION);
      const horizonY = h * 0.6;
      const cx = w / 2;

      // Cel
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
      sky.addColorStop(0, col.bg);
      sky.addColorStop(1, col.horizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizonY);
      ctx.fillStyle = col.bg;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Estrelles (s'estiren al final: salt d'hiperespai)
      ctx.fillStyle = '#ffffff';
      const stretch = 1 + easeIn(p) * 40;
      for (const s of stars) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 500 + s.tw));
        ctx.globalAlpha = a;
        ctx.fillRect(s.x * w, s.y * horizonY, 1.5, 1.5 * stretch);
      }
      ctx.globalAlpha = 1;

      // Sol de ratlles que puja
      const sunR = Math.min(w, h) * 0.32;
      const sunY = horizonY - sunR * (0.35 + p * 0.55);
      const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sun.addColorStop(0, col.score);
      sun.addColorStop(0.55, col.primary);
      sun.addColorStop(1, col.primary);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizonY);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = sun;
      ctx.shadowColor = col.primary;
      ctx.shadowBlur = 0; // sense blur per frame
      ctx.fill();
      // ratlles (bandes del color del cel)
      ctx.fillStyle = col.horizon;
      for (let i = 0; i < 7; i++) {
        const k = i / 7;
        const y = sunY + sunR * (0.05 + k * 0.95) + ((t / 40) % 14);
        ctx.fillRect(cx - sunR, y, sunR * 2, 2 + k * 7);
      }
      ctx.restore();
      // halo del sol
      const halo = ctx.createRadialGradient(cx, sunY, sunR * 0.8, cx, sunY, sunR * 2);
      halo.addColorStop(0, `${col.primary}55`);
      halo.addColorStop(1, `${col.primary}00`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, horizonY);

      // Graella del terra en perspectiva (cada cop més ràpida)
      const speed = 0.4 + easeIn(p) * 6;
      const offset = ((t / 1000) * speed) % 1;
      ctx.strokeStyle = col.accent;
      ctx.shadowColor = col.accent;
      for (const pass of [0, 1]) {
        ctx.lineWidth = pass ? 1.2 : 4;
        ctx.globalAlpha = pass ? 0.9 : 0.18;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const z = (i + 1 - offset) / 14;
          const y = horizonY + (h - horizonY) * z * z;
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        for (let i = -12; i <= 12; i++) {
          ctx.moveTo(cx + i * 8, horizonY);
          ctx.lineTo(cx + i * w * 0.18, h);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.primary;
      ctx.fillRect(0, horizonY - 1, w, 2);

      // Tòtem de neó: s'encén amb pampallugues, flota i al final fa un glitch RGB
      if (sprite) {
        const on = t < 700 ? Math.random() < 0.6 + (t / 700) * 0.4 : true; // s'encén amb un parpelleig curt
        const bob = Math.sin(t / 600) * 8;
        const scale = 0.85 + easeIn(p) * 0.3;
        const sw = sprite.width * scale, sh = sprite.height * scale;
        const x = cx - sw / 2, y = h * 0.42 - sh / 2 + bob;
        if (on) {
          if (p > 0.6 && ghostA && ghostB) {
            const g = (p - 0.6) * 30 * (Math.random() < 0.5 ? 1 : 0.3);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.7;
            ctx.drawImage(ghostA, x - g, y, sw, sh);
            ctx.drawImage(ghostB, x + g, y, sw, sh);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.drawImage(sprite, x, y, sw, sh);
        }
      }

      // línies d'escaneig de CRT
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = (t / 30) % 3; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced, assets]);

  return (
    <div className="reveal-overlay" role="status" aria-live="polite">
      {!reduced && <canvas ref={canvasRef} />}
      <div className="reveal-text">{ready ? PHRASES[phrase] : 'INSERT COIN...'}</div>
      <button type="button" className="reveal-skip" onClick={finish}>
        Skip ▶▶
      </button>
      <div className={`reveal-flash ${flash ? 'on' : ''}`} style={{ '--to': color } as CSSProperties} />
    </div>
  );
}
