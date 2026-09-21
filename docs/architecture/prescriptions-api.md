# API de prescripciones — Fase 6D.2 / cliente 6D.3B

La implementación backend de prescripciones mantiene cada receta dentro de un
`ClinicalEncounter` y del tenant de la sesión. No crea recetas administrativas,
no expone modelos Prisma y no produce efectos secundarios de documentos,
inventario, ventas, facturación o correo.

## Endpoints

| Método  | Ruta                                                     | Permiso                     | Resultado                                                   |
| ------- | -------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- |
| `GET`   | `/api/v1/patients/:patientId/prescriptions`              | `prescriptions.read`        | Lista paginada, filtrable por estado y Encounter.           |
| `GET`   | `/api/v1/prescriptions/:prescriptionId`                  | `prescriptions.read`        | Detalle con items y estado del Encounter padre.             |
| `POST`  | `/api/v1/clinical-encounters/:encounterId/prescriptions` | `prescriptions.create`      | Crea un `DRAFT`; el Patient se deriva del Encounter.        |
| `PATCH` | `/api/v1/prescriptions/:prescriptionId`                  | `prescriptions.updateDraft` | Reemplaza cabecera editable e items completos usando CAS.   |
| `POST`  | `/api/v1/prescriptions/:prescriptionId/finalize`         | `prescriptions.finalize`    | Congela snapshots y pasa a `FINALIZED`.                     |
| `POST`  | `/api/v1/prescriptions/:prescriptionId/void`             | `prescriptions.void`        | Anula una receta finalizada con motivo; no borra evidencia. |

No existen endpoints independientes para `PrescriptionItem` ni endpoint de
delete.

El cliente React de 6D.3B consume estos mismos endpoints mediante
`prescriptionsApi`; no se creó un endpoint paralelo ni se cambió el contrato de
Prisma. `POST` de creación recibe únicamente el Encounter contextual, `PATCH`
reemplaza cabecera/items completos, y finalize/void reciben solo los campos CAS
correspondientes. Snapshots, tenant, actor y auditoría permanecen derivados en
backend.

## Contratos y reglas

Las respuestas separan `PrescriptionSummary`, `PrescriptionDetail` e
`PrescriptionItem`. El resumen incluye `itemCount` sin cargar el contenido de
cada item. Todas contienen `version`; las mutaciones reciben
`expectedVersion`. Un conflicto de versión devuelve `409` con
`PRESCRIPTION_STALE` y no escribe auditoría.

La creación acepta cero o más items y solo procede si el Encounter está
`DRAFT` o `FINALIZED` y el Patient está activo. El PATCH solo opera sobre un
`DRAFT`, reemplaza el conjunto completo de items atómicamente y conserva el
prescriptor cuando el campo se omite. Finalizar exige al menos un item con
`medicationName` no vacío, Patient activo, prescriptor activo con
`ClinicalRole=PRACTITIONER`, perfil con `displayName` y que el actor sea el
prescriptor. Finalizar y anular son transacciones CAS.

`patientNameSnapshot`, `ownerDisplayNameSnapshot`, `diagnosisSnapshot`,
`professionalDisplayNameSnapshot` y `professionalLicenseSnapshot` se fijan al
finalizar. El estado actual del Encounter padre se devuelve como
`parentEncounterStatus`; anular el Encounter no modifica la receta.

Los items enviados por create/PATCH se aceptan como texto libre acotado (máximo
100 items; nombre de 1–500 caracteres no vacíos; presentación/dosis/frecuencia/
duración hasta 500; cantidad hasta 200; observaciones hasta 2.000). El backend
recorta valores, ordena por la posición recibida y persiste posiciones contiguas
`0..N-1`; la base también protege posiciones no negativas, nombres no vacíos y
unicidad por receta. Un Draft puede quedar sin items, pero no puede finalizarse
así.

## Concurrencia y locks

Las operaciones críticas usan una transacción y compare-and-set por
`expectedVersion`. Create, PATCH y finalize toman locks PostgreSQL en orden
determinista:

```text
ClinicalEncounter → Patient → Prescription
```

Finalize additionally locks the historical Owner and prescriber Membership
before reading their current identity data. Owner edits and professional-profile
upserts use the same row locks, so finalized snapshots cannot race a source
identity update.

`voidEncounter` bloquea primero el Encounter y `archive Patient` bloquea primero
el Patient para que una receta nunca confirme una validación de estado que ya
quedó obsoleta. Void de Prescription bloquea su propia fila y no modifica al
Encounter. Si el Encounter se anula primero, create/update/finalize devuelve
`PARENT_CLINICAL_ENCOUNTER_VOIDED`; si la receta obtiene primero el lock, la
operación confirma y el Encounter puede anularse después sin auto-anular la
receta finalizada. Los items se borran y recrean dentro de la misma transacción,
por lo que nunca se observa una versión nueva con items parciales.

La lista usa el orden determinista `finalizedAt DESC NULLS LAST, createdAt DESC,
id DESC`, con `page` entre 1 y 10.000 y `pageSize` entre 1 y 100. El detalle
incluye únicamente campos necesarios para la UI; no expone eventos de auditoría,
internals de Membership ni información de sesión.

## Errores de dominio

Los errores relevantes son `PRESCRIPTION_NOT_FOUND`, `PRESCRIPTION_STALE`,
`PRESCRIPTION_IMMUTABLE`, `INVALID_PRESCRIPTION_STATE`,
`PARENT_CLINICAL_ENCOUNTER_VOIDED`, `INVALID_CLINICAL_ENCOUNTER_STATE`,
`PRESCRIBER_NOT_FOUND`, `PRESCRIBER_REQUIRED`,
`PRESCRIBER_PROFILE_REQUIRED`, `ONLY_PRESCRIBER_CAN_FINALIZE`,
`PRESCRIPTION_ITEMS_REQUIRED` e `INSUFFICIENT_PERMISSION`. La respuesta HTTP
mantiene aislamiento de tenant y no revela la existencia de recursos de otra
organización.

## Auditoría

`ClinicalAuditEvent` usa `entityType=PRESCRIPTION` y las acciones
`PRESCRIPTION_CREATED`, `PRESCRIPTION_UPDATED`, `PRESCRIPTION_FINALIZED` y
`PRESCRIPTION_VOIDED`. El metadata solo contiene versión, cantidad de items y
si se proporcionó motivo; nunca copia texto clínico ni credenciales.

La auditoría es append-only: cada ganador CAS escribe exactamente un evento;
los requests perdedores no escriben eventos ni side effects duplicados.

PostgreSQL también exige `version > 0` y metadata de lifecycle coherente: un
draft no tiene timestamps terminales; una receta finalizada exige actor,
timestamp y snapshots de identidad; una anulada agrega motivo y metadata de
anulación no vacíos. Estos checks complementan las reglas de servicio.

## Fuera de alcance

PDF, Documents, Storage, firma, notificaciones, catálogo de medicamentos,
fármacos controlados, inventario, ventas y facturación siguen fuera de alcance.
La UI operativa no altera el modelo; las dos migraciones de hardening de 6D.4
solo refuerzan invariantes ya implementadas.
