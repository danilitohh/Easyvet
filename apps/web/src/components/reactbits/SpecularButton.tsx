import { useRef } from 'react';
import type { HTMLAttributes, PointerEvent } from 'react';

type SpecularButtonProps = HTMLAttributes<HTMLSpanElement>;

// Wraps any link or button with a restrained light sweep inspired by React Bits Specular Button.
export function SpecularButton({
  children,
  className = '',
  onPointerMove,
  ...props
}: SpecularButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const bounds = wrapper.getBoundingClientRect();
      wrapper.style.setProperty('--specular-x', `${event.clientX - bounds.left}px`);
      wrapper.style.setProperty('--specular-y', `${event.clientY - bounds.top}px`);
    }
    onPointerMove?.(event);
  }

  return (
    <span
      {...props}
      className={['rb-specular-button', className].filter(Boolean).join(' ')}
      ref={wrapperRef}
      onPointerMove={handlePointerMove}
    >
      {children}
    </span>
  );
}
