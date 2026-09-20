import type { HTMLAttributes, ReactNode } from 'react';

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
};

// Inline alerts provide context for demo data and technical states.
export function Alert({ tone = 'info', children, className, ...props }: AlertProps) {
  return (
    <div
      className={['alert', `alert--${tone}`, className ?? ''].filter(Boolean).join(' ')}
      {...props}
    >
      <span className="alert__marker" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
