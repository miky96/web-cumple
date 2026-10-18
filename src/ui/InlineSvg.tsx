import { useEffect, useState, type CSSProperties } from 'react';

const cache = new Map<string, Promise<string>>();

function load(src: string): Promise<string> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '');
    cache.set(src, p);
  }
  return p;
}

/** Precarrega SVGs (ex. durant la benvinguda) perquè després surtin a l'instant. */
export const preloadSvg = (src: string) => void load(src);

/**
 * Insereix un SVG dels nostres assets dins el DOM perquè hereti `color`
 * (currentColor) i la variable --logo-fill. Els fitxers són nostres (public/brand).
 */
export function InlineSvg({ src, className, style, label }: { src: string; className?: string; style?: CSSProperties; label: string }) {
  const [markup, setMarkup] = useState<string>('');
  useEffect(() => {
    let alive = true;
    load(src).then((s) => alive && setMarkup(s));
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-svg ${className ?? ''}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
