# API de prescripciones — Fase 6D.2

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

## Errores de dominio

Los errores relevantes son `PRESCRIPTION_NOT_FOUND`,
`PRESCRIPTION_STALE`, `PRESCRIPTION_NOT_DRAFT`, `PRESCRIPTION_NOT_FINALIZED`,
`PRESCRIPTION_PARENT_VOIDED`, `PRESCRIPTION_PATIENT_ARCHIVED`,
`PRESCRIPTION_INVALID_PRESCRIBER`, `PRESCRIPTION_PROFILE_REQUIRED`,
`PRESCRIPTION_ITEMS_REQUIRED`, `PRESCRIPTION_ITEM_INVALID` y
`PRESCRIPTION_PERMISSION_DENIED`. La respuesta HTTP mantiene aislamiento de
tenant y no revela la existencia de recursos de otra organización.

## Auditoría

`ClinicalAuditEvent` usa `entityType=PRESCRIPTION` y las acciones
`PRESCRIPTION_CREATED`, `PRESCRIPTION_UPDATED`, `PRESCRIPTION_FINALIZED` y
`PRESCRIPTION_VOIDED`. El metadata solo contiene versión, cantidad de items y
si se proporcionó motivo; nunca copia texto clínico ni credenciales.

## Fuera de alcance

La Fase 6D.2 no implementa frontend, PDF, Documents, Storage, firma,
notificaciones, catálogo de medicamentos, fármacos controlados, inventario,
ventas ni facturación. La UI queda explícitamente para 6D.3.
