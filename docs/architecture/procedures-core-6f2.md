# Contrato literal: Procedures/Surgery backend — Fase 6F.2A

Este documento conserva el contrato aprobado por el Design Gate 6F.1.1 para la
fase backend 6F.2A. **Procedures/Surgery Backend 6F.2A está implementado** en
Prisma, migración, API, contratos, permisos, seed y pruebas; el detalle de las
rutas está en [procedures-api.md](procedures-api.md). Las pruebas de hardening y
frontend continúan pendientes como fases separadas. La anestesia queda fuera y
tiene contrato separado en
[anesthesia-core-6f2.md](anesthesia-core-6f2.md).

## 1. Alcance e invariantes

- Un solo agregado raíz: `ClinicalProcedure` para procedimientos y cirugías.
- `ClinicalProcedureKind` tiene exactamente `PROCEDURE` y `SURGERY`.
- `procedureName` es texto clínico libre; nunca determina el kind.
- `ClinicalSurgeryDetail` es 1:0..1 y solo existe para `kind = SURGERY`.
- Todo Procedure requiere el mismo `Organization`, `Patient` y
  `ClinicalEncounter`; no hay evento standalone.
- Encounter admite escritura si está `DRAFT` o `FINALIZED`; `VOIDED` bloquea
  create, update de DRAFT y finalize.
- Encounter tiene 0..N Procedures. No hay unicidad por nombre, fecha, Patient
  ni Encounter.
- No crear `Procedure`/`Surgery` roots separados, `Consent`, documentos,
  catálogo de servicios, inventario, facturación ni citas derivadas.
- Planificación operativa corresponde a Agenda; Procedure guarda evidencia
  clínica efectivamente realizada.

## 2. Esquema exacto

### Enum `ClinicalProcedureKind`

```text
PROCEDURE
SURGERY
```

### Enum `ClinicalProcedureStatus`

```text
DRAFT
FINALIZED
VOIDED
```

### Modelo `ClinicalProcedure`

La lista siguiente es completa. `String?` representa texto nullable; todos los
timestamps son `TIMESTAMPTZ(3)` UTC y todos los identificadores referencian UUID.

| Campo                                 | Tipo                      | Nullable / regla                                                                  |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `id`                                  | UUID                      | No; PK generado.                                                                  |
| `organizationId`                      | UUID                      | No; solo TenantContext.                                                           |
| `clinicalEncounterId`                 | UUID                      | No; Encounter padre obligatorio.                                                  |
| `patientId`                           | UUID                      | No; debe ser el Patient del Encounter.                                            |
| `kind`                                | `ClinicalProcedureKind`   | No; sin texto libre.                                                              |
| `status`                              | `ClinicalProcedureStatus` | No; default `DRAFT`.                                                              |
| `version`                             | Int                       | No; default `1`, siempre `>= 1`.                                                  |
| `procedureName`                       | String                    | Sí en DRAFT; trim no vacío al finalizar.                                          |
| `performedAt`                         | TIMESTAMPTZ(3)            | Sí en DRAFT; requerido al finalizar; sin prohibición global de fecha futura.      |
| `indication`                          | String                    | Sí; texto breve del motivo; sin FK a diagnóstico.                                 |
| `description`                         | String                    | Sí; narrativa general de qué se realizó.                                          |
| `technique`                           | String                    | Sí; método clínico específico utilizado, no resumen general.                      |
| `findings`                            | String                    | Sí; hallazgos observados.                                                         |
| `complications`                       | String                    | Sí; `NULL` significa no documentado; “Ninguna” expresa ausencia documentada.      |
| `recoveryNotes`                       | String                    | Sí; observaciones narrativas de recuperación, sin enum de estado.                 |
| `postoperativePlan`                   | String                    | Sí; instrucciones inmediatas específicas del procedimiento.                       |
| `notes`                               | String                    | Sí; nota clínica residual no cubierta por campos anteriores.                      |
| `createdByMembershipId`               | UUID                      | No; Membership actor-derived al crear.                                            |
| `responsiblePractitionerMembershipId` | UUID                      | Sí en DRAFT; Practitioner requerido al finalizar.                                 |
| `patientNameSnapshot`                 | String                    | Sí en DRAFT; requerido al finalizar.                                              |
| `ownerDisplayNameSnapshot`            | String                    | Sí en DRAFT; requerido al finalizar; se deriva del Owner histórico del Encounter. |
| `professionalDisplayNameSnapshot`     | String                    | Sí en DRAFT; requerido al finalizar desde el perfil profesional.                  |
| `professionalLicenseSnapshot`         | String                    | Sí siempre; se copia del perfil y puede ser null.                                 |
| `finalizedAt`                         | TIMESTAMPTZ(3)            | Sí; requerido en `FINALIZED` y `VOIDED`.                                          |
| `finalizedByMembershipId`             | UUID                      | Sí; requerido en `FINALIZED` y `VOIDED`.                                          |
| `voidedAt`                            | TIMESTAMPTZ(3)            | Sí; requerido solo en `VOIDED`.                                                   |
| `voidedByMembershipId`                | UUID                      | Sí; requerido solo en `VOIDED`.                                                   |
| `voidReason`                          | String                    | Sí; requerido, trim no vacío, solo en `VOIDED`.                                   |
| `createdAt`                           | TIMESTAMPTZ(3)            | No; default now.                                                                  |
| `updatedAt`                           | TIMESTAMPTZ(3)            | No; actualizado por cada mutación aceptada.                                       |

No agregar `clinicalRecordId` (se deriva del Encounter), `ownerId` mutable,
`startedAt`/`endedAt`, `appointmentId`, `nextControlOn`, diagnóstico duplicado,
estado operativo ni snapshots de especie, raza, sexo, microchip o peso.

### Modelo `ClinicalSurgeryDetail`

Lista completa, sin lifecycle ni versionado independiente:

| Campo                          | Tipo           | Nullable / regla                                                       |
| ------------------------------ | -------------- | ---------------------------------------------------------------------- |
| `id`                           | UUID           | No; PK generado.                                                       |
| `organizationId`               | UUID           | No; tenant del Procedure.                                              |
| `clinicalProcedureId`          | UUID           | No; único por Procedure.                                               |
| `assistantMembershipId`        | UUID           | Sí; Membership activo con `ClinicalRole.CLINICAL_ASSISTANT`.           |
| `assistantDisplayNameSnapshot` | String         | Sí; nombre congelado al finalizar solo si hay Assistant.               |
| `surgicalArea`                 | String         | Sí; transforma el `area` textual legacy.                               |
| `surgicalSide`                 | String         | Sí; transforma `side` textual legacy; no enum ni laterality inventada. |
| `bleedingNotes`                | String         | Sí; transforma la nota `bleeding`.                                     |
| `closureNotes`                 | String         | Sí; transforma `closure`.                                              |
| `createdAt`                    | TIMESTAMPTZ(3) | No; default now.                                                       |
| `updatedAt`                    | TIMESTAMPTZ(3) | No; se actualiza con el Procedure.                                     |

No incluir assessment, approach, técnica, findings, complicaciones, recovery ni
plan duplicados: pertenecen al Procedure o al AnesthesiaRecord. El detalle solo
se edita anidado en PATCH de Procedure DRAFT; no tiene CRUD propio. Al finalizar
el agregado, incluido el detalle, queda inmutable.

## 3. Semántica, workflow y snapshots

- `description`: qué se hizo en términos narrativos generales; `technique`:
  cómo se hizo clínicamente. Se conservan ambos porque su contenido no es
  intercambiable en los ejemplos de protocolo legacy.
- `indication` es nullable y no replica `ClinicalEncounter` diagnosis fields.
- `findings` y `complications` son nullable. No crear `hadComplications`.
- `recoveryNotes` describe la recuperación observada; `postoperativePlan`
  contiene instrucciones posteriores propias del procedimiento. No reemplaza el
  plan terapéutico/recomendaciones generales del Encounter ni crea seguimiento.
- Draft permite `procedureName`, `performedAt`, datos narrativos,
  `responsiblePractitionerMembershipId` y detail incompletos.
- Lifecycle: `DRAFT → FINALIZED → VOIDED`; no hay reopen, hard delete ni
  endpoint DELETE. No se anula un Draft; drafts abandonados esperan un futuro
  discard/archive workflow.
- Finalize requiere exactamente `performedAt`, `procedureName` trim no vacío,
  Practitioner responsable activo con perfil y `displayName` no vacío. No exige
  diagnosis, `indication`, technique, findings, complications, recovery,
  postoperativePlan ni campos de SurgeryDetail.
- Quien finaliza debe ser el mismo Membership responsable; no existe
  finalize-on-behalf. La licencia puede ser null.
- Si hay assistant, debe ser activo y de rol clínico Assistant, y su perfil debe
  permitir capturar `displayName` para snapshot. No se congela licencia del
  Assistant.
- Patient `ARCHIVED` bloquea create, update Draft y finalize; permite lectura
  histórica y Void de Procedure FINALIZED por Practitioner autorizado.
- Encounter que luego se vuelve VOID no cambia automáticamente un Procedure
  FINALIZED. Detail/API exponen `parentEncounterStatus`. Un Draft hijo de un
  Encounter VOID no se puede editar/finalizar.
- Void solo acepta Procedure FINALIZED, Practitioner autorizado, motivo trim
  no vacío y expectedVersion vigente. Conserva los datos finales y snapshots.
- Snapshot de Patient usa su nombre al finalizar; Owner usa
  `ClinicalEncounter.ownerIdAtTime`, nunca `Patient.ownerId` actual; profesional
  y licencia usan el perfil profesional vigente bloqueado dentro de la
  transacción. No se rehidratan después.
- `ClinicalProcedure.version` gobierna Procedure + SurgeryDetail. Cambiar kind
  solo es posible en DRAFT. `PROCEDURE → SURGERY` permite crear detail; el detail
  es opcional. `SURGERY → PROCEDURE` elimina un detail Draft dentro de la misma
  transacción CAS. El kind finalizado es inmutable.
- No hay relación obligatoria a Appointment; el estado de Agenda no define si la
  intervención fue realizada.

## 4. API 6F.2A

Todas las rutas requieren sesión, TenantContext y permiso de acción. Se filtra
por organization en cada query y los identificadores ajenos al tenant no
revelan existencia.

| Método  | Ruta                                           | Acción                                               |
| ------- | ---------------------------------------------- | ---------------------------------------------------- |
| `GET`   | `/patients/:patientId/procedures`              | Listar historia del Patient.                         |
| `GET`   | `/procedures/:procedureId`                     | Obtener detalle y `parentEncounterStatus`.           |
| `POST`  | `/clinical-encounters/:encounterId/procedures` | Crear Draft.                                         |
| `PATCH` | `/procedures/:procedureId`                     | Actualizar Draft y SurgeryDetail en una transacción. |
| `POST`  | `/procedures/:procedureId/finalize`            | Finalizar.                                           |
| `POST`  | `/procedures/:procedureId/void`                | Anular evidencia finalizada.                         |

No endpoint para hard delete ni operaciones independientes sobre SurgeryDetail.
Create no acepta tenant, actor, status, version, snapshots ni metadata terminal.
Los IDs de parent se obtienen de la ruta; organization solo del contexto.

## 5. Contratos HTTP

Definir y exportar desde el paquete compartido Zod. Los TypeScript input/output
types se infieren de esos schemas y no dependen de Prisma.

| Contrato             | Shape normativo                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateProcedure`    | `kind`, `procedureName?`, `performedAt?`, `indication?`, `description?`, `technique?`, `findings?`, `complications?`, `recoveryNotes?`, `postoperativePlan?`, `notes?`, `responsiblePractitionerMembershipId?`, `surgeryDetail?`. No acepta campos de servidor. |
| `UpdateProcedure`    | `expectedVersion` requerido; parcial de los campos Draft editables de Create, incluido `kind` y objeto `surgeryDetail` parcial o `null` únicamente para quitarlo/cambiar a PROCEDURE. Rechaza campos desconocidos.                                              |
| `FinalizeProcedure`  | `{ expectedVersion }`; sin override de snapshots ni finalizer.                                                                                                                                                                                                  |
| `VoidProcedure`      | `{ expectedVersion, reason }`; reason trim no vacío; actor derive del contexto.                                                                                                                                                                                 |
| `ProcedureListQuery` | `page` default 1; `pageSize` default 20/max 100; filtros opcionales `clinicalEncounterId`, `kind`, `status`, `responsiblePractitionerMembershipId`, `from`, `to`. `from/to` filtran performedAt en UTC; validar `from <= to`.                                   |
| `ProcedureSummary`   | IDs/tenant no sensible, `kind`, `status`, `version`, nombre/fecha, Encounter y responsible membership, snapshots de resumen y timestamps; no incluye notas clínicas extensas.                                                                                   |
| `ProcedureDetail`    | Summary + campos clínicos completos + `surgeryDetail                                                                                                                                                                                                            | null`+`parentEncounterStatus`; status del padre es lectura actual, nunca cambia lifecycle hijo. |

Strings vacíos opcionales se normalizan a null; solo `procedureName` al
finalizar y `reason` al anular son obligatorios no vacíos. Outputs validan y
serializan `Date` como ISO-8601. Errores stale, parent void, Patient archived,
estado terminal y mínimos incompletos se expresan como conflictos HTTP 409 con
código estable; forma exacta sigue el error envelope de Easyvet.

## 6. Permisos

Registrar exactamente:

```text
procedures.read
procedures.create
procedures.updateDraft
procedures.finalize
procedures.void
```

`PRACTITIONER`: los cinco. `CLINICAL_ASSISTANT`: read/create/updateDraft. Sin
ClinicalRole, OWNER/ADMIN de Membership o `PLATFORM_ADMIN`: ninguno ni bypass.
El guard de permiso y la regla de rol se aplican también a rutas alternativas.

## 7. Transacción, CAS, locks y carreras

Mutaciones usan transacción PostgreSQL. Orden global:

```text
ClinicalEncounter → Patient → ClinicalProcedure → Owner histórico → Memberships
```

Las Memberships se bloquean una sola vez, deduplicadas y ordenadas por ID. El
Owner es `ownerIdAtTime` del Encounter y se bloquea cuando se calcula snapshot.
No se bloquean fuentes de snapshot durante lectura GET.

Create valida y bloquea Encounter/Patient antes de insertar con version 1. PATCH,
FINALIZE y VOID requieren `expectedVersion`; el CAS se hace por id,
organization, estado permitido y versión esperada, incrementa exactamente una
vez y devuelve 409 si `count != 1`. PATCH de Procedure y alta/edición/baja
anidada de SurgeryDetail son atómicas; una edición del detalle no incrementa
otra vez la versión.

Orden de lock para mutation de Procedure: Encounter → Patient → Procedure →
Owner (si snapshot) → Memberships ordenadas. Este orden coincide con el de
Clinical/Prescriptions/Preventive Care existente (Encounter antes de Patient)
y no invierte respecto al void del Encounter.

Si Encounter VOID gana el parent lock, create/update/finalize Draft falla. Si
la operación hija lo obtiene primero, puede confirmar y el void del Encounter
continúa después. Un Procedure ya FINALIZED no se altera por void del Encounter.
Patient ARCHIVED se valida bajo lock; su estado impide mutaciones Draft pero no
historia/void final autorizado.

## 8. Constraints e índices

Migración nueva, aditiva y transaccional; no editar migraciones ya aplicadas ni
importar Lativet. FKs `ON DELETE RESTRICT`, `ON UPDATE CASCADE`:

- `organization_id → organizations(id)`.
- `(clinical_encounter_id, organization_id, patient_id) →
clinical_encounters(id, organization_id, patient_id)`.
- `(patient_id, organization_id) → patients(id, organization_id)`.
- creador, responsable, finalizador y anulador usan `(membership_id,
organization_id) → memberships(id, organization_id)`.
- SurgeryDetail `(clinical_procedure_id, organization_id) →
clinical_procedures(id, organization_id)`; unique por Procedure.
- Assistant Membership, si presente, usa `(assistant_membership_id,
organization_id) → memberships(id, organization_id)`.
- Añadir unique `(id, organization_id, clinical_encounter_id, patient_id)` en
  ClinicalProcedure para relaciones compuestas tenant/padre de anestesia en
  6F.2B.

Checks SQL: `version >= 1`; Procedure DRAFT sin metadata terminal; FINALIZED
requiere performedAt, procedureName trim no vacío, responsable, snapshots
requeridos y `finalizedAt/by`, con metadata void nula; VOIDED conserva metadata
final, agrega `voidedAt/by` y `voidReason` trim no vacío. `clinicalProcedureId`
de detail único. No agregar `CHECK` para kind cruzado: un CHECK/FK PostgreSQL no
puede validar `ClinicalProcedure.kind` de otra fila sin trigger. En 6F.2A ese
invariante se aplica dentro de la transacción que primero bloquea Procedure,
valida `kind = SURGERY`, muta detail y hace CAS; se prueba con integración. Los
paths de escritura directa fuera del servicio no están soportados.

Índices mínimos:

1. `(organization_id, patient_id, performed_at DESC NULLS LAST, created_at DESC, id ASC)`.
2. `(organization_id, clinical_encounter_id)`.
3. `(organization_id, status)`.
4. `(organization_id, responsible_practitioner_membership_id, performed_at DESC)`.
5. Unique de SurgeryDetail por `clinical_procedure_id` (incluye organization
   para su FK compuesta).

## 9. Audit, seed y pruebas de base de datos

Reusar `ClinicalAuditEvent`; extender entity type con `CLINICAL_PROCEDURE` y
usar actions comunes `CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`. Guardar en
metadata solo `previousVersion`, `newVersion`, nombres de campos modificados y
operación de surgery detail. Nunca narrative, findings, complications, nombres
de Patient/Owner ni demás contenido clínico. Una mutación que afecta Procedure,
detail y audit confirma o revierte todo junto.

El seed de desarrollo será idempotente y usará fixtures existentes de
Organization, Patient, Encounter, Practitioner y Assistant; agregará un
Procedure de cirugía DRAFT con detail para probar el shape, sin depender de
coincidencias de texto ni producir efectos externos. No se agregan datos al
seed de producción.

Pruebas `test:db` en PostgreSQL de test deben cubrir FKs tenant compuestas,
kind/detail, unicidad detail, cambio de kind atómico, DRAFT → FINALIZED → VOIDED,
mínimo de finalize, actor = responsable, perfil y snapshots/Owner histórico,
Patient archivado, roles, aislamiento cross-tenant, no hard delete, expected
version stale, actualizaciones concurrentes y carreras con Encounter VOID.
Fixtures se limpian lógicamente al terminar cada prueba, sin cambiar seed.

## 10. Fuera de 6F.2A

No implementar AnesthesiaRecord/Observation, frontend React, consentimiento,
firma, PDF, Storage, Appointment, reminders, Inventory, Sales, Billing, import
histórico, catálogos ni permisos de esos módulos. El trabajo de 6F.2A se detiene
al contrato aquí definido y no inicia Fase 6F.2B sin finalizar/verificar la
secuencia de fase solicitada.
