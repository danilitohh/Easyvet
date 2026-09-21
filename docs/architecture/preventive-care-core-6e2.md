# Contrato exacto para Preventive Care — implementación 6E.2

Este documento es normativo para la futura implementación de Vaccination y
Deworming. No contiene código ni autoriza iniciar 6E.2 durante el checkpoint
6E.1.1.

## 1. Convenciones comunes

Cada tabla tiene `organizationId` y las siguientes columnas, en este orden
conceptual:

| Campo                                 | Tipo conceptual          | Nullability / regla                                                                          |
| ------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `id`                                  | UUID                     | Requerido, PK.                                                                               |
| `organizationId`                      | UUID                     | Requerido, derivado de TenantContext.                                                        |
| `clinicalEncounterId`                 | UUID                     | Requerido; el Encounter es obligatorio.                                                      |
| `patientId`                           | UUID                     | Requerido; debe coincidir con el Encounter.                                                  |
| `status`                              | `PreventiveRecordStatus` | Requerido, default `DRAFT`. Valores `DRAFT`, `FINALIZED`, `VOIDED`.                          |
| `version`                             | Int                      | Requerido, default `1`, siempre positivo.                                                    |
| `createdByMembershipId`               | UUID                     | Requerido, server-derived.                                                                   |
| `responsiblePractitionerMembershipId` | UUID                     | Nullable en DRAFT; requerido en FINALIZED/VOIDED.                                            |
| `administeredByMembershipId`          | UUID                     | Nullable; Practitioner o Clinical Assistant activos.                                         |
| `patientNameSnapshot`                 | String                   | Nullable en DRAFT; requerido al FINALIZE.                                                    |
| `ownerDisplayNameSnapshot`            | String                   | Nullable en DRAFT; requerido al FINALIZE y derivado de `ClinicalEncounter.ownerIdAtTime`.    |
| `professionalDisplayNameSnapshot`     | String                   | Nullable en DRAFT; requerido al FINALIZE.                                                    |
| `professionalLicenseSnapshot`         | String                   | Nullable siempre; copia de licencia del perfil.                                              |
| `administeredByDisplayNameSnapshot`   | String                   | Nullable; se llena al FINALIZE si existe administeredBy. No license snapshot para Assistant. |
| `finalizedAt`                         | TIMESTAMPTZ UTC          | Nullable; requerido en FINALIZED/VOIDED.                                                     |
| `finalizedByMembershipId`             | UUID                     | Nullable; requerido en FINALIZED/VOIDED.                                                     |
| `voidedAt`                            | TIMESTAMPTZ UTC          | Nullable; requerido en VOIDED.                                                               |
| `voidedByMembershipId`                | UUID                     | Nullable; requerido en VOIDED.                                                               |
| `voidReason`                          | String                   | Nullable fuera de VOIDED; requerido, trim y no vacío en VOIDED.                              |
| `createdAt`                           | TIMESTAMPTZ UTC          | Requerido.                                                                                   |
| `updatedAt`                           | TIMESTAMPTZ UTC          | Requerido.                                                                                   |

No hay `applicationStatus`, `source`, `externalId`, `organizationNameSnapshot`,
Owner FK ni campos de Patient de especie/raza/sexo/microchip.

## 2. Modelo `Vaccination`

Además de las columnas comunes, la tabla contiene exactamente:

| Campo            | Tipo conceptual | Nullability / regla                                                     |
| ---------------- | --------------- | ----------------------------------------------------------------------- |
| `administeredOn` | DATE            | Nullable en DRAFT; obligatorio al FINALIZE. No se limita contra hoy.    |
| `nextDueOn`      | DATE            | Nullable; si existe, `nextDueOn >= administeredOn`. Igualdad permitida. |
| `vaccineName`    | String          | Nullable en DRAFT; requerido, trim y no vacío al FINALIZE.              |
| `vaccineType`    | String          | Nullable; no enum en MVP.                                               |
| `route`          | String          | Nullable; texto libre, columna propia, sin catálogo farmacológico.      |
| `laboratoryName` | String          | Nullable; texto libre trim. Sin Supplier/Inventory FK.                  |
| `lotNumber`      | String          | Nullable; texto libre trim, no unique.                                  |
| `expiryOn`       | DATE            | Nullable; no obligación global ni check contra administeredOn.          |
| `doseText`       | String          | Nullable; conserva unidades/fracciones/texto humano.                    |
| `notes`          | String          | Nullable; narrativa clínica acotada.                                    |

### Mínimo de finalización Vaccination

`administeredOn`, `vaccineName`, `responsiblePractitionerMembershipId` válido y
perfil profesional con `displayName`. `vaccineType`, `route`,
`laboratoryName`, `lotNumber`, `expiryOn`, `doseText`, `nextDueOn` y `notes`
son opcionales.

## 3. Modelo `Deworming`

Además de las columnas comunes, la tabla contiene exactamente:

| Campo            | Tipo conceptual | Nullability / regla                                             |
| ---------------- | --------------- | --------------------------------------------------------------- |
| `administeredOn` | DATE            | Nullable en DRAFT; obligatorio al FINALIZE.                     |
| `nextDueOn`      | DATE            | Nullable; si existe, `nextDueOn >= administeredOn`.             |
| `productName`    | String          | Nullable en DRAFT; requerido, trim y no vacío al FINALIZE.      |
| `dewormingType`  | String          | Nullable; taxonomía propia, sin compartir enum con vaccineType. |
| `doseText`       | String          | Nullable; texto libre.                                          |
| `notes`          | String          | Nullable; único texto narrativo estructural del MVP.            |

No existen `route`, `reason`, `lastAdministrationOn`, `intervalText`,
`reminderDays`, `followUp`, `inventoryProductId` ni `inventoryBatchId`.

### Mínimo de finalización Deworming

`administeredOn`, `productName`, `responsiblePractitionerMembershipId` válido y
perfil profesional con `displayName`. Todos los demás campos propios son
opcionales.

## 4. Parent Encounter y multiplicidad

- Create: solo parent `DRAFT` o `FINALIZED`; crea siempre preventive `DRAFT`.
- Update DRAFT: permitido si parent no es `VOIDED`.
- Finalize: permitido si parent es `DRAFT` o `FINALIZED`.
- Parent `VOIDED`: bloquea create/update/finalize de preventivo DRAFT.
- Preventivo `FINALIZED` no se auto-void cuando parent pasa a `VOIDED`;
  responses exponen `parentEncounterStatus`.
- Un Encounter tiene `0..N` Vaccinations y `0..N` Dewormings.
- No hay unique por Patient, producto, fecha, dosis o Encounter.
- No se soportan preventivos standalone.

## 5. Lifecycle y operaciones

```text
DRAFT → FINALIZED → VOIDED
```

- `PATCH` solo sobre `DRAFT` y con `expectedVersion`.
- `FINALIZE` solo desde `DRAFT`, con `expectedVersion`; el actor de sesión
  debe ser exactamente `responsiblePractitionerMembershipId`.
- `VOID` solo desde `FINALIZED`, con `expectedVersion`, Practitioner autorizado
  y `voidReason`; no requiere ser el responsable original.
- No hay reopening ni endpoint DELETE. Drafts abandonados permanecen.

## 6. Fechas, profesionales y snapshots

`administeredOn`, `nextDueOn` y `expiryOn` son fechas civiles. `createdAt`,
`updatedAt`, `finalizedAt` y `voidedAt` son timestamps UTC. No se generan
Appointment, Reminder, FollowUp ni Notification.

El responsable debe tener Membership y User `ACTIVE`, `ClinicalRole.PRACTITIONER`
y `MembershipProfessionalProfile.displayName`; `licenseNumber` puede ser null.
`administeredByMembershipId` es opcional, tenant-safe y admite Practitioner o
Clinical Assistant con `clinicalRole` no nulo.

Los cinco snapshots se calculan únicamente en FINALIZE:

1. `professionalDisplayNameSnapshot`.
2. `professionalLicenseSnapshot` (puede ser null).
3. `administeredByDisplayNameSnapshot` si existe administeredBy.
4. `patientNameSnapshot`.
5. `ownerDisplayNameSnapshot` desde `ownerIdAtTime` del Encounter.

Después de FINALIZE nunca se rehidratan desde User, Membership, Patient u Owner.

## 7. Dosis y transformación legacy

`doseText String nullable` es deliberado para ambos modelos: legacy contiene
ml, fracciones, tabletas, gotas y expresiones como “según peso”.

- `vaccination_date` y `deworming_date` → `administeredOn`.
- `vaccination_name/custom` → `vaccineName`.
- `vaccination_type` → `vaccineType`.
- `vaccination_route` → `route`.
- `vaccination_lab` → `laboratoryName`.
- lot/expiration/dose/notes → `lotNumber`/`expiryOn`/`doseText`/`notes`.
- `deworming_product/type/dose/notes` → `productName`/`dewormingType`/`doseText`/`notes`.
- follow-up con fecha → `nextDueOn`; intervalo sin fecha no se conserva.
- `deworming_last_date` no se copia: requiere otro evento histórico.
- labels legacy Aplicada/Proxima/No aplicada/Contraindicada no se convierten en
  `applicationStatus`.

## 8. Patient archivado, inventario y documentos

Patient `ARCHIVED` bloquea create, update DRAFT y finalize; permite lectura
histórica y `FINALIZED → VOIDED` por Practitioner autorizado. No hay Patient
projections preventivas. No hay inventario, stock, reserva, compra, venta,
factura, certificado, PDF, Storage ni Signature en 6E.2.

## 9. Auditoría, CAS y locks

Reutilizar `ClinicalAuditEvent` con entity types `VACCINATION` y `DEWORMING` y
acciones genéricas `CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`. Metadata mínima
incluye operación, actor y versiones; no incluye dosis, lote, notes ni PII
completa.

`version` inicia en `1`. `expectedVersion` es obligatorio en PATCH, FINALIZE y
VOID; el servicio responde conflicto ante stale version.

Lock order:

```text
ClinicalEncounter → Patient → Vaccination/Deworming
```

Finalize añade `Owner histórico → responsible Membership → administeredBy
Membership`; múltiples Membership se bloquean ordenadas por ID. 6E.2 debe
probar Encounter VOID concurrente con Create, Update y Finalize.

## 10. FKs e índices

- `organizationId` → Organization.
- `(clinicalEncounterId, organizationId, patientId)` → Encounter compuesto.
- `(patientId, organizationId)` → Patient compuesto.
- Cada actor Membership usa `(id, organizationId)`.
- No existe FK Owner en el agregado.

Índices mínimos:

1. `(organizationId, patientId, administeredOn, createdAt)`.
2. `(organizationId, clinicalEncounterId)`.
3. `(organizationId, status)`.
4. `(organizationId, responsiblePractitionerMembershipId)`.

## 11. Permisos y APIs

Permisos separados:

```text
vaccinations.read/create/updateDraft/finalize/void
dewormings.read/create/updateDraft/finalize/void
```

PRACTITIONER tiene todos; CLINICAL_ASSISTANT solo read/create/updateDraft;
sin ClinicalRole no tiene ninguno; PlatformAdmin no hace bypass.

Vaccination:

```text
GET   /patients/:patientId/vaccinations
GET   /vaccinations/:vaccinationId
POST  /clinical-encounters/:encounterId/vaccinations
PATCH /vaccinations/:vaccinationId
POST  /vaccinations/:vaccinationId/finalize
POST  /vaccinations/:vaccinationId/void
```

Deworming es equivalente con `/dewormings` y `:dewormingId`.

## 12. Contratos, listas y paginación

Contratos Zod futuros, separados de Prisma:

`vaccinationListQuerySchema`, `dewormingListQuerySchema`,
`createVaccinationDraftSchema`, `updateVaccinationDraftSchema`,
`finalizeVaccinationSchema`, `voidVaccinationSchema`,
`createDewormingDraftSchema`, `updateDewormingDraftSchema`,
`finalizeDewormingSchema`, `voidDewormingSchema`,
`vaccinationSummarySchema`, `vaccinationDetailSchema`,
`dewormingSummarySchema`, `dewormingDetailSchema`.

List query: `page` default 1, `pageSize` default 20 y máximo 100, filtros
opcionales `status`, `clinicalEncounterId`, `from`, `to`. Orden determinista:
`administeredOn DESC NULLS LAST`, `createdAt DESC`, `id ASC`.

## 13. Preguntas futuras permitidas

Solo permanecen fuera del contrato: requisitos jurisdiccionales de lote/licencia,
importación histórica externa, certificados, biológicos controlados, protocolos
por especie y vínculo de inventario. Ninguna es necesaria para construir el
schema base de 6E.2.
