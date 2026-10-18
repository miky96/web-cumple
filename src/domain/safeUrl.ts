/**
 * Només accepta imatges de la pròpia web (`/editions/...`) o `https://`.
 * Defensa en profunditat: evita `javascript:`, `data:` i trencar el `url("...")` del CSS.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u || /["'()\\\s<>]/.test(u)) return null;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  try {
    return new URL(u).protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}
