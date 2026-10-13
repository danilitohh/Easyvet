import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type PillNavItem = {
  href: string;
  label: string;
};

type PillNavProps = {
  items: PillNavItem[];
  ariaLabel?: string;
  className?: string;
};

type IndicatorStyle = Pick<CSSProperties, 'left' | 'width'>;

// The active pill follows the selected item, keeping the motion subtle and keyboard-friendly.
export function PillNav({ items, ariaLabel = 'Navegación', className = '' }: PillNavProps) {
  const firstItem = items[0]?.href ?? '';
  const [activeHref, setActiveHref] = useState(firstItem);
  const [indicator, setIndicator] = useState<IndicatorStyle>({ left: 0, width: 0 });
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useLayoutEffect(() => {
    const activeItem = itemRefs.current[activeHref];
    if (!activeItem) return;

    setIndicator({
      left: activeItem.offsetLeft,
      width: activeItem.offsetWidth,
    });
  }, [activeHref, items]);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeItem = itemRefs.current[activeHref];
      if (!activeItem) return;
      setIndicator({ left: activeItem.offsetLeft, width: activeItem.offsetWidth });
    };

    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeHref]);

  return (
    <nav className={['rb-pill-nav', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <span
        className="rb-pill-nav__indicator"
        aria-hidden="true"
        style={indicator}
      />
      {items.map((item) => (
        <a
          aria-current={item.href === activeHref ? 'page' : undefined}
          className="rb-pill-nav__item"
          data-active={item.href === activeHref ? 'true' : undefined}
          href={item.href}
          key={item.href}
          ref={(node) => {
            itemRefs.current[item.href] = node;
          }}
          onClick={() => setActiveHref(item.href)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
