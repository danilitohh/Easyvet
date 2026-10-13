import type { HTMLAttributes } from 'react';

type ShimmerTextProps = HTMLAttributes<HTMLSpanElement>;

// A restrained KokonutUI-style shimmer used for small emphasis, not body copy.
export function ShimmerText({ className = '', ...props }: ShimmerTextProps) {
  return <span {...props} className={['kk-shimmer-text', className].filter(Boolean).join(' ')} />;
}
