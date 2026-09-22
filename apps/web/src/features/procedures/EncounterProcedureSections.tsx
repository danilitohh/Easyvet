import { Link } from 'react-router-dom';
import { useState } from 'react';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import {
  useAnesthesiaListResource,
  useProcedureListResource,
} from '../shared/useClinicalDomainResource';
import { formatDateTime } from '../clinical/clinicalUtils';
import { useClinicalOrganization } from '../clinical/useClinical';
import { PROCEDURE_KIND_LABEL, PROCEDURE_STATUS_LABEL } from './procedureUtils';

// Encounter panels call only domains the active membership is allowed to read and keep their states independent.
export function EncounterProcedureSections({
  patientId,
  encounterId,
  encounterStatus,
  patientStatus,
}: {
  patientId: string;
  encounterId: string;
  encounterStatus: 'DRAFT' | 'FINALIZED' | 'VOIDED';
  patientStatus: 'ACTIVE' | 'ARCHIVED';
}) {
  const [procedurePage, setProcedurePage] = useState(1);
  const [anesthesiaPage, setAnesthesiaPage] = useState(1);
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const canReadAnesthesia = useCan(PERMISSION.ANESTHESIA_READ);
  const canCreateProcedure = useCan(PERMISSION.PROCEDURES_CREATE);
  const canCreateAnesthesia = useCan(PERMISSION.ANESTHESIA_CREATE);
  const procedureList = useProcedureListResource(
    patientId,
    procedurePage,
    canReadProcedures,
    encounterId,
  );
  const anesthesiaList = useAnesthesiaListResource(
    patientId,
    anesthesiaPage,
    canReadAnesthesia,
    encounterId,
  );
  const timezone = useClinicalOrganization().data?.timezone ?? 'UTC';
  const canCreate = encounterStatus !== 'VOIDED' && patientStatus === 'ACTIVE';
  if (!canReadProcedures && !canReadAnesthesia) return null;
  return (
    <div className="clinical-domain-sections">
      {canReadProcedures ? (
        <Card className="clinical-domain-list">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Procedimientos</p>
              <h2>Procedimientos de esta consulta</h2>
            </div>
            {canCreateProcedure && canCreate ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/encuentros/${encounterId}/procedimientos/nuevo`}
              >
                Nuevo procedimiento
              </Button>
            ) : null}
          </div>
          {procedureList.loading ? (
            <LoadingState label="Cargando procedimientos de la consulta" />
          ) : procedureList.error ? (
            <ResourceError error={procedureList.error} onRetry={procedureList.reload} />
          ) : procedureList.data?.data.length ? (
            <div className="clinical-domain-rows">
              {procedureList.data.data.map((item) => (
                <Link
                  className="clinical-domain-row"
                  key={item.id}
                  to={`/pacientes/${patientId}/historia/procedimientos/${item.id}`}
                >
                  <span className="clinical-domain-row__main">
                    <strong>{item.procedureName || PROCEDURE_KIND_LABEL[item.kind]}</strong>
                    <small>
                      {PROCEDURE_KIND_LABEL[item.kind]} ·{' '}
                      {formatDateTime(item.performedAt, timezone)}
                    </small>
                  </span>
                  <span className="clinical-domain-row__aside">
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
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="clinical-muted">No hay procedimientos vinculados a esta consulta.</p>
          )}
          {procedureList.data ? (
            <PaginationControls
              page={procedureList.data.pagination.page}
              totalPages={procedureList.data.pagination.totalPages}
              onChange={setProcedurePage}
            />
          ) : null}
        </Card>
      ) : null}
      {canReadAnesthesia ? (
        <Card className="clinical-domain-list">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Anestesia</p>
              <h2>Registros anestésicos de esta consulta</h2>
            </div>
            {canCreateAnesthesia && canCreate ? (
              <Button
                as={Link}
                to={`/pacientes/${patientId}/historia/encuentros/${encounterId}/anestesias/nueva`}
              >
                Nuevo registro anestésico
              </Button>
            ) : null}
          </div>
          {anesthesiaList.loading ? (
            <LoadingState label="Cargando registros anestésicos de la consulta" />
          ) : anesthesiaList.error ? (
            <ResourceError error={anesthesiaList.error} onRetry={anesthesiaList.reload} />
          ) : anesthesiaList.data?.data.length ? (
            <div className="clinical-domain-rows">
              {anesthesiaList.data.data.map((item) => (
                <Link
                  className="clinical-domain-row"
                  key={item.id}
                  to={`/pacientes/${patientId}/historia/anestesias/${item.id}`}
                >
                  <span className="clinical-domain-row__main">
                    <strong>Registro anestésico</strong>
                    <small>
                      {formatDateTime(item.startedAt, timezone)} · {item.observationCount} lecturas
                    </small>
                  </span>
                  <span className="clinical-domain-row__aside">
                    <Badge
                      tone={
                        item.status === 'FINALIZED'
                          ? 'success'
                          : item.status === 'VOIDED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {item.status === 'DRAFT'
                        ? 'Borrador'
                        : item.status === 'FINALIZED'
                          ? 'Finalizado'
                          : 'Anulado'}
                    </Badge>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="clinical-muted">
              No hay registros anestésicos vinculados a esta consulta.
            </p>
          )}
          {anesthesiaList.data ? (
            <PaginationControls
              page={anesthesiaList.data.pagination.page}
              totalPages={anesthesiaList.data.pagination.totalPages}
              onChange={setAnesthesiaPage}
            />
          ) : null}
        </Card>
      ) : null}
      {encounterStatus === 'VOIDED' && (canCreateProcedure || canCreateAnesthesia) ? (
        <Alert tone="warning" role="status">
          No se pueden crear registros clínicos desde una consulta anulada.
        </Alert>
      ) : null}
    </div>
  );
}
