import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { derivePalette, normalizeTheme, paletteToCssVars } from '../domain/theme/palette';
import type { Theme } from '../domain/types';

/** Clau de localStorage on es guarden les variables del darrer tema (ha de coincidir amb index.html). */
export const THEME_CACHE_KEY = 'totem-theme-vars';

export function themeStyle(raw: Theme): CSSProperties {
  const theme = normalizeTheme(raw);
  const vars = paletteToCssVars(derivePalette(theme.base, theme.accent));
  return {
    ...vars,
    '--grid-opacity': theme.pattern === 'none' ? '0' : String(theme.patternOpacity),
  } as CSSProperties;
}

/** Aplica el tema a tot el document (fons del body i color de la barra del navegador). */
export function useDocumentTheme(theme: Theme | null): void {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const style = themeStyle(theme) as Record<string, string>;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(style))
      if (k.startsWith('--')) {
        root.style.setProperty(k, v);
        vars[k] = v;
      }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', style['--bg']);
    // Es recorda per aplicar-lo a l'instant en la propera càrrega (vegeu l'script d'index.html)
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(vars));
    } catch {
      /* sense storage: no passa res */
    }
  }, [theme]);
}

/** Aplica el tema només dins un contenidor (p. ex. la previsualització de l'admin). */
export function ThemeScope({ theme, children, className }: { theme: Theme; children: ReactNode; className?: string }) {
  const style = useMemo(() => themeStyle(theme), [theme]);
  return (
    <div className={`theme-scope ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}
