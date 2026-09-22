# Diagnostics API — Fase 6H

Todas las rutas requieren sesión autenticada, Membership activa en el tenant
seleccionado y permiso clínico específico. Los recursos de otro tenant y los
IDs inconsistentes responden como no encontrados. No existe endpoint DELETE.

## Rutas

| Método y ruta                                                     | Permiso                   | Uso                                    |
| ----------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| `GET /api/v1/patients/:patientId/diagnostic-orders`               | `diagnostics.read`        | Historial paginado del paciente        |
| `GET /api/v1/diagnostic-orders/:diagnosticOrderId`                | `diagnostics.read`        | Detalle y contexto histórico           |
| `POST /api/v1/clinical-encounters/:encounterId/diagnostic-orders` | `diagnostics.create`      | Crear Draft contextual                 |
| `PATCH /api/v1/diagnostic-orders/:diagnosticOrderId`              | `diagnostics.updateDraft` | Actualizar Draft con `expectedVersion` |
| `POST /api/v1/diagnostic-orders/:diagnosticOrderId/request`       | `diagnostics.request`     | Emitir solicitud con CAS               |
| `POST /api/v1/diagnostic-orders/:diagnosticOrderId/result`        | `diagnostics.result`      | Registrar resultado con CAS            |
| `POST /api/v1/diagnostic-orders/:diagnosticOrderId/void`          | `diagnostics.void`        | Anular con motivo y CAS                |

El tenant, Patient, actor y snapshots se derivan en el backend; no se aceptan
como autoridad campos de tenant enviados por el cliente. PATCH opera solo sobre
Draft. Request exige `testName`, `requestedAt` y al Practitioner responsable.
Result exige `resultedAt` y al menos uno de `resultText` / `interpretation`.
Void preserva los campos anteriores.

## Listado

`page` predeterminado `1`; `pageSize` predeterminado `20`, máximo `100`.
Filtros opcionales: `status`, `category`, `clinicalEncounterId`, `from` y `to`;
el intervalo consulta `requestedAt`. Draft sin fecha solicitada aparece cuando
no se usa filtro de fecha. Orden estable: `requestedAt DESC NULLS LAST`,
`createdAt DESC`, `id ASC`.

## Errores de dominio

- `DIAGNOSTIC_ORDER_STALE` — versión obsoleta (409); recargar es explícito.
- `DIAGNOSTIC_ORDER_IMMUTABLE` — se intentó editar una orden no Draft.
- `INVALID_DIAGNOSTIC_ORDER_STATE` — transición no permitida.
- `DIAGNOSTIC_ORDER_REQUEST_INCOMPLETE` / `RESPONSIBLE_PRACTITIONER_REQUIRED` —
  faltan datos o responsable válido.
- `DIAGNOSTIC_ORDER_RESULT_EMPTY` — resultado e interpretación están vacíos.
- `PATIENT_ARCHIVED` / `PARENT_CLINICAL_ENCOUNTER_VOIDED` — el padre impide la
  mutación solicitada.
- `DIAGNOSTIC_ORDER_NOT_FOUND` — ID ausente, fuera del tenant o fuera del
  contexto paciente esperado.

DTOs Nest y contratos Zod compartidos validan tipos, longitudes, instantes con
offset y payloads estrictos. No se comparten tipos Prisma con frontend.
