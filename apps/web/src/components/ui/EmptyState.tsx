import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: string;
  action?: ReactNode;
};

// Empty states explain the current scope instead of leaving blank product surfaces.
export function EmptyState({ title, description, icon = '·', action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
