# Revisión final de Documents / Consents / Signatures — Fase 6I

## Comparativo legacy

La inspección de solo lectura se hizo sobre Lativet-reference en el commit
`05fea495cb13208b27bf470b3570987fd501a81e`. En
`Backend/CONSULTORIO/Pacientes/Documentos/servicios.py` y `persistencia.py`, el
Consent legacy se guardaba directamente con identidad/número del firmante, datos
profesionales y `signed_at`; el mismo save intentaba crear PDF local y, si SMTP
estaba configurado, enviarlo al Owner. El request de firma estaba ligado a consulta,
Record, Patient y Owner, comprobaba que el hash del documento consultado no hubiera
cambiado, permitía reenviar código y controlaba expiración e intentos (máximo cinco).
El código se entregaba por SMTP con vigencia de 15 minutos. Sin embargo, la tabla
SQLite `document_signature_requests` guardaba el token bearer en claro y la firma
dibujo como Data URL; el código se guardaba como SHA-256 de token+código. La ruta
pública también devolvía detalles clínicos y microchip del Patient, mientras el Owner
email sí se enmascaraba. La página de firma exigía identidad escrita y PNG. Había PDF
de consentimientos, export PDF/DOCX de consulta y cobertura de pruebas PDF/export;
también existían flujos separados de grooming consent.

Easyvet conserva la aceptación con OTP y entrega local del enlace/código al operador,
pero lo adapta a Organization compuesto en lecturas/escrituras, storage privado
opaco, hashes verificables, snapshots al emitir, lifecycle versionado, reemisión que
revoca tokens antiguos y límites de archivo/OTP. En esta fase no se configuró SMTP:
no se afirma que Easyvet entregue email/SMS, aunque Lativet sí enviaba OTP/PDF por
correo. No se migraron filas, firmas, archivos ni datos personales legacy. No se
consideró la implementación local anterior como política de retención ni como
evidencia de cumplimiento legal.

## Resultado V1

- Prisma: `ClinicalDocument`, `Consent`, `ConsentSignatureRequest`, enums, FKs
  compuestas y constraints/indexes en `20260922170000_add_documents_consents_signatures`.
- Storage: adaptadores local privado y S3-compatible configurables; QA real local.
  No hay URL pública/pre-signed ni credenciales de S3 de prueba configuradas.
- Documentos: seis PDF clínicos de source más PDF de consentimiento firmado y
  adjuntos PDF/PNG/JPEG; sha256, idempotencia por source version, descarga privada,
  void lógico y no hard-delete.
- Consent: Draft/issue/sign/void, snapshots y hash contenido, requests token-hash +
  OTP Argon2id, TTL/intentos limitados, typed/drawn, hash de evidencia y PDF.
- Aislamiento: rutas internas tenant-scoped; firma pública solo por bearer token
  hasheado y expirable. Sign/reissue/void/archive se serializan con locks/CAS.
- No se añade canal de email/SMS, malware scanner, OCR, DICOM, constructor de
  plantillas, firma digital cualificada ni reglas nacionales.

## Legal y privacidad

Easyvet V1 captura evidencia de aceptación/firma electrónica. No afirma ofrecer una
firma digital cualificada/certificada reconocida en cada jurisdicción; requisitos
legales por país requieren PRODUCT/LEGAL REVIEW. Auditoría omite OTP, token, clave
de storage, narrativa clínica, datos completos de Owner, nombre de firmante, raw IP,
User-Agent y contenido de archivos. La tabla de request mantiene la evidencia
operativa necesaria, y el público ve documento de Owner enmascarado.

## Validación y QA

La migración fue aplicada solo en `easyvet_dev` y `easyvet_test`; seed sigue sin
filas Documents/Consents de QA. Se verificó la lista de documentos, lista/detalle
de Consent y firma pública typed en viewport 390×844, sin overflow horizontal.
Los conteos finales, validaciones, auditoría npm y commit quedan registrados en
`MIGRATION_STATUS.md`.
