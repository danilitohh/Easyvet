# Contrato del Clinical Core — Fases 6B.1–6B.2

**Estado:** fundación de esquema y núcleo API implementados y verificados en
Fases 6B.1 y 6B.2.
**Alcance:** `ClinicalRecord`, `ClinicalEncounter`, `ClinicalEvolution`,
`VitalMeasurement`, `ClinicalAuditEvent`, roles/perfil clínico, API, CAS,
transacciones y sus invariantes de base de datos. La UI clínica y los
satélites siguen fuera de alcance.

Las migraciones versionadas de la fundación son
`20260921130259_add_clinical_core_foundation`,
`20260921133000_align_clinical_field_names`,
`20260921134500_remove_redundant_clinical_indexes` y
`20260921135000_restore_required_clinical_uniques`; se aplican únicamente a
`easyvet_dev` y `easyvet_test`. El seed contiene datos ficticios mínimos en
Norte y Sur. Las rutas implementadas y sus contratos se detallan en
`docs/architecture/clinical-core-api.md`.

La migración es aditiva y no reescribe datos existentes. No se alteraron
migraciones previas; cualquier rollback de una base local deberá hacerse con
un snapshot/restauración o una migración inversa revisada explícitamente, no
editando una migración ya aplicada.

## Dependencia previa: perfil profesional

La fundación 6B.1 contiene display name y matrícula opcional en un perfil
profesional separado de `MembershipRole`:

```text
Membership (organizationRole: OWNER/ADMIN/…)
  └── MembershipProfessionalProfile (displayName, licenseNumber)
```

El perfil es tenant-aware y 1:0..1 por Membership; no se añaden campos clínicos
arbitrarios a User. La política futura de finalización exige Membership activo,
`ClinicalRole=PRACTITIONER` y perfil válido. `licenseNumber` puede ser null.

## Enums conceptuales

```text
ClinicalEncounterStatus = DRAFT | FINALIZED | VOIDED

ClinicalAuditAction =
  CREATED
  UPDATED
  FINALIZED
  VOIDED
  EVOLUTION_ADDED
  VITAL_ADDED
```

No se crea un enum de tipos de consulta en 6B: los valores legacy mezclan
eventos y documentos y requieren una decisión de producto posterior.

## Modelo `ClinicalRecord`

Un expediente longitudinal por organización y Patient. No tiene status
`DRAFT/FINALIZED`; el estado clínico vive en los encounters.

| Campo            | Tipo conceptual | Null | Regla                                                 |
| ---------------- | --------------- | ---- | ----------------------------------------------------- |
| `id`             | UUID            | No   | Identidad estable.                                    |
| `organizationId` | UUID            | No   | Tenant directo.                                       |
| `patientId`      | UUID            | No   | FK compuesta `(patientId, organizationId)` a Patient. |
| `openedAt`       | timestamptz     | No   | Momento del primer uso clínico; no es lifecycle.      |
| `createdAt`      | timestamptz     | No   | Auditoría técnica.                                    |
| `updatedAt`      | timestamptz     | No   | Actualización del contenedor/resumen.                 |

Relaciones:

- `Organization 1 — N ClinicalRecord`, `onDelete: Restrict`.
- `Patient 1 — 1 ClinicalRecord` dentro de la organización, `Restrict`.
- `ClinicalRecord 1 — N ClinicalEncounter`, `Restrict`.
- `ClinicalRecord 1 — N ClinicalEvolution`, `Restrict`.

Constraints e índices:

- `UNIQUE(organizationId, patientId)`;
- `UNIQUE(id, organizationId)` para FKs tenant-aware;
- índices `(organizationId, updatedAt)` y `(organizationId, patientId)`.

Creación: lazy, en la misma transacción que el primer encounter. Patient
administrativo o de grooming no crea expediente vacío.

## Modelo `ClinicalEncounter`

Representa la consulta/atención principal. La UI podrá llamarlo Consultation,
pero el contrato usa un nombre neutral para walk-ins, controles y futuros
perfiles de evento.

| Campo                             | Tipo conceptual         | Null        | Regla                                                                                  |
| --------------------------------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `id`                              | UUID                    | No          | Identidad estable.                                                                     |
| `organizationId`                  | UUID                    | No          | Tenant directo.                                                                        |
| `clinicalRecordId`                | UUID                    | No          | FK `(id, organizationId)` a Record.                                                    |
| `patientId`                       | UUID                    | No          | FK `(id, organizationId)` a Patient; coincide con Record.                              |
| `ownerIdAtTime`                   | UUID                    | No          | Owner vigente al crear; nunca se toma del cliente ni se reescribe por cambio de Owner. |
| `clinicLocationId`                | UUID                    | No          | Sede del encuentro presencial; también obligatorio en walk-in.                         |
| `appointmentId`                   | UUID                    | Sí          | FK tenant-aware; unique por organización cuando existe.                                |
| `responsibleMembershipId`         | UUID                    | Sí en draft | Debe estar activo y autorizado antes de finalizar.                                     |
| `status`                          | ClinicalEncounterStatus | No          | Default `DRAFT`.                                                                       |
| `version`                         | integer                 | No          | Default `1`, positivo; optimistic concurrency.                                         |
| `eventAt`                         | timestamptz             | No          | Momento clínico declarado.                                                             |
| `reason`                          | text                    | No          | Motivo/título clínico.                                                                 |
| `anamnesis`                       | text                    | Sí          | Texto libre observado en legacy.                                                       |
| `physicalExam`                    | text                    | Sí          | Examen físico/resumen.                                                                 |
| `presumptiveDiagnosis`            | text                    | Sí          | No catálogo en 6B.                                                                     |
| `differentialDiagnosis`           | text                    | Sí          | No catálogo en 6B.                                                                     |
| `definitiveDiagnosis`             | text                    | Sí          | No catálogo en 6B.                                                                     |
| `diagnosticPlan`                  | text                    | Sí          | Plan diagnóstico.                                                                      |
| `therapeuticPlan`                 | text                    | Sí          | Plan terapéutico; no es Prescription.                                                  |
| `recommendations`                 | text                    | Sí          | Recomendaciones al Owner/equipo.                                                       |
| `followUpPlan`                    | text                    | Sí          | Texto de seguimiento; FollowUp estructurado queda postergado.                          |
| `notes`                           | text                    | Sí          | Notas clínicas adicionales.                                                            |
| `professionalDisplayNameSnapshot` | text                    | Sí en draft | Backend lo congela al finalizar.                                                       |
| `professionalLicenseSnapshot`     | text                    | Sí          | Matrícula/registro según jurisdicción.                                                 |
| `createdByMembershipId`           | UUID                    | No          | Actor que creó el draft.                                                               |
| `finalizedAt`                     | timestamptz             | Sí          | Solo `FINALIZED`/`VOIDED`.                                                             |
| `finalizedByMembershipId`         | UUID                    | Sí          | Actor que finalizó.                                                                    |
| `voidReason`                      | text                    | Sí          | Obligatorio en `VOIDED`.                                                               |
| `voidedAt`                        | timestamptz             | Sí          | Solo `VOIDED`.                                                                         |
| `voidedByMembershipId`            | UUID                    | Sí          | Actor que anuló.                                                                       |
| `createdAt`                       | timestamptz             | No          | Técnico.                                                                               |
| `updatedAt`                       | timestamptz             | No          | Técnico y soporte de CAS.                                                              |

Invariantes:

- `patientId`, `ownerIdAtTime`, `clinicLocationId`, Appointment y Membership
  deben pertenecer a `organizationId`.
- `appointmentId` es nullable para urgencias; al vincularlo inicialmente se
  rechazan Appointment `CANCELLED` y `NO_SHOW`, y se exige mismo Patient y sede.
- Una Appointment produce como máximo un encounter principal:
  `UNIQUE(organizationId, appointmentId)`.
- `FINALIZED` exige `responsibleMembershipId`, perfil clínico activo y snapshots
  derivados por backend.
- `VOIDED` solo transita desde `FINALIZED`; no se edita ni se reutiliza.

Índices y constraints:

- `UNIQUE(id, organizationId)`;
- `UNIQUE(organizationId, appointmentId)` (los null permanecen permitidos);
- índices `(organizationId, patientId, eventAt)`,
  `(organizationId, clinicalRecordId, eventAt)`,
  `(organizationId, status, updatedAt)` y
  `(organizationId, responsibleMembershipId, eventAt)`.
- Todas las relaciones usan `onDelete: Restrict`; no cascada clínica.

## Modelo `ClinicalEvolution`

La regla Easyvet conserva el caso observado en legacy: una evolución puede ser
general del expediente o contextualizar un encounter. No se convierte en una
segunda consulta.

| Campo                       | Tipo conceptual | Null | Regla                                                                         |
| --------------------------- | --------------- | ---- | ----------------------------------------------------------------------------- |
| `id`                        | UUID            | No   | Inmutable.                                                                    |
| `organizationId`            | UUID            | No   | Tenant directo.                                                               |
| `clinicalRecordId`          | UUID            | No   | Siempre pertenece al Record del mismo tenant.                                 |
| `clinicalEncounterId`       | UUID            | Sí   | Si existe, Encounter debe ser `FINALIZED` y no `VOIDED`; coincide con Record. |
| `occurredAt`                | timestamptz     | No   | Momento de la evolución.                                                      |
| `subjective`                | text            | Sí   | Campo observado.                                                              |
| `objective`                 | text            | Sí   | Campo observado.                                                              |
| `assessment`                | text            | Sí   | Campo observado.                                                              |
| `plan`                      | text            | No   | Campo requerido por validación legacy.                                        |
| `authorMembershipId`        | UUID            | No   | Membership activo del autor.                                                  |
| `authorDisplayNameSnapshot` | text            | No   | Snapshot derivado por backend.                                                |
| `authorLicenseSnapshot`     | text            | Sí   | Matrícula/registro.                                                           |
| `createdAt`                 | timestamptz     | No   | Técnico; no `updatedAt`.                                                      |

Constraints/índices:

- `UNIQUE(id, organizationId)`;
- índice `(organizationId, clinicalRecordId, occurredAt)`;
- índice `(organizationId, clinicalEncounterId, occurredAt)`;
- `onDelete: Restrict` a Record, Encounter y Membership.

No hay `PATCH` ni `DELETE` de Evolution. Un error se corrige con otra
Evolution/Addendum posterior. La creación verifica permiso y tenant, pero no
usa version global del Encounter porque dos autores pueden anexar notas sin
pisarse.

## Modelo `VitalMeasurement`

Tabla separada para múltiples mediciones en consulta u hospitalización futura.
Mientras el Encounter sea draft, las mediciones pueden corregirse dentro del
CAS del encounter; después de finalizar son inmutables.

| Campo                    | Tipo conceptual | Null | Regla                                            |
| ------------------------ | --------------- | ---- | ------------------------------------------------ |
| `id`                     | UUID            | No   | Identidad.                                       |
| `organizationId`         | UUID            | No   | Tenant directo.                                  |
| `clinicalEncounterId`    | UUID            | No   | FK tenant-aware.                                 |
| `patientId`              | UUID            | No   | Coincide con Encounter.                          |
| `recordedAt`             | timestamptz     | No   | Permite 09:00/13:00/17:00.                       |
| `weightKg`               | decimal         | Sí   | Positivo si se informa.                          |
| `temperatureC`           | decimal         | Sí   | Campo observado.                                 |
| `heartRateBpm`           | integer         | Sí   | Campo observado.                                 |
| `respiratoryRateBpm`     | integer         | Sí   | Campo observado.                                 |
| `bodyCondition`          | text            | Sí   | Incluye ICC/condición corporal sin catálogo aún. |
| `hydrationStatus`        | text            | Sí   | Texto observado.                                 |
| `mucousMembranes`        | text            | Sí   | Texto observado.                                 |
| `turgency`               | text            | Sí   | Texto observado.                                 |
| `observations`           | text            | Sí   | Otros datos no estructurados observados.         |
| `recordedByMembershipId` | UUID            | No   | Actor que registró.                              |
| `createdAt`              | timestamptz     | No   | Técnico.                                         |
| `updatedAt`              | timestamptz     | No   | Solo mientras el parent sea draft.               |

Índices `(organizationId, patientId, recordedAt)`,
`(organizationId, clinicalEncounterId, recordedAt)` y unique compuesto
`(id, organizationId)`. `onDelete: Restrict`.

## Modelo `ClinicalAuditEvent`

Append-only y no editable por API normal.

| Campo               | Tipo conceptual     | Null | Regla                                                         |
| ------------------- | ------------------- | ---- | ------------------------------------------------------------- |
| `id`                | UUID                | No   | Identidad.                                                    |
| `organizationId`    | UUID                | No   | Tenant directo.                                               |
| `actorMembershipId` | UUID                | Sí   | Null únicamente para tarea de sistema explícita.              |
| `entityType`        | enum conceptual     | No   | RECORD, ENCOUNTER, EVOLUTION, VITAL_MEASUREMENT.              |
| `entityId`          | UUID                | No   | Id del agregado afectado.                                     |
| `action`            | ClinicalAuditAction | No   | Catálogo mínimo de 6B.                                        |
| `occurredAt`        | timestamptz         | No   | Timestamp de la acción.                                       |
| `metadata`          | JSON                | Sí   | IDs/versiones/motivo mínimos; nunca payload clínico completo. |

Índice `(organizationId, entityType, entityId, occurredAt)` y
`(organizationId, occurredAt)`. Actor con `onDelete: SetNull` para preservar
auditoría; Organization y demás referencias usan `Restrict`.

## Estados y transiciones

```text
ClinicalEncounter:
  DRAFT --finalize (CAS + professional profile)--> FINALIZED
  FINALIZED --void(reason + CAS)---------------> VOIDED

ClinicalEvolution:
  append on Record; optional Encounter must be FINALIZED and not VOIDED

ClinicalRecord:
  sin lifecycle clínico; vive mientras Organization + Patient existan
```

No se implementa `DELETE` para ninguno de los cinco modelos en 6B. Un draft
abandonado queda pendiente de una futura política de limpieza; un encounter
finalizado se anula, nunca se borra.

## API conceptual de 6B

El tenant se obtiene del contexto autenticado, no de un `organizationId` libre
del cliente. Todas las rutas aplican permisos y relaciones compuestas.

| Método y ruta                                     | Propósito                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /patients/:patientId/clinical-record`        | Obtener el único Record del tenant; `{ clinicalRecord: null }` si no existe.       |
| `GET /patients/:patientId/clinical-encounters`    | Lista paginada por `eventAt`, status, tipo futuro y profesional.                   |
| `POST /patients/:patientId/clinical-encounters`   | Lazy-create Record + Encounter draft + auditoría. Rechaza Patient archivado.       |
| `GET /clinical-encounters/:encounterId`           | Detalle tenant-safe con versión y resúmenes de relaciones.                         |
| `PATCH /clinical-encounters/:encounterId`         | Editar draft con `expectedVersion`; 409 `CLINICAL_ENCOUNTER_STALE` si no coincide. |
| `POST /clinical-encounters/:encounterId/finalize` | CAS de finalización, snapshots, vitals, peso y auditoría.                          |
| `POST /clinical-encounters/:encounterId/void`     | Solo `FINALIZED`; requiere `voidReason`, recalcula peso y audita.                  |
| `GET /patients/:patientId/clinical-evolutions`    | Evoluciones paginadas del Record, incluidas las contextualizadas.                  |
| `POST /patients/:patientId/clinical-evolutions`   | Evolución general o contextual; body opcional `clinicalEncounterId`.               |
| `POST /clinical-encounters/:encounterId/vitals`   | Añadir medición durante draft; no cambia Patient hasta finalize.                   |

No hay endpoints de hard-delete, reopen, PDF, Storage, firma, FollowUp ni
mutación de Agenda en 6B.

## Plan de pruebas obligatorio

### Tenant y relaciones

- Record único por `Organization + Patient`.
- No leer ni mutar Patient, Owner, Membership, ClinicLocation, Appointment,
  Record, Encounter, Evolution o Vital de otro tenant.
- Appointment con mismo Patient/sede; rechazo de CANCELLED/NO_SHOW y de
  Appointment ya enlazado.
- Owner histórico derivado en backend y estable tras cambio de Owner.
- ClinicLocation requerido y compatible con Appointment.

### Lifecycle, autorización y concurrencia

- Patient archivado: historia legible, creación/finalización rechazada.
- Draft editable por permiso; `patients.read` sin acceso clínico.
- Owner/Admin sin perfil no finaliza; Owner + perfil Practitioner sí puede.
- Assistant no finaliza por defecto; Groomer/Cashier/Reception y
  PLATFORM_ADMIN no obtienen acceso clínico automático.
- Actualización concurrente con versión stale devuelve 409.
- Finalización CAS idempotente; encounter finalizado no acepta PATCH.
- Void solo desde finalizado, exige motivo y no permite reutilización.

### Evoluciones y vitales

- Evolution general de Record y contextual de Encounter finalizado.
- Evolution para Encounter draft/voided rechazada.
- Dos evoluciones concurrentes no se sobrescriben.
- Vitals repetidos en un encounter se conservan con `recordedAt`.
- Draft no modifica peso; finalize proyecta peso válido.
- Void recalcula desde la última medición finalizada no anulada.

### Auditoría e integridad

- Se crean acciones `CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`,
  `EVOLUTION_ADDED` y `VITAL_ADDED`.
- Audit no acepta update/delete por API normal y no contiene payload clínico
  completo.
- Restrict evita cascadas al archivar Patient/Owner/Membership.
- No existe endpoint ni servicio de hard-delete para los cinco agregados.

## Fuera de alcance

No se implementan en 6B roles múltiples, permisos en código, diagnósticos
codificados, React, Prescription,
Vaccination, Deworming, Procedure, Hospitalization, DiagnosticOrder/Result,
Document, Consent, SignatureRequest, Referral, FollowUp, Storage, email, PDF,
Google Calendar ni cambios de Agenda/Patient.

## Implementación 6B.2

El contrato operativo vigente está documentado en
`docs/architecture/clinical-core-api.md`. El backend cubre Record lazy,
encounters segmentados, edición de drafts con CAS, vitales append-only,
finalización y void transaccionales, evoluciones, auditoría y proyección de
peso. No se añadieron endpoints de auditoría ni mutaciones para satélites
clínicos; la interfaz React queda pendiente de 6C.
