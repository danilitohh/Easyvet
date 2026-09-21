import type { ReactNode } from 'react';
import type { ClinicalEncounterStatus, PreventiveRecordStatus } from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../clinical/clinicalUtils';
import {
  formatCivilDate,
  PREVENTIVE_STATUS_LABEL,
  preventiveStatusTone,
  present,
} from './preventiveUtils';

export function PreventiveStatusBadge({ status }: { status: PreventiveRecordStatus }) {
  return (
    <span className={`clinical-status clinical-status--${preventiveStatusTone(status)}`}>
      {PREVENTIVE_STATUS_LABEL[status]}
    </span>
  );
}

export function CivilDateDisplay({
  label,
  value,
  empty = 'No registrada',
}: {
  label?: string;
  value: string | null | undefined;
  empty?: string;
}) {
  const formatted = formatCivilDate(value);
  if (!formatted) return label ? <ReadonlyField label={label} value={empty} /> : null;
  return label ? <ReadonlyField label={label} value={formatted} /> : <span>{formatted}</span>;
}

export function ReadonlyField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null | undefined;
  children?: ReactNode;
}) {
  if (!children && !present(value)) return null;
  return (
    <div className="clinical-field">
      <dt>{label}</dt>
      <dd className="clinical-prose">{children ?? value}</dd>
    </div>
  );
}

export function PreventiveLifecycleNotice({
  status,
  finalizedAt,
  voidedAt,
  voidReason,
  timezone,
}: {
  status: PreventiveRecordStatus;
  finalizedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  timezone: string;
}) {
  return (
    <div className="preventive-lifecycle-notice">
      {status === 'DRAFT' ? (
        <Alert tone="warning" role="status">
          Borrador — este registro preventivo aún no ha sido finalizado.
        </Alert>
      ) : null}
      {status === 'FINALIZED' && finalizedAt ? (
        <p className="clinical-meta">Finalizado {formatDateTime(finalizedAt, timezone)}</p>
      ) : null}
      {status === 'VOIDED' ? (
        <div className="preventive-voided-meta">
          {voidedAt ? (
            <p className="clinical-meta">Anulado {formatDateTime(voidedAt, timezone)}</p>
          ) : null}
          <ReadonlyField label="Motivo de anulación" value={voidReason} />
        </div>
      ) : null}
    </div>
  );
}

export function ParentEncounterNotice({
  parentEncounterStatus,
  status,
}: {
  parentEncounterStatus: ClinicalEncounterStatus;
  status: PreventiveRecordStatus;
}) {
  if (parentEncounterStatus !== 'VOIDED') return null;
  return (
    <Alert tone="warning" role="status">
      La consulta clínica asociada fue anulada.
      {status === 'DRAFT'
        ? ' Este borrador no puede continuar.'
        : ' El registro preventivo conserva su estado histórico.'}
    </Alert>
  );
}

export function ArchivedPatientBadge({ status }: { status: 'ACTIVE' | 'ARCHIVED' }) {
  return status === 'ARCHIVED' ? <Badge tone="warning">Paciente archivado</Badge> : null;
}
