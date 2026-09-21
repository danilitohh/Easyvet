import type { PrescriptionSummary } from '@veterinary-saas/contracts';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import { usePatientPrescriptions } from './usePrescriptions';
import {
  compactId,
  historicalProfessional,
  prescriptionStatusLabel,
  prescriptionStatusTone,
} from './prescriptionsUtils';
import { formatDateTime } from '../clinical/clinicalUtils';

type PrescriptionListSectionProps = {
  patientId: string;
  encounterId?: string;
  timezone: string;
  compact?: boolean;
};

function PrescriptionRow({ item, timezone }: { item: PrescriptionSummary; timezone: string }) {
  const parentVoided = item.parentEncounterStatus === 'VOIDED';
  const professional = historicalProfessional(
    item.status,
    item.professionalDisplayNameSnapshot,
    item.prescribedBy?.displayName,
  );
  return (
    <Link
      className="prescription-list-row"
      to={`/pacientes/${item.patientId}/historia/prescripciones/${item.id}`}
    >
      <span className="prescription-list-row__main">
        <span className="prescription-list-row__title">
          <strong>Prescripción</strong>
          <span
            className={`clinical-status clinical-status--${prescriptionStatusTone(item.status)}`}
          >
            {prescriptionStatusLabel(item.status)}
          </span>
        </span>
        <span className="prescription-list-row__meta">
          Creada {formatDateTime(item.createdAt, timezone)} · {professional}
        </span>
        <span className="prescription-list-row__meta">
          {item.finalizedAt
            ? `Emitida ${formatDateTime(item.finalizedAt, timezone)}`
            : 'Aún sin fecha de emisión'}{' '}
          · {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'} · Consulta{' '}
          {compactId(item.clinicalEncounterId)}
        </span>
      </span>
      <span className="prescription-list-row__aside">
        {parentVoided ? <Badge tone="warning">Consulta anulada</Badge> : null}
        <span aria-hidden="true" className="prescription-list-row__arrow">
          →
        </span>
      </span>
    </Link>
  );
}

// Shared list surface keeps Patient history and Encounter detail on the same read-only contract.
export function PrescriptionListSection({
  patientId,
  encounterId,
  timezone,
  compact = false,
}: PrescriptionListSectionProps) {
  const canRead = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const [page, setPage] = useState(1);
  const state = usePatientPrescriptions(
    patientId,
    { page, pageSize: 20, ...(encounterId ? { clinicalEncounterId: encounterId } : {}) },
    canRead,
  );

  if (!canRead) return null;
  if (state.loading) {
    return (
      <Card className="prescription-list-card">
        <LoadingState label="Cargando prescripciones" />
      </Card>
    );
  }
  if (state.error) return <ResourceError error={state.error} onRetry={state.reload} />;

  const prescriptions = state.data?.data ?? [];
  const title = encounterId ? 'Prescripciones de esta consulta' : 'Prescripciones';
  if (!prescriptions.length) {
    return (
      <Card className="prescription-list-card">
        <EmptyState
          title={
            encounterId
              ? 'No hay prescripciones asociadas a esta consulta.'
              : 'Este paciente todavía no tiene prescripciones.'
          }
          description="Las prescripciones existentes aparecerán aquí en modo lectura."
        />
      </Card>
    );
  }

  return (
    <Card className={`prescription-list-card${compact ? ' prescription-list-card--compact' : ''}`}>
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Tratamiento indicado</p>
          <h2>{title}</h2>
        </div>
        <Badge>{`${state.data?.pagination.total ?? prescriptions.length} registros`}</Badge>
      </div>
      <div className="prescription-list" aria-label={title}>
        {prescriptions.map((item) => (
          <PrescriptionRow item={item} timezone={timezone} key={item.id} />
        ))}
      </div>
      <PaginationControls
        page={state.data?.pagination.page ?? 1}
        totalPages={state.data?.pagination.totalPages ?? 0}
        onChange={setPage}
      />
    </Card>
  );
}
