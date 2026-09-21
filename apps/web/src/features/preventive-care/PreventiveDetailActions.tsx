import type { DewormingDetail, VaccinationDetail } from '@veterinary-saas/contracts';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { dewormingsApi } from './dewormingsApi';
import { vaccinationsApi } from './vaccinationsApi';

type Kind = 'vaccination' | 'deworming';
type Item = VaccinationDetail | DewormingDetail;

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
function label(kind: Kind) {
  return kind === 'vaccination' ? 'vacunación' : 'desparasitación';
}
function noun(kind: Kind) {
  return kind === 'vaccination' ? 'vacuna' : 'producto';
}
function staleCode(kind: Kind) {
  return kind === 'vaccination' ? 'VACCINATION_STALE' : 'DEWORMING_STALE';
}

// Detail actions own lifecycle mutations so list and encounter surfaces remain read-only.
export function PreventiveDetailActions({
  kind,
  item,
  patientId,
  reload,
}: {
  kind: Kind;
  item: Item;
  patientId: string;
  reload: () => void;
}) {
  const { activeMembership } = useAuth();
  const organization = useClinicalOrganization();
  const canUpdate = useCan(
    kind === 'vaccination'
      ? PERMISSION.VACCINATIONS_UPDATE_DRAFT
      : PERMISSION.DEWORMINGS_UPDATE_DRAFT,
  );
  const canFinalize = useCan(
    kind === 'vaccination' ? PERMISSION.VACCINATIONS_FINALIZE : PERMISSION.DEWORMINGS_FINALIZE,
  );
  const canVoid = useCan(
    kind === 'vaccination' ? PERMISSION.VACCINATIONS_VOID : PERMISSION.DEWORMINGS_VOID,
  );
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const [actionError, setActionError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const mutationRef = useRef<AbortController | null>(null);
  const organizationId = activeMembership?.organization.id;

  useEffect(() => {
    mutationRef.current?.abort();
    mutationRef.current = null;
    setFinalizeOpen(false);
    setVoidOpen(false);
    setVoidReason('');
    setValidationError('');
    setActionError(null);
    setPending(false);
    return () => mutationRef.current?.abort();
  }, [organizationId]);

  const isPractitioner = activeMembership?.clinicalRole === 'PRACTITIONER';
  const responsible = item.responsiblePractitioner;
  const isResponsible = activeMembership?.id === item.responsiblePractitionerMembershipId;
  const responsibleMissing = !item.responsiblePractitionerMembershipId;
  const responsibleProfileMissing = Boolean(responsible && !responsible.displayName?.trim());
  const currentProfileMissing = isResponsible && responsibleProfileMissing;
  const administeredMissing = Boolean(
    item.administeredByMembershipId && !item.administeredBy?.displayName?.trim(),
  );
  const administeredIsCurrent = activeMembership?.id === item.administeredByMembershipId;
  const name =
    kind === 'vaccination'
      ? (item as VaccinationDetail).vaccineName
      : (item as DewormingDetail).productName;
  const vaccinationItem = item as VaccinationDetail;
  const expiryWarning =
    kind === 'vaccination' &&
    Boolean(
      vaccinationItem.expiryOn &&
      item.administeredOn &&
      vaccinationItem.expiryOn < item.administeredOn,
    );
  const canEdit = item.status === 'DRAFT' && canUpdate && item.parentEncounterStatus !== 'VOIDED';
  const canOpenFinalize =
    item.status === 'DRAFT' &&
    canFinalize &&
    isPractitioner &&
    isResponsible &&
    item.parentEncounterStatus !== 'VOIDED';
  const canOpenVoid = item.status === 'FINALIZED' && canVoid && isPractitioner;

  async function finalize() {
    if (pending) return;
    const missing = [
      !item.administeredOn ? 'La fecha de aplicación es obligatoria.' : '',
      !name?.trim() ? `El nombre de ${noun(kind)} es obligatorio.` : '',
      responsibleMissing ? 'Selecciona un Practitioner responsable.' : '',
      currentProfileMissing ? 'Completa tu perfil profesional antes de finalizar.' : '',
      !currentProfileMissing && responsibleProfileMissing
        ? 'El profesional responsable debe completar su perfil profesional.'
        : '',
      administeredMissing
        ? 'El miembro registrado como administrador debe completar su perfil profesional.'
        : '',
    ].filter(Boolean);
    if (missing.length) {
      setValidationError(missing.join(' '));
      return;
    }
    const controller = new AbortController();
    mutationRef.current?.abort();
    mutationRef.current = controller;
    setPending(true);
    setActionError(null);
    try {
      if (kind === 'vaccination')
        await vaccinationsApi.finalize(
          item.id,
          { expectedVersion: item.version },
          controller.signal,
        );
      else
        await dewormingsApi.finalize(item.id, { expectedVersion: item.version }, controller.signal);
      if (!controller.signal.aborted) {
        setFinalizeOpen(false);
        reload();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        setActionError(error);
        setFinalizeOpen(false);
        reload();
      }
    } finally {
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        setPending(false);
      }
    }
  }

  async function voidRecord() {
    const reason = voidReason.trim();
    if (!reason || pending) {
      setValidationError('Escribe un motivo de anulación.');
      return;
    }
    const controller = new AbortController();
    mutationRef.current?.abort();
    mutationRef.current = controller;
    setPending(true);
    setActionError(null);
    try {
      if (kind === 'vaccination')
        await vaccinationsApi.void(
          item.id,
          { expectedVersion: item.version, reason },
          controller.signal,
        );
      else
        await dewormingsApi.void(
          item.id,
          { expectedVersion: item.version, reason },
          controller.signal,
        );
      if (!controller.signal.aborted) {
        setVoidOpen(false);
        setVoidReason('');
        reload();
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted && !isAbortError(error)) setActionError(error);
    } finally {
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        setPending(false);
      }
    }
  }

  const editPath = `/pacientes/${patientId}/historia/preventivos/${kind === 'vaccination' ? 'vacunas' : 'desparasitaciones'}/${item.id}/editar`;
  return (
    <>
      <span className="page-header__actions">
        {canEdit ? (
          <Button as={Link} to={editPath}>
            Editar borrador
          </Button>
        ) : null}
        {canOpenFinalize ? (
          <Button
            type="button"
            onClick={() => {
              setValidationError('');
              setFinalizeOpen(true);
            }}
          >
            Finalizar {label(kind)}
          </Button>
        ) : null}
        {canOpenVoid ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setValidationError('');
              setVoidOpen(true);
            }}
          >
            Anular {label(kind)}
          </Button>
        ) : null}
      </span>
      {item.status === 'DRAFT' && canFinalize ? (
        <div className="preventive-action-guidance">
          {responsibleMissing ? (
            <Alert tone="warning" role="status">
              Selecciona un Practitioner responsable antes de finalizar.
            </Alert>
          ) : null}
          {!responsibleMissing && !isResponsible ? (
            <Alert tone="info" role="status">
              Este registro debe ser finalizado por{' '}
              {responsible?.displayName || 'el Practitioner responsable'}.
            </Alert>
          ) : null}
          {isResponsible && currentProfileMissing ? (
            <Alert tone="warning" role="status">
              Completa tu perfil profesional antes de finalizar.{' '}
              <Link to="/perfil/profesional">Configurar perfil profesional</Link>
            </Alert>
          ) : null}
          {!isResponsible && !responsibleMissing && responsibleProfileMissing ? (
            <Alert tone="warning" role="status">
              El profesional responsable debe completar su perfil profesional.
            </Alert>
          ) : null}
          {administeredMissing ? (
            <Alert tone="warning" role="status">
              El miembro registrado como administrador debe completar su perfil profesional.
              {administeredIsCurrent ? (
                <>
                  {' '}
                  <Link to="/perfil/profesional">Configurar perfil profesional</Link>
                </>
              ) : null}
            </Alert>
          ) : null}
        </div>
      ) : null}
      {actionError ? (
        <Alert tone="error" role="alert">
          {errorMessage(actionError, 'No fue posible completar la operación.')}
          {actionError instanceof ApiError && actionError.code === staleCode(kind) ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setActionError(null);
                reload();
              }}
            >
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Modal
        open={finalizeOpen}
        title={`Revisar y finalizar ${label(kind)}`}
        description="Al finalizar, este registro dejará de ser editable."
        onClose={() => {
          if (!pending) setFinalizeOpen(false);
        }}
      >
        <div className="modal-summary">
          <p>
            <strong>Paciente:</strong> {item.patient.name}
          </p>
          <p>
            <strong>Encuentro:</strong> {item.encounter.id}
          </p>
          <p>
            <strong>Fecha de aplicación:</strong> {item.administeredOn || 'Sin definir'}
          </p>
          <p>
            <strong>{kind === 'vaccination' ? 'Vacuna' : 'Producto'}:</strong>{' '}
            {name || 'Sin definir'}
          </p>
          <p>
            <strong>Responsable:</strong> {responsible?.displayName || 'Sin asignar'}
          </p>
          {item.administeredBy ? (
            <p>
              <strong>Administrado por:</strong>{' '}
              {item.administeredBy.displayName || 'Perfil incompleto'}
            </p>
          ) : null}
          {kind === 'vaccination' && vaccinationItem.lotNumber ? (
            <p>
              <strong>Lote:</strong> {vaccinationItem.lotNumber}
            </p>
          ) : null}
          <p>
            <strong>Versión:</strong> {item.version}
          </p>
        </div>
        {expiryWarning ? (
          <Alert tone="warning" role="status">
            El vencimiento registrado es anterior a la fecha de aplicación. Se conservará como dato
            clínico.
          </Alert>
        ) : null}
        {validationError ? (
          <Alert tone="error" role="alert">
            {validationError}
          </Alert>
        ) : null}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setFinalizeOpen(false)}
            disabled={pending}
          >
            Volver
          </Button>
          <Button type="button" onClick={() => void finalize()} disabled={pending}>
            {pending ? 'Finalizando…' : 'Confirmar finalización'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={voidOpen}
        title={`Anular ${label(kind)}`}
        description="El registro seguirá conservado en la historia clínica y quedará marcado como anulado."
        onClose={() => {
          if (!pending) setVoidOpen(false);
        }}
      >
        <FormField
          label="Motivo de anulación"
          htmlFor="preventive-void-reason"
          hint="Explica por qué se anula este registro."
        >
          <TextInput
            id="preventive-void-reason"
            value={voidReason}
            maxLength={1000}
            onChange={(event) => setVoidReason(event.target.value)}
          />
        </FormField>
        {validationError ? (
          <Alert tone="error" role="alert">
            {validationError}
          </Alert>
        ) : null}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setVoidOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void voidRecord()}
            disabled={pending || !voidReason.trim()}
          >
            {pending ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </div>
      </Modal>
      {organization.error ? (
        <Alert tone="error" role="alert">
          No fue posible cargar la zona horaria de la organización.
        </Alert>
      ) : null}
    </>
  );
}
