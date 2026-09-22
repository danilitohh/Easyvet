import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { DocumentGenerationAction } from '../documents/DocumentGenerationAction';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { instantFromCivil } from '../agenda/agendaUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import {
  useClinicalMutationGuard,
  useDiagnosticOrderResource,
} from '../shared/useClinicalDomainResource';
import { diagnosticsApi } from './diagnosticsApi';
import {
  currentDiagnosticDateTime,
  DIAGNOSTIC_CATEGORY_LABEL,
  DIAGNOSTIC_STATUS_LABEL,
  diagnosticStatusTone,
} from './diagnosticUtils';

// Presents request and result evidence as plain text, with explicit actions for each lifecycle step.
export function DiagnosticOrderDetailPage() {
  const { patientId = '', diagnosticOrderId = '' } = useParams<{
    patientId: string;
    diagnosticOrderId: string;
  }>();
  const resource = useDiagnosticOrderResource(diagnosticOrderId, true);
  const organization = useClinicalOrganization();
  const timezone = organization.data?.timezone ?? 'UTC';
  const organizationId = useActiveOrganizationId();
  const { activeMembership } = useAuth();
  const canUpdate = useCan(PERMISSION.DIAGNOSTICS_UPDATE_DRAFT);
  const canRequest = useCan(PERMISSION.DIAGNOSTICS_REQUEST);
  const canResult = useCan(PERMISSION.DIAGNOSTICS_RESULT);
  const canVoid = useCan(PERMISSION.DIAGNOSTICS_VOID);
  const guard = useClinicalMutationGuard();
  const [requestOpen, setRequestOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [resultedAt, setResultedAt] = useState('');
  const [resultText, setResultText] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const order = resource.data;
  const practitioner = activeMembership?.clinicalRole === 'PRACTITIONER';
  const patientArchived = order?.patient.status === 'ARCHIVED';
  const encounterVoided = order?.parentEncounterStatus === 'VOIDED';
  const canRequestThisOrder = Boolean(
    order &&
    order.status === 'DRAFT' &&
    canRequest &&
    practitioner &&
    activeMembership?.id === order.responsiblePractitionerMembershipId &&
    !patientArchived &&
    !encounterVoided,
  );
  const canRecordResult = Boolean(
    order &&
    order.status === 'REQUESTED' &&
    canResult &&
    practitioner &&
    !patientArchived &&
    !encounterVoided,
  );
  const canVoidOrder = Boolean(
    order &&
    (order.status === 'REQUESTED' || order.status === 'RESULTED') &&
    canVoid &&
    practitioner,
  );

  useEffect(() => {
    setRequestOpen(false);
    setResultOpen(false);
    setVoidOpen(false);
    setResultedAt('');
    setResultText('');
    setInterpretation('');
    setVoidReason('');
    setError(null);
  }, [organizationId]);

  async function perform(action: () => Promise<unknown>, onSuccess: () => void) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      if (!guard.isCurrent()) return;
      onSuccess();
      resource.reload();
    } catch (requestError) {
      if (guard.isCurrent()) setError(requestError);
    } finally {
      if (guard.isCurrent()) setSaving(false);
    }
  }

  function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !canRecordResult) return;
    void perform(
      () =>
        diagnosticsApi.result(
          order.id,
          {
            expectedVersion: order.version,
            resultedAt: instantFromCivil(
              resultedAt.split('T')[0] ?? '',
              resultedAt.split('T')[1] ?? '',
              timezone,
            ),
            resultText: resultText.trim() || null,
            interpretation: interpretation.trim() || null,
          },
          guard.signal(),
        ),
      () => setResultOpen(false),
    );
  }

  function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order || !canVoidOrder) return;
    void perform(
      () =>
        diagnosticsApi.void(
          order.id,
          {
            expectedVersion: order.version,
            reason: voidReason.trim(),
          },
          guard.signal(),
        ),
      () => setVoidOpen(false),
    );
  }

  if (resource.loading)
    return (
      <Card>
        <LoadingState label="Cargando orden diagnóstica" />
      </Card>
    );
  if (resource.error)
    return (
      <Card>
        <ResourceError error={resource.error} onRetry={resource.reload} />
      </Card>
    );
  if (!order) return <ResourceError error={new Error('Orden diagnóstica no encontrada.')} />;
  if (order.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  return (
    <section className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow="Historia clínica · Diagnósticos"
        title={order.testName || 'Examen sin nombre'}
        description={`${DIAGNOSTIC_CATEGORY_LABEL[order.category]} · Encuentro ${formatDateTime(order.encounter.occurredAt, timezone)}`}
        action={
          <Link
            className="button button--secondary"
            to={`/pacientes/${patientId}/historia/diagnosticos`}
          >
            Volver al historial
          </Link>
        }
      />
      <DocumentGenerationAction
        documentType="DIAGNOSTIC_RESULT"
        sourceId={order.id}
        sourceStatus={order.status}
      />
      {encounterVoided ? (
        <Alert tone="warning" role="status">
          El encuentro está anulado. Esta orden conserva su estado histórico; las órdenes Draft o
          Requested no se pueden modificar ni completar.
        </Alert>
      ) : null}
      {patientArchived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. La lectura histórica continúa disponible; los borradores y
          solicitudes pendientes son de solo lectura, pero un Practitioner puede anular la
          evidencia.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {error instanceof ApiError && error.code === 'DIAGNOSTIC_ORDER_STALE'
            ? 'La orden cambió en otra sesión. Recarga para consultar su versión actual.'
            : errorMessage(error, 'No fue posible completar la operación.')}
          {error instanceof ApiError && error.status === 409 ? (
            <Button type="button" variant="secondary" onClick={resource.reload}>
              Recargar orden
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Card className="diagnostic-order-status-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Estado de la orden · v{order.version}</p>
            <h2>{DIAGNOSTIC_STATUS_LABEL[order.status]}</h2>
          </div>
          <Badge tone={diagnosticStatusTone(order.status)}>
            {DIAGNOSTIC_STATUS_LABEL[order.status]}
          </Badge>
        </div>
        <div className="page-header__actions">
          {order.status === 'DRAFT' && canUpdate && !patientArchived && !encounterVoided ? (
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/diagnosticos/${order.id}/editar`}
              variant="secondary"
            >
              Editar borrador
            </Button>
          ) : null}
          {canRequestThisOrder ? (
            <Button onClick={() => setRequestOpen(true)}>Emitir solicitud</Button>
          ) : null}
          {canRecordResult ? (
            <Button
              onClick={() => {
                setResultedAt(currentDiagnosticDateTime(timezone));
                setResultOpen(true);
              }}
            >
              Registrar resultado
            </Button>
          ) : null}
          {canVoidOrder ? (
            <Button variant="danger" onClick={() => setVoidOpen(true)}>
              Anular evidencia
            </Button>
          ) : null}
        </div>
        {order.status === 'DRAFT' && canRequest && !canRequestThisOrder ? (
          <p className="clinical-muted">
            La solicitud solo puede emitirla el Practitioner asignado cuando el paciente y el
            encuentro admiten cambios.
          </p>
        ) : null}
      </Card>
      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Solicitud</p>
              <h2>Examen solicitado</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Categoría</dt>
              <dd>{DIAGNOSTIC_CATEGORY_LABEL[order.category]}</dd>
            </div>
            <div>
              <dt>Nombre del examen</dt>
              <dd>{order.testName || 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Fecha solicitada</dt>
              <dd>
                {order.requestedAt ? formatDateTime(order.requestedAt, timezone) : 'Pendiente'}
              </dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>
                {order.professionalDisplayNameSnapshot ||
                  order.responsiblePractitioner?.displayName ||
                  'Sin asignar'}
                {order.professionalLicenseSnapshot ? ` · ${order.professionalLicenseSnapshot}` : ''}
              </dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd className="clinical-prose">{order.reason || '—'}</dd>
            </div>
            <div>
              <dt>Instrucciones</dt>
              <dd className="clinical-prose">{order.instructions || '—'}</dd>
            </div>
            <div>
              <dt>Notas</dt>
              <dd className="clinical-prose">{order.notes || '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Contexto histórico</p>
              <h2>Paciente y encuentro</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Paciente</dt>
              <dd>
                {order.patientNameSnapshot || order.patient.name}
                <span className="inline-note">
                  {order.patientNameSnapshot
                    ? 'Snapshot al emitir solicitud'
                    : order.patient.status === 'ARCHIVED'
                      ? 'Archivado'
                      : 'Actual'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Propietario al solicitar</dt>
              <dd>{order.ownerDisplayNameSnapshot || 'Pendiente de solicitud'}</dd>
            </div>
            <div>
              <dt>Encuentro clínico</dt>
              <dd>
                <Link
                  to={`/pacientes/${patientId}/historia/encuentros/${order.clinicalEncounterId}`}
                >
                  {order.encounter.reason} · {formatDateTime(order.encounter.occurredAt, timezone)}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Estado del encuentro</dt>
              <dd>
                {order.parentEncounterStatus === 'VOIDED'
                  ? 'Anulado'
                  : order.parentEncounterStatus === 'FINALIZED'
                    ? 'Finalizado'
                    : 'Borrador'}
              </dd>
            </div>
            <div>
              <dt>Emitida por</dt>
              <dd>{order.requestedBy?.displayName || 'Aún no solicitada'}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <Card className="detail-card diagnostic-result-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Resultado</p>
            <h2>
              {order.status === 'RESULTED' || (order.status === 'VOIDED' && order.resultedAt)
                ? 'Resultado registrado'
                : 'Pendiente'}
            </h2>
          </div>
        </div>
        {order.resultedAt ? (
          <dl className="detail-list">
            <div>
              <dt>Fecha del resultado</dt>
              <dd>{formatDateTime(order.resultedAt, timezone)}</dd>
            </div>
            <div>
              <dt>Registrado por</dt>
              <dd>{order.resultedBy?.displayName || 'Profesional clínico'}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd className="clinical-prose">{order.resultText || '—'}</dd>
            </div>
            <div>
              <dt>Interpretación</dt>
              <dd className="clinical-prose">{order.interpretation || '—'}</dd>
            </div>
          </dl>
        ) : (
          <EmptyState
            title="Sin resultado"
            description="El resultado se puede registrar después de emitir la solicitud."
          />
        )}
      </Card>
      {order.status === 'VOIDED' ? (
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Anulación</p>
              <h2>Evidencia invalidada</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Fecha</dt>
              <dd>{order.voidedAt ? formatDateTime(order.voidedAt, timezone) : '—'}</dd>
            </div>
            <div>
              <dt>Profesional</dt>
              <dd>{order.voidedByDisplayName || 'Profesional clínico'}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd className="clinical-prose">{order.voidReason}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Modal
        open={requestOpen}
        title="Emitir solicitud"
        description="Al emitirla, los datos de la solicitud quedarán inmutables."
        onClose={() => setRequestOpen(false)}
      >
        <div className="page-stack">
          <p>
            <strong>Paciente:</strong> {order.patient.name}
          </p>
          <p>
            <strong>Examen:</strong> {DIAGNOSTIC_CATEGORY_LABEL[order.category]} ·{' '}
            {order.testName || 'Sin nombre'}
          </p>
          <p>
            <strong>Fecha:</strong>{' '}
            {order.requestedAt ? formatDateTime(order.requestedAt, timezone) : 'Sin fecha'}
          </p>
          <p>
            <strong>Responsable:</strong>{' '}
            {order.responsiblePractitioner?.displayName || 'Sin asignar'}
          </p>
          <p>
            <strong>Versión:</strong> {order.version}
          </p>
          <div className="page-header__actions">
            <Button
              disabled={saving || !canRequestThisOrder}
              onClick={() =>
                void perform(
                  () => diagnosticsApi.request(order.id, order.version, guard.signal()),
                  () => setRequestOpen(false),
                )
              }
            >
              {saving ? 'Emitiendo…' : 'Confirmar solicitud'}
            </Button>
            <Button variant="secondary" disabled={saving} onClick={() => setRequestOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={resultOpen}
        title="Registrar resultado"
        description="Ingresa un resultado, una interpretación o ambos."
        onClose={() => setResultOpen(false)}
      >
        <form className="page-stack" onSubmit={submitResult}>
          <FormField
            label="Fecha y hora del resultado"
            htmlFor="diagnostic-resulted-at"
            hint={`Zona horaria: ${timezone}`}
          >
            <TextInput
              id="diagnostic-resulted-at"
              type="datetime-local"
              required
              value={resultedAt}
              onChange={(event) => setResultedAt(event.target.value)}
              disabled={saving}
            />
          </FormField>
          <FormField label="Resultado" htmlFor="diagnostic-result-text">
            <textarea
              id="diagnostic-result-text"
              className="input textarea"
              maxLength={20000}
              value={resultText}
              onChange={(event) => setResultText(event.target.value)}
              disabled={saving}
            />
          </FormField>
          <FormField label="Interpretación" htmlFor="diagnostic-interpretation">
            <textarea
              id="diagnostic-interpretation"
              className="input textarea"
              maxLength={10000}
              value={interpretation}
              onChange={(event) => setInterpretation(event.target.value)}
              disabled={saving}
            />
          </FormField>
          {!resultText.trim() && !interpretation.trim() ? (
            <p className="clinical-muted">Completa el resultado o la interpretación.</p>
          ) : null}
          <div className="page-header__actions">
            <Button type="submit" disabled={saving || !canRecordResult}>
              {saving ? 'Guardando…' : 'Guardar resultado'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setResultOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={voidOpen}
        title="Anular evidencia diagnóstica"
        description="La solicitud y el resultado se conservarán en el historial."
        onClose={() => setVoidOpen(false)}
      >
        <form className="page-stack" onSubmit={submitVoid}>
          <FormField label="Motivo de anulación" htmlFor="diagnostic-void-reason">
            <textarea
              id="diagnostic-void-reason"
              className="input textarea"
              maxLength={1000}
              required
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              disabled={saving}
            />
          </FormField>
          <div className="page-header__actions">
            <Button
              type="submit"
              variant="danger"
              disabled={saving || !voidReason.trim() || !canVoidOrder}
            >
              {saving ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setVoidOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
