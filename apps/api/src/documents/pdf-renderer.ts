import PDFDocument from 'pdfkit';

type PDFDocumentType = InstanceType<typeof PDFDocument>;

export type PdfField = { label: string; value: string | number | Date | null | undefined };

export type ClinicalPdfInput = {
  title: string;
  organizationName: string;
  patientName?: string | null | undefined;
  ownerName?: string | null | undefined;
  professionalName?: string | null | undefined;
  clinicalDate?: string | Date | null | undefined;
  documentId: string;
  generatedAt: Date;
  fields: PdfField[];
  signatureImage?: Buffer | undefined;
  evidenceSha256?: string | undefined;
  statusNotice?: string | undefined;
};

// Renders plain text clinical evidence with bounded page layout and optional drawn-signature evidence.
export async function renderClinicalPdf(input: ClinicalPdfInput): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'LETTER',
    margin: 48,
    info: {
      Title: input.title,
      Author: input.organizationName,
      Subject: 'Documento clínico Easyvet',
    },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });

  pdf.font('Helvetica-Bold').fontSize(18).fillColor('#173b2b').text('Easyvet', { continued: true });
  pdf
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#53665c')
    .text(`  ${input.organizationName}`, { align: 'right' });
  pdf.moveDown(1);
  pdf.font('Helvetica-Bold').fontSize(16).fillColor('#18231e').text(input.title);
  pdf.moveDown(0.7);

  const headerFields: PdfField[] = [
    { label: 'Paciente', value: input.patientName },
    { label: 'Responsable', value: input.ownerName },
    { label: 'Profesional', value: input.professionalName },
    { label: 'Fecha clínica', value: input.clinicalDate },
  ];
  for (const field of headerFields) writeField(pdf, field);
  pdf.moveDown(0.5);

  for (const field of input.fields) writeField(pdf, field);

  if (input.signatureImage) {
    pdf.moveDown(1);
    pdf.font('Helvetica-Bold').fontSize(11).fillColor('#18231e').text('Firma manuscrita');
    pdf.image(input.signatureImage, { fit: [200, 72] });
  }
  if (input.evidenceSha256) {
    pdf.moveDown(0.4);
    writeField(pdf, {
      label: 'Identificador de evidencia',
      value: input.evidenceSha256.slice(0, 16),
    });
  }
  if (input.statusNotice) {
    pdf.moveDown(0.8);
    pdf
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#8a4b11')
      .text(input.statusNotice, { width: 510 });
  }

  pdf.moveDown(1.2);
  pdf.moveTo(48, pdf.y).lineTo(564, pdf.y).strokeColor('#dce5df').stroke();
  pdf.moveDown(0.5);
  pdf.font('Helvetica').fontSize(8).fillColor('#65756c');
  pdf.text(`Documento: ${input.documentId}`);
  pdf.text(`Generado: ${input.generatedAt.toISOString()}`);
  pdf.end();
  return output;
}

// Converts database values to printable plain text without interpreting markup as HTML.
function writeField(pdf: PDFDocumentType, field: PdfField): void {
  if (field.value === null || field.value === undefined || field.value === '') return;
  const value = field.value instanceof Date ? field.value.toISOString() : String(field.value);
  pdf
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#3f5147')
    .text(`${field.label}:`, { continued: true });
  pdf.font('Helvetica').fontSize(9).fillColor('#18231e').text(` ${value}`, { width: 516 });
  pdf.moveDown(0.35);
}
