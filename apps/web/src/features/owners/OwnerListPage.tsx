import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import {
  PaginationControls,
  ResourceError,
  StatusBadge,
  StatusFilter,
  type ResourceFilterStatus,
} from '../shared/ResourceFeedback';
import { useOwners } from './useOwners';
import type { OwnerResponse } from '@veterinary-saas/contracts';

function ownerName(owner: OwnerResponse): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ');
}

// Owners list keeps search, filters and pagination in the URL-ready page state while the hook owns transport.
export function OwnerListPage() {
  const canCreate = useCan(PERMISSION.OWNERS_CREATE);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ResourceFilterStatus>('ACTIVE');
  const [page, setPage] = useState(1);
  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search.trim(),
      status,
      sortBy: 'createdAt' as const,
      sortDirection: 'desc' as const,
    }),
    [page, search, status],
  );
  const owners = useOwners(params);
  const columns = useMemo<DataTableColumn<OwnerResponse>[]>(
    () => [
      {
        key: 'name',
        header: 'Propietario',
        render: (owner) => (
          <Link className="table-primary-link" to={`/propietarios/${owner.id}`}>
            <strong>{ownerName(owner)}</strong>
            <small>
              {owner.documentNumber
                ? `${owner.documentType ?? 'Documento'} · ${owner.documentNumber}`
                : 'Sin documento'}
            </small>
          </Link>
        ),
      },
      {
        key: 'contact',
        header: 'Contacto',
        render: (owner) => (
          <span className="table-secondary-text">
            <span>{owner.phone ?? 'Sin teléfono'}</span>
            <small>{owner.email ?? 'Sin correo'}</small>
          </span>
        ),
      },
      {
        key: 'location',
        header: 'Ubicación',
        render: (owner) => owner.city ?? 'Sin ciudad',
      },
      {
        key: 'status',
        header: 'Estado',
        render: (owner) => <StatusBadge status={owner.status} />,
      },
      {
        key: 'actions',
        header: '',
        render: (owner) => (
          <Link className="button button--ghost button--compact" to={`/propietarios/${owner.id}`}>
            Ver detalle
          </Link>
        ),
      },
    ],
    [],
  );

  function updateStatus(nextStatus: ResourceFilterStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    setPage(1);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Clientes"
        title="Propietarios"
        description="Personas responsables y contactos principales de tus pacientes."
        action={
          canCreate ? (
            <Button as={Link} to="/propietarios/nuevo">
              Nuevo propietario
            </Button>
          ) : null
        }
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <SearchInput
            id="owner-list-search"
            value={search}
            onChange={updateSearch}
            placeholder="Buscar por nombre, documento, correo o teléfono"
          />
          <StatusFilter value={status} onChange={updateStatus} />
        </div>
        {owners.error ? (
          <ResourceError error={owners.error} onRetry={owners.reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={owners.data?.data ?? []}
            getRowKey={(owner) => owner.id}
            loading={owners.loading}
            emptyTitle={search ? 'Sin coincidencias' : 'No hay propietarios registrados.'}
            emptyDescription={
              search
                ? 'Prueba con otro nombre, documento o dato de contacto.'
                : 'Crea el primer propietario de esta organización para empezar.'
            }
            emptyAction={
              canCreate ? (
                <Button as={Link} to="/propietarios/nuevo">
                  Crear propietario
                </Button>
              ) : null
            }
          />
        )}
        {owners.data ? (
          <PaginationControls
            page={owners.data.pagination.page}
            totalPages={owners.data.pagination.totalPages}
            onChange={setPage}
          />
        ) : null}
      </Card>
    </div>
  );
}
