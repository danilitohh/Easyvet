# Propuesta cerrada de arquitectura — Preventive Care

## Alcance del checkpoint 6E.1.1

Este documento convirtió el análisis de la Fase 6E.1 en el contrato de diseño
que precedió a Prisma. La propuesta se implementó de forma controlada en Fase
6E.2 únicamente para backend; el frontend 6E.3 continúa pendiente.

La fuente legacy inspeccionada es el commit
`05fea495cb13208b27bf470b3570987fd501a81e` del checkout read-only de Lativet.

## Decisiones estructurales cerradas

- `Vaccination` y `Deworming` son modelos/tablas independientes.
- Ambos requieren siempre un `ClinicalEncounter` de la misma organización y
  Patient. No existe evento preventivo standalone en el MVP.
- Un Encounter admite `0..N` Vaccinations y `0..N` Dewormings. No hay unicidad
  artificial por Patient, producto, fecha o Encounter.
- Ambos usan el enum conceptual común `PreventiveRecordStatus` con
  `DRAFT`, `FINALIZED` y `VOIDED`; no se crea `applicationStatus`.
- Las fechas clínicas son civiles (`DATE` conceptual). Los timestamps técnicos
  son UTC.
- Los snapshots se crean únicamente al finalizar y nunca se rehidratan desde
  entidades actuales.
- No se agregan proyecciones preventivas a `Patient`.
- No hay integración de inventario, recordatorios, citas, documentos, storage,
  firma ni notificaciones en 6E.2.

## Relación y estados del Encounter padre

### Creación y edición

El endpoint de creación siempre crea un preventivo en `DRAFT` y solo acepta un
Encounter cuyo estado sea `DRAFT` o `FINALIZED`. Un Encounter `VOIDED` rechaza
la creación.

Un preventivo `DRAFT` puede actualizarse mientras el Encounter no esté
`VOIDED`; un preventivo `FINALIZED` o `VOIDED` no admite PATCH.

### Finalización

La finalización de un preventivo `DRAFT` solo procede si el Encounter está
`DRAFT` o `FINALIZED`. Si el Encounter está `VOIDED`, la operación falla.

### Anulación del padre

Si un preventivo ya `FINALIZED` tiene un Encounter que posteriormente pasa a
`VOIDED`, el preventivo permanece `FINALIZED`; nunca se auto-anula. La lectura y
los DTOs exponen `parentEncounterStatus` para hacer visible esa relación, igual
que en `Prescription`.

## Lifecycle preventivo

```text
DRAFT ──finalize──> FINALIZED ──void(reason)──> VOIDED
```

- `DRAFT`: editable, sin obligación de campos clínicos finales.
- `FINALIZED`: hecho clínico consolidado, con profesional y snapshots.
- `VOIDED`: terminal, conserva evidencia y motivo; no se reabre.
- No existe endpoint DELETE, ni siquiera para drafts abandonados.
- `VOID` requiere Practitioner autorizado, `expectedVersion` y `voidReason`.

El enum común `PreventiveRecordStatus` es correcto porque los tres valores
tienen exactamente la misma semántica en ambos dominios. No se introduce una
segunda dimensión de estado.

## Decisión sobre el `status` legacy

La UI legacy ofrecía `Aplicada`, `Proxima`, `No aplicada` y `Contraindicada`,
pero esos valores se serializaban dentro de una consulta genérica y no forman
un lifecycle clínico persistente. En Easyvet se rediseñan intencionalmente:

- `DRAFT` significa registro no consolidado.
- `FINALIZED` significa aplicación/administración registrada como hecho.
- `VOIDED` significa evidencia invalidada, conservada para auditoría.
- `nextDueOn` expresa planificación futura.

No habrá `applicationStatus` en 6E.2. Eventos planificados, no aplicados o
contraindicados requieren un diseño de producto posterior; no se simulan con
una falsa administración.

## Fechas y reglas temporales

| Campo                     | Tipo conceptual                   | Semántica                                                             |
| ------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `administeredOn`          | `DATE` nullable en draft          | Fecha civil del hecho. Obligatoria al finalizar.                      |
| `nextDueOn`               | `DATE` nullable                   | Planificación clínica; si existe, debe ser `>= administeredOn`.       |
| `expiryOn`                | `DATE` nullable, solo Vaccination | Snapshot del vencimiento informado. Nunca es obligatorio globalmente. |
| `createdAt`, `updatedAt`  | `TIMESTAMPTZ` UTC                 | Auditoría técnica.                                                    |
| `finalizedAt`, `voidedAt` | `TIMESTAMPTZ` UTC nullable        | Timestamps de transiciones.                                           |

No se impone `administeredOn <= today`; la validación de fechas futuras queda
como decisión de producto/regulación. Se permite `nextDueOn = administeredOn`.
No se impone `expiryOn >= administeredOn`: un hecho vencido o documentado
retrospectivamente debe poder conservarse sin rechazo de base.

No se crean `Appointment`, `Reminder`, `FollowUp` ni `Notification` por
efecto de `nextDueOn`.

## Identidad tenant-safe y snapshots

Ambas tablas contienen las siguientes columnas conceptuales exactas:

| Campo                                 | Nullability y regla                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                  | Requerido, UUID estable.                                                            |
| `organizationId`                      | Requerido, derivado del tenant activo.                                              |
| `clinicalEncounterId`                 | Requerido; FK compuesta al Encounter.                                               |
| `patientId`                           | Requerido; debe coincidir con el Encounter.                                         |
| `status`                              | Requerido, default `DRAFT`, enum `PreventiveRecordStatus`.                          |
| `version`                             | Requerido, default `1`, positivo.                                                   |
| `createdByMembershipId`               | Requerido, derivado de sesión; nunca client-controlled.                             |
| `responsiblePractitionerMembershipId` | Nullable en `DRAFT`; requerido al finalizar.                                        |
| `administeredByMembershipId`          | Nullable; Membership activa con `ClinicalRole.PRACTITIONER` o `CLINICAL_ASSISTANT`. |
| `patientNameSnapshot`                 | Nullable en draft; requerido al finalizar.                                          |
| `ownerDisplayNameSnapshot`            | Nullable en draft; al finalizar se deriva de `ClinicalEncounter.ownerIdAtTime`.     |
| `professionalDisplayNameSnapshot`     | Nullable en draft; requerido al finalizar.                                          |
| `professionalLicenseSnapshot`         | Nullable globalmente; copia de `MembershipProfessionalProfile.licenseNumber`.       |
| `administeredByDisplayNameSnapshot`   | Nullable; se crea al finalizar solo si existe `administeredByMembershipId`.         |
| `finalizedAt`                         | Nullable; requerido con `FINALIZED`/`VOIDED`.                                       |
| `finalizedByMembershipId`             | Nullable; requerido con `FINALIZED`/`VOIDED`.                                       |
| `voidedAt`                            | Nullable; requerido con `VOIDED`.                                                   |
| `voidedByMembershipId`                | Nullable; requerido con `VOIDED`.                                                   |
| `voidReason`                          | Nullable en otros estados; obligatorio y no vacío en `VOIDED`.                      |
| `createdAt`, `updatedAt`              | Requeridos, timestamps UTC.                                                         |

No se guarda snapshot de Organization en estos aggregates. No se copian
species, breed, sex ni microchip; pertenecen a un futuro Document/Certificate
snapshot si un requisito legal lo exige.

## Modelo exacto: `Vaccination`

Además de todas las columnas comunes anteriores, `Vaccination` contiene:

| Campo            | Tipo/nullable             | Regla                                                                                                 |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `administeredOn` | `DATE`, nullable en draft | Obligatorio al finalizar.                                                                             |
| `nextDueOn`      | `DATE`, nullable          | Debe ser `>= administeredOn` cuando ambos existen.                                                    |
| `vaccineName`    | String, nullable en draft | Obligatorio, trim y no vacío al finalizar. Texto libre.                                               |
| `vaccineType`    | String nullable           | Conserva clasificación legacy sin enum inicial.                                                       |
| `route`          | String nullable           | Columna propia, texto libre (`SC`, `IM`, `Oral`, `Intranasal`, etc.); sin catálogo.                   |
| `laboratoryName` | String nullable           | Nombre libre; se elige este nombre porque legacy usa consistentemente “laboratorio”. Sin Supplier FK. |
| `lotNumber`      | String nullable           | Texto libre trim; no unique; no obligatorio globalmente.                                              |
| `expiryOn`       | `DATE` nullable           | Snapshot; no bloquea finalización aunque preceda a `administeredOn`.                                  |
| `doseText`       | String nullable           | Texto libre; puede contener `1 ml`, fracciones, tabletas, gotas o “según peso”.                       |
| `notes`          | String nullable           | Observaciones clínicas acotadas.                                                                      |

El legacy `vaccination_followup_dose_type`, checkbox de seguimiento, intervalo
y días de recordatorio no crean columnas en 6E.2: la fecha clínica resultante,
si existe, se representa únicamente con `nextDueOn`.

Mínimo global de finalización: `administeredOn`, `vaccineName`,
`responsiblePractitionerMembershipId` válido y perfil profesional con
`displayName`. Ningún otro campo propio es obligatorio globalmente.

## Modelo exacto: `Deworming`

Además de todas las columnas comunes, `Deworming` contiene exactamente:

| Campo            | Tipo/nullable             | Regla                                                          |
| ---------------- | ------------------------- | -------------------------------------------------------------- |
| `administeredOn` | `DATE`, nullable en draft | Obligatorio al finalizar.                                      |
| `nextDueOn`      | `DATE`, nullable          | Debe ser `>= administeredOn` cuando ambos existen.             |
| `productName`    | String, nullable en draft | Obligatorio, trim y no vacío al finalizar. Texto libre.        |
| `dewormingType`  | String nullable           | Conserva el valor legacy sin compartir enum con `vaccineType`. |
| `doseText`       | String nullable           | Texto libre, igual que en Vaccination.                         |
| `notes`          | String nullable           | Único campo narrativo del evento en MVP.                       |

No se agrega `route`: legacy mezcla modalidad y vía dentro de `type` y no hay
evidencia suficiente para separar ambas. No se agrega `reason`: el único
“follow-up reason” legacy describe seguimiento, no una razón clínica distinta;
se representa `nextDueOn` y, si corresponde, `notes`.

El mínimo global de finalización es `administeredOn`, `productName`,
`responsiblePractitionerMembershipId` válido y perfil profesional con
`displayName`. `dewormingType`, dosis, próxima fecha, notes y administeredBy
son opcionales.

## Dosis, intervalos y campos legacy

Se elige `doseText String nullable` para ambos dominios. La evidencia legacy
contiene expresiones humanas (dosis, ml, tabletas, gotas y texto dependiente del
peso); imponer Decimal/unidad perdería información y exigiría un catálogo que
no existe.

- `deworming_last_date` no se copia: cada administración previa debe ser otro
  Deworming histórico. Queda **NO APLICA / REDISEÑADO**.
- `deworming_followup_interval_value/unit` y el checkbox de seguimiento no se
  conservan como campos redundantes. Si producen una fecha, se guarda solo
  `nextDueOn`; el intervalo textual queda descartado.
- `deworming_followup_reason` no es un `reason` del evento; se descarta como
  campo estructural y puede conservarse en `notes` únicamente mediante una
  decisión de importación legacy futura.

## Profesionales y workflow de asistente

`responsiblePractitionerMembershipId` debe apuntar a Membership `ACTIVE`, User
`ACTIVE`, `ClinicalRole.PRACTITIONER` y un `MembershipProfessionalProfile` con
`displayName`. `licenseNumber` es globalmente nullable y no se reemplaza por
email.

El actor de `FINALIZE` debe satisfacer:

```text
TenantContext.membershipId == responsiblePractitionerMembershipId
```

No existe finalize-on-behalf en MVP. `administeredByMembershipId` es opcional,
puede ser Practitioner o Clinical Assistant, y representa quién aplicó
físicamente el producto; no sustituye al responsable clínico. Debe pertenecer
al tenant, tener Membership/User activos y `clinicalRole` no nulo.

Clinical Assistant puede leer, crear DRAFT, actualizar DRAFT y figurar como
`administeredBy`; no puede finalizar ni anular. Practitioner puede ejecutar
las operaciones que sus permisos permitan. Un PlatformAdmin no obtiene bypass.

## Patient archivado y VOID

Con Patient `ARCHIVED` se rechazan crear, actualizar DRAFT y finalizar. La
lectura histórica sigue permitida. Un evento ya `FINALIZED` permanece así.
Se permite `FINALIZED → VOIDED` por Practitioner autorizado incluso si Patient
está archivado, porque corrige evidencia histórica y no crea actividad clínica.

`voidReason` es obligatorio; no hay hard delete ni reapertura.

## Inventario, reminders y documentos

6E.2 no contiene `inventoryProductId`, `inventoryBatchId`, descuento de stock,
reserva, venta, factura, Reminder, Appointment, FollowUp, Notification, PDF,
Storage ni Signature. `laboratoryName`, `lotNumber` y `expiryOn` son snapshots
clínicos independientes. Un workflow/outbox explícito futuro podrá integrar
`nextDueOn` sin mutar la transacción clínica.

## Auditoría, concurrencia y orden de locks

Se reutiliza `ClinicalAuditEvent`. 6E.2 añadió tipos de entidad
`VACCINATION` y `DEWORMING`, con acciones genéricas `CREATED`, `UPDATED`,
`FINALIZED` y `VOIDED`, usando el naming existente. Metadata mínima: versión,
operación y estado; nunca dosis, lote, notes ni nombres completos de Patient u
Owner.

Todas las mutaciones `PATCH DRAFT`, `FINALIZE` y `VOID` exigen
`expectedVersion`, usan CAS y transacción. El orden conceptual es:

```text
ClinicalEncounter → Patient → Vaccination/Deworming
```

En `FINALIZE` se añaden `Owner` histórico, Membership responsable y, si existe,
Membership administeredBy. Los locks de múltiples Membership se ordenan por ID
ascendente para evitar deadlocks.

Las carreras obligatorias de 6E.2 son Encounter VOID vs Create, Update y
Finalize. Si la mutación preventiva obtiene primero los locks, puede completar;
el posterior VOID del Encounter no auto-anula un preventivo ya finalizado. Si
Encounter VOID gana primero, la mutación preventiva falla.

## FKs e índices

Cada agregado incluye `organizationId` en sus FKs:

- `(clinicalEncounterId, organizationId, patientId)` →
  `ClinicalEncounter(id, organizationId, patientId)`.
- `(patientId, organizationId)` → `Patient(id, organizationId)`.
- Cada Membership actor usa `(membershipId, organizationId)`.
- `organizationId` referencia `Organization`.
- No hay FK Owner; el snapshot se deriva de `ClinicalEncounter.ownerIdAtTime`.

Índices concretos y mínimos:

1. `(organizationId, patientId, administeredOn, createdAt)` para historia.
2. `(organizationId, clinicalEncounterId)` para contexto.
3. `(organizationId, status)` para bandejas de trabajo.
4. `(organizationId, responsiblePractitionerMembershipId)` para agenda clínica.

No se añade ninguna unicidad por Patient, producto, fecha o Encounter.

## Permisos y role matrix

Permisos independientes, nunca `preventiveCare.*`:

```text
vaccinations.read
vaccinations.create
vaccinations.updateDraft
vaccinations.finalize
vaccinations.void
dewormings.read
dewormings.create
dewormings.updateDraft
dewormings.finalize
dewormings.void
```

| Rol                |       Read |     Create | Update DRAFT |   Finalize |       Void |
| ------------------ | ---------: | ---------: | -----------: | ---------: | ---------: |
| PRACTITIONER       |         Sí |         Sí |           Sí |         Sí |         Sí |
| CLINICAL_ASSISTANT |         Sí |         Sí |           Sí |         No |         No |
| Sin ClinicalRole   |         No |         No |           No |         No |         No |
| PlatformAdmin      | Sin bypass | Sin bypass |   Sin bypass | Sin bypass | Sin bypass |

## APIs exactas de 6E.2

Vaccination:

```text
GET   /patients/:patientId/vaccinations
GET   /vaccinations/:vaccinationId
POST  /clinical-encounters/:encounterId/vaccinations
PATCH /vaccinations/:vaccinationId
POST  /vaccinations/:vaccinationId/finalize
POST  /vaccinations/:vaccinationId/void
```

Deworming usa la misma forma con `dewormings` y `dewormingId`.

No existen endpoints child, delete, eventos standalone, catálogo, inventario,
reminders ni consultas polimórficas.

## Contratos Zod implementados

Sin compartir tipos Prisma con la API, 6E.2 implementa estos contratos:

- `vaccinationListQuerySchema` y `dewormingListQuerySchema`: `page` entero
  positivo (default `1`), `pageSize` entero `1..100` (default `20`),
  `status` opcional, `clinicalEncounterId` opcional, `from`/`to` opcionales
  como fechas civiles.
- `createVaccinationDraftSchema`: campos propios nullable de draft,
  `responsiblePractitionerMembershipId` y `administeredByMembershipId`
  opcionales; sin `organizationId`, actor, status ni Patient.
- `updateVaccinationDraftSchema`: mismo conjunto mutable más
  `expectedVersion` requerido.
- `finalizeVaccinationSchema`: únicamente `expectedVersion` requerido.
- `voidVaccinationSchema`: `expectedVersion` y `voidReason` requerido no vacío.
- Contratos equivalentes `createDewormingDraftSchema`,
  `updateDewormingDraftSchema`, `finalizeDewormingSchema` y
  `voidDewormingSchema`.
- `vaccinationSummarySchema`, `vaccinationDetailSchema`,
  `dewormingSummarySchema` y `dewormingDetailSchema`: campos públicos,
  snapshots y `parentEncounterStatus`, nunca modelos Prisma.

Listas ordenan `administeredOn DESC NULLS LAST`, luego `createdAt DESC` y luego
`id ASC`. DRAFT sin fecha sigue visible. El límite default es 20 y máximo 100.

## Mapeo conceptual legacy

| Legacy                               | Easyvet                             | Tratamiento                                                 |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| Consultation `Vacunacion`            | `ClinicalEncounter` + `Vaccination` | Transformación; no se conserva consulta polimórfica.        |
| `vaccination_date`                   | `administeredOn`                    | Directo como fecha civil.                                   |
| nombre/custom                        | `vaccineName`                       | Directo, con trim.                                          |
| type/route/lab/lot/expiry/dose/notes | campos propios                      | Directo, con `laboratoryName` y `doseText`.                 |
| seguimiento/next date                | `nextDueOn`                         | Solo fecha resultante; no reminder ni intervalo redundante. |
| `vaccination_status` de Patient      | Ningún campo                        | Proyección descartada.                                      |
| Consultation `Desparasitacion`       | `ClinicalEncounter` + `Deworming`   | Transformación; no consulta polimórfica.                    |
| date/product/type/dose/notes         | campos propios                      | Directo, con `dewormingType`.                               |
| last date/interval/follow-up reason  | Sin columnas equivalentes           | Rediseñados o postergados según reglas anteriores.          |
| `deworming_status` de Patient        | Ningún campo                        | Proyección descartada.                                      |

Si no existe profesional verificable, Encounter o contexto tenant completo en
un futuro import legacy, no se inventa Practitioner: se posterga a una
estrategia de importación especial.

## Producto pendiente y siguiente fase

No quedan decisiones estructurales necesarias para el schema de 6E.2. Solo
quedan decisiones genuinamente futuras/regulatorias: obligatoriedad jurisdiccional
de lote/licencia, importación histórica externa, certificados, biológicos
controlados, protocolos por especie y vínculo opcional con inventario.

La Fase 6E.2 implementó literalmente este contrato: dos modelos, migración
additive, contratos Zod, servicios tenant-safe, endpoints, permisos, auditoría,
CAS y pruebas de carreras. No incluye frontend; eso corresponde a 6E.3.
