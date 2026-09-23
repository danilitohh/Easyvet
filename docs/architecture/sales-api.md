# Sales API — Fase 9

Todas las rutas están bajo `/api/v1`, cookie de sesión y `TenantContext`; los
identificadores de organización nunca se aceptan en el body. UUIDs de otro
tenant responden `404 RESOURCE_NOT_FOUND`.

| Método y ruta                  | Permiso             | Uso                                                                |
| ------------------------------ | ------------------- | ------------------------------------------------------------------ |
| `GET /sales`                   | `sales.read`        | Lista paginada; filtros de estado, sede, Owner, Patient y fechas   |
| `POST /sales`                  | `sales.create`      | Crea DRAFT y líneas iniciales; devuelve versión 1                  |
| `GET /sales/:saleId`           | `sales.read`        | Detalle, pagos e Invoice asociada                                  |
| `PATCH /sales/:saleId`         | `sales.updateDraft` | Reemplaza sede, cliente y conjunto de líneas con `expectedVersion` |
| `POST /sales/:saleId/complete` | `sales.complete`    | Recibe medios de pago y completa toda la operación atómicamente    |
| `POST /sales/:saleId/void`     | `sales.void`        | Anula con `expectedVersion` y motivo obligatorio                   |

Los importes (`quantity`, `unitPrice`, descuentos y pagos) son cadenas decimales;
no se envían totales calculados, snapshots, posiciones, estado, actor, tenant ni
sesión de caja. La edición reemplaza todas las líneas en una transacción; no hay
CRUD de SaleItem independiente. `expectedVersion` usa compare-and-swap y las
versiones obsoletas responden `409 SALE_STALE`.

Errores estables de operación incluyen `SALE_NOT_DRAFT`, `SALE_NOT_COMPLETED`,
`SALE_STALE`, `LOCATION_INACTIVE`, `PATIENT_INACTIVE`, `OWNER_INACTIVE`,
`CASH_SESSION_REQUIRED`, `INSUFFICIENT_STOCK`, `SALE_CASH_SESSION_CLOSED` y
`SALE_INVENTORY_ITEM_ARCHIVED`. Errores de validación no exponen SQL, nombres de
tablas ni detalles internos de Prisma.

Contratos compartidos Zod, DTOs y controladores viven en
`packages/contracts/src/index.ts` y `apps/api/src/commercial/`.
