# Contrato conceptual del Clinical Core — Fase 6B

**Estado:** diseño cerrado por el Checkpoint 6A.1; no implementado.  
**Alcance:** contrato conceptual para cinco agregados. No es un bloque para
copiar en `schema.prisma` y no autoriza todavía la Fase 6B.

## Dependencia previa: perfil profesional

El schema actual de Easyvet no contiene display name ni matrícula profesional.
Antes de permitir `FINALIZED`, debe aprobarse y modelarse una capacidad
profesional separada del `MembershipRole` organizacional:

```text
Membership (organizationRole: OWNER/ADMIN/…)
  └── MembershipProfessionalProfile (clinicalAccessLevel, displayName, licenseNumber)
```

Ese perfil puede ser un agregado de identidad independiente o una extensión de
Membership, pero no se añaden campos clínicos arbitrarios a User. Un perfil
activo con `PRACTITIONER` autoriza finalización; `ASSISTANT` no finaliza por
defecto. Esta dependencia es obligatoria para la transición de Encounter.

## Enums conceptuales

```text
ClinicalEncounterStatus = DRAFT | FINALIZED | VOIDED

ClinicalAuditAction =
  ENCOUNTER_CREATED
  ENCOUNTER_UPDATED
  ENCOUNTER_FINALIZED
  ENCOUNTER_VOIDED
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

| Método y ruta                                      | Propósito                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /patients/:patientId/clinical-record`         | Obtener el único Record del tenant; 404 si no existe.                              |
| `GET /patients/:patientId/clinical-encounters`     | Lista paginada por `eventAt`, status, tipo futuro y profesional.                   |
| `POST /patients/:patientId/clinical-encounters`    | Lazy-create Record + Encounter draft + auditoría. Rechaza Patient archivado.       |
| `GET /clinical-encounters/:encounterId`            | Detalle tenant-safe con versión y vitales.                                         |
| `PATCH /clinical-encounters/:encounterId`          | Editar draft con `expectedVersion`; 409 `CLINICAL_ENCOUNTER_STALE` si no coincide. |
| `POST /clinical-encounters/:encounterId/finalize`  | CAS de finalización, snapshots, vitals, peso y auditoría.                          |
| `POST /clinical-encounters/:encounterId/void`      | Solo `FINALIZED`; requiere `voidReason`, recalcula peso y audita.                  |
| `GET /clinical-encounters/:encounterId/evolutions` | Evoluciones contextualizadas del encounter.                                        |
| `POST /clinical-records/:recordId/evolutions`      | Evolución general o contextual; body opcional `clinicalEncounterId`.               |
| `POST /clinical-encounters/:encounterId/vitals`    | Añadir medición durante draft; no cambia Patient hasta finalize.                   |

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

- Se crean acciones `ENCOUNTER_CREATED`, `ENCOUNTER_UPDATED`,
  `ENCOUNTER_FINALIZED`, `ENCOUNTER_VOIDED`, `EVOLUTION_ADDED` y `VITAL_ADDED`.
- Audit no acepta update/delete por API normal y no contiene payload clínico
  completo.
- Restrict evita cascadas al archivar Patient/Owner/Membership.
- No existe endpoint ni servicio de hard-delete para los cinco agregados.

## Fuera de alcance

No se implementan en 6B roles múltiples, permisos en código, perfil profesional,
Prisma, migraciones, endpoints, React, diagnósticos codificados, Prescription,
Vaccination, Deworming, Procedure, Hospitalization, DiagnosticOrder/Result,
Document, Consent, SignatureRequest, Referral, FollowUp, Storage, email, PDF,
Google Calendar ni cambios de Agenda/Patient.
