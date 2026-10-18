import type { CSSProperties } from 'react';
import { InlineSvg } from './InlineSvg';

export const BRAND = {
  logo: '/brand/logo.svg',
  totem: '/brand/totem.svg',
  illustration: '/brand/illustration.svg',
  silhouette: '/brand/totem-silhouette.png',
};

/** Amplada/alçada del tòtem retallat (viewBox de totem.svg). */
const TOTEM_RATIO = 101.3 / 215.8;

export function Logo({ size = 260, className }: { size?: number; className?: string }) {
  return <InlineSvg src={BRAND.logo} label="Totem of Happiness" className={`logo ${className ?? ''}`} style={{ width: size, height: size }} />;
}

export function Totem({ height = 200, style, className }: { height?: number; style?: CSSProperties; className?: string }) {
  return (
    <InlineSvg
      src={BRAND.totem}
      label="Tòtem"
      className={`totem ${className ?? ''}`}
      style={{ width: Math.round(height * TOTEM_RATIO), height, ...style }}
    />
  );
}

export function Illustration({ size = 260, className }: { size?: number; className?: string }) {
  return (
    <InlineSvg
      src={BRAND.illustration}
      label="Tòtem a l'illa"
      className={`illustration ${className ?? ''}`}
      style={{ width: size, height: size }}
    />
  );
}
