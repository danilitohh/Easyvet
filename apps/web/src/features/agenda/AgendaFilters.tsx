import type {
  AppointmentResponse,
  LocationResponse,
  MembershipResponse,
  PatientResponse,
} from '@veterinary-saas/contracts';
import { FormField } from '../../components/ui/FormField';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { STATUS_LABELS, type AgendaFilters as AgendaFilterValues } from './agendaUtils';

type AgendaFiltersProps = {
  filters: AgendaFilterValues;
  locations: LocationResponse[];
  memberships: MembershipResponse[];
  patients: PatientResponse[];
  patientSearch: string;
  observedAppointments: AppointmentResponse[];
  onChange: (filters: AgendaFilterValues) => void;
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
  patients,
  patientSearch,
  observedAppointments,
  onChange,
  onPatientSearchChange,
  onReset,
}: AgendaFiltersProps) {
  const fallbackMemberships = observedAppointments.reduce<MembershipResponse[]>(
    (items, appointment) => {
      const membership = appointment.assignedMembership;
      if (membership && !items.some((item) => item.id === membership.id)) {
        items.push({
          id: membership.id,
          role: membership.role,
          status: 'ACTIVE',
          user: membership.user,
        });
      }
      return items;
    },
    [],
  );
  const professionalOptions = memberships.length ? memberships : fallbackMemberships;
  const hasFilters = Boolean(
    filters.clinicLocationId ||
    filters.assignedMembershipId ||
    filters.patientId ||
    filters.status !== 'ALL' ||
    patientSearch,
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
        <FormField label="Profesional" htmlFor="agenda-professional-filter">
          <Select
            id="agenda-professional-filter"
            value={filters.assignedMembershipId || 'ALL'}
            onChange={(event) =>
              onChange({
                ...filters,
                assignedMembershipId: event.target.value === 'ALL' ? '' : event.target.value,
              })
            }
          >
            <option value="ALL">Todos los profesionales</option>
            <option value="UNASSIGNED">Sin profesional asignado</option>
            {professionalOptions
              .filter(
                (membership) =>
                  membership.status === 'ACTIVE' && membership.user.status === 'ACTIVE',
              )
              .map((membership) => (
                <option value={membership.id} key={membership.id}>
                  {professionalLabel(membership)}
                </option>
              ))}
          </Select>
        </FormField>
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
