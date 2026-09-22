import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useClinicalOrganization } from '../clinical/useClinical';
import { formatDateTime } from '../clinical/clinicalUtils';
import { PaginationControls, ResourceError } from '../shared/ResourceFeedback';
import { useHospitalizationListResource } from '../shared/useClinicalDomainResource';

const STATUS_LABEL = {
  DRAFT: 'Borrador',
  ACTIVE: 'Hospitalizado',
  DISCHARGED: 'Alta',
  VOIDED: 'Anulado',
} as const;

// Renders the patient's hospitalization history as responsive cards instead of a wide table.
export function HospitalizationListPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const canRead = useCan(PERMISSION.HOSPITALIZATIONS_READ);
  const canCreate = useCan(PERMISSION.HOSPITALIZATIONS_CREATE);
  const organization = useClinicalOrganization();
  const [page, setPage] = useState(1);
  const resource = useHospitalizationListResource(patientId, page, canRead);

  return (
    <section className="page-stack hospitalization-page">
      <PageHeader
        eyebrow="Historia clínica · Hospitalización"
        title="Hospitalizaciones"
        description="Ingresos, evolución y altas conservados como episodios clínicos independientes."
        action={
          <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
            Volver a historia
          </Button>
        }
      />
      {!canRead ? (
        <Card>
          <EmptyState
            title="Acceso restringido"
            description="Tu membresía no puede consultar hospitalizaciones."
          />
        </Card>
      ) : resource.loading ? (
        <Card>
          <LoadingState label="Cargando hospitalizaciones" />
        </Card>
      ) : resource.error ? (
        <Card>
          <ResourceError error={resource.error} onRetry={resource.reload} />
        </Card>
      ) : (
        <Card className="hospitalization-list">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Episodios</p>
              <h2>Registro histórico</h2>
            </div>
            <Badge>{`${resource.data?.pagination.total ?? 0} registros`}</Badge>
          </div>
          {resource.data?.data.length ? (
            <div className="hospitalization-list__cards">
              {resource.data.data.map((episode) => (
                <Link
                  key={episode.id}
                  className="hospitalization-row"
                  to={`/pacientes/${patientId}/historia/hospitalizaciones/${episode.id}`}
                >
                  <span className="hospitalization-row__main">
                    <strong>
                      {episode.admissionReason || episode.diagnosis || 'Ingreso clínico'}
                    </strong>
                    <small>
                      {episode.admittedAt
                        ? formatDateTime(
                            episode.admittedAt,
                            organization.data?.timezone ?? 'America/Bogota',
                          )
                        : 'Fecha de ingreso pendiente'}
                      {episode.locationName ? ` · ${episode.locationName}` : ''}
                    </small>
                    <small>
                      {episode.patientNameSnapshot ?? 'Paciente'}
                      {episode.ownerDisplayNameSnapshot
                        ? ` · ${episode.ownerDisplayNameSnapshot}`
                        : ''}
                    </small>
                  </span>
                  <span
                    className={`hospitalization-status hospitalization-status--${episode.status.toLowerCase()}`}
                  >
                    {STATUS_LABEL[episode.status]}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <>
              <EmptyState
                title="No hay hospitalizaciones"
                description="Los ingresos creados desde un encuentro aparecerán aquí como historial."
                action={
                  canCreate ? (
                    <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
                      Abrir historia clínica
                    </Button>
                  ) : undefined
                }
              />
              {resource.data?.pagination.total === 0 && canCreate ? (
                <Alert tone="info" role="status">
                  Para iniciar un episodio, abre un encuentro clínico y crea el borrador desde allí.
                </Alert>
              ) : null}
            </>
          )}
          <PaginationControls
            page={resource.data?.pagination.page ?? 1}
            totalPages={resource.data?.pagination.totalPages ?? 0}
            onChange={setPage}
          />
        </Card>
      )}
    </section>
  );
}
