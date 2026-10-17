import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GroomingVisitStatus, GroomingVisitListQuery } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { ResourceError } from '../shared/ResourceFeedback';
import { isoAtCivilMidnight, nextCivilDate } from '../agenda/agendaUtils';
import { useGroomingListResource, useGroomingOptions } from './useGroomingResources';
import { GROOMING_MUTATED_EVENT, GROOMING_STATUS_LABEL, ownerLabel } from './groomingViewUtils';
import './grooming.css';

const STATUS_VALUES: GroomingVisitStatus[] = ['IN_PROGRESS', 'DRAFT', 'COMPLETED', 'VOIDED'];

// Queue filters are URL-independent UI state; all values are tenant scoped in the API query.
export function GroomingQueuePage() {
  const canRead = useCan(PERMISSION.GROOMING_READ);
  const canCreate = useCan(PERMISSION.GROOMING_CREATE);
  const organization = useClinicalOrganization();
  const [status, setStatus] = useState<GroomingVisitStatus | ''>('');
  const [locationId, setLocationId] = useState('');
  const [groomerId, setGroomerId] = useState('');
  const [groomerSearch, setGroomerSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const options = useGroomingOptions(canRead, groomerSearch);
  const timezone = organization.data?.timezone ?? 'America/Bogota';
  const query = useMemo<GroomingVisitListQuery>(
    () => ({
      page: 1,
      pageSize: 100,
      ...(status ? { status } : {}),
      ...(locationId ? { clinicLocationId: locationId } : {}),
      ...(groomerId ? { assignedGroomerMembershipId: groomerId } : {}),
      ...(fromDate ? { from: isoAtCivilMidnight(fromDate, timezone) } : {}),
      ...(toDate
        ? {
            to: new Date(
              Date.parse(isoAtCivilMidnight(nextCivilDate(toDate), timezone)) - 1,
            ).toISOString(),
          }
        : {}),
    }),
    [fromDate, groomerId, locationId, status, timezone, toDate],
  );
  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);
  const state = useGroomingListResource(query, canRead && !dateRangeInvalid);
  const reload = state.reload;

  useEffect(() => {
    window.addEventListener(GROOMING_MUTATED_EVENT, reload);
    return () => window.removeEventListener(GROOMING_MUTATED_EVENT, reload);
  }, [reload]);

  const clearFilters = useCallback(() => {
    setStatus('');
    setLocationId('');
    setGroomerId('');
    setGroomerSearch('');
    setFromDate('');
    setToDate('');
  }, []);

  return (
    <div className="page-stack grooming-page">
      <PageHeader
        eyebrow="Servicios · Peluquería"
        title="Peluquería"
        description="Cola operativa de servicios de baño, corte y cuidado estético. Este registro no es una consulta clínica."
        action={
          canCreate ? (
            <Button as={Link} to="/peluqueria/nueva">
              Nueva atención
            </Button>
          ) : undefined
        }
      />
      {!canRead ? (
        <Card>
          <EmptyState
            title="Acceso restringido"
            description="Tu membresía no puede consultar la operación de peluquería."
          />
        </Card>
      ) : (
        <Card className="grooming-queue">
          <div className="grooming-filter-grid" aria-label="Filtros de peluquería">
            <label className="grooming-filter">
              <span>Estado</span>
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as GroomingVisitStatus | '')}
              >
                <option value="">Todos</option>
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {GROOMING_STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grooming-filter">
              <span>Sede</span>
              <Select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                <option value="">Todas</option>
                {options.data?.locations
                  .filter((location) => location.status === 'ACTIVE')
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="grooming-filter">
              <span>Peluquero</span>
              <Select value={groomerId} onChange={(event) => setGroomerId(event.target.value)}>
                <option value="">Todos</option>
                {options.data?.groomers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grooming-filter">
              <span>Buscar peluquero</span>
              <SearchInput
                value={groomerSearch}
                onChange={setGroomerSearch}
                placeholder="Nombre del profesional"
                ariaLabel="Buscar peluquero"
              />
            </label>
            <label className="grooming-filter">
              <span>Desde</span>
              <input
                className="input"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label className="grooming-filter">
              <span>Hasta</span>
              <input
                className="input"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
          {fromDate && toDate && fromDate > toDate ? (
            <Alert tone="warning" role="status">
              La fecha inicial es posterior a la fecha final.
            </Alert>
          ) : null}
          {state.loading ? <LoadingState label="Cargando atenciones de peluquería" /> : null}
          {state.error ? (
            <ResourceError
              error={state.error}
              fallback="No fue posible cargar la cola de peluquería."
              onRetry={state.reload}
            />
          ) : null}
          {!state.loading && !state.error && !state.data?.data.length ? (
            <EmptyState
              title="No hay atenciones para estos filtros"
              description="Los borradores, servicios en atención y registros recientes aparecerán aquí."
              action={
                canCreate ? (
                  <Button as={Link} to="/peluqueria/nueva">
                    Crear primera atención
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {state.data?.data.length ? (
            <div className="grooming-visit-list">
              {state.data.data.map((visit) => (
                <Link className="grooming-visit-card" to={`/peluqueria/${visit.id}`} key={visit.id}>
                  <span className="grooming-visit-card__main">
                    <span className="grooming-visit-card__title-row">
                      <strong>{visit.patientNameSnapshot ?? visit.patient.name}</strong>
                      <Badge
                        tone={
                          visit.status === 'IN_PROGRESS'
                            ? 'info'
                            : visit.status === 'COMPLETED'
                              ? 'success'
                              : visit.status === 'VOIDED'
                                ? 'danger'
                                : 'warning'
                        }
                      >
                        {GROOMING_STATUS_LABEL[visit.status]}
                      </Badge>
                    </span>
                    <small>
                      {ownerLabel(visit)} ·{' '}
                      {visit.serviceSummary || 'Servicio pendiente de definir'}
                    </small>
                    <small>
                      {visit.appointment
                        ? formatDateTime(visit.appointment.startsAt, timezone)
                        : formatDateTime(visit.startedAt ?? visit.createdAt, timezone)}{' '}
                      · {visit.clinicLocation.name}
                    </small>
                    <small>
                      {visit.groomerDisplayNameSnapshot ??
                        visit.assignedGroomer?.displayName ??
                        'Sin peluquero asignado'}
                      {visit.appointment
                        ? ` · Cita ${visit.appointment.status === 'CANCELLED' || visit.appointment.status === 'NO_SHOW' ? 'cancelada' : 'vinculada'}`
                        : ''}
                    </small>
                  </span>
                  <span className="grooming-visit-card__arrow" aria-hidden="true">
                    <EasyvetIcon name="arrow-right" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          {state.data?.pagination.total ? (
            <p className="grooming-list-total">
              {state.data.pagination.total} atenciones · en atención, borradores y actividad
              reciente
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
