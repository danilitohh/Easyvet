# Documentos clínicos

## Modelo y autoridad

`ClinicalDocument` es el registro tenant-scoped de un artefacto inmutable y su
procedencia; no reemplaza ni se convierte en fuente de estado clínico. Prescriptions,
Vaccinations, Procedures, AnesthesiaRecords, Hospitalizations, DiagnosticOrders y
Consents conservan autoridad sobre su propio lifecycle. Los documentos guardan
`organizationId`, `patientId`, Encounter opcional, origen (`GENERATED`/`UPLOADED`),
tipo, MIME, tamaño, SHA-256, clave privada, autor y estado (`ACTIVE`/`VOIDED`).
Las FKs incluyen tenant, usan `RESTRICT`, y las referencias polimórficas de origen
se validan por servicio dentro del mismo tenant.

Tipos: `PRESCRIPTION`, `VACCINATION_CERTIFICATE`, `PROCEDURE_REPORT`,
`ANESTHESIA_REPORT`, `HOSPITALIZATION_DISCHARGE`, `DIAGNOSTIC_RESULT`,
`SIGNED_CONSENT` y `CLINICAL_ATTACHMENT`. Los seis primeros documentos clínicos
generables requieren su fuente elegible y finalizada; una source anulada o Encounter
anulado no permite emitir PDF nuevo. `SIGNED_CONSENT` solo lo crea el flujo de firma.
Los adjuntos subidos pueden asociarse a un Encounter y, opcionalmente, a una source
permitida; no se aceptan Consent como source de upload manual.

## Generación e integridad

La generación toma snapshots/historia de la source existente y produce un PDF que
conserva identidad clínica relevante al momento de la generación. No muta la source.
La clave de idempotencia de negocio es tenant + tipo + tipo/id de source + versión:
una repetición reutiliza el documento de esa versión; una versión nueva puede
producir otro. Antes y después de bloquear se valida que la source siga elegible.
El artefacto registra el hash SHA-256 de los bytes realmente guardados.

PDF V1: receta; certificado de vacunación; informe de procedimiento/cirugía;
informe de anestesia; alta de hospitalización; resultado diagnóstico; y PDF de
Consent firmado. La descarga vuelve a calcular hash y longitud para detectar
corrupción.

## Upload, void y retención

Upload acepta solo PDF, PNG y JPEG, máximo 10 MiB, y comprueba la firma mágica
contra el MIME declarado antes de guardar. El nombre original se reduce a un
basename sanitizado; nunca compone la clave interna. Se calcula tamaño/hash en el
servidor. El documento se anula con razón, actor y fecha, pero se conserva y sigue
descargable para usuarios autorizados como evidencia histórica. No hay hard delete.

Las capacidades son `documents.read`, `documents.generate`, `documents.upload` y
`documents.void`. Cada ruta valida tenant y autorización backend; tener permiso de
generación no sustituye el permiso `read` de la source clínica específica. API y
respuestas se especifican en [documents-api.md](documents-api.md); los drivers en
[storage.md](storage.md).

## Privacidad y límites

Auditoría registra actor, acción y metadatos acotados (tipo/source/version, MIME y
tamaño); no copia narrativas clínicas, bytes, hashes de secretos ni claves de
storage. La localización del archivo es privada. V1 no integra escáner antivirus,
OCR, DICOM, DOCX editable, export completo de historia ni generación masiva.
