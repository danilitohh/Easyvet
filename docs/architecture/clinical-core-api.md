# Clinical Core API — Fases 6B.2 y 6C.2B

**Estado:** COMPLETADO en backend y consumido por el frontend de 6C.2B. El núcleo expone
finalización, evoluciones append-only y anulación sin abrir satélites clínicos.

Todas las rutas están bajo `/api/v1`, requieren sesión autenticada y
`TenantContext`. El `organizationId` nunca se acepta desde el cliente.

## Rutas

| Método  | Ruta                                | Permiso                     | Comportamiento                                                             |
| ------- | ----------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| GET/PUT | `/clinical/me/professional-profile` | `clinicalRecords.read`      | Perfil de la membresía activa; `membershipId` se deriva del tenant.        |
| GET     | `/clinical/practitioners`           | `clinicalEncounters.create` | Profesionales Practitioner activos del tenant con datos mínimos de perfil. |

| Método   | Ruta                                         | Permiso                          | Comportamiento                                               |
| -------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| GET      | `/patients/:patientId/clinical-record`       | `clinicalRecords.read`           | Devuelve `{ clinicalRecord: null }` si aún no existe.        |
| GET      | `/patients/:patientId/clinical-encounters`   | `clinicalEncounters.read`        | Lista paginada y ordenada de forma determinista.             |
| POST     | `/patients/:patientId/clinical-encounters`   | `clinicalEncounters.create`      | Crea Record lazy y Encounter `DRAFT` en una transacción.     |
| GET      | `/clinical-encounters/:encounterId`          | `clinicalEncounters.read`        | Detalle tenant-safe sin expandir historia completa.          |
| PATCH    | `/clinical-encounters/:encounterId`          | `clinicalEncounters.updateDraft` | Edita solo drafts mediante `expectedVersion`.                |
| GET/POST | `/clinical-encounters/:encounterId/vitals`   | `clinicalVitals.read/create`     | Mediciones append-only; solo se registran durante `DRAFT`.   |
| POST     | `/clinical-encounters/:encounterId/finalize` | `clinicalEncounters.finalize`    | Finaliza con CAS, snapshots profesionales, peso y auditoría. |
| POST     | `/clinical-encounters/:encounterId/void`     | `clinicalEncounters.void`        | Anula únicamente `FINALIZED`, recalcula peso y audita.       |
| GET/POST | `/patients/:patientId/clinical-evolutions`   | `clinicalEvolutions.read/create` | Evolución append-only de Record o Encounter finalizado.      |

## Reglas operativas

- El Patient debe pertenecer al tenant y estar `ACTIVE` para crear, editar,
  registrar vitales, finalizar o anexar evoluciones. El historial archivado
  permanece legible.
- `ClinicLocation`, Appointment y Membership responsable se revalidan dentro
  del tenant. Appointment debe coincidir en Patient y sede y no puede estar
  `CANCELLED`/`NO_SHOW` ni enlazarse dos veces.
- El responsable de finalización es un Membership activo cuyo User está activo,
  tiene `ClinicalRole=PRACTITIONER` y un perfil profesional con `displayName`.
  Solo esa membresía puede finalizar; los snapshots se derivan del perfil y quedan congelados.
  Cambios posteriores del perfil nunca reescriben el snapshot.
- `DRAFT` admite edición y vitales. `FINALIZED` y `VOIDED` son inmutables; no
  existen reopen, PATCH ni DELETE de auditorías, vitales o evoluciones.
- Las transiciones usan `version` con comparación y actualización atómica. Un
  conflicto devuelve `409 CLINICAL_ENCOUNTER_STALE`; estado no editable devuelve
  `409 CLINICAL_ENCOUNTER_IMMUTABLE` o `INVALID_CLINICAL_ENCOUNTER_STATE`.
- `Patient.currentWeightKg` se proyecta únicamente desde la medición con peso
  más reciente de encounters `FINALIZED` no anulados. Un draft no lo cambia;
  anular recalcula y puede dejarlo en `null`. La edición directa queda bloqueada
  con `CURRENT_WEIGHT_MANAGED_BY_CLINICAL_RECORD` cuando existe una medición
  clínica finalizada válida.
- Cada creación, edición, vital, finalización, anulación y evolución escribe un
  `ClinicalAuditEvent` dentro de la misma transacción. Metadata solo contiene
  estado, versiones o IDs; nunca el payload clínico completo.
- Una evolución requiere al menos una narrativa no vacía. El autor se deriva de la sesión y su
  display name se devuelve como dato histórico; no se aceptan `authorMembershipId` ni
  `organizationId` del cliente.
- La anulación solo es válida desde `FINALIZED`, exige motivo y `expectedVersion`, conserva
  encuentros/vitales/auditoría y recalcula la proyección de peso excluyendo encounters anulados.

## Fuera de alcance

Prescriptions, Vaccination, Preventive, Procedure, Hospitalization,
DiagnosticOrder/Result, Documents, Consent, SignatureRequest, FollowUp,
Storage, PDF, email, notifications, cambios automáticos de Agenda y cualquier
frontend clínico quedan pendientes de Fase 6C o fases satélite posteriores.
