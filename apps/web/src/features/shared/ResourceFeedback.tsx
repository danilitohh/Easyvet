import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { appConfig } from '../../config/app';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import type { Permission } from '@veterinary-saas/contracts';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from './resourceUtils';

export function ResourceError({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback?: string;
  onRetry?: () => void;
}) {
  const isNotFound =
    error instanceof ApiError && (error.status === 404 || error.code === 'RESOURCE_NOT_FOUND');
  const isForbidden = error instanceof ApiError && error.status === 403;

  if (isForbidden) return <AccessDeniedPage />;
  if (isNotFound) {
    return (
      <Card className="resource-feedback-card">
        <EmptyState
          icon="?"
          title="Recurso no encontrado"
          description="La dirección puede estar archivada, ser incorrecta o no estar disponible en esta organización."
          action={
            <Link className="button button--secondary" to="..">
              Volver
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Alert tone="error" role="alert">
      <span>{errorMessage(error, fallback)}</span>
      {onRetry ? (
        <Button variant="secondary" type="button" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </Alert>
  );
}

export function PermissionRoute({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const allowed = useCan(permission);
  if (appConfig.dataMode === 'mock' || allowed) return children;
  return <AccessDeniedPage />;
}

// Some clinical history routes are readable through multiple independent domain permissions.
export function AnyPermissionRoute({
  permissions,
  children,
}: {
  permissions: Permission[];
  children: ReactNode;
}) {
  const { activeMembership } = useAuth();
  const canAccess = permissions.some((permission) =>
    activeMembership?.permissions.includes(permission),
  );
  if (appConfig.dataMode === 'mock' || canAccess) return children;
  return <AccessDeniedPage />;
}

export function StatusBadge({ status }: { status: 'ACTIVE' | 'ARCHIVED' }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      <span aria-hidden="true" className="status-badge__dot" />
      {status === 'ACTIVE' ? 'Activo' : 'Archivado'}
    </span>
  );
}

export function PaginationControls({
  page,
  totalPages,
  onChange,
  ariaLabel = 'Paginación',
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <Button
        variant="secondary"
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={ariaLabel === 'Paginación' ? undefined : `${ariaLabel}: página anterior`}
      >
        Anterior
      </Button>
      <span>
        Página <strong>{page}</strong> de <strong>{totalPages}</strong>
      </span>
      <Button
        variant="secondary"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label={ariaLabel === 'Paginación' ? undefined : `${ariaLabel}: página siguiente`}
      >
        Siguiente
      </Button>
    </nav>
  );
}

export type ResourceFilterStatus = 'ACTIVE' | 'ARCHIVED' | 'ALL';

export function StatusFilter({
  value,
  onChange,
}: {
  value: ResourceFilterStatus;
  onChange: (value: ResourceFilterStatus) => void;
}) {
  return (
    <label className="filter-field">
      <span>Estado</span>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value as ResourceFilterStatus)}
      >
        <option value="ACTIVE">Activos</option>
        <option value="ARCHIVED">Archivados</option>
        <option value="ALL">Todos</option>
      </select>
    </label>
  );
}
