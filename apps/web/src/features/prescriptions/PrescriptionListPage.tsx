import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { ResourceError } from '../shared/ResourceFeedback';
import { ApiError } from '../../services/apiClient';
import { useClinicalOrganization } from '../clinical/useClinical';
import { PrescriptionListSection } from './PrescriptionListSection';

// Patient prescription history is intentionally read-only until Fase 6D.3B.
export function PrescriptionListPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const canRead = useCan(PERMISSION.PRESCRIPTIONS_READ);
  const organization = useClinicalOrganization();

  if (!canRead) return <ResourceError error={new ApiError('Acceso denegado', 403)} />;
  if (!patientId) {
    return (
      <ResourceError error={new ApiError('Paciente no encontrado', 404, 'RESOURCE_NOT_FOUND')} />
    );
  }

  return (
    <div className="page-stack clinical-page prescription-page">
      <PageHeader
        eyebrow="Historia clínica"
        title="Prescripciones"
        description="Consulta histórica de las indicaciones asociadas a este paciente."
        action={
          <span className="page-header__actions">
            <Button as={Link} to={`/pacientes/${patientId}/historia`} variant="secondary">
              Volver a historia
            </Button>
          </span>
        }
      />
      {organization.error ? (
        <ResourceError error={organization.error} onRetry={organization.reload} />
      ) : (
        <PrescriptionListSection
          patientId={patientId}
          timezone={organization.data?.timezone ?? 'UTC'}
        />
      )}
    </div>
  );
}
