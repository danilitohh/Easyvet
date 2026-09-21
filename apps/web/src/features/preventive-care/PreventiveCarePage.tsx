import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { AccessDeniedPage } from '../../pages/AccessDeniedPage';
import { ApiError } from '../../services/apiClient';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { ResourceError, StatusBadge } from '../shared/ResourceFeedback';
import { usePatient } from '../patients/usePatients';
import { useClinicalOrganization } from '../clinical/useClinical';
import { DewormingListSection } from './DewormingListSection';
import { VaccinationListSection } from './VaccinationListSection';

// The combined route is an OR permission boundary; each child section keeps its own permission.
export function PreventiveCarePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const canReadVaccinations = useCan(PERMISSION.VACCINATIONS_READ);
  const canReadDewormings = useCan(PERMISSION.DEWORMINGS_READ);
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const organization = useClinicalOrganization();
  const patient = usePatient(canReadPatients ? patientId : undefined);
  const canReadAny = canReadVaccinations || canReadDewormings;
  const timezone = organization.data?.timezone ?? 'UTC';
  const patientData = patient.patient;

  if (!canReadAny) return <AccessDeniedPage />;
  if (!patientId) {
    return (
      <ResourceError error={new ApiError('Paciente no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }
  if (organization.loading || (canReadPatients && patient.loading)) {
    return (
      <div className="page-stack clinical-page">
        <LoadingState label="Cargando cuidado preventivo" />
      </div>
    );
  }
  if (organization.error)
    return <ResourceError error={organization.error} onRetry={organization.reload} />;
  if (canReadPatients && patient.error)
    return <ResourceError error={patient.error} onRetry={patient.reload} />;

  return (
    <div className="page-stack clinical-page preventive-page">
      <PageHeader
        eyebrow="Historia clínica"
        title="Cuidado preventivo"
        description="Consulta histórica de vacunaciones y desparasitaciones, sin operaciones desde esta vista."
        action={
          <Link className="button button--secondary" to={`/pacientes/${patientId}/historia`}>
            Volver a historia
          </Link>
        }
      />
      <Card className="clinical-summary-card preventive-patient-summary">
        <div className="clinical-patient-summary">
          <div>
            <p className="section-kicker">Paciente</p>
            <h2>{patientData?.name ?? 'Paciente clínico'}</h2>
            <p>
              {patientData
                ? `${patientData.species}${patientData.breed ? ` · ${patientData.breed}` : ''}`
                : 'Identidad disponible según los permisos de la organización.'}
            </p>
          </div>
          {patientData ? (
            <StatusBadge status={patientData.status} />
          ) : (
            <Badge>Lectura clínica</Badge>
          )}
        </div>
      </Card>
      <div className="preventive-sections">
        {canReadVaccinations ? (
          <VaccinationListSection patientId={patientId} timezone={timezone} />
        ) : null}
        {canReadDewormings ? (
          <DewormingListSection patientId={patientId} timezone={timezone} />
        ) : null}
      </div>
    </div>
  );
}
