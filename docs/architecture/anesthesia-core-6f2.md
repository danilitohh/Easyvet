# Contrato literal: Anesthesia backend — Fase 6F.2B

Este es el contrato aprobado por el Design Gate 6F.1.1 para la fase backend
6F.2B. Es diseño, no implementación: no añade todavía modelos Prisma,
migraciones, endpoints, permisos registrados, seed ni código funcional. Depende
del núcleo Procedure de [procedures-core-6f2.md](procedures-core-6f2.md), que
se implementa y verifica por separado en 6F.2A.

## 1. Agregado y cardinalidades

- `AnesthesiaRecord` es un agregado independiente con lifecycle propio.
- Siempre requiere Organization, Patient y ClinicalEncounter del mismo tenant.
- `clinicalProcedureId` es nullable para anestesia/sedación sin Procedure
  específico. Si se indica, Procedure debe compartir Organization, Patient y
  Encounter y no estar VOIDED al crear, modificar o finalizar el Draft.
- Encounter tiene 0..N registros anestésicos; Procedure también puede tener
  0..N. No crear unicidad 1:1 ni restricciones por nombre/hora.
- Encounter DRAFT o FINALIZED es elegible; VOIDED bloquea create, update de
  Draft y finalize. Parent Procedure puede estar DRAFT o FINALIZED; VOIDED bloquea
  mutaciones/finalización de Draft enlazado.
- Finalized Anesthesia no hereda void de padres. Se conserva FINALIZED y la API
  muestra `parentEncounterStatus` y nullable `parentProcedureStatus`.
- No relacionar `AnesthesiaObservation` con `VitalMeasurement` ni actualizar
  `Patient.currentWeightKg`.

## 2. Esquema exacto

### Enum `AnesthesiaRecordStatus`

```text
DRAFT
FINALIZED
VOIDED
```

Es enum independiente de `ClinicalProcedureStatus`, aunque comparte sus tres
labels. No agregar `IN_PROGRESS`, cancelación ni estado heredado.

### Modelo `AnesthesiaRecord`

Campos completos. `String?` es nullable; instantes son `TIMESTAMPTZ(3)` UTC.

| Campo                                 | Tipo                     | Nullable / regla                                                             |
| ------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `id`                                  | UUID                     | No; PK generado.                                                             |
| `organizationId`                      | UUID                     | No; derivado de TenantContext.                                               |
| `clinicalEncounterId`                 | UUID                     | No; Encounter requerido.                                                     |
| `clinicalProcedureId`                 | UUID                     | Sí; si existe, parents deben coincidir en organization, patient y encounter. |
| `patientId`                           | UUID                     | No; debe coincidir con Encounter y Procedure vinculado.                      |
| `status`                              | `AnesthesiaRecordStatus` | No; default `DRAFT`.                                                         |
| `version`                             | Int                      | No; default `1`, siempre `>= 1`.                                             |
| `startedAt`                           | TIMESTAMPTZ(3)           | Sí en DRAFT; requerido en FINALIZED/VOIDED.                                  |
| `endedAt`                             | TIMESTAMPTZ(3)           | Sí en DRAFT; requerido en FINALIZED/VOIDED; no anterior a startedAt.         |
| `asaClassification`                   | String                   | Sí; se conserva como texto nullable, sin enum ASA.                           |
| `technique`                           | String                   | Sí; técnica anestésica narrativa.                                            |
| `preAnestheticAssessment`             | String                   | Sí; evaluación narrativa previa.                                             |
| `medicationsText`                     | String                   | Sí; lista narrativa heterogénea, sin estructura farmacológica.               |
| `airwayManagement`                    | String                   | Sí; manejo de vía aérea narrativo.                                           |
| `fluidsText`                          | String                   | Sí; fluidos narrativos, sin tasas/volúmenes asumidos.                        |
| `complications`                       | String                   | Sí; `NULL` no documentado; texto explícito puede registrar ausencia.         |
| `recoveryNotes`                       | String                   | Sí; observación narrativa de recuperación, no enum.                          |
| `notes`                               | String                   | Sí; nota anestésica residual.                                                |
| `createdByMembershipId`               | UUID                     | No; actor server-derived al crear.                                           |
| `responsiblePractitionerMembershipId` | UUID                     | Sí en DRAFT; Practitioner requerido al finalizar.                            |
| `patientNameSnapshot`                 | String                   | Sí en DRAFT; requerido al finalizar.                                         |
| `ownerDisplayNameSnapshot`            | String                   | Sí en DRAFT; requerido al finalizar, desde Owner histórico del Encounter.    |
| `professionalDisplayNameSnapshot`     | String                   | Sí en DRAFT; requerido al finalizar desde perfil profesional.                |
| `professionalLicenseSnapshot`         | String                   | Sí; copia nullable de la licencia vigente.                                   |
| `finalizedAt`                         | TIMESTAMPTZ(3)           | Sí; requerido en FINALIZED/VOIDED.                                           |
| `finalizedByMembershipId`             | UUID                     | Sí; requerido en FINALIZED/VOIDED.                                           |
| `voidedAt`                            | TIMESTAMPTZ(3)           | Sí; requerido solo en VOIDED.                                                |
| `voidedByMembershipId`                | UUID                     | Sí; requerido solo en VOIDED.                                                |
| `voidReason`                          | String                   | Sí; requerido, trim no vacío, solo en VOIDED.                                |
| `createdAt`                           | TIMESTAMPTZ(3)           | No; default now.                                                             |
| `updatedAt`                           | TIMESTAMPTZ(3)           | No; cambia con cada mutación aceptada del agregado.                          |

No se almacenan snapshots de especie/raza/sexo/microchip/peso ni un owner
mutable. `clinicalRecordId` se deriva del Encounter.

### Modelo `AnesthesiaObservation`

Cada fila es un punto de monitorización. Lista exacta, sin campos genéricos JSON:

| Campo                      | Tipo           | Nullable / regla                                                        |
| -------------------------- | -------------- | ----------------------------------------------------------------------- |
| `id`                       | UUID           | No; PK generado.                                                        |
| `organizationId`           | UUID           | No; mismo tenant que AnesthesiaRecord.                                  |
| `anesthesiaRecordId`       | UUID           | No; registro padre obligatorio.                                         |
| `observedAt`               | TIMESTAMPTZ(3) | No; instante completo UTC, no HH:mm aislado.                            |
| `heartRateBpm`             | Int            | Sí; latidos/minuto.                                                     |
| `respiratoryRatePerMinute` | Int            | Sí; respiraciones/minuto.                                               |
| `temperatureC`             | Decimal(5,2)   | Sí; temperatura en °C.                                                  |
| `bloodPressureText`        | String         | Sí; texto original, puede contener sistólica/diastólica y forma legacy. |
| `spo2Percent`              | Decimal(5,2)   | Sí; porcentaje, sin imponer rango clínico no acordado.                  |
| `etco2MmHg`                | Decimal(6,2)   | Sí; CO₂ al final de espiración en mmHg.                                 |
| `anestheticPlane`          | String         | Sí; descripción textual, no enum.                                       |
| `notes`                    | String         | Sí; observación libre equivalente a `observations` legacy.              |
| `createdAt`                | TIMESTAMPTZ(3) | No; default now.                                                        |
| `updatedAt`                | TIMESTAMPTZ(3) | No; se actualiza al corregir un Draft.                                  |

Null significa no registrado; no sustituirlo por cero. Inputs numéricos deben
ser números finitos en las unidades anteriores. No agregar límites de dosis,
rangos clínicos ni valores default sin política clínica. Un punto requiere
`observedAt` y al menos un campo de medida/plano/nota con dato; no se persisten
filas vacías. Los nombres de campo normalizan los campos legacy verificados
`time`, `heartRate`, `respiratoryRate`, `temperature`, `bloodPressure`, `spo2`,
`etco2`, `plane`, `observations`.

## 3. Semántica y workflow

- Lifecycle: `DRAFT → FINALIZED → VOIDED`, sin reopen ni hard delete de
  AnesthesiaRecord. Void solo acepta FINALIZED con motivo no vacío y conserva
  las observaciones.
- Draft admite campos incompletos, timestamps null y observaciones editables.
- Para FINALIZE se requieren `startedAt`, `endedAt`, `endedAt >= startedAt`,
  Practitioner responsable activo, perfil Professional con `displayName` no
  vacío y autoría del actor igual al responsable. Licencia puede ser null.
- No exigir ASA, medicamento, fluido, vía aérea, técnica ni al menos una
  observación para FINALIZE; la calidad clínica de esos datos queda a decisión
  del profesional. Esto evita convertir la ausencia legacy en dato requerido.
- ASA se persiste en `asaClassification String?`: Lativet usa valores
  inconsistentes y el texto `Emergency` no es una clase ASA. No enum ni
  normalización silenciosa.
- Medicamentos quedan en `medicationsText`; fluidos en `fluidsText`. No crear
  `AnesthesiaMedication`, FK Prescription/Medication/Inventory, tasas ni
  volúmenes cuyo shape no esté respaldado. No hay stock, Sale, Invoice ni
  facturación.
- `airwayManagement`, technique, evaluación, complications, recovery y notes
  son texto nullable; no copiar JSON completo.
- Practitioner responsable anestésico usa nombre neutral y
  `ClinicalRole.PRACTITIONER`; no exigir título de “anestesiólogo”. Snapshot
  profesional se genera en finalize desde ProfessionalProfile bajo lock. No
  finalize-on-behalf.
- Patient `ARCHIVED` aplica la misma política de escritura que Procedure:
  bloquea create, update de Draft y finalize; conserva read histórico y permite
  void de evidencia final por Practitioner autorizado.
- Si Encounter o Procedure padre se anula después, Anesthesia FINALIZED
  permanece FINALIZED. Un Anesthesia DRAFT con padre VOIDED no se actualiza ni
  finaliza. No hay propagación automática de lifecycle.
- Snapshots de paciente y Owner se escriben una sola vez al finalizar. Owner se
  resuelve desde `ClinicalEncounter.ownerIdAtTime`, nunca desde relación actual
  de Patient. No rehidratar snapshots desde fuentes vivas.

## 4. Estrategia de observations y CAS

`AnesthesiaRecord.version` gobierna todo el agregado; Observation no tiene
version propia. Agregar/corregir/quitar observación requiere
`expectedVersion`, bloquea los padres y el record, muta la fila, incrementa la
versión del record exactamente una vez y registra un ClinicalAuditEvent en la
misma transacción. Una `count != 1` o expectedVersion obsoleta devuelve 409 sin
dejar mutación parcial.

Observations se pueden insertar, corregir y eliminar físicamente solo mientras
AnesthesiaRecord está DRAFT. Tras FINALIZE son inmutables y no hay endpoint de
corrección ni DELETE. El borrado Draft queda registrado como operación auditada
del aggregate padre. Timestamps de observations son absolutos; no se impone
constraint duro dentro de `[startedAt, endedAt]`, porque la corrección o captura
retrospectiva puede quedar levemente fuera. API/UI puede advertir discrepancia,
pero conserva el instante introducido. El padre sí exige `endedAt >= startedAt`
cuando ambos existen.

Orden de lectura explícito:

```text
observedAt ASC, createdAt ASC, id ASC
```

Sin unicidad por `observedAt`: varias mediciones pueden compartir instante.

## 5. API 6F.2B

Todas las rutas requieren sesión, TenantContext, scope Organization y permiso.

| Método   | Ruta                                                                  | Acción                                                         |
| -------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `GET`    | `/patients/:patientId/anesthesia-records`                             | Lista paginada; acepta filtros encounter/procedure/status.     |
| `GET`    | `/anesthesia-records/:anesthesiaRecordId`                             | Detalle, observaciones ordenadas y estados actuales de padres. |
| `POST`   | `/clinical-encounters/:encounterId/anesthesia-records`                | Crear Draft; link a Procedure opcional en body.                |
| `PATCH`  | `/anesthesia-records/:anesthesiaRecordId`                             | Actualizar campos Draft del registro.                          |
| `POST`   | `/anesthesia-records/:anesthesiaRecordId/observations`                | Agregar observation Draft.                                     |
| `PATCH`  | `/anesthesia-records/:anesthesiaRecordId/observations/:observationId` | Corregir observation Draft.                                    |
| `DELETE` | `/anesthesia-records/:anesthesiaRecordId/observations/:observationId` | Eliminar observation solo si padre DRAFT.                      |
| `POST`   | `/anesthesia-records/:anesthesiaRecordId/finalize`                    | Finalizar, actor debe ser responsable.                         |
| `POST`   | `/anesthesia-records/:anesthesiaRecordId/void`                        | Anular record FINALIZED con razón.                             |

No existe DELETE de AnesthesiaRecord. IDs, tenant, actor, lifecycle, versión,
snapshots y metadata terminal son server-derived o ruta-derived, no aceptados
desde create/patch.

## 6. Contratos HTTP y paginación

Schemas Zod y TypeScript types inferidos se definen en el paquete compartido, no
acoplados a Prisma.

| Contrato                      | Shape normativo                                                                                                                                                                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateAnesthesiaRecord`      | `clinicalProcedureId?`, `startedAt?`, `endedAt?`, `asaClassification?`, `technique?`, `preAnestheticAssessment?`, `medicationsText?`, `airwayManagement?`, `fluidsText?`, `complications?`, `recoveryNotes?`, `notes?`, `responsiblePractitionerMembershipId?`. Sin IDs tenant/actor/status/version/snapshots. |
| `UpdateAnesthesiaRecord`      | `{ expectedVersion, ...partial editable fields de Draft }`; unknown keys rechazados.                                                                                                                                                                                                                           |
| `FinalizeAnesthesiaRecord`    | `{ expectedVersion }`.                                                                                                                                                                                                                                                                                         |
| `VoidAnesthesiaRecord`        | `{ expectedVersion, reason }`; actor server-derived.                                                                                                                                                                                                                                                           |
| `AnesthesiaRecordListQuery`   | `page=1`, `pageSize=20` default/max 100; filtros opcionales `clinicalEncounterId`, `clinicalProcedureId`, `status`, `responsiblePractitionerMembershipId`, `from`, `to` sobre startedAt; `from <= to`. Patient va en ruta.                                                                                     |
| `AddAnesthesiaObservation`    | `{ expectedVersion, observedAt, heartRateBpm?, respiratoryRatePerMinute?, temperatureC?, bloodPressureText?, spo2Percent?, etco2MmHg?, anestheticPlane?, notes? }`; exige al menos un dato además de tiempo.                                                                                                   |
| `UpdateAnesthesiaObservation` | `{ expectedVersion, ...partial measurement fields, observedAt? }`; `observedAt`, cuando se envía, debe ser ISO-8601 y solo puede corregirse mientras el registro padre está DRAFT.                                                                                                                             |
| `RemoveAnesthesiaObservation` | `{ expectedVersion }` en body DELETE.                                                                                                                                                                                                                                                                          |
| `AnesthesiaRecordSummary`     | IDs parent, status/version, tiempos, responsable, snapshots resumidos, timestamps y `parentEncounterStatus`/`parentProcedureStatus`.                                                                                                                                                                           |
| `AnesthesiaRecordDetail`      | Summary + campos narrativos completos + observations ordenadas; no omite statuses parent.                                                                                                                                                                                                                      |

Orden de lista de registros:
`startedAt DESC NULLS LAST, createdAt DESC, id ASC`. Respuestas serializan
instantes ISO-8601. Stale CAS, padre VOIDED, Patient ARCHIVED, permiso insuficiente
y operación sobre estado terminal usan el error envelope existente y código
estable; conflictos de invariantes devuelven 409.

## 7. Permisos

Registrar exactamente:

```text
anesthesia.read
anesthesia.create
anesthesia.updateDraft
anesthesia.finalize
anesthesia.void
```

`anesthesia.updateDraft` cubre update del record y create/update/remove de todas
las observations Draft; no crear tres permisos separados de observations.
`PRACTITIONER` tiene las cinco acciones. `CLINICAL_ASSISTANT` solo read/create/
updateDraft, lo que incluye registrar monitorización Draft, pero no finalize ni
void. Sin ClinicalRole, OWNER/ADMIN y PLATFORM_ADMIN no tienen acceso implícito
ni bypass.

## 8. Locks, CAS y política de carreras

Orden global de mutación:

```text
ClinicalEncounter → Patient → ClinicalProcedure (si está vinculado)
→ AnesthesiaRecord → Owner histórico (cuando se captura snapshot)
→ Memberships ordenadas y deduplicadas por ID
```

Coincide con Encounter → Patient usado por Clinical/Prescriptions/Preventive
Care. Procedure se bloquea antes que AnesthesiaRecord, evitando inversión con
Procedure VOID. Un record standalone omite solo el lock Procedure. Memberships
incluyen creator, responsable, actor y padre Assistant si aplica; al adquirir
varias, ordenar por ID. GET no bloquea ni lee snapshots vivos para reescribirlos.

Si Encounter VOID adquiere primero el parent lock, create/update/finalize Draft
fracasa; si la mutation gana primero, confirma antes del VOID de Encounter. Para
record ligado, rige igual carrera entre Procedure VOID y operaciones de
Anesthesia Draft: Procedure VOID primero bloquea la mutación; si Anesthesia
adquiere locks primero y confirma, el void sigue después. Anesthesia FINALIZED
no se revierte en ninguna carrera de void padre.

Create inicia version 1. PATCH, observations, FINALIZE y VOID exigen
expectedVersion, comparan status permitido y versión y suman 1 por operación
aceptada. Observations y audit son atómicos con el parent version update. Una
versión obsoleta devuelve conflicto sin side-effects.

## 9. Constraints, migración e índices

Crear migración Prisma aditiva de 6F.2B, sin editar migraciones anteriores y sin
backfill automático Lativet. FKs con `ON DELETE RESTRICT`, `ON UPDATE CASCADE`:

- organization a Organization;
- `(clinicalEncounterId, organizationId, patientId)` a Encounter;
- `(patientId, organizationId)` a Patient;
- opcionalmente `(clinicalProcedureId, organizationId, clinicalEncounterId,
patientId)` a la unique compuesta de ClinicalProcedure establecida en 6F.2A;
- actor/responsable/finalizer/voider a Membership `(id, organizationId)`;
- observation `(anesthesiaRecordId, organizationId)` a AnesthesiaRecord
  `(id, organizationId)`.

Checks SQL: `version >= 1`; DRAFT sin terminal metadata; FINALIZED requiere
startedAt/endedAt, responsable, snapshots obligatorios y finalizedAt/by con
void metadata nula; VOIDED conserva requisitos finales y añade voidedAt/by y
voidReason trim no vacío; `endedAt >= startedAt` si ambos están presentes.
Observations requieren `observedAt`; sus medidas son nullable y no se agregan
checks de intervalo clínico ni timestamps dentro del episodio. El servicio
valida rol clínico y consistencia de parent status, invariantes que cruzan
Membership/otra fila.

Índices mínimos:

1. `(organization_id, patient_id, started_at DESC NULLS LAST, created_at DESC, id ASC)`.
2. `(organization_id, clinical_encounter_id)`.
3. `(organization_id, status)`.
4. `(organization_id, responsible_practitioner_membership_id, started_at DESC)`.
5. `(organization_id, clinical_procedure_id, started_at DESC)` con filtro
   `clinical_procedure_id IS NOT NULL`.
6. `(organization_id, anesthesia_record_id, observed_at ASC, created_at ASC, id ASC)`.

## 10. Audit, seed y pruebas

Reusar `ClinicalAuditEvent`, entity type `ANESTHESIA_RECORD`, actions comunes
`CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`; no crear entity type de
`AnesthesiaObservation`. Observation mutations se auditan como `UPDATED` con
metadata operacional `operation=OBSERVATION_CREATED|OBSERVATION_UPDATED|
OBSERVATION_REMOVED`, `previousVersion`, `newVersion`, `changedFieldNames` y
count mínima. Nunca guardar valores monitorizados, narrative, medicamentos,
findings, complicaciones ni nombres/PII en metadata.

Seed dev idempotente añade un AnesthesiaRecord Draft enlazado al fixture
Procedure de cirugía de 6F.2A con dos observations sintéticas completas en
unidades declaradas. No requiere que toda anesthesia tenga Procedure; esa
cardinalidad se prueba en DB tests, junto con episodios múltiples.

`test:db` cubre mismo tenant/parents, link null y válido, rechazo de link cross-
tenant/patient/encounter, multiplicidad 0..N, lifecycle independiente,
timestamps, mínimos de finalize, actor/profesional/snapshots/Owner histórico,
medications/fluids narrativos, Assistant read/create/update-observations pero
sin finalize/void, expectedVersion en operaciones, observations add/edit/remove
solo DRAFT y orden ASC, permisos, Patient archived, locks y carreras de parent
VOID, FKs RESTRICT y ausencia de audit con payload clínico.

## 11. Fuera de 6F.2B

No UI React, PDFs, Consent, Signature, Storage, Inventory, billing, Medication
catalog/administración estructurada, dispositivos, integración de monitores,
exportaciones ni importación legacy automática. No empezar esta fase como parte
de 6F.2A: se ejecuta únicamente después de cerrar y validar 6F.2A.
