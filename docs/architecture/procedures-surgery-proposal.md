# Propuesta: dominio de procedimientos, cirugía y anestesia

## Estado

Propuesta documental de Fase 6F.1. No está implementada ni autoriza cambios Prisma/API/UI. Por decisiones aún abiertas se recomienda **Design Gate 6F.1.1** antes del backend 6F.2. Contrato de implementación condicionado al gate.

## Arquitectura recomendada

Híbrido: `ClinicalProcedure` común para cirugía y otros procedimientos; `ClinicalSurgeryDetail` 1:1 opcional para campos exclusivos de cirugía; `AnesthesiaRecord` como agregado aparte; `AnesthesiaObservation` como lecturas seriadas 0..N. Todos cuelgan de Encounter; la anestesia puede asociarse a un procedure opcionalmente mientras producto decide si elimina la opción independiente observada en Lativet.

No crear raíces distintas `Procedure` y `Surgery`: legado no demuestra límites ni workflows distintos. No usar un modelo genérico con JSON libre: impediría validar y auditar campos clínicos. El detalle 1:1 evita columnas quirúrgicas nulas en todos los procedimientos. Medicaciones perioperatorias/anestésicas son documentación clínica, no inventario/receta/facturación.

## Modelo conceptual (no es DDL)

### `ClinicalProcedure`

| Campo                                                    | Propuesta                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `organizationId`                                   | UUID requerido; Organization se deriva de TenantContext.                                                                                              |
| `clinicalRecordId`, `clinicalEncounterId`, `patientId`   | UUID requeridos, tenant-safe y consistentes con padre.                                                                                                |
| `procedureType`                                          | Enum mínimo `PROCEDURE`/`SURGERY`, no catálogo de operaciones.                                                                                        |
| `status`, `version`                                      | `DRAFT` default, `FINALIZED`, `VOIDED`; entero positivo para CAS.                                                                                     |
| `name`                                                   | Requerido al finalizar; texto trim con longitud por acordar.                                                                                          |
| `description`, `indication`                              | Texto nullable en draft. Sin FK de diagnóstico hasta entidad estable.                                                                                 |
| `performedAt`                                            | `TIMESTAMPTZ(3)`; nullable en draft, requerido en final; almacenar instante UTC.                                                                      |
| `startedAt`, `endedAt`                                   | Instantes nullable; cuando ambos existan `endedAt >= startedAt`; requerimiento por tipo pendiente.                                                    |
| `technique`, `findings`, `complications`                 | Texto nullable en draft y preservado al finalizar. Ausencia no equivale a “ninguna complicación”.                                                     |
| `recoveryStatus`, `postoperativePlan`, `recommendations` | Texto clínico; sin seguimiento automático.                                                                                                            |
| `nextControlOn`                                          | Propuesta de fecha civil, no Appointment/Reminder; semántica por confirmar.                                                                           |
| responsable/autor                                        | `responsiblePractitionerMembershipId` nullable en draft, requerido al finalizar; `createdByMembershipId` obligatorio y actor server-derived.          |
| snapshots                                                | `patientNameSnapshot`, `ownerDisplayNameSnapshot`, `professionalDisplayNameSnapshot`, `professionalLicenseSnapshot`; servidor los llena al finalizar. |
| lifecycle                                                | `finalizedAt`, `finalizedByMembershipId`, `voidedAt`, `voidedByMembershipId`, `voidReason`; igual patrón de Clinical/Preventive.                      |
| timestamps                                               | `createdAt`, `updatedAt` como `TIMESTAMPTZ(3)`.                                                                                                       |

El owner snapshot procede de `ClinicalEncounter.ownerIdAtTime`, no tutor actual. No duplicar `ownerId` mutable. `appointmentId` no se agrega por defecto: Appointment es reserva, no hecho clínico.

### `ClinicalSurgeryDetail`

Único 1:1 con ClinicalProcedure y sólo válido si `procedureType=SURGERY`. Candidatos: `anestheticRisk`, `fastingStatus`, `area`, `side`, `bleeding`, `closure`, `ownerCommunication`, preparación/recuperación específica. No duplicar status/findings/complications/technique/recommendations del root. No fijar vocabulario clínico sin gate.

Medicaciones por fase podrían ser filas `PerioperativeMedication`: `phase=PREOPERATIVE|INTRAOPERATIVE|POSTOPERATIVE`, `medicationName`, `doseText`, `routeText`, `frequencyText`, `notes`, `position`. Nombre/dosis/ruta son texto; no producto de inventario. Si gate determina que basta una narración, diferir la tabla; no reemplazarla por JSON arbitrario.

### `AnesthesiaRecord` y `AnesthesiaObservation`

AnesthesiaRecord requiere Encounter y Patient; `clinicalProcedureId` puede ser nullable si producto conserva registro standalone legacy. Cuando existe, debe pertenecer al mismo Encounter/Organization/Patient. Tiene estado, versión, autor y terminal fields propios.

Campos candidatos: `startedAt`, `endedAt`, `asaClass` (candidato I–V, no `Emergency` como grado ASA), `technique`, `preanestheticEvaluation`, `airway`, `fluids`, `medicationsText` inicialmente, `complications`, `recovery`, `observations`; `anesthesiologistMembershipId` y snapshot display requeridos al finalizar, license snapshot nullable. `endedAt >= startedAt`. Gate decide clasificación de urgencia, y si anestesiólogo debe ser Practitioner.

Observation: `id`, `organizationId`, `anesthesiaRecordId`, `observedAt` (`TIMESTAMPTZ(3)`), FC `heartRateBpm`, FR `respiratoryRateBpm`, `temperatureC`, `spo2Percent`, `etco2`, PA sistólica/diastólica o una forma única aprobada, `anestheticPlane`, `observations`, `recordedByMembershipId`, `createdAt`. Cadencia 10 minutos es sugerencia UI, no constraint; nunca interpolar lecturas. Gate define unidades/rangos/campos opcionales. Al finalizar registro, no editar/borrar observaciones individualmente.

## Fronteras e invariantes

- **Encounter:** requerido; DRAFT/FINALIZED permite child; VOIDED bloquea escrituras. No eventos flotantes ni cross-tenant.
- **Cardinalidad:** Encounter 1→0..N ClinicalProcedure y 0..N AnesthesiaRecord; Procedure 0..1 SurgeryDetail; AnesthesiaRecord 0..1 Procedure; AnesthesiaRecord 1→0..N Observation. Sin límite de un evento por Encounter.
- **Fecha:** instancia UTC para hecho; mostrar en zona de organización. No importar `YYYY-MM-DDT12:00` sin interpretar su timezone. Fecha de próximo control si aprobada es civil y no crea agenda.
- **Diagnóstico:** `indication` libre; no FK/catálogo en 6F.
- **Signos:** VitalMeasurement actual es medición general del Encounter. No meter serie intraoperatoria de FC/FR/T/SpO2/EtCO2/PA en ella; usar Observation con timestamps/unidades. Examen pre/post general puede usar vitales normales sin copiar serie.
- **Meds/materiales:** describir fases/medicación; no Prescription, stock/lotes, Kardex, Billing, costo ni decrementos automáticos.
- **Consent:** checkbox no es evidencia. Consent firmado se integra en fase documental futura, relacionado a patient/procedure/Encounter y verificable; obligatoriedad por tipo requiere decisión legal/producto. Consent, firma, PDF, archivos y Storage fuera de 6F.2.
- **Agenda:** cita es planificación; realizado no crea/completa/mueve Appointment. Navegación con CTA explícito, no side effect.

## Lifecycle y casos terminales

- `DRAFT`: editable con expectedVersion y campos parciales.
- `FINALIZED`: inmutable; requiere mínimos acordados, responsable Practitioner, snapshots server-derived, tiempo/actor y audit en misma transacción.
- `VOIDED`: motivo requerido, actor y tiempo; preservar evidencia, sin reopen ni hard delete. Se recomienda también anular DRAFT en vez de borrar; confirmar en gate.
- Child VOIDED no se escribe más. Si parent se anula, child historial sigue visible con aviso; Encounter VOID bloquea child create/edit/finalize. Definir si Encounter VOID advierte o exige razón reforzada cuando hay hijos FINALIZED.
- Patient ARCHIVED permite leer historia pero bloquea actividad nueva/edit draft/finalize; Void correctivo sigue posible al actor autorizado.
- Sin DELETE HTTP ni cascadas de historia; FK RESTRICT.

## Backend 6F.2 condicionado al gate

Rutas candidatas bajo `/api/v1`:

| Uso                            | Ruta                                                                                                                    | Permiso propuesto                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Listar por Patient / Encounter | `GET /patients/:patientId/procedures?cursor=&limit=`; `GET /clinical-encounters/:encounterId/procedures?cursor=&limit=` | `clinicalProcedures.read`                  |
| Crear Procedure                | `POST /clinical-encounters/:encounterId/procedures`                                                                     | `clinicalProcedures.create`                |
| Leer/editar draft              | `GET/PATCH /procedures/:procedureId`                                                                                    | `clinicalProcedures.read` / `.updateDraft` |
| Finalizar/anular               | `POST /procedures/:id/finalize`, `/void`                                                                                | `clinicalProcedures.finalize`, `.void`     |
| Listar anestesia               | `GET /patients/:patientId/anesthesia-records`; `GET /clinical-encounters/:encounterId/anesthesia-records`               | `anesthesiaRecords.read`                   |
| Crear anestesia                | `POST /clinical-encounters/:encounterId/anesthesia-records`                                                             | `anesthesiaRecords.create`                 |
| Leer anestesia                 | `GET /anesthesia-records/:id`                                                                                           | `anesthesiaRecords.read`                   |
| Editar borrador                | `PATCH /anesthesia-records/:id`                                                                                         | `anesthesiaRecords.updateDraft`            |
| Finalizar/anular               | `POST /anesthesia-records/:id/finalize` y `POST /anesthesia-records/:id/void`                                           | `anesthesiaRecords.finalize` / `.void`     |

Observations se devuelven dentro del detalle anestésico, con orden estable y paginación si hace falta. Mutación por agregado con expectedVersion o append idempotente se decide en gate; no CRUD para borrar lecturas finalizadas. Inputs allow-listed: nunca aceptar org, status, actor, snapshots, finalization fields o versión del cliente salvo expectedVersion. Output Contracts/Zod usa IDs UUID, timestamps ISO, lifecycle, versión, snapshots, detalles y `parentEncounterStatus`. Cross-tenant devuelve 404 uniforme; estado stale/inválido y parent VOIDED devuelven 409 con código estable.

### Locks, CAS y auditoría

Transacción Prisma para toda escritura: bloquear Encounter; validar estado y tenant; lock Patient para serializar archive; lock del agregado; lock memberships responsables por UUID lexicográfico; validar status+`expectedVersion`; write/version increment/audit atómicos. Orden propuesto `Encounter -> Patient -> child aggregate -> memberships ordenadas`; reconciliar con órdenes existentes antes de implementación y no hacer I/O de red/storage en transacción.

Si Encounter VOID gana carrera contra create/finalize, no debe hacer commit el child. Si hijo finalizado ya existía, permanece legible como evidencia con padre VOIDED. Estado DRAFT puede conservarse pero write posterior se bloquea.

Extender `ClinicalAuditEvent` con entity types/actions específicos sólo si enums actuales no bastan. Metadata mínima: versiones, acción, conteos y razón de Void según política; excluir narrativa clínica, PII, medicamentos, observaciones, mediciones y documentos. Audit se escribe en misma transacción; no almacenar payload completo.

### Constraints e índices candidatos

- FK compuestas con Organization/Encounter/Record/Patient para demostrar tenant y consistencia padre-hijo; FK de Participant a Membership dentro del tenant. SurgeryDetail unique por Procedure; Observation FK a AnesthesiaRecord+Organization; si anesthesia.procedureId no null debe coincidir en Encounter/Patient/Organization.
- `onDelete: Restrict`; `version > 0`; status terminal implica snapshots/actor/fecha; VOIDED implica motivo trim no vacío; intervalos no negativos; SurgeryDetail sólo con tipo SURGERY. No confiar sólo en validación Nest.
- Índices `organizationId, patientId, performedAt`, `organizationId, clinicalEncounterId, performedAt`, anestesia por Encounter/tiempo y observaciones por `anesthesiaRecordId, observedAt, id`.

### Pruebas requeridas

- constraints, transiciones, obligatorios al finalize, tipo Surgery/detail y fechas; no dependencia externa de catálogo.
- permisos separados/role matrix, tenant isolation/404, snapshot injection y perfil responsable.
- CAS update/finalize/void; atomicidad del audit; carreras contra Encounter VOID y Patient archive; test deadlock/lock-order.
- Patient/Owner/Professional snapshots persisten ante cambio de datos actuales; history legible tras archive/parent void.
- Anesthesia separada y opcionalidad/relación según gate; series con tiempo/unidades, sin lecturas inventadas, sin edición tras finalización ni cruce a VitalMeasurement.
- Contratos Zod, paginación/orden, rutas/deep links cross-tenant y stale frontend cuando se implemente UI.

## Migración

No se ejecuta ni se define backfill automático en esta fase. `clinical_consultations` no trae Encounter ID; `consultation_at` no guarda timezone fuente; nombre/licencia no resuelven Membership; `consentSigned` no demuestra firma; `procedureId`/monitoring JSON pueden estar rotos o ser texto. Ver mapeo por campo en [decisiones](procedures-surgery-decisions.md). Importación futura requerirá staging, reglas aprobadas, reporte de ambiguos, provenance y revisión; nunca asignar Encounter/actor arbitrariamente.
