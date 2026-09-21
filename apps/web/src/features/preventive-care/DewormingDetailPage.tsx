import type { DewormingDetail } from '@veterinary-saas/contracts';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useDeworming } from './useDewormings';
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

function DewormingApplication({ item }: { item: DewormingDetail }) {
  return (
    <Card className="detail-card">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Aplicación</p>
          <h2>Datos de la desparasitación</h2>
        </div>
      </div>
      <dl className="detail-list">
        <ReadonlyField label="Fecha de aplicación" value={formatCivilDate(item.administeredOn)} />
        <ReadonlyField label="Producto" value={item.productName} />
        <ReadonlyField label="Tipo de desparasitación" value={item.dewormingType} />
        <ReadonlyField label="Dosis" value={item.doseText} />
        <ReadonlyField label="Próxima desparasitación" value={formatCivilDate(item.nextDueOn)} />
      </dl>
      <ReadonlyField label="Notas" value={item.notes} />
    </Card>
  );
}

function DewormingIdentity({ item }: { item: DewormingDetail }) {
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

// Deworming detail stays a separate read-only surface so vaccination-only fields never leak here.
export function DewormingDetailPage() {
  const { patientId, dewormingId } = useParams<{
    patientId: string;
    dewormingId: string;
  }>();
  const canRead = useCan(PERMISSION.DEWORMINGS_READ);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const organization = useClinicalOrganization();
  const deworming = useDeworming(dewormingId, canRead);
  const timezone = organization.data?.timezone ?? 'UTC';

  if (!canRead) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId || !dewormingId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (deworming.loading || organization.loading) {
    return (
      <div className="page-stack clinical-page">
        <LoadingState label="Cargando detalle de desparasitación" />
      </div>
    );
  }
  if (deworming.error) return <ResourceError error={deworming.error} onRetry={deworming.reload} />;
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (!deworming.data || deworming.data.patientId !== patientId) {
    return (
      <ResourceError error={new ApiError('Recurso no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  const item = deworming.data;
  return (
    <div className="page-stack clinical-page preventive-page">
      <PageHeader
        eyebrow="Cuidado preventivo · Desparasitación"
        title={item.productName || 'Desparasitación'}
        description={`${item.patient.name} · ${item.status === 'DRAFT' ? 'Borrador' : item.status === 'FINALIZED' ? 'Finalizado' : 'Anulado'}`}
        action={
          <>
            <PreventiveDetailActions
              kind="deworming"
              item={item}
              patientId={patientId}
              reload={deworming.reload}
            />
            <Link
              className="button button--secondary"
              to={`/pacientes/${patientId}/historia/preventivos`}
            >
              Volver a cuidado preventivo
            </Link>
          </>
        }
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
      <DewormingApplication item={item} />
      <DewormingIdentity item={item} />
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
