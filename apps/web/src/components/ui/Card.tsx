import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
};

// Cards establish meaningful hierarchy for dashboard content without hiding page structure.
export function Card({ as: Component = 'section', className, ...props }: CardProps) {
  return <Component className={['card', className ?? ''].filter(Boolean).join(' ')} {...props} />;
}
