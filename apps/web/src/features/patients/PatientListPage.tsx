import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PatientResponse } from '@veterinary-saas/contracts';
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
import { usePatients } from './usePatients';

function ownerName(patient: PatientResponse): string {
  return [patient.owner.firstName, patient.owner.lastName].filter(Boolean).join(' ');
}

// Patient list surfaces only fields available in Fase 4A; clinical and financial indicators stay out.
export function PatientListPage() {
  const canCreate = useCan(PERMISSION.PATIENTS_CREATE);
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
  const patients = usePatients(params);
  const columns = useMemo<DataTableColumn<PatientResponse>[]>(
    () => [
      {
        key: 'patient',
        header: 'Paciente',
        render: (patient) => (
          <Link className="table-primary-link" to={`/pacientes/${patient.id}`}>
            <strong>{patient.name}</strong>
            <small>
              {patient.species}
              {patient.breed ? ` · ${patient.breed}` : ''}
            </small>
          </Link>
        ),
      },
      {
        key: 'owner',
        header: 'Propietario',
        render: (patient) => (
          <span className="table-secondary-text">
            <span>{ownerName(patient)}</span>
            <small>{patient.owner.phone ?? 'Sin teléfono'}</small>
          </span>
        ),
      },
      {
        key: 'sex',
        header: 'Sexo',
        render: (patient) =>
          patient.sex === 'UNKNOWN'
            ? 'No especificado'
            : patient.sex === 'MALE'
              ? 'Macho'
              : 'Hembra',
      },
      {
        key: 'microchip',
        header: 'Microchip',
        render: (patient) => patient.microchipNumber ?? 'No registrado',
      },
      {
        key: 'status',
        header: 'Estado',
        render: (patient) => <StatusBadge status={patient.status} />,
      },
      {
        key: 'actions',
        header: '',
        render: (patient) => (
          <Link className="button button--ghost button--compact" to={`/pacientes/${patient.id}`}>
            Ver ficha
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
        eyebrow="Clínica"
        title="Pacientes"
        description="La ficha base de cada paciente, conectada con su propietario principal."
        action={
          canCreate ? (
            <Button as={Link} to="/pacientes/nuevo">
              Nuevo paciente
            </Button>
          ) : null
        }
      />
      <Card className="resource-card">
        <div className="resource-toolbar">
          <SearchInput
            value={search}
            onChange={updateSearch}
            placeholder="Buscar por nombre, microchip o propietario"
          />
          <StatusFilter value={status} onChange={updateStatus} />
        </div>
        {patients.error ? (
          <ResourceError error={patients.error} onRetry={patients.reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={patients.data?.data ?? []}
            getRowKey={(patient) => patient.id}
            loading={patients.loading}
            emptyTitle={search ? 'Sin coincidencias' : 'No hay pacientes registrados.'}
            emptyDescription={
              search
                ? 'Prueba con otro nombre, microchip o propietario.'
                : 'Registra el primer paciente de esta organización para empezar.'
            }
            emptyAction={
              canCreate ? (
                <Button as={Link} to="/pacientes/nuevo">
                  Registrar paciente
                </Button>
              ) : null
            }
          />
        )}
        {patients.data ? (
          <PaginationControls
            page={patients.data.pagination.page}
            totalPages={patients.data.pagination.totalPages}
            onChange={setPage}
          />
        ) : null}
      </Card>
    </div>
  );
}
