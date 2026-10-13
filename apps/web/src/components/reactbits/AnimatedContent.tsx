import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';

type AnimatedContentProps = HTMLAttributes<HTMLDivElement> & {
  delay?: number;
};

// Viewport reveals are progressive enhancement: content remains visible if observers are unavailable.
export function AnimatedContent({ className = '', delay = 0, style, ...props }: AnimatedContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(content);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      {...props}
      className={['rb-animated-content', className].filter(Boolean).join(' ')}
      data-visible={visible ? 'true' : 'false'}
      ref={contentRef}
      style={{ '--rb-delay': `${delay}ms`, ...style } as CSSProperties}
    />
  );
}
