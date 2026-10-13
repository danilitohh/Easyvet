import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type DockItem = {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

type DockProps = {
  items: DockItem[];
  ariaLabel?: string;
  className?: string;
};

// A lightweight, source-owned dock adapted from the interaction language of React Bits Dock.
export function Dock({ items, ariaLabel = 'Atajos de navegación', className = '' }: DockProps) {
  return (
    <nav className={['rb-dock', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {items.map((item) => (
        <Link
          aria-current={item.active ? 'page' : undefined}
          className="rb-dock__item"
          data-active={item.active ? 'true' : undefined}
          to={item.href}
          key={item.href}
          title={item.label}
        >
          <span className="rb-dock__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="rb-dock__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
