import {
  clinicalDocumentListResponseSchema,
  clinicalDocumentMetadataSchema,
  consentCreateRequestSchema,
  consentDetailSchema,
  consentExpectedVersionRequestSchema,
  consentUpdateDraftRequestSchema,
  consentVoidRequestSchema,
  generateClinicalDocumentRequestSchema,
  publicConsentSchema,
  publicSignatureResultSchema,
  signatureIssueResponseSchema,
  type ClinicalDocumentMetadata,
  type ConsentDetail,
  type ClinicalDocumentType,
  type PublicConsent,
} from '@veterinary-saas/contracts';
import { apiBlob, apiClient, apiForm, publicApiClient } from '../../services/apiClient';

// Feature API parses all metadata at the boundary and keeps file bytes out of JSON responses.
export const documentsApi = {
  async list(patientId: string, signal?: AbortSignal): Promise<ClinicalDocumentMetadata[]> {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    const result = clinicalDocumentListResponseSchema.parse(
      await apiClient(`/patients/${patientId}/documents?${params}`, signal ? { signal } : {}),
    );
    return result.data;
  },
  async generate(documentType: ClinicalDocumentType, sourceId: string) {
    const body = generateClinicalDocumentRequestSchema.parse({ documentType, sourceId });
    return clinicalDocumentMetadataSchema.parse(
      await apiClient('/documents/generate', { method: 'POST', body }),
    );
  },
  async upload(patientId: string, title: string, file: File, clinicalEncounterId?: string) {
    const form = new FormData();
    form.set('title', title);
    form.set('file', file);
    if (clinicalEncounterId) form.set('clinicalEncounterId', clinicalEncounterId);
    return clinicalDocumentMetadataSchema.parse(
      await apiForm(`/patients/${patientId}/documents`, form),
    );
  },
  async download(id: string) {
    return apiBlob(`/documents/${id}/file`);
  },
  async void(id: string, reason: string) {
    return clinicalDocumentMetadataSchema.parse(
      await apiClient(`/documents/${id}/void`, { method: 'POST', body: { reason } }),
    );
  },
  async listConsents(patientId: string, signal?: AbortSignal): Promise<ConsentDetail[]> {
    return consentDetailSchema
      .array()
      .parse(await apiClient(`/patients/${patientId}/consents`, signal ? { signal } : {}));
  },
  async consent(id: string, signal?: AbortSignal): Promise<ConsentDetail> {
    return consentDetailSchema.parse(await apiClient(`/consents/${id}`, signal ? { signal } : {}));
  },
  async createConsent(patientId: string, encounterId: string, input: unknown) {
    const body = consentCreateRequestSchema.parse(input);
    return consentDetailSchema.parse(
      await apiClient(`/patients/${patientId}/clinical-encounters/${encounterId}/consents`, {
        method: 'POST',
        body,
      }),
    );
  },
  async updateConsent(id: string, input: unknown) {
    const body = consentUpdateDraftRequestSchema.parse(input);
    return consentDetailSchema.parse(await apiClient(`/consents/${id}`, { method: 'PATCH', body }));
  },
  async issue(id: string, expectedVersion: number) {
    const body = consentExpectedVersionRequestSchema.parse({ expectedVersion });
    return signatureIssueResponseSchema.parse(
      await apiClient(`/consents/${id}/issue`, { method: 'POST', body }),
    );
  },
  async reissue(id: string, expectedVersion: number) {
    const body = consentExpectedVersionRequestSchema.parse({ expectedVersion });
    return signatureIssueResponseSchema.parse(
      await apiClient(`/consents/${id}/signature-request/reissue`, { method: 'POST', body }),
    );
  },
  async voidConsent(id: string, expectedVersion: number, reason: string) {
    const body = consentVoidRequestSchema.parse({ expectedVersion, reason });
    return consentDetailSchema.parse(
      await apiClient(`/consents/${id}/void`, { method: 'POST', body }),
    );
  },
  async publicConsent(token: string): Promise<PublicConsent> {
    return publicConsentSchema.parse(await publicApiClient(`/public/signatures/${token}`));
  },
  async signPublic(
    token: string,
    input: {
      verificationCode: string;
      signerName: string;
      signatureMethod: 'TYPED' | 'DRAWN';
      signature?: Blob | undefined;
    },
  ) {
    const form = new FormData();
    form.set('verificationCode', input.verificationCode);
    form.set('signerName', input.signerName);
    form.set('signatureMethod', input.signatureMethod);
    form.set('accepted', 'true');
    if (input.signature) form.set('signature', input.signature, 'signature.png');
    return publicSignatureResultSchema.parse(
      await publicApiClient(`/public/signatures/${token}/sign`, { method: 'POST', body: form }),
    );
  },
};
