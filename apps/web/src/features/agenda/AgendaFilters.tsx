import { useEffect, useState } from 'react';
import type {
  LocationResponse,
  MembershipResponse,
  PaginatedMembershipResponse,
  PatientResponse,
} from '@veterinary-saas/contracts';
import { FormField } from '../../components/ui/FormField';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { PaginationControls } from '../shared/ResourceFeedback';
import { STATUS_LABELS, type AgendaFilters as AgendaFilterValues } from './agendaUtils';

type AgendaFiltersProps = {
  filters: AgendaFilterValues;
  locations: LocationResponse[];
  memberships: PaginatedMembershipResponse;
  professionalSearch: string;
  professionalLoading: boolean;
  professionalError: unknown;
  patients: PatientResponse[];
  patientSearch: string;
  onChange: (filters: AgendaFilterValues) => void;
  onProfessionalSearchChange: (value: string) => void;
  onProfessionalPageChange: (page: number) => void;
  onProfessionalRetry: () => void;
  onPatientSearchChange: (value: string) => void;
  onReset: () => void;
};

function professionalLabel(membership: MembershipResponse): string {
  return `${membership.user.email} · ${membership.role}`;
}

// Filters only expose backend-supported fields and remain scoped by the active tenant hook.
export function AgendaFilters({
  filters,
  locations,
  memberships,
  professionalSearch,
  professionalLoading,
  professionalError,
  patients,
  patientSearch,
  onChange,
  onProfessionalSearchChange,
  onProfessionalPageChange,
  onProfessionalRetry,
  onPatientSearchChange,
  onReset,
}: AgendaFiltersProps) {
  const [selectedMembership, setSelectedMembership] = useState<MembershipResponse | null>(null);
  useEffect(() => {
    const selected = memberships.data.find(({ id }) => id === filters.assignedMembershipId);
    if (selected) setSelectedMembership(selected);
  }, [filters.assignedMembershipId, memberships.data]);
  const professionalOptions = [
    ...memberships.data,
    ...(selectedMembership && !memberships.data.some(({ id }) => id === selectedMembership.id)
      ? [selectedMembership]
      : []),
  ];
  const hasFilters = Boolean(
    filters.clinicLocationId ||
    filters.assignedMembershipId ||
    filters.patientId ||
    filters.status !== 'ALL' ||
    patientSearch ||
    professionalSearch,
  );

  return (
    <section className="agenda-filters" aria-label="Filtros de agenda">
      <div className="agenda-filters__heading">
        <div>
          <p className="section-kicker">Lectura operativa</p>
          <h2>Filtrar citas</h2>
        </div>
        {hasFilters ? (
          <button className="button button--ghost button--compact" type="button" onClick={onReset}>
            Limpiar filtros
          </button>
        ) : null}
      </div>
      <div className="agenda-filter-grid">
        <FormField label="Sede" htmlFor="agenda-location-filter">
          <Select
            id="agenda-location-filter"
            value={filters.clinicLocationId || 'ALL'}
            onChange={(event) =>
              onChange({
                ...filters,
                clinicLocationId: event.target.value === 'ALL' ? '' : event.target.value,
              })
            }
          >
            <option value="ALL">Todas las sedes</option>
            {locations
              .filter((location) => location.status === 'ACTIVE')
              .map((location) => (
                <option value={location.id} key={location.id}>
                  {location.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Buscar profesional" htmlFor="agenda-professional-search">
          <SearchInput
            id="agenda-professional-search"
            value={professionalSearch}
            onChange={onProfessionalSearchChange}
            placeholder="Nombre o correo del profesional"
          />
        </FormField>
        <FormField label="Profesional" htmlFor="agenda-professional-filter">
          <Select
            id="agenda-professional-filter"
            value={filters.assignedMembershipId || 'ALL'}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedMembership(
                memberships.data.find((membership) => membership.id === value) ?? null,
              );
              onChange({
                ...filters,
                assignedMembershipId: value === 'ALL' ? '' : value,
              });
            }}
          >
            <option value="ALL">Todos los profesionales</option>
            <option value="UNASSIGNED">Sin profesional asignado</option>
            {professionalOptions
              .filter((membership) => membership.status === 'ACTIVE')
              .map((membership) => (
                <option value={membership.id} key={membership.id}>
                  {professionalLabel(membership)}
                </option>
              ))}
          </Select>
        </FormField>
        <div>
          <p role="status" aria-live="polite">
            {professionalLoading
              ? 'Buscando profesionales…'
              : `${memberships.total} profesionales activos · página ${memberships.page}`}
          </p>
          {professionalError ? (
            <div role="alert">
              <p>No fue posible cargar profesionales.</p>
              <button className="button button--ghost button--compact" type="button" onClick={onProfessionalRetry}>
                Reintentar carga de profesionales
              </button>
            </div>
          ) : null}
          <PaginationControls
            page={memberships.page}
            totalPages={Math.ceil(memberships.total / memberships.pageSize)}
            onChange={onProfessionalPageChange}
            ariaLabel="Paginación de profesionales"
          />
        </div>
        <FormField label="Estado" htmlFor="agenda-status-filter">
          <Select
            id="agenda-status-filter"
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as AgendaFilterValues['status'] })
            }
          >
            <option value="ALL">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <option value={status} key={status}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Buscar Patient" htmlFor="agenda-patient-search">
          <SearchInput
            id="agenda-patient-search"
            value={patientSearch}
            onChange={onPatientSearchChange}
            placeholder="Nombre del Patient"
          />
        </FormField>
        <FormField label="Patient" htmlFor="agenda-patient-filter">
          <Select
            id="agenda-patient-filter"
            value={filters.patientId || 'ALL'}
            onChange={(event) =>
              onChange({
                ...filters,
                patientId: event.target.value === 'ALL' ? '' : event.target.value,
              })
            }
          >
            <option value="ALL">Todos los Patients</option>
            {patients.map((patient) => (
              <option value={patient.id} key={patient.id}>
                {patient.name} · {patient.species}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </section>
  );
}
