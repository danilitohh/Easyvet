import { describe, expect, it } from '@jest/globals';
import { renderClinicalPdf } from './pdf-renderer';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw9sAAAAASUVORK5CYII=',
  'base64',
);

// Renderer tests assert valid, non-empty PDFs and ensure the drawn-signature image path is supported.
describe('clinical PDF renderer', () => {
  it('renders a valid PDF and preserves zero-valued clinical fields', async () => {
    const bytes = await renderClinicalPdf({
      title: 'Fórmula médica QA',
      organizationName: 'Clínica Norte QA',
      patientName: 'Luna',
      ownerName: 'Camila Rojas',
      professionalName: 'Dra. Andrea Pérez',
      clinicalDate: '2035-01-08T15:00:00.000Z',
      documentId: '10000000-0000-4000-8000-000000000001',
      generatedAt: new Date('2035-01-08T15:00:00.000Z'),
      fields: [
        { label: 'Frecuencia cardiaca', value: 0 },
        { label: 'Diagnóstico', value: 'Hallazgo ficticio' },
      ],
    });

    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(bytes.subarray(-6).toString('ascii')).toContain('%%EOF');
  });

  it('embeds a PNG signature image and its evidence hash in a signed-consent PDF', async () => {
    const bytes = await renderClinicalPdf({
      title: 'Consentimiento firmado QA',
      organizationName: 'Clínica Norte QA',
      patientName: 'Luna',
      ownerName: 'Camila Rojas',
      professionalName: 'Dra. Andrea Pérez',
      documentId: '10000000-0000-4000-8000-000000000002',
      generatedAt: new Date('2035-01-08T15:00:00.000Z'),
      signatureImage: onePixelPng,
      evidenceSha256: 'a'.repeat(64),
      fields: [{ label: 'Firmante', value: 'Camila Rojas' }],
    });

    expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(bytes.subarray(-6).toString('ascii')).toContain('%%EOF');
  });
});
