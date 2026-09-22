import type { VaccinationDetail } from '@veterinary-saas/contracts';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { DocumentGenerationAction } from '../documents/DocumentGenerationAction';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useVaccination } from './useVaccinations';
import { PreventiveDetailActions } from './PreventiveDetailActions';
import {
  administeredByDisplay,
  formatCivilDate,
  historicalPatientDisplay,
  professionalDisplay,
} from './preventiveUtils';
import {
  ArchivedPatientBadge,
  ParentEncounterNotice,
  PreventiveLifecycleNotice,
  PreventiveStatusBadge,
  ReadonlyField,
} from './PreventivePrimitives';

function VaccinationApplication({ item }: { item: VaccinationDetail }) {
  return (
    <Card className="detail-card">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Aplicación</p>
          <h2>Datos de la vacuna</h2>
        </div>
      </div>
      <dl className="detail-list">
        <ReadonlyField label="Fecha de aplicación" value={formatCivilDate(item.administeredOn)} />
        <ReadonlyField label="Vacuna" value={item.vaccineName} />
        <ReadonlyField label="Tipo de vacuna" value={item.vaccineType} />
        <ReadonlyField label="Vía" value={item.route} />
        <ReadonlyField label="Laboratorio" value={item.laboratoryName} />
        <ReadonlyField label="Lote" value={item.lotNumber} />
        <ReadonlyField label="Vencimiento del producto" value={formatCivilDate(item.expiryOn)} />
        <ReadonlyField label="Dosis" value={item.doseText} />
        <ReadonlyField label="Próxima dosis" value={formatCivilDate(item.nextDueOn)} />
      </dl>
      <ReadonlyField label="Notas" value={item.notes} />
    </Card>
  );
}

function VaccinationIdentity({ item }: { item: VaccinationDetail }) {
  const historical = item.status !== 'DRAFT';
  const responsible = professionalDisplay(
    item.status,
    item.professionalDisplayNameSnapshot,
    item.responsiblePractitioner?.displayName,
  );
  const responsibleLicense = historical
    ? item.professionalLicenseSnapshot
    : item.responsiblePractitioner?.licenseNumber;
  const administeredBy = administeredByDisplay(
    item.status,
    item.administeredByDisplayNameSnapshot,
    item.administeredBy?.displayName,
  );
  return (
    <div className="detail-grid">
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Identidad clínica</p>
            <h2>Paciente y responsable histórico</h2>
          </div>
          <ArchivedPatientBadge status={item.patient.status} />
        </div>
        <dl className="detail-list">
          <div>
            <dt>{historical ? 'Paciente al registrar' : 'Paciente'}</dt>
            <dd>
              {historicalPatientDisplay(item.status, item.patientNameSnapshot, item.patient.name)}
            </dd>
          </div>
          {historical && item.patientNameSnapshot ? (
            <div>
              <dt>Paciente actual</dt>
              <dd>{item.patient.name}</dd>
            </div>
          ) : null}
          {historical ? (
            <ReadonlyField
              label="Responsable al momento de la atención"
              value={item.ownerDisplayNameSnapshot}
            />
          ) : null}
        </dl>
      </Card>
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Autoría clínica</p>
            <h2>Profesionales</h2>
          </div>
        </div>
        <dl className="detail-list">
          <ReadonlyField label="Profesional responsable" value={responsible} />
          <ReadonlyField label="Matrícula o registro" value={responsibleLicense} />
          <ReadonlyField label="Administrado por" value={administeredBy} />
        </dl>
      </Card>
    </div>
  );
}

export function VaccinationDetailPage() {
  const { patientId, vaccinationId } = useParams<{
    patientId: string;
    vaccinationId: string;
  }>();
  const canRead = useCan(PERMISSION.VACCINATIONS_READ);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const organization = useClinicalOrganization();
  const vaccination = useVaccination(vaccinationId, canRead);
  const timezone = organization.data?.timezone ?? 'UTC';

  if (!canRead) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId || !vaccinationId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (vaccination.loading || organization.loading) {
    return (
      <div className="page-stack clinical-page">
        <LoadingState label="Cargando detalle de vacunación" />
      </div>
    );
  }
  if (vaccination.error)
    return <ResourceError error={vaccination.error} onRetry={vaccination.reload} />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (!vaccination.data || vaccination.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  const item = vaccination.data;
  return (
    <div className="page-stack clinical-page preventive-page">
      <PageHeader
        eyebrow="Cuidado preventivo · Vacunación"
        title={item.vaccineName || 'Vacunación'}
        description={`${item.patient.name} · ${item.status === 'DRAFT' ? 'Borrador' : item.status === 'FINALIZED' ? 'Finalizado' : 'Anulado'}`}
        action={
          <>
            <PreventiveDetailActions
              kind="vaccination"
              item={item}
              patientId={patientId}
              reload={vaccination.reload}
            />
            <ButtonBack
              to={`/pacientes/${patientId}/historia/preventivos`}
              label="Volver a cuidado preventivo"
            />
          </>
        }
      />
      <DocumentGenerationAction
        documentType="VACCINATION_CERTIFICATE"
        sourceId={item.id}
        sourceStatus={item.status}
      />
      <Card className="preventive-status-panel">
        <div className="preventive-status-panel__top">
          <div>
            <p className="section-kicker">Estado del registro</p>
            <h2>
              {item.status === 'DRAFT'
                ? 'Borrador'
                : item.status === 'FINALIZED'
                  ? 'Finalizado'
                  : 'Anulado'}
            </h2>
          </div>
          <PreventiveStatusBadge status={item.status} />
        </div>
        <PreventiveLifecycleNotice
          status={item.status}
          finalizedAt={item.finalizedAt}
          voidedAt={item.voidedAt}
          voidReason={item.voidReason}
          timezone={timezone}
        />
        <ParentEncounterNotice
          parentEncounterStatus={item.parentEncounterStatus}
          status={item.status}
        />
      </Card>
      <VaccinationApplication item={item} />
      <VaccinationIdentity item={item} />
      <Card className="detail-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Consulta relacionada</p>
            <h2>Encuentro clínico padre</h2>
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
        <dl className="detail-list preventive-timestamps">
          <ReadonlyField label="Creada" value={formatDateTime(item.createdAt, timezone)} />
          <ReadonlyField label="Actualizada" value={formatDateTime(item.updatedAt, timezone)} />
          {item.finalizedAt ? (
            <ReadonlyField label="Finalizada" value={formatDateTime(item.finalizedAt, timezone)} />
          ) : null}
          {item.voidedAt ? (
            <ReadonlyField label="Anulada" value={formatDateTime(item.voidedAt, timezone)} />
          ) : null}
        </dl>
      </Card>
    </div>
  );
}

function ButtonBack({ to, label }: { to: string; label: string }) {
  return (
    <Link className="button button--secondary" to={to}>
      {label}
    </Link>
  );
}
