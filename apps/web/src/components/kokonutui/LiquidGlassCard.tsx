import type { HTMLAttributes } from 'react';

type LiquidGlassCardProps = HTMLAttributes<HTMLDivElement>;

// Local adaptation of KokonutUI's liquid-glass surface pattern.
// It stays a small wrapper so the existing CSS architecture remains intact.
export function LiquidGlassCard({ className = '', ...props }: LiquidGlassCardProps) {
  return <div {...props} className={['kk-liquid-glass', className].filter(Boolean).join(' ')} />;
}
