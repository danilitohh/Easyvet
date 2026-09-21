import type { PrescriptionDetail } from '@veterinary-saas/contracts';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError } from '../shared/ResourceFeedback';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
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

// Read-only detail preserves historical snapshots and never exposes prescription mutations.
export function PrescriptionDetailPage() {
  const { patientId, prescriptionId } = useParams<{
    patientId: string;
    prescriptionId: string;
  }>();
  const canRead = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const canReadEncounter = useCan(PERMISSION.CLINICAL_ENCOUNTERS_READ);
  const organization = useClinicalOrganization();
  const prescription = usePrescription(prescriptionId, canRead);
  const timezone = organization.data?.timezone ?? 'UTC';

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
  const professional = historicalProfessional(
    item.status,
    item.professionalDisplayNameSnapshot,
    item.prescribedBy?.displayName,
  );
  const isHistorical = item.status !== 'DRAFT';
  return (
    <div className="page-stack clinical-page prescription-page">
      <PageHeader
        eyebrow="Historia clínica · Prescripción"
        title="Prescripción"
        description={`${item.patient.name} · ${prescriptionStatusLabel(item.status)}`}
        action={
          <span className="page-header__actions">
            <Link
              className="button button--secondary"
              to={`/pacientes/${patientId}/historia/prescripciones`}
            >
              Volver a prescripciones
            </Link>
          </span>
        }
      />
      <PrescriptionStatusPanel prescription={item} timezone={timezone} />
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
    </div>
  );
}
