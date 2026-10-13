import { useRef } from 'react';
import type { CSSProperties, HTMLAttributes, PointerEvent } from 'react';

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
};

type SpotlightStyle = CSSProperties & {
  '--spotlight-x'?: string;
  '--spotlight-y'?: string;
  '--spotlight-color'?: string;
};

// Spotlight follows the pointer without adding a canvas or animation dependency to the page.
export function SpotlightCard({
  className = '',
  style,
  spotlightColor = 'rgb(7 53 217 / 14%)',
  onPointerMove,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (card) {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
    }
    onPointerMove?.(event);
  }

  return (
    <div
      {...props}
      className={['rb-spotlight-card', className].filter(Boolean).join(' ')}
      ref={cardRef}
      style={{ '--spotlight-color': spotlightColor, ...style } as SpotlightStyle}
      onPointerMove={handlePointerMove}
    />
  );
}
