import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { ResourceError } from '../shared/ResourceFeedback';

export function CommercialHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header commercial-header">
      <div className="page-header__copy">
        <h1>{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

export function CommercialState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  retry: () => void;
}) {
  if (loading) return <LoadingState label="Cargando información comercial" />;
  if (error)
    return (
      <ResourceError
        error={error}
        fallback="No fue posible cargar esta información."
        onRetry={retry}
      />
    );
  if (empty) {
    return (
      <Card className="commercial-empty">
        <EmptyState
          title="Todavía no hay registros"
          description="Cuando se registren movimientos, aparecerán aquí."
        />
      </Card>
    );
  }
  return null;
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    COMPLETED: 'Completada',
    VOIDED: 'Anulada',
    ISSUED: 'Emitida',
    OPEN: 'Abierta',
    CLOSED: 'Cerrada',
    POSTED: 'Registrado',
  };
  return (
    <span className={`commercial-status commercial-status--${status.toLowerCase()}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function BackLink({ to, children = 'Volver' }: { to: string; children?: ReactNode }) {
  return (
    <Button as={Link} variant="ghost" to={to}>
      {children}
    </Button>
  );
}
