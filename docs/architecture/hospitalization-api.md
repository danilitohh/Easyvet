# Hospitalization V1 — API

Prefijo global: /api/v1. El tenant y el actor salen de la sesión, nunca del body. Los DTOs estrictos están en apps/api/src/hospitalizations y los contratos Zod en packages/contracts/src/index.ts.

| Método | Ruta                                              | Permiso                       | Uso                                |
| ------ | ------------------------------------------------- | ----------------------------- | ---------------------------------- |
| GET    | /patients/:patientId/hospitalizations             | hospitalizations.read         | Historia paginada                  |
| GET    | /hospitalizations/:hospitalizationId              | hospitalizations.read         | Detalle tenant-safe                |
| POST   | /clinical-encounters/:encounterId/hospitalization | hospitalizations.create       | Crear DRAFT                        |
| PATCH  | /hospitalizations/:hospitalizationId              | hospitalizations.updateDraft  | Editar DRAFT o plan ACTIVE con CAS |
| POST   | /hospitalizations/:hospitalizationId/activate     | hospitalizations.activate     | Activar con CAS                    |
| GET    | /hospitalizations/:hospitalizationId/entries      | hospitalizations.read         | Kardex paginado                    |
| POST   | /hospitalizations/:hospitalizationId/entries      | hospitalizationEntries.create | Añadir entrada append-only         |
| POST   | /hospitalizations/:hospitalizationId/discharge    | hospitalizations.discharge    | Registrar alta                     |
| POST   | /hospitalizations/:hospitalizationId/void         | hospitalizations.void         | Anular episodio                    |

No existe DELETE ni endpoint de edición/eliminación de entries. Respuestas de otro tenant son 404; carreras CAS devuelven 409 con códigos estables como HOSPITALIZATION_STALE, HOSPITALIZATION_IMMUTABLE o INVALID_HOSPITALIZATION_STATE. El servicio revalida Membership/User/Profile dentro de la transacción y convierte errores de unicidad de Encounter en 409 HOSPITALIZATION_EXISTS_FOR_ENCOUNTER.
