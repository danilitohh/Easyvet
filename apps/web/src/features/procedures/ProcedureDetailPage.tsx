import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ClinicalProcedureDetail } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useActiveOrganizationId } from '../shared/hooks';
import {
  useClinicalMembers,
  useClinicalOrganization,
  useProfessionalProfile,
} from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import {
  useClinicalMutationGuard,
  useProcedureResource,
} from '../shared/useClinicalDomainResource';
import { proceduresApi } from './proceduresApi';
import {
  PROCEDURE_KIND_LABEL,
  PROCEDURE_STATUS_LABEL,
  procedureOwnerName,
  procedurePatientName,
  procedureProfessionalName,
} from './procedureUtils';

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="clinical-domain-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || 'No registrado'}</dd>
    </div>
  );
}

function ProcedureFields({ item }: { item: ClinicalProcedureDetail }) {
  return (
    <dl className="clinical-domain-fields">
      <DetailValue label="Nombre" value={item.procedureName} />
      <DetailValue label="Indicación" value={item.indication} />
      <DetailValue label="Descripción" value={item.description} />
      <DetailValue label="Técnica" value={item.technique} />
      <DetailValue label="Hallazgos" value={item.findings} />
      <DetailValue label="Complicaciones" value={item.complications} />
      <DetailValue label="Recuperación" value={item.recoveryNotes} />
      <DetailValue label="Plan posoperatorio" value={item.postoperativePlan} />
      <DetailValue label="Notas" value={item.notes} />
    </dl>
  );
}

// Historical snapshots are the source of identity after finalization; live summaries are shown only on Drafts.
export function ProcedureDetailPage() {
  const { patientId, procedureId } = useParams<{ patientId: string; procedureId: string }>();
  const canRead = useCan(PERMISSION.PROCEDURES_READ);
  const canUpdateDraft = useCan(PERMISSION.PROCEDURES_UPDATE_DRAFT);
  const canFinalize = useCan(PERMISSION.PROCEDURES_FINALIZE);
  const canVoid = useCan(PERMISSION.PROCEDURES_VOID);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const procedure = useProcedureResource(procedureId, canRead);
  const mutationGuard = useClinicalMutationGuard();
  const organizationId = useActiveOrganizationId();
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const item = procedure.data;
  const isResponsible = Boolean(
    item && activeMembership?.id === item.responsiblePractitionerMembershipId,
  );
  const profile = useProfessionalProfile(
    Boolean(
      item && canFinalize && isResponsible && activeMembership?.clinicalRole === 'PRACTITIONER',
    ),
  );
  const assistantId = item?.kind === 'SURGERY' ? item.surgeryDetail?.assistantMembershipId : null;
  const assistantMembers = useClinicalMembers(
    Boolean(item && canFinalize && isResponsible && item.status === 'DRAFT' && assistantId),
  );
  const assignedAssistant = assistantMembers.data?.data.find(
    (member) => member.membershipId === assistantId,
  );
  const assistantProfileMissing = Boolean(
    assistantId && (!assignedAssistant || !assignedAssistant.profileConfigured),
  );
  const profileConfigured = Boolean(profile.data?.displayName.trim());
  const parentVoided = item?.parentEncounterStatus === 'VOIDED';
  const patientArchived = item?.patient.status === 'ARCHIVED';
  const timezone = organization.data?.timezone ?? 'UTC';
  const canFinalizeThis = Boolean(
    item &&
    item.status === 'DRAFT' &&
    canFinalize &&
    isResponsible &&
    !parentVoided &&
    !patientArchived &&
    profileConfigured &&
    !profile.error &&
    !assistantProfileMissing &&
    !assistantMembers.loading &&
    !assistantMembers.error &&
    item.procedureName?.trim() &&
    item.performedAt,
  );

  // Tenant switches dismiss action dialogs and remove any draft reason or prior error.
  useEffect(() => {
    setFinalizeOpen(false);
    setVoidOpen(false);
    setVoidReason('');
    setActionError(null);
    setPending(false);
  }, [organizationId]);

  async function runAction(action: 'finalize' | 'void') {
    if (!item || pending) return;
    setPending(true);
    setActionError(null);
    try {
      if (action === 'finalize')
        await proceduresApi.finalize(
          item.id,
          { expectedVersion: item.version },
          mutationGuard.signal(),
        );
      else
        await proceduresApi.void(
          item.id,
          { expectedVersion: item.version, reason: voidReason.trim() },
          mutationGuard.signal(),
        );
      if (mutationGuard.isCurrent()) {
        setFinalizeOpen(false);
        setVoidOpen(false);
        setVoidReason('');
        procedure.reload();
      }
    } catch (error) {
      if (mutationGuard.isCurrent()) setActionError(error);
    } finally {
      if (mutationGuard.isCurrent()) setPending(false);
    }
  }

  if (!patientId || !procedureId)
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  if (!canRead)
    return (
      <ResourceError
        error={new ApiError('No tienes permiso para consultar este procedimiento.', 403)}
      />
    );
  if (organization.loading || procedure.loading || profile.loading || assistantMembers.loading)
    return <LoadingState label="Cargando procedimiento" />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (procedure.error || !item || item.patientId !== patientId)
    return (
      <ResourceError
        error={procedure.error ?? new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')}
        onRetry={procedure.reload}
      />
    );

  const assistantName =
    item.status === 'DRAFT'
      ? item.surgeryDetail?.assistant?.displayName?.trim() || 'Sin asistente asignado'
      : item.surgeryDetail?.assistantDisplayNameSnapshot?.trim() ||
        'Snapshot de asistente no disponible';

  return (
    <div className="page-stack clinical-page clinical-domain-page">
      <PageHeader
        eyebrow={item.kind === 'SURGERY' ? 'Cirugía' : 'Procedimiento'}
        title={item.procedureName || PROCEDURE_KIND_LABEL[item.kind]}
        description={`${procedurePatientName(item)} · ${formatDateTime(item.performedAt, timezone)}`}
        action={
          <span className="page-header__actions">
            {item.status === 'DRAFT' && canUpdateDraft && !parentVoided && !patientArchived ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/procedimientos/${item.id}/editar`}
              >
                Editar borrador
              </Button>
            ) : null}
            {canFinalizeThis ? (
              <Button type="button" onClick={() => setFinalizeOpen(true)}>
                Finalizar
              </Button>
            ) : null}
            {item.status === 'FINALIZED' && canVoid ? (
              <Button type="button" variant="danger" onClick={() => setVoidOpen(true)}>
                Anular registro
              </Button>
            ) : null}
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/procedimientos`}
              variant="secondary"
            >
              Volver al listado
            </Button>
          </span>
        }
      />
      {item.status === 'DRAFT' && parentVoided ? (
        <Alert tone="warning" role="status">
          La consulta relacionada fue anulada. Este borrador no puede finalizarse.
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && patientArchived ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. El borrador se conserva para consulta histórica y no admite
          cambios ni finalización.
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && canFinalize && !isResponsible ? (
        <Alert tone="info" role="status">
          Solo el profesional responsable asignado
          {item.responsiblePractitioner?.displayName
            ? ` (${item.responsiblePractitioner.displayName})`
            : ''}{' '}
          puede finalizar este registro.
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      isResponsible &&
      assistantId &&
      assistantMembers.error ? (
        <Alert tone="warning" role="status">
          No se pudo verificar el perfil del asistente asignado.{' '}
          <button className="link-button" type="button" onClick={assistantMembers.reload}>
            Reintentar verificación
          </button>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      isResponsible &&
      assistantId &&
      !assistantMembers.error &&
      assistantProfileMissing ? (
        <Alert tone="warning" role="status">
          El asistente asignado debe completar su perfil profesional antes de finalizar.
          {assistantId === activeMembership?.id ? (
            <>
              {' '}
              <Link to="/perfil/profesional">Configurar mi perfil profesional</Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      {item.status === 'DRAFT' && canFinalize && isResponsible && profile.error ? (
        <Alert tone="warning" role="status">
          No se pudo verificar tu perfil profesional.{' '}
          <button className="link-button" type="button" onClick={profile.reload}>
            Reintentar verificación
          </button>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      isResponsible &&
      !profile.error &&
      !profileConfigured ? (
        <Alert tone="warning" role="status">
          Completa tu perfil profesional antes de finalizar.{' '}
          <Link to="/perfil/profesional">Configurar perfil profesional</Link>
        </Alert>
      ) : null}
      {item.status === 'DRAFT' &&
      canFinalize &&
      (!item.procedureName?.trim() || !item.performedAt) ? (
        <Alert tone="info" role="status">
          Para finalizar, completa el nombre del procedimiento y la fecha/hora realizada.
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {actionError instanceof ApiError && actionError.code === 'PROCEDURE_STALE' ? (
            <>
              El registro cambió en otra sesión. No se aplicó la acción.{' '}
              <button className="link-button" type="button" onClick={() => procedure.reload()}>
                Recargar versión actual
              </button>
            </>
          ) : (
            errorMessage(actionError, 'No se pudo completar la acción.')
          )}
        </Alert>
      ) : null}
      <Card className="clinical-domain-status">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Estado del registro</p>
            <h2>{PROCEDURE_STATUS_LABEL[item.status]}</h2>
          </div>
          <Badge
            tone={
              item.status === 'FINALIZED'
                ? 'success'
                : item.status === 'VOIDED'
                  ? 'danger'
                  : 'warning'
            }
          >
            {PROCEDURE_STATUS_LABEL[item.status]}
          </Badge>
        </div>
        <p className="clinical-meta">
          Tipo: {PROCEDURE_KIND_LABEL[item.kind]} · Versión {item.version}
        </p>
        {item.status === 'FINALIZED' ? (
          <p className="clinical-meta">
            Finalizado {formatDateTime(item.finalizedAt, timezone)} ·{' '}
            {item.professionalDisplayNameSnapshot || 'Profesional histórico no disponible'}
            {item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}
          </p>
        ) : null}
        {item.status === 'VOIDED' ? (
          <>
            <p className="clinical-meta">Anulado {formatDateTime(item.voidedAt, timezone)}</p>
            <DetailValue label="Motivo de anulación" value={item.voidReason} />
          </>
        ) : null}
        {parentVoided ? (
          <Alert tone="warning" role="status">
            La consulta clínica asociada fue anulada. El estado de este procedimiento se mantiene
            por separado.
          </Alert>
        ) : null}
      </Card>
      <Card>
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Registro clínico</p>
            <h2>Datos del procedimiento</h2>
          </div>
        </div>
        <dl className="clinical-domain-fields">
          <DetailValue label="Paciente" value={procedurePatientName(item)} />
          <DetailValue label="Propietario histórico" value={procedureOwnerName(item)} />
          <DetailValue
            label="Profesional responsable"
            value={`${procedureProfessionalName(item)}${item.status !== 'DRAFT' && item.professionalLicenseSnapshot ? ` · ${item.professionalLicenseSnapshot}` : ''}`}
          />
          <DetailValue label="Realizado" value={formatDateTime(item.performedAt, timezone)} />
          <DetailValue label="Consulta relacionada" value={item.clinicalEncounterId} />
          <DetailValue
            label="Estado de la consulta"
            value={
              item.parentEncounterStatus === 'VOIDED'
                ? 'Anulada'
                : item.parentEncounterStatus === 'FINALIZED'
                  ? 'Finalizada'
                  : 'Borrador'
            }
          />
        </dl>
        <ProcedureFields item={item} />
        {canReadEncounter ? (
          <Link to={`/pacientes/${patientId}/historia/encuentros/${item.clinicalEncounterId}`}>
            Abrir consulta relacionada
          </Link>
        ) : null}
      </Card>
      {item.kind === 'SURGERY' && item.surgeryDetail ? (
        <Card>
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Detalle de cirugía</p>
              <h2>Información quirúrgica</h2>
            </div>
          </div>
          <dl className="clinical-domain-fields">
            <DetailValue label="Área quirúrgica" value={item.surgeryDetail.surgicalArea} />
            <DetailValue label="Lado" value={item.surgeryDetail.surgicalSide} />
            <DetailValue label="Sangrado" value={item.surgeryDetail.bleedingNotes} />
            <DetailValue label="Cierre" value={item.surgeryDetail.closureNotes} />
            <DetailValue label="Asistente" value={assistantName} />
            {item.status !== 'DRAFT' ? (
              <DetailValue
                label="Matrícula del responsable"
                value={item.professionalLicenseSnapshot}
              />
            ) : null}
          </dl>
        </Card>
      ) : null}
      <Modal
        open={finalizeOpen}
        onClose={() => {
          if (!pending) setFinalizeOpen(false);
        }}
        eyebrow="Revisión clínica"
        title="Finalizar procedimiento"
        description="Confirma que el registro es correcto. Después de finalizar dejará de ser editable."
      >
        <dl className="clinical-domain-fields">
          <DetailValue label="Paciente" value={procedurePatientName(item)} />
          <DetailValue label="Tipo" value={PROCEDURE_KIND_LABEL[item.kind]} />
          <DetailValue label="Nombre" value={item.procedureName} />
          <DetailValue label="Fecha" value={formatDateTime(item.performedAt, timezone)} />
          <DetailValue label="Responsable" value={procedureProfessionalName(item)} />
          {item.kind === 'SURGERY' ? <DetailValue label="Asistente" value={assistantName} /> : null}
          <DetailValue label="Versión revisada" value={String(item.version)} />
        </dl>
        <Alert tone="warning" role="status">
          Al finalizar, este registro clínico dejará de ser editable.
        </Alert>
        <div className="modal-actions">
          <Button variant="secondary" disabled={pending} onClick={() => setFinalizeOpen(false)}>
            Revisar después
          </Button>
          <Button disabled={pending} onClick={() => void runAction('finalize')}>
            {pending ? 'Finalizando…' : 'Confirmar finalización'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={voidOpen}
        onClose={() => {
          if (!pending) setVoidOpen(false);
        }}
        eyebrow="Corrección histórica"
        title="Anular procedimiento"
        description="El registro, sus datos y snapshots se conservarán en la historia clínica."
      >
        <FormField label="Motivo de anulación *" htmlFor="procedure-void-reason">
          <textarea
            id="procedure-void-reason"
            className="input input--textarea"
            value={voidReason}
            maxLength={1000}
            disabled={pending}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </FormField>
        <div className="modal-actions">
          <Button variant="secondary" disabled={pending} onClick={() => setVoidOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={pending || !voidReason.trim()}
            onClick={() => void runAction('void')}
          >
            {pending ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
