# Decisiones y preguntas abiertas del dominio clínico

Este documento convierte la lectura de Lativet en decisiones explícitas para
Easyvet. `DECIDIDO` describe una regla de arquitectura propuesta; `POR DECIDIR`
requiere aprobación de producto/legal; `POSTERGADO` queda fuera del núcleo de
Fase 6B.

Para no mezclar hechos y diseño, las conclusiones usan además estas etiquetas:

- **VERIFIED LEGACY BEHAVIOR:** se observó directamente en código, rutas, SQL o
  frontend de Lativet.
- **EASYVET DESIGN RECOMMENDATION:** propuesta tenant-safe derivada del hallazgo.
- **PRODUCT DECISION REQUIRED:** no puede cerrarse solo leyendo el legacy.
- **POSTPONED:** depende de decisiones posteriores y no entra en 6B.

## Decisiones propuestas

| Tema                     | Estado   | Decisión para Easyvet                                                                                                                                                           | Razón/evidencia legacy                                                                                          |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tenant                   | DECIDIDO | Toda entidad clínica incluye `organizationId`; las relaciones compuestas validan el mismo tenant.                                                                               | Las tablas legacy no tienen tenant y sus UUID no bastan para aislamiento.                                       |
| Identidad del expediente | DECIDIDO | Un `ClinicalRecord` longitudinal por `Organization + Patient`, creado lazy; encounters ilimitados. Episodios legales, si se requieren, serán otra decisión explícita posterior. | Legacy permite varios `clinical_records` por Patient y lista un bundle completo; no hay unique `patient_id`.    |
| Consulta versus historia | DECIDIDO | `ClinicalRecord` es contenedor/timeline; `ClinicalEncounter` (UI: Consultation) es un evento. No se duplican formularios.                                                       | Legacy separa `clinical_records` y `clinical_consultations`, pero sincroniza implícitamente una consulta única. |
| Finalización             | DECIDIDO | Transición explícita `DRAFT -> FINALIZED` con control de versión y actor; no editar finalizados.                                                                                | Legacy bloquea record finalizado, pero usa `finalize` booleano dentro de POST y no versiona.                    |
| Correcciones             | DECIDIDO | Addendum/evolución append-only con motivo y autor; no reopen general ni hard delete.                                                                                            | Legacy permite `save_evolution` después de finalizar, pero no formaliza el concepto de addendum.                |
| Estado de Consultation   | DECIDIDO | Encounter tendrá estado propio, aunque legacy no lo tenga. `DRAFT`, `FINALIZED`, `VOIDED`.                                                                                      | Sin estado de consulta no hay bloqueo ni concurrencia granular.                                                 |
| Profesional              | DECIDIDO | Actor vivo = `Membership`; guardar snapshot de nombre/matrícula en cada evidencia.                                                                                              | Legacy solo persiste `professional_name`/`professional_license`.                                                |
| Patient archivado        | DECIDIDO | Historia existente legible; crear o finalizar nuevos eventos rechazado en 6B, sin excepción silenciosa.                                                                         | Archive debe preservar historia, no borrar evidencia.                                                           |
| Owner histórico          | DECIDIDO | Guardar `ownerId` cuando corresponda y snapshots de nombre/contacto/identificación en documentos y actos sensibles.                                                             | Legacy toma el Owner actual al guardar y no garantiza el contexto histórico.                                    |
| Appointment              | DECIDIDO | Relación opcional; no es entidad clínica. Un futuro servicio puede proyectar controles después del commit.                                                                      | Legacy enlaza `source_consultation_id` y sincroniza próximos controles.                                         |
| Vitals/peso              | DECIDIDO | `VitalMeasurement` temporal; `Patient.currentWeightKg` es proyección, no fuente histórica.                                                                                      | Legacy tiene `patient_weight_records`, pero mezcla otros signos en texto.                                       |
| Diagnóstico              | DECIDIDO | Mantener texto libre y tipo presumptive/differential/definitive al inicio; catálogo posterior.                                                                                  | Legacy usa tres textos y payload flexible.                                                                      |
| Adjuntos                 | DECIDIDO | Metadata + StorageService futuro; no data URLs en la fila clínica.                                                                                                              | Legacy embebe data URLs en `document_reference`.                                                                |
| Firma                    | DECIDIDO | Versionar documento y firmar hash inmutable; OTP/auditoría son satélites.                                                                                                       | Legacy ya registra hash SHA-256, OTP, IP, UA e identidad.                                                       |
| Auditoría                | DECIDIDO | Crear evento de auditoría en cada transición y exportación sensible.                                                                                                            | Legacy registra acciones, pero no existe un límite tenant-aware en sus tablas.                                  |

## Permisos propuestos

Los permisos se asignan al `Membership` activo y siempre se evalúan junto al
tenant. No deben derivarse automáticamente de `patients.read`.

| Permiso                                       | Uso                                           |
| --------------------------------------------- | --------------------------------------------- |
| `clinical.records.read`                       | Leer expediente y timeline.                   |
| `clinical.records.create`                     | Abrir expediente/evento.                      |
| `clinical.records.update-draft`               | Cambiar un draft propio o permitido.          |
| `clinical.records.finalize`                   | Finalizar y fijar evidencia.                  |
| `clinical.records.addendum`                   | Añadir evolución/corrección trazable.         |
| `clinical.records.void`                       | Anular draft o corregir duplicado con motivo. |
| `clinical.measurements.read/create`           | Leer/registrar peso y signos.                 |
| `clinical.diagnoses.read/create`              | Consultar/registrar diagnósticos.             |
| `clinical.prescriptions.read/create/finalize` | Fórmulas y sus items.                         |
| `clinical.preventive.read/create`             | Vacunación y desparasitación.                 |
| `clinical.procedures.read/create`             | Procedimientos y cirugía.                     |
| `clinical.diagnostics.read/create/result`     | Solicitudes y resultados.                     |
| `clinical.documents.read/create/export`       | Documentos y exportaciones.                   |
| `clinical.consents.read/create/sign`          | Consentimientos y firma.                      |
| `clinical.followups.read/create/complete`     | Planes, ocurrencias y controles.              |

Matriz inicial sugerida:

| Rol existente         | Lectura clínica                                        | Escritura clínica                                                     | Finalizar/firma                                          |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `OWNER` / `ADMIN`     | Amplia dentro de la organización                       | Según política; no implica conocimiento clínico automático            | Delegable a profesional autorizado; toda acción auditada |
| `VETERINARIAN`        | Sí                                                     | Encounters, diagnósticos, medidas, tratamientos y satélites asignados | Sí, según licencia/estado                                |
| `ASSISTANT`           | Solo si se concede `clinical.records.read`             | Draft y medidas no sensibles; no finaliza por defecto                 | No                                                       |
| `RECEPTION`           | Agenda y datos administrativos; clínica no por defecto | No                                                                    | No                                                       |
| `GROOMER` / `CASHIER` | No clínica                                             | No                                                                    | No                                                       |
| `PLATFORM_ADMIN`      | Sin acceso clínico por defecto                         | No                                                                    | No                                                       |

La matriz no sustituye una política de mínimo privilegio. Se necesitan pruebas
cross-tenant para cada permiso y no debe existir un bypass por rol global.

## Máquinas de estado propuestas

Estas máquinas separan el comportamiento observado de una implementación futura:

| Agregado                 | VERIFIED LEGACY BEHAVIOR                                                                                               | EASYVET DESIGN RECOMMENDATION                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ClinicalRecord/Encounter | Record `draft/finalized`; una historia finalizada bloquea edición; la consulta no tiene estado propio.                 | `DRAFT -> FINALIZED`; `FINALIZED -> ADDENDUM` sin reabrir; `VOIDED` solo con motivo y audit.                                   |
| Hospitalization          | Ambulatorio/hospitalización guarda admisión, seguimiento/kardex y alta dentro de consulta/JSON; kardex tiene autosave. | `PLANNED -> ADMITTED -> IN_CARE -> DISCHARGED` y `CANCELLED`; modelar solo cuando se apruebe el satélite. **POSTPONED.**       |
| DiagnosticOrder          | Laboratorio/imagen se guardan como consulta con estados/resultados en JSON; puede fusionarse una solicitud pendiente.  | `REQUESTED -> IN_PROGRESS -> RESULTED -> REVIEWED` con resultados versionados. **POSTPONED.**                                  |
| Document/Signature       | Documento se genera desde consulta; solicitud de firma `pending/code_sent/signed`, hash y expiración.                  | Documento versionado; firma `PENDING -> CODE_SENT -> SIGNED/EXPIRED/REJECTED`; cambiar contenido invalida hash. **POSTPONED.** |
| FollowUp/Reminder        | Follow-up `pending/completed`; reminder pendiente y job de vencidos.                                                   | Separar plan, ocurrencia y reminder; completar es idempotente y puede proyectar Appointment. **POSTPONED.**                    |

No se propone crear enums de satélites en 6B hasta cerrar los estados y las
políticas de transición con producto.

## PII, seguridad y cumplimiento

La anamnesis, diagnósticos, medicamentos, identificación del propietario,
consentimientos, firmas, IP y documentos constituyen datos sensibles. Por eso:

- los endpoints clínicos no deben devolver campos extra por conveniencia;
- los listados deben aplicar tenant + permiso antes de cargar relaciones;
- exports y descargas deben auditarse y usar URLs de Storage de corta duración;
- no se fija un plazo de retención en código hasta recibir política jurídica por
  país; `retentionUntil` debe ser configurable y auditable;
- una firma requiere hash de la versión exacta, identidad del firmante y
  evidencia verificable; cambiar el documento invalida el hash pendiente;
- se debe documentar cifrado, backup, borrado legal y respuesta a solicitudes
  de acceso antes de producción.

## Decisiones abiertas que bloquean satélites

1. Significado legal de “expediente” si se necesitan episodios separados; la
   cardinalidad técnica de 6B ya está decidida.
2. Catálogo y codificación de diagnósticos.
3. Lista mínima de campos y unidades para signos vitales por especie.
4. Reglas de edición/void de fórmula, vacuna, cirugía y resultados.
5. Consentimientos obligatorios por procedimiento y validez de firma electrónica
   en cada país.
6. Estados y reconciliación de laboratorio/imagen asincrónicos.
7. Si una ocurrencia completada de FollowUp aparece como Consultation o como
   evento propio en la timeline.
8. Storage, retención, antivirus, límites de tamaño y redacción de documentos.

## Alcance exacto de una eventual Fase 6B

Si el usuario aprueba la siguiente fase, el alcance propuesto es únicamente:

1. `ClinicalRecord` tenant-safe y endpoints de lectura/creación.
2. `ClinicalEncounter`/Consultation con draft, edición, finalización y
   optimistic concurrency.
3. `ClinicalEvolution`/Addendum append-only.
4. `VitalMeasurement` para peso y signos básicos, incluyendo la proyección de
   peso vigente de Patient.
5. Auditoría y permisos mínimos de esos cuatro agregados.
6. Tests unitarios, de integración, cross-tenant y de archivado.

No incluye aún diagnóstico codificado, prescripciones, vacunas, desparasitación,
procedimientos, hospitalización, documentos, firmas, remisiones, seguimiento,
Storage ni UI clínica completa. Eso requiere fases posteriores.

## Cierre del Design Gate 6A.1

Las siguientes decisiones quedan cerradas para el diseño conceptual de 6B; no
constituyen autorización para implementarlas en este commit.

### ClinicalRecord y cardinalidad

**DECIDIDO — uno por `Organization + Patient`.** `ClinicalRecord` es el
expediente longitudinal y no tiene lifecycle clínico. Se crea lazy, dentro de la
misma transacción que el primer encounter. La futura restricción es
`UNIQUE(organizationId, patientId)`.

Los múltiples records del legacy son un efecto del insert sin unique y de varios
flujos que crean un draft cuando no encuentran el record que la UI llama
“primary” (el de mayor `opened_at`). No se encontró evidencia de episodios
legales separados. Por tanto se clasifica como **artefacto histórico / NEEDS
REVIEW**. Una migración futura consolidaría records por Patient y conservaría
las fechas/eventos; no se define aquí el proceso de importación.

### ClinicalEncounter

**DECIDIDO — `DRAFT`, `FINALIZED`, `VOIDED`.**

- `DRAFT`: editable, versión 1 o superior, no es evidencia definitiva.
- `FINALIZED`: inmutable, exige profesional responsable activo y snapshot;
  almacena `finalizedAt` y `finalizedByMembershipId`.
- `VOIDED`: solo desde `FINALIZED`, conserva contenido, `voidReason`,
  `voidedAt` y `voidedByMembershipId`; no se reutiliza.
- No hay `FINALIZED -> DRAFT` ni delete de drafts en 6B.

### Evolution / Addendum

**DECIDIDO con compatibilidad explícita:** el legacy permite evoluciones
directamente sobre `clinical_record` (`clinical_evolutions.record_id`) y su UI
solo selecciona un record; no exige consultation. Easyvet conservará
`clinicalRecordId` obligatorio y `clinicalEncounterId` nullable. Si se informa
encounter, debe estar `FINALIZED` y no `VOIDED`; si es null, la nota es una
evolución general del expediente. Ambas variantes son append-only y no se
editan ni eliminan. Esto evita convertir Evolution en una segunda Consultation y
no pierde la semántica observada.

### Appointment y ClinicLocation

`ClinicalEncounter.appointmentId` es nullable y único por organización cuando
existe: urgencias/walk-ins no requieren Appointment y una Appointment puede
producir como máximo un encounter principal. El vínculo inicial exige mismo
tenant, Patient y ClinicLocation compatibles; se rechazan `CANCELLED` y
`NO_SHOW`. `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS` y un enlace histórico a
`COMPLETED` son válidos. Appointment no crea encounter automáticamente.

`clinicLocationId` es requerido en todo encounter presencial, incluido walk-in;
telemedicina queda postergada. No se hereda silenciosamente desde Appointment.

### Owner histórico

`ownerIdAtTime` es requerido y se deriva en backend del Owner vigente del
Patient, nunca del frontend. No cambia cuando Patient cambia de Owner. Snapshots
textuales completos se dejan para Document/Consent; 6B conserva la relación
histórica y la defensa tenant-aware.

### Identidad profesional y brecha de perfil

El schema actual de Easyvet solo ofrece User.email, User.status,
Membership.role/status y relaciones; no tiene display name ni licencia
profesional. Esto es un **BLOCKING DESIGN GAP** para finalizar un encounter con
un snapshot confiable.

La recomendación es la opción D: separar `organizationRole` (el `MembershipRole`
actual) de un perfil/capability clínica explícita. Un futuro
`MembershipProfessionalProfile` 1:1 debe contener como mínimo
`displayName`, `licenseNumber` nullable y `clinicalAccessLevel` (`NONE`,
`ASSISTANT`, `PRACTITIONER`), con estado activo y tenant. No se implementa ni se
añaden campos arbitrarios a User/Membership en este gate.

`responsibleMembershipId` puede ser null en draft, pero es obligatorio al
finalizar. El Membership y User deben estar ACTIVE, pertenecer a la
Organization y el perfil debe autorizar el acto. Los snapshots los deriva el
backend al finalizar; el cliente no puede proporcionarlos.

### Autorización seleccionada

Se selecciona **Option D — organization role separado de clinical role/capability**.
Permite que una persona sea `OWNER` administrativa y `PRACTITIONER` clínica sin
conceder historia a todos los Owners/Admins. Es más extensible que Option B,
no requiere múltiples built-in roles como Option C y conserva compatibilidad con
el `PermissionGuard` actual; las capabilities clínicas pueden incorporarse como
permisos code-defined antes de custom roles.

| Perfil efectivo                                   | Lectura                                  | Escritura                                 | Finalización/void              |
| ------------------------------------------------- | ---------------------------------------- | ----------------------------------------- | ------------------------------ |
| Practitioner activo (cualquier organization role) | Record, encounters, evolutions, vitales  | Crear y editar drafts; añadir evoluciones | Sí, si tiene permiso explícito |
| Assistant clínico activo                          | Record/encounter según permiso           | Crear/editar drafts y registrar vitales   | No por defecto                 |
| Owner/Admin sin perfil clínico                    | Datos administrativos/Patient permitidos | No clínica                                | No                             |
| Reception                                         | Agenda y datos administrativos           | No clínica                                | No                             |
| Groomer/Cashier                                   | Patient/agenda que ya posean             | No clínica                                | No                             |
| PLATFORM_ADMIN                                    | Ningún acceso clínico automático         | No                                        | No                             |

Permisos mínimos de 6B: `clinicalRecords.read`,
`clinicalEncounters.read`, `clinicalEncounters.create`,
`clinicalEncounters.updateDraft`, `clinicalEncounters.finalize`,
`clinicalEncounters.void`, `clinicalEvolutions.read`,
`clinicalEvolutions.create`, `clinicalMeasurements.read` y
`clinicalMeasurements.create`. No se crean permisos por campo.

### Concurrencia

**DECIDIDO — optimistic concurrency.** `ClinicalEncounter.version` inicia en

1. Cada modificación de draft y la finalización hacen compare-and-set por
   `id + organizationId + status = DRAFT + version = expectedVersion` y aumentan
   version. Un desajuste devuelve `409 CLINICAL_ENCOUNTER_STALE`; nunca gana en
   silencio el último write.

### Peso, vitales y diagnóstico

Solo un encounter `FINALIZED` proyecta `Patient.currentWeightKg`. Si después se
anula, la transacción recalcula desde la medición `weightKg` finalizada más
reciente de encounters no anulados; si no queda ninguna, usa null. Los drafts
no modifican Patient.

Se adopta `VitalMeasurement` separado para permitir varias mediciones por
encounter (incluida futura hospitalización). Campos mínimos observados:
`recordedAt`, `weightKg`, `temperatureC`, `heartRateBpm`,
`respiratoryRateBpm`, `bodyCondition`, `hydrationStatus`, `mucousMembranes`,
`turgency` y `observations`, todos salvo fecha/relaciones opcionales.

En 6B los diagnósticos permanecen como campos nullable de texto:
`presumptiveDiagnosis`, `differentialDiagnosis`, `definitiveDiagnosis`. No se
crea catálogo ni entidad Diagnosis.

El plan core conserva texto separado: `diagnosticPlan`, `therapeuticPlan`,
`recommendations` y `followUpPlan`; Prescription queda postergada.

### Finalización y auditoría

La transacción de finalización valida estado/version, Patient activo, Owner
histórico, profesional responsable/perfil, congela snapshots, fija
`FINALIZED/finalizedAt/by`, congela mediciones, proyecta peso y crea un
`ClinicalAuditEvent`; después hace commit. Email, PDF, Storage, Google,
FollowUp y mutaciones de Agenda no forman parte de esta transacción.

`ClinicalAuditEvent` es append-only y registra organización, actor, entidad,
acción, timestamp y metadata mínima segura. Acciones 6B:
`ENCOUNTER_CREATED`, `ENCOUNTER_UPDATED`, `ENCOUNTER_FINALIZED`,
`ENCOUNTER_VOIDED`, `EVOLUTION_ADDED`, `VITAL_ADDED`. No almacena el payload
clínico completo ni puede modificarse desde la API normal.

### PRODUCT DECISION REQUIRED restante

El gate deja solo decisiones fuera del núcleo: jurisdicción/retención legal,
forma final del `MembershipProfessionalProfile`, catálogo diagnóstico,
telemedicina, satélites (prescripción, preventivos, cirugía, hospitalización,
diagnóstico, documentos y firmas), y el proceso de importación de múltiples
records legacy. Ninguna afecta la cardinalidad, lifecycle, seguridad o contrato
mínimo de los cinco modelos de 6B.
