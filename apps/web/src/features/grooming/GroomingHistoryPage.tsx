import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { ResourceError } from '../shared/ResourceFeedback';
import { usePatient } from '../patients/usePatients';
import { useGroomingPatientHistory } from './useGroomingResources';
import { GROOMING_MUTATED_EVENT, GROOMING_STATUS_LABEL, ownerLabel } from './groomingViewUtils';
import { useEffect } from 'react';
import './grooming.css';

// Patient history presents the operational timeline while explicitly separating it from clinical records.
export function GroomingHistoryPage() {
  const { patientId = '' } = useParams();
  const canRead = useCan(PERMISSION.GROOMING_READ);
  const canCreate = useCan(PERMISSION.GROOMING_CREATE);
  const patient = usePatient(patientId);
  const organization = useClinicalOrganization();
  const history = useGroomingPatientHistory(patientId, canRead);

  useEffect(() => {
    window.addEventListener(GROOMING_MUTATED_EVENT, history.reload);
    return () => window.removeEventListener(GROOMING_MUTATED_EVENT, history.reload);
  }, [history.reload]);

  return (
    <div className="page-stack grooming-page">
      <PageHeader
        eyebrow="Historial operativo · Peluquería"
        title={patient.patient?.name ?? 'Historial de peluquería'}
        description="Atenciones de peluquería conservadas por paciente. Este historial no es una historia clínica ni contiene consultas o evoluciones."
        action={
          <span className="page-header__actions">
            <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
              Volver a historia
            </Button>
            {canCreate && patient.patient?.status === 'ACTIVE' ? (
              <Button as={Link} to={`/peluqueria/nueva?patientId=${encodeURIComponent(patientId)}`}>
                Nueva atención
              </Button>
            ) : null}
          </span>
        }
      />
      {patient.patient?.status === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          Paciente archivado. El historial es de solo lectura.
        </Alert>
      ) : null}
      {history.loading ? (
        <Card>
          <LoadingState label="Cargando historial operativo" />
        </Card>
      ) : null}
      {history.error ? (
        <Card>
          <ResourceError error={history.error} onRetry={history.reload} />
        </Card>
      ) : null}
      {!history.loading && !history.error && !history.data?.data.length ? (
        <Card>
          <EmptyState
            title="Sin atenciones de peluquería"
            description="Cuando se cree una atención operativa, aparecerá aquí sin mezclarse con la historia clínica."
            action={
              canCreate && patient.patient?.status === 'ACTIVE' ? (
                <Button
                  as={Link}
                  to={`/peluqueria/nueva?patientId=${encodeURIComponent(patientId)}`}
                >
                  Crear atención
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : null}
      {history.data?.data.length ? (
        <Card className="grooming-history-card">
          <div className="grooming-history-list">
            {history.data.data.map((visit) => (
              <Link className="grooming-history-row" to={`/peluqueria/${visit.id}`} key={visit.id}>
                <span className="grooming-history-row__main">
                  <strong>{visit.serviceSummary || 'Servicio de peluquería'}</strong>
                  <small>
                    {visit.patientNameSnapshot ?? visit.patient.name} · {ownerLabel(visit)}
                  </small>
                  <small>
                    {formatDateTime(
                      visit.startedAt ?? visit.createdAt,
                      organization.data?.timezone ?? 'America/Bogota',
                    )}{' '}
                    · {visit.clinicLocation.name}
                  </small>
                  <small>
                    {visit.groomerDisplayNameSnapshot ??
                      visit.assignedGroomer?.displayName ??
                      'Sin peluquero asignado'}
                  </small>
                </span>
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
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
