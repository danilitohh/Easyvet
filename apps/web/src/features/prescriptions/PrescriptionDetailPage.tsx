import type { PrescriptionDetail } from '@veterinary-saas/contracts';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { useClinicalOrganization, useProfessionalProfile } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { prescriptionsApi } from './prescriptionsApi';
import { usePrescription } from './usePrescriptions';
import {
  historicalProfessional,
  prescriptionStatusLabel,
  prescriptionStatusTone,
} from './prescriptionsUtils';

function ReadonlyValue({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="prescription-detail-field">
      <dt>{label}</dt>
      <dd className="clinical-prose">{value}</dd>
    </div>
  );
}

function PrescriptionItems({ prescription }: { prescription: PrescriptionDetail }) {
  const items = [...prescription.items].sort((left, right) => left.position - right.position);
  return (
    <div className="prescription-items" aria-label="Medicamentos e indicaciones">
      {items.map((item) => (
        <article className="prescription-item" key={item.id}>
          <div className="prescription-item__heading">
            <span className="prescription-item__position" aria-label={`Item ${item.position + 1}`}>
              {item.position + 1}
            </span>
            <h3>{item.medicationName}</h3>
          </div>
          <dl className="prescription-item__fields">
            <ReadonlyValue label="Presentación" value={item.presentation} />
            <ReadonlyValue label="Cantidad" value={item.quantity} />
            <ReadonlyValue label="Dosis" value={item.dosage} />
            <ReadonlyValue label="Frecuencia" value={item.frequency} />
            <ReadonlyValue label="Duración" value={item.duration} />
            <ReadonlyValue label="Observaciones" value={item.observations} />
          </dl>
        </article>
      ))}
    </div>
  );
}

function PrescriptionStatusPanel({
  prescription,
  timezone,
}: {
  prescription: PrescriptionDetail;
  timezone: string;
}) {
  const parentVoided = prescription.parentEncounterStatus === 'VOIDED';
  return (
    <Card className="prescription-status-panel">
      <div className="prescription-status-panel__top">
        <div>
          <p className="section-kicker">Estado de la prescripción</p>
          <h2>{prescriptionStatusLabel(prescription.status)}</h2>
        </div>
        <span
          className={`clinical-status clinical-status--${prescriptionStatusTone(prescription.status)}`}
        >
          {prescriptionStatusLabel(prescription.status)}
        </span>
      </div>
      {prescription.status === 'DRAFT' ? (
        <Alert tone="warning" role="status">
          Borrador. Esta prescripción aún no ha sido finalizada.
        </Alert>
      ) : null}
      {prescription.status === 'FINALIZED' && prescription.finalizedAt ? (
        <p className="clinical-meta">
          Fecha de emisión: {formatDateTime(prescription.finalizedAt, timezone)}
        </p>
      ) : null}
      {prescription.status === 'VOIDED' ? (
        <div className="prescription-voided-meta">
          <p className="clinical-meta">Anulada {formatDateTime(prescription.voidedAt, timezone)}</p>
          <ReadonlyValue label="Motivo de anulación" value={prescription.voidReason} />
        </div>
      ) : null}
      {parentVoided ? (
        <Alert tone="warning" role="status">
          La consulta clínica asociada fue anulada.
          {prescription.status === 'DRAFT'
            ? ' Este borrador no puede continuar.'
            : ' La prescripción conserva su estado histórico.'}
        </Alert>
      ) : null}
    </Card>
  );
}

// Detail preserves historical snapshots while exposing only lifecycle-safe prescription actions.
export function PrescriptionDetailPage() {
  const { patientId, prescriptionId } = useParams<{
    patientId: string;
    prescriptionId: string;
  }>();
  const canRead = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const canUpdateDraft = useCan(PERMISSION.PRESCRIPTIONS_UPDATE_DRAFT);
  const canFinalize = useCan(PERMISSION.PRESCRIPTIONS_FINALIZE);
  const canVoid = useCan(PERMISSION.PRESCRIPTIONS_VOID);
  const { activeMembership } = useAuth();
  const location = useLocation();
  const organization = useClinicalOrganization();
  const prescription = usePrescription(prescriptionId, canRead);
  const profile = useProfessionalProfile(canFinalize);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const organizationId = activeMembership?.organization.id;
  const timezone = organization.data?.timezone ?? 'UTC';

  // Tenant changes close destructive dialogs and remove the previous prescription context.
  useEffect(() => {
    setFinalizeOpen(false);
    setVoidOpen(false);
    setVoidReason('');
    setActionError(null);
  }, [organizationId]);

  if (!canRead) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId || !prescriptionId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (prescription.loading || organization.loading) {
    return (
      <div className="page-stack clinical-page">
        <LoadingState label="Cargando prescripción" />
      </div>
    );
  }
  if (prescription.error)
    return <ResourceError error={prescription.error} onRetry={prescription.reload} />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (!prescription.data || prescription.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  const item = prescription.data;
  const parentVoided = item.parentEncounterStatus === 'VOIDED';
  const isResponsiblePractitioner = activeMembership?.id === item.prescribedByMembershipId;
  const isPractitionerActor = activeMembership?.clinicalRole === 'PRACTITIONER';
  const hasItems = item.items.length > 0;
  const prescriberMissing = !item.prescribedByMembershipId;
  const prescriberProfileMissing = Boolean(
    item.prescribedByMembershipId && !item.prescribedBy?.displayName?.trim(),
  );
  const currentProfileMissing = Boolean(
    isResponsiblePractitioner &&
    !profile.loading &&
    (!profile.data || !profile.data.displayName.trim()),
  );
  const canEdit = item.status === 'DRAFT' && canUpdateDraft && !parentVoided;
  const canOpenFinalizeReview =
    item.status === 'DRAFT' &&
    canFinalize &&
    isPractitionerActor &&
    isResponsiblePractitioner &&
    !parentVoided &&
    hasItems &&
    !prescriberProfileMissing &&
    !currentProfileMissing;
  const professional = historicalProfessional(
    item.status,
    item.professionalDisplayNameSnapshot,
    item.prescribedBy?.displayName,
  );
  const isHistorical = item.status !== 'DRAFT';

  async function finalizePrescription() {
    if (actionPending) return;
    setActionPending(true);
    setActionError(null);
    try {
      await prescriptionsApi.finalize(item.id, { expectedVersion: item.version });
      setFinalizeOpen(false);
      prescription.reload();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'PARENT_CLINICAL_ENCOUNTER_VOIDED') {
        setFinalizeOpen(false);
        setActionError(error);
        prescription.reload();
      } else {
        setActionError(error);
      }
    } finally {
      setActionPending(false);
    }
  }

  async function voidPrescription() {
    const reason = voidReason.trim();
    if (!reason || actionPending) return;
    setActionPending(true);
    setActionError(null);
    try {
      await prescriptionsApi.void(item.id, { expectedVersion: item.version, reason });
      setVoidOpen(false);
      setVoidReason('');
      prescription.reload();
    } catch (error: unknown) {
      setActionError(error);
    } finally {
      setActionPending(false);
    }
  }

  function reloadCurrent() {
    setActionError(null);
    setFinalizeOpen(false);
    setVoidOpen(false);
    prescription.reload();
  }

  return (
    <div className="page-stack clinical-page prescription-page">
      <PageHeader
        eyebrow="Historia clínica · Prescripción"
        title="Prescripción"
        description={`${item.patient.name} · ${prescriptionStatusLabel(item.status)}`}
        action={
          <span className="page-header__actions">
            {canEdit ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/prescripciones/${item.id}/editar`}
              >
                Editar borrador
              </Button>
            ) : null}
            {item.status === 'FINALIZED' && canVoid && isPractitionerActor ? (
              <Button type="button" variant="danger" onClick={() => setVoidOpen(true)}>
                Anular prescripción
              </Button>
            ) : null}
            {canOpenFinalizeReview ? (
              <Button type="button" onClick={() => setFinalizeOpen(true)}>
                Finalizar prescripción
              </Button>
            ) : null}
            <Link
              className="button button--secondary"
              to={`/pacientes/${patientId}/historia/prescripciones`}
            >
              Volver a prescripciones
            </Link>
          </span>
        }
      />
      {location.state && typeof location.state === 'object' && 'notice' in location.state ? (
        <Alert tone="warning" role="status">
          {String((location.state as { notice?: unknown }).notice)}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {errorMessage(actionError, 'No fue posible completar la operación.')}
          {actionError instanceof ApiError && actionError.code === 'PRESCRIPTION_STALE' ? (
            <Button type="button" variant="secondary" onClick={reloadCurrent}>
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <PrescriptionStatusPanel prescription={item} timezone={timezone} />
      {item.status === 'DRAFT' && canFinalize ? (
        <div className="prescription-action-guidance">
          {prescriberMissing ? (
            <Alert tone="warning" role="status">
              Selecciona un profesional prescriptor antes de finalizar.
              {canEdit ? (
                <Button
                  as={Link}
                  to={`/pacientes/${patientId}/historia/prescripciones/${item.id}/editar`}
                  variant="secondary"
                >
                  Editar borrador
                </Button>
              ) : null}
            </Alert>
          ) : null}
          {!prescriberMissing && !isResponsiblePractitioner ? (
            <Alert tone="info" role="status">
              Esta prescripción debe ser finalizada por{' '}
              {item.prescribedBy?.displayName || 'el profesional asignado'}.
            </Alert>
          ) : null}
          {!prescriberMissing && isResponsiblePractitioner && currentProfileMissing ? (
            <Alert tone="warning" role="status">
              Completa tu perfil profesional antes de finalizar.{' '}
              <Link to="/perfil/profesional">Configurar perfil profesional</Link>
            </Alert>
          ) : null}
          {!prescriberMissing && !isResponsiblePractitioner && prescriberProfileMissing ? (
            <Alert tone="warning" role="status">
              El profesional asignado debe completar su perfil profesional.
            </Alert>
          ) : null}
          {isResponsiblePractitioner && !hasItems ? (
            <Alert tone="warning" role="status">
              Agrega al menos un medicamento antes de finalizar la prescripción.
            </Alert>
          ) : null}
          {parentVoided ? (
            <Alert tone="warning" role="status">
              La consulta clínica asociada fue anulada. Este borrador no puede continuar.
            </Alert>
          ) : null}
        </div>
      ) : null}
      <div className="detail-grid prescription-detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Identidad clínica</p>
              <h2>Paciente y responsable</h2>
            </div>
            {item.patient.status === 'ARCHIVED' ? (
              <Badge tone="warning">Paciente archivado</Badge>
            ) : null}
          </div>
          <dl className="detail-list">
            {isHistorical && item.patientNameSnapshot ? (
              <div>
                <dt>Paciente al emitir</dt>
                <dd>{item.patientNameSnapshot}</dd>
              </div>
            ) : null}
            <div>
              <dt>Paciente actual</dt>
              <dd>{item.patient.name}</dd>
            </div>
            {isHistorical && item.ownerDisplayNameSnapshot ? (
              <div>
                <dt>Responsable al momento de emisión</dt>
                <dd>{item.ownerDisplayNameSnapshot}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Autoría</p>
              <h2>Profesional prescriptor</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>{isHistorical ? 'Profesional histórico' : 'Prescriptor actual'}</dt>
              <dd>{professional}</dd>
            </div>
            {isHistorical && item.professionalLicenseSnapshot ? (
              <div>
                <dt>Matrícula histórica</dt>
                <dd>{item.professionalLicenseSnapshot}</dd>
              </div>
            ) : null}
            {!isHistorical && item.prescribedBy?.licenseNumber ? (
              <div>
                <dt>Matrícula</dt>
                <dd>{item.prescribedBy.licenseNumber}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
      {item.diagnosisSnapshot ? (
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Contexto diagnóstico</p>
              <h2>Diagnóstico al emitir</h2>
            </div>
          </div>
          <p className="clinical-prose prescription-diagnosis">{item.diagnosisSnapshot}</p>
        </Card>
      ) : null}
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Indicaciones</p>
            <h2>Medicamentos e indicaciones</h2>
          </div>
          <Badge>{`${item.items.length} ${item.items.length === 1 ? 'item' : 'items'}`}</Badge>
        </div>
        {item.items.length ? (
          <PrescriptionItems prescription={item} />
        ) : (
          <p className="clinical-muted">Esta prescripción no tiene items registrados.</p>
        )}
      </Card>
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Contexto clínico</p>
            <h2>Consulta relacionada</h2>
          </div>
        </div>
        {canReadEncounter ? (
          <Link
            className="prescription-encounter-link"
            to={`/pacientes/${patientId}/historia/encuentros/${item.clinicalEncounterId}`}
          >
            Ver consulta clínica relacionada
          </Link>
        ) : (
          <p className="clinical-muted">
            Consulta clínica relacionada disponible para roles autorizados.
          </p>
        )}
        <p className="clinical-meta">
          Estado de la consulta:{' '}
          {item.parentEncounterStatus === 'VOIDED'
            ? 'Anulada'
            : item.parentEncounterStatus === 'FINALIZED'
              ? 'Finalizada'
              : 'Borrador'}
        </p>
        <dl className="detail-list prescription-timestamps">
          <div>
            <dt>Creada</dt>
            <dd>{formatDateTime(item.createdAt, timezone)}</dd>
          </div>
          {item.finalizedAt ? (
            <div>
              <dt>Emitida</dt>
              <dd>{formatDateTime(item.finalizedAt, timezone)}</dd>
            </div>
          ) : null}
          {item.voidedAt ? (
            <div>
              <dt>Anulada</dt>
              <dd>{formatDateTime(item.voidedAt, timezone)}</dd>
            </div>
          ) : null}
        </dl>
      </Card>
      <Modal
        open={finalizeOpen}
        onClose={() => {
          if (!actionPending) setFinalizeOpen(false);
        }}
        eyebrow="Revisión de emisión"
        title="Finalizar prescripción"
        description="Revisa el contenido antes de dejar esta prescripción como evidencia clínica definitiva."
      >
        <div className="prescription-review">
          <dl className="detail-list">
            <div>
              <dt>Paciente</dt>
              <dd>{item.patient.name}</dd>
            </div>
            <div>
              <dt>Consulta</dt>
              <dd>{item.clinicalEncounterId}</dd>
            </div>
            <div>
              <dt>Prescriptor</dt>
              <dd>{item.prescribedBy?.displayName || 'Sin prescriptor'}</dd>
            </div>
            <div>
              <dt>Matrícula</dt>
              <dd>{item.prescribedBy?.licenseNumber || 'No registrada'}</dd>
            </div>
            <div>
              <dt>Medicamentos</dt>
              <dd>{item.items.length}</dd>
            </div>
            <div>
              <dt>Versión revisada</dt>
              <dd>{item.version}</dd>
            </div>
          </dl>
          <Alert tone="warning" role="status">
            Al finalizar, esta prescripción dejará de ser editable.
          </Alert>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={actionPending}
              onClick={() => setFinalizeOpen(false)}
            >
              Revisar después
            </Button>
            <Button
              type="button"
              disabled={actionPending}
              onClick={() => void finalizePrescription()}
            >
              {actionPending ? 'Finalizando…' : 'Finalizar prescripción'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={voidOpen}
        onClose={() => {
          if (!actionPending) setVoidOpen(false);
        }}
        eyebrow="Anulación histórica"
        title="Anular prescripción"
        description="La prescripción seguirá conservada en la historia clínica y quedará marcada como anulada."
      >
        <div className="prescription-review">
          <label className="form-field" htmlFor="prescription-void-reason">
            <span>Motivo de anulación *</span>
            <textarea
              id="prescription-void-reason"
              className="input input--textarea"
              value={voidReason}
              maxLength={2_000}
              disabled={actionPending}
              onChange={(event) => setVoidReason(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={actionPending}
              onClick={() => setVoidOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={actionPending || !voidReason.trim()}
              onClick={() => void voidPrescription()}
            >
              {actionPending ? 'Anulando…' : 'Confirmar anulación'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
