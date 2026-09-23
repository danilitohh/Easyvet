import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/apiClient';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { useClinicalMutationGuard } from '../shared/useClinicalDomainResource';
import { ResourceError } from '../shared/ResourceFeedback';
import { useGroomingVisitResource } from './useGroomingResources';
import { groomingApi } from './groomingApi';
import {
  groomingErrorMessage,
  GROOMING_MUTATED_EVENT,
  GROOMING_STATUS_LABEL,
  notifyGroomingMutation,
} from './groomingViewUtils';
import './grooming.css';

type Dialog = 'start' | 'complete' | 'void' | null;

// Detail owns explicit lifecycle confirmation; no action mutates Agenda or creates a clinical record.
export function GroomingVisitDetailPage() {
  const { groomingVisitId = '' } = useParams();
  const { activeMembership } = useAuth();
  const canRead = useCan(PERMISSION.GROOMING_READ);
  const canUpdate = useCan(PERMISSION.GROOMING_UPDATE_DRAFT);
  const canPerform = useCan(PERMISSION.GROOMING_PERFORM);
  const canComplete = useCan(PERMISSION.GROOMING_COMPLETE);
  const canVoid = useCan(PERMISSION.GROOMING_VOID);
  const canReadAppointments = useCan(PERMISSION.APPOINTMENTS_READ);
  const organization = useClinicalOrganization();
  const mutationGuard = useClinicalMutationGuard();
  const visitState = useGroomingVisitResource(groomingVisitId, canRead);
  const visit = visitState.data;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [postServiceNotes, setPostServiceNotes] = useState('');
  const [incidentNotes, setIncidentNotes] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const organizationId = activeMembership?.organization.id;

  // Tenant changes close confirmations and clear any text so it cannot cross organization context.
  useEffect(() => {
    setDialog(null);
    setError(null);
    setPostServiceNotes('');
    setIncidentNotes('');
    setVoidReason('');
  }, [organizationId, groomingVisitId]);

  useEffect(() => {
    window.addEventListener(GROOMING_MUTATED_EVENT, visitState.reload);
    return () => window.removeEventListener(GROOMING_MUTATED_EVENT, visitState.reload);
  }, [visitState.reload]);

  // A lifecycle response is accepted only if the same tenant remains active until the request resolves.
  async function mutate(action: 'start' | 'complete' | 'void') {
    if (!visit) return;
    const signal = mutationGuard.signal();
    setSaving(true);
    setError(null);
    try {
      if (action === 'start') await groomingApi.start(visit.id, visit.version, signal);
      if (action === 'complete')
        await groomingApi.complete(
          visit.id,
          { expectedVersion: visit.version, postServiceNotes, incidentNotes },
          signal,
        );
      if (action === 'void')
        await groomingApi.void(
          visit.id,
          { expectedVersion: visit.version, reason: voidReason },
          signal,
        );
      if (!mutationGuard.isCurrent()) return;
      notifyGroomingMutation();
      setDialog(null);
      setPostServiceNotes('');
      setIncidentNotes('');
      setVoidReason('');
      visitState.reload();
    } catch (cause) {
      if (!mutationGuard.isCurrent()) return;
      const versionChanged = cause instanceof ApiError && cause.code === 'STALE_GROOMING_VISIT';
      setError(groomingErrorMessage(cause, 'No fue posible completar la operación.'));
      if (versionChanged) visitState.reload();
    } finally {
      if (mutationGuard.isCurrent()) setSaving(false);
    }
  }

  if (visitState.loading)
    return (
      <div className="page-stack">
        <LoadingState label="Cargando atención de peluquería" />
      </div>
    );
  if (visitState.error)
    return (
      <div className="page-stack">
        <ResourceError error={visitState.error} onRetry={visitState.reload} />
      </div>
    );
  if (!visit)
    return (
      <div className="page-stack">
        <Alert tone="warning" role="status">
          No se encontró la atención solicitada.
        </Alert>
      </div>
    );

  const canEdit =
    canUpdate && (visit.status === 'DRAFT' || (visit.status === 'IN_PROGRESS' && canPerform));
  const canStart = visit.status === 'DRAFT' && canPerform;
  const canFinish = visit.status === 'IN_PROGRESS' && canComplete;
  const canCancelRecord =
    (visit.status === 'IN_PROGRESS' || visit.status === 'COMPLETED') && canVoid;
  const timezone = organization.data?.timezone ?? 'America/Bogota';

  return (
    <div className="page-stack grooming-page">
      <PageHeader
        eyebrow="Peluquería · Servicio operativo"
        title={visit.patientNameSnapshot ?? visit.patient.name}
        description="Detalle de la atención de peluquería. Este registro es operativo y no forma parte de la historia clínica."
        action={
          <span className="page-header__actions">
            <Button as={Link} to="/peluqueria" variant="secondary">
              Volver a peluquería
            </Button>
            {canEdit ? (
              <Button as={Link} to={`/peluqueria/${visit.id}/editar`} variant="secondary">
                Editar
              </Button>
            ) : null}
          </span>
        }
      />
      {error ? (
        <Alert tone="error" role="alert">
          {error}
        </Alert>
      ) : null}
      {visit.patient.status === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          Paciente archivado. El servicio se conserva para consulta histórica y no puede avanzar ni
          editarse.
        </Alert>
      ) : null}
      {visit.appointment?.status === 'CANCELLED' || visit.appointment?.status === 'NO_SHOW' ? (
        <Alert tone="warning" role="status">
          La cita vinculada está{' '}
          {visit.appointment.status === 'CANCELLED' ? 'cancelada' : 'marcada como no asistió'}. El
          estado de esta atención es independiente y no cambia automáticamente.
        </Alert>
      ) : null}
      <Card className="grooming-detail-card">
        <div className="grooming-detail-card__heading">
          <div>
            <p className="section-kicker">Estado del servicio</p>
            <h2>{GROOMING_STATUS_LABEL[visit.status]}</h2>
          </div>
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
          >{`Versión ${visit.version}`}</Badge>
        </div>
        <dl className="grooming-detail-grid">
          <div>
            <dt>Paciente</dt>
            <dd>
              {visit.patientNameSnapshot ?? visit.patient.name} · {visit.patient.species}
            </dd>
          </div>
          <div>
            <dt>Propietario histórico</dt>
            <dd>{visit.ownerDisplayNameSnapshot ?? visit.ownerAtTime.displayName}</dd>
          </div>
          <div>
            <dt>Sede</dt>
            <dd>{visit.clinicLocation.name}</dd>
          </div>
          <div>
            <dt>Peluquero responsable</dt>
            <dd>
              {visit.groomerDisplayNameSnapshot ??
                visit.assignedGroomer?.displayName ??
                'Sin asignar'}
            </dd>
          </div>
          <div>
            <dt>Servicio solicitado</dt>
            <dd>{visit.serviceSummary || 'Pendiente de definir'}</dd>
          </div>
          <div>
            <dt>Creada</dt>
            <dd>{formatDateTime(visit.createdAt, timezone)}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{formatDateTime(visit.startedAt, timezone)}</dd>
          </div>
          <div>
            <dt>Finalización</dt>
            <dd>{formatDateTime(visit.completedAt, timezone)}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>{formatDateTime(visit.updatedAt, timezone)}</dd>
          </div>
          {canReadAppointments && visit.appointment ? (
            <div>
              <dt>Cita de Agenda</dt>
              <dd>
                <Link to={`/agenda/citas/${visit.appointment.id}`}>
                  {formatDateTime(visit.appointment.startsAt, timezone)} ·{' '}
                  {visit.appointment.reason}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="grooming-detail-notes">
          <Note label="Estado del pelaje" value={visit.coatCondition} />
          <Note label="Observaciones de piel" value={visit.skinObservations} />
          <Note label="Temperamento" value={visit.temperamentNotes} />
          <Note label="Notas previas" value={visit.preServiceNotes} />
          <Note label="Notas posteriores" value={visit.postServiceNotes} />
          <Note label="Incidentes operativos" value={visit.incidentNotes} />
        </div>
        {visit.voidReason ? (
          <Alert tone="warning" role="status">
            Anulada por {visit.voidedBy?.displayName ?? 'un administrador'}: {visit.voidReason}
          </Alert>
        ) : null}
        <div className="grooming-detail-actions">
          {canStart ? (
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setDialog('start');
              }}
            >
              Iniciar atención
            </Button>
          ) : null}
          {canFinish ? (
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setPostServiceNotes(visit.postServiceNotes ?? '');
                setIncidentNotes(visit.incidentNotes ?? '');
                setDialog('complete');
              }}
            >
              Completar servicio
            </Button>
          ) : null}
          {canCancelRecord ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setError(null);
                setDialog('void');
              }}
            >
              Anular registro
            </Button>
          ) : null}
        </div>
      </Card>
      <Modal
        open={dialog === 'start'}
        title="Iniciar atención"
        eyebrow="Confirmación de servicio"
        description="Se guardarán la versión revisada y las referencias históricas de paciente, propietario y peluquero."
        onClose={() => !saving && setDialog(null)}
      >
        <div className="grooming-confirmation">
          <p>
            <strong>Paciente:</strong> {visit.patientNameSnapshot ?? visit.patient.name}
          </p>
          <p>
            <strong>Servicio:</strong> {visit.serviceSummary || 'Pendiente'}
          </p>
          <p>
            <strong>Peluquero:</strong> {visit.assignedGroomer?.displayName ?? 'Sin asignar'}
          </p>
          <p>
            <strong>Sede:</strong> {visit.clinicLocation.name}
          </p>
          {canReadAppointments ? (
            <p>
              <strong>Cita relacionada:</strong>{' '}
              {visit.appointment
                ? `${formatDateTime(visit.appointment.startsAt, timezone)} · ${visit.appointment.reason} · ${visit.appointment.status}`
                : 'Sin cita vinculada'}
            </p>
          ) : null}
          <p>
            <strong>Versión revisada:</strong> {visit.version}
          </p>
        </div>
        {error ? (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className="grooming-modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => setDialog(null)}
          >
            Volver a revisar
          </Button>
          <Button
            type="button"
            disabled={saving || visit.patient.status !== 'ACTIVE'}
            onClick={() => void mutate('start')}
          >
            {saving ? 'Iniciando…' : 'Confirmar inicio'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={dialog === 'complete'}
        title="Completar servicio"
        eyebrow="Cierre operativo"
        description="Registra notas posteriores e incidentes antes de cerrar este servicio."
        onClose={() => !saving && setDialog(null)}
      >
        <div className="grooming-modal-fields">
          <FormField label="Notas posteriores" htmlFor="complete-post-notes">
            <textarea
              id="complete-post-notes"
              className="input grooming-textarea"
              maxLength={5000}
              value={postServiceNotes}
              onChange={(event) => setPostServiceNotes(event.target.value)}
            />
          </FormField>
          <FormField label="Incidentes operativos" htmlFor="complete-incidents">
            <textarea
              id="complete-incidents"
              className="input grooming-textarea"
              maxLength={5000}
              value={incidentNotes}
              onChange={(event) => setIncidentNotes(event.target.value)}
            />
          </FormField>
        </div>
        {error ? (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className="grooming-modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => setDialog(null)}
          >
            Seguir en atención
          </Button>
          <Button
            type="button"
            disabled={saving || visit.patient.status !== 'ACTIVE'}
            onClick={() => void mutate('complete')}
          >
            {saving ? 'Guardando…' : 'Confirmar finalización'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={dialog === 'void'}
        title="Anular atención"
        eyebrow="Acción administrativa"
        description="El registro se conservará en el historial. La anulación no modifica la cita de Agenda."
        onClose={() => !saving && setDialog(null)}
      >
        <FormField label="Motivo obligatorio" htmlFor="void-reason">
          <textarea
            id="void-reason"
            className="input grooming-textarea"
            maxLength={1000}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </FormField>
        {error ? (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className="grooming-modal-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => setDialog(null)}
          >
            Conservar registro
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={saving || !voidReason.trim()}
            onClick={() => void mutate('void')}
          >
            {saving ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Note({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grooming-detail-note">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}
