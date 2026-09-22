import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ClinicalProcedureSummary } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useClinicalPractitioners } from '../clinical/useClinical';
import { useActiveOrganizationId } from '../shared/hooks';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';
import { proceduresApi } from '../procedures/proceduresApi';
import './documents.css';

type ConsentDraftFields = {
  title: string;
  purposeText: string;
  risksText: string;
  benefitsText: string;
  alternativesText: string;
  estimatedCostText: string;
  declarationText: string;
  responsiblePractitionerMembershipId: string;
  clinicalProcedureId: string;
};

const EMPTY_FIELDS: ConsentDraftFields = {
  title: '',
  purposeText: '',
  risksText: '',
  benefitsText: '',
  alternativesText: '',
  estimatedCostText: '',
  declarationText: '',
  responsiblePractitionerMembershipId: '',
  clinicalProcedureId: '',
};

const TEXT_FIELDS: Array<{
  key: Exclude<
    keyof ConsentDraftFields,
    'responsiblePractitionerMembershipId' | 'clinicalProcedureId'
  >;
  label: string;
  maxLength: number;
}> = [
  { key: 'title', label: 'Título', maxLength: 300 },
  { key: 'purposeText', label: 'Propósito', maxLength: 10000 },
  { key: 'risksText', label: 'Riesgos', maxLength: 10000 },
  { key: 'benefitsText', label: 'Beneficios', maxLength: 10000 },
  { key: 'alternativesText', label: 'Alternativas', maxLength: 10000 },
  { key: 'estimatedCostText', label: 'Costo estimado', maxLength: 2000 },
  { key: 'declarationText', label: 'Declaración de aceptación', maxLength: 10000 },
];

// Draft editor sends explicit CAS versions and keeps consent text as plain text from input through rendering.
export function ConsentFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const {
    patientId = '',
    encounterId = '',
    consentId = '',
  } = useParams<{ patientId: string; encounterId: string; consentId: string }>();
  const navigate = useNavigate();
  const canCreate = useCan(PERMISSION.CONSENTS_CREATE);
  const canUpdate = useCan(PERMISSION.CONSENTS_UPDATE_DRAFT);
  const canReadProcedures = useCan(PERMISSION.PROCEDURES_READ);
  const organizationId = useActiveOrganizationId();
  const organizationIdRef = useRef(organizationId);
  organizationIdRef.current = organizationId;
  const practitioners = useClinicalPractitioners(canCreate || canUpdate);
  const [linkEncounterId, setLinkEncounterId] = useState(encounterId);
  const [procedures, setProcedures] = useState<ClinicalProcedureSummary[]>([]);
  const [proceduresError, setProceduresError] = useState(false);
  const [fields, setFields] = useState<ConsentDraftFields>(EMPTY_FIELDS);
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (mode !== 'edit' || !consentId || !organizationId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setVersion(null);
    setFields(EMPTY_FIELDS);
    void documentsApi
      .consent(consentId, controller.signal)
      .then((consent) => {
        if (controller.signal.aborted) return;
        if (consent.status !== 'DRAFT') {
          setError(
            new ApiError(
              'Los consentimientos emitidos no permiten editar su contenido.',
              409,
              'CONSENT_NOT_DRAFT',
            ),
          );
          return;
        }
        setVersion(consent.version);
        setLinkEncounterId(consent.clinicalEncounterId);
        setFields({
          title: consent.title,
          purposeText: consent.purposeText ?? '',
          risksText: consent.risksText ?? '',
          benefitsText: consent.benefitsText ?? '',
          alternativesText: consent.alternativesText ?? '',
          estimatedCostText: consent.estimatedCostText ?? '',
          declarationText: consent.declarationText ?? '',
          responsiblePractitionerMembershipId: consent.responsiblePractitionerMembershipId ?? '',
          clinicalProcedureId: consent.clinicalProcedureId ?? '',
        });
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [consentId, mode, organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    setProcedures([]);
    setProceduresError(false);
    if (!canReadProcedures || !organizationId || !patientId || !linkEncounterId) {
      return () => controller.abort();
    }
    void proceduresApi
      .listByPatient(
        patientId,
        { page: 1, pageSize: 100, clinicalEncounterId: linkEncounterId },
        controller.signal,
      )
      .then((result) => {
        if (!controller.signal.aborted) setProcedures(result.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProceduresError(true);
      });
    return () => controller.abort();
  }, [canReadProcedures, linkEncounterId, organizationId, patientId]);

  function update<K extends keyof ConsentDraftFields>(key: K, value: ConsentDraftFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const savingOrganizationId = organizationId;
    setSaving(true);
    setError(null);
    try {
      const input = {
        title: fields.title,
        purposeText: fields.purposeText || null,
        risksText: fields.risksText || null,
        benefitsText: fields.benefitsText || null,
        alternativesText: fields.alternativesText || null,
        estimatedCostText: fields.estimatedCostText || null,
        declarationText: fields.declarationText || null,
        responsiblePractitionerMembershipId: fields.responsiblePractitionerMembershipId || null,
        ...(canReadProcedures ? { clinicalProcedureId: fields.clinicalProcedureId || null } : {}),
      };
      const consent =
        mode === 'create'
          ? await documentsApi.createConsent(patientId, encounterId, input)
          : await documentsApi.updateConsent(consentId, {
              ...input,
              expectedVersion: version ?? 0,
            });
      if (organizationIdRef.current !== savingOrganizationId) return;
      navigate(`/pacientes/${patientId}/historia/consentimientos/${consent.id}`, { replace: true });
    } catch (requestError: unknown) {
      if (organizationIdRef.current === savingOrganizationId) setError(requestError);
    } finally {
      if (organizationIdRef.current === savingOrganizationId) setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="page-stack">
        <LoadingState label="Cargando borrador de consentimiento" />
      </div>
    );
  if (mode === 'create' && !canCreate)
    return (
      <div className="page-stack">
        <Alert tone="error" role="alert">
          No tienes permiso para crear consentimientos.
        </Alert>
      </div>
    );
  if (mode === 'edit' && !canUpdate)
    return (
      <div className="page-stack">
        <Alert tone="error" role="alert">
          No tienes permiso para editar borradores.
        </Alert>
      </div>
    );

  return (
    <section className="page-stack clinical-page documents-page">
      <PageHeader
        eyebrow="Historia clínica · Borrador"
        title={mode === 'create' ? 'Nuevo consentimiento' : 'Editar borrador'}
        description="El texto se guarda como contenido simple. Al emitir, quedará congelado con snapshots históricos."
        action={
          <Link
            className="button button--secondary"
            to={
              mode === 'edit'
                ? `/pacientes/${patientId}/historia/consentimientos/${consentId}`
                : `/pacientes/${patientId}/historia/encuentros/${encounterId}`
            }
          >
            Cancelar
          </Link>
        }
      />
      <Card>
        <form className="domain-form consent-form" onSubmit={(event) => void save(event)}>
          {error ? (
            <Alert tone="error" role="alert">
              {errorMessage(error, 'No fue posible guardar el borrador.')}
              {error instanceof ApiError && error.status === 409 ? (
                <p>
                  Alguien más cambió este borrador. Recarga la versión actual antes de volver a
                  editar.
                </p>
              ) : null}
            </Alert>
          ) : null}
          <div className="form-grid form-grid--two">
            {TEXT_FIELDS.slice(0, 1).map(({ key, label, maxLength }) => (
              <FormField key={key} label={label} htmlFor={`consent-${key}`}>
                <TextInput
                  id={`consent-${key}`}
                  value={fields[key]}
                  maxLength={maxLength}
                  onChange={(event) => update(key, event.target.value)}
                />
              </FormField>
            ))}
            <FormField
              label="Profesional responsable"
              htmlFor="consent-practitioner"
              hint="Solo el profesional asignado podrá emitir este consentimiento."
            >
              <Select
                id="consent-practitioner"
                value={fields.responsiblePractitionerMembershipId}
                onChange={(event) =>
                  update('responsiblePractitionerMembershipId', event.target.value)
                }
              >
                <option value="">Seleccionar después</option>
                {(practitioners.data?.data ?? []).map((member) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.displayName || 'Profesional sin nombre'}
                    {member.profileConfigured ? '' : ' · perfil pendiente'}
                  </option>
                ))}
              </Select>
            </FormField>
            {canReadProcedures ? (
              <FormField
                label="Procedimiento relacionado (opcional)"
                htmlFor="consent-procedure"
                hint="Solo se muestran procedimientos del mismo paciente y encuentro."
              >
                <Select
                  id="consent-procedure"
                  value={fields.clinicalProcedureId}
                  onChange={(event) => update('clinicalProcedureId', event.target.value)}
                >
                  <option value="">Sin procedimiento relacionado</option>
                  {procedures.map((procedure) => (
                    <option
                      key={procedure.id}
                      value={procedure.id}
                      disabled={procedure.status === 'VOIDED'}
                    >
                      {procedure.procedureName || 'Procedimiento sin nombre'} · {procedure.status}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
          </div>
          {TEXT_FIELDS.slice(1).map(({ key, label, maxLength }) => (
            <FormField key={key} label={label} htmlFor={`consent-${key}`}>
              <textarea
                id={`consent-${key}`}
                className="input input--textarea consent-form__textarea"
                value={fields[key]}
                maxLength={maxLength}
                onChange={(event) => update(key, event.target.value)}
              />
            </FormField>
          ))}
          {practitioners.error ? (
            <Alert tone="warning" role="status">
              No se pudo cargar la lista de profesionales. Puedes guardar el borrador y asignarlo
              más tarde.
            </Alert>
          ) : null}
          {proceduresError ? (
            <Alert tone="warning" role="status">
              No se pudo cargar la lista de procedimientos. El consentimiento puede guardarse sin
              vincular uno.
            </Alert>
          ) : null}
          <p className="clinical-muted">
            Puedes guardar un borrador incompleto. El título y la declaración serán necesarios para
            emitirlo.
          </p>
          <div className="form-actions">
            <Button type="submit" disabled={saving || (mode === 'edit' && version === null)}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Link
              className="button button--secondary"
              to={
                mode === 'edit'
                  ? `/pacientes/${patientId}/historia/consentimientos/${consentId}`
                  : `/pacientes/${patientId}/historia/encuentros/${encounterId}`
              }
            >
              Volver sin guardar
            </Link>
          </div>
        </form>
      </Card>
    </section>
  );
}
