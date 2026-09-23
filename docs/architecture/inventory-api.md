# Inventory API

Todas las rutas usan `/api/v1/inventory` y requieren sesión, `TenantContext` y
`inventory.read` o el permiso de escritura indicado. Los IDs de tenant, actor,
delta firmado, status y stock calculado los controla el servidor.

## Catálogo y resumen

| Método y ruta                 | Permiso                   | Resultado                                                                    |
| ----------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `GET /summary`                | `inventory.read`          | Conteo activo, pares artículo/sede bajo mínimo, lotes vencidos y próximos    |
| `GET /items`                  | `inventory.read`          | Catálogo paginado; `pageSize` máximo 100; filtra `status`, tipo y nombre/SKU |
| `GET /items/:itemId`          | `inventory.read`          | Metadata del artículo                                                        |
| `POST /items`                 | `inventory.items.create`  | Crea metadata, sin saldo inicial                                             |
| `PATCH /items/:itemId`        | `inventory.items.update`  | Cambia metadata; lote inmutable después de historia                          |
| `POST /items/:itemId/archive` | `inventory.items.archive` | Archiva solo con stock cero en todas las sedes                               |

## Stock, lotes y ledger

| Método y ruta                | Permiso                      | Resultado                                                                        |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `GET /stock`                 | `inventory.read`             | Existencias derivadas; filtros de sede, tipo, bajo mínimo y `includeArchived`    |
| `GET /items/:itemId/stock`   | `inventory.read`             | Total, saldos por sede/lote, bajo mínimo y estado de vencimiento                 |
| `GET /items/:itemId/batches` | `inventory.read`             | Lotes del artículo, sin cantidad mutable                                         |
| `GET /movements`             | `inventory.read`             | Ledger de solo lectura; filtro por artículo/sede/lote/tipo/rango y orden estable |
| `POST /movements`            | `inventory.movements.create` | RECEIPT, ISSUE o ajuste, con cantidad positiva                                   |
| `POST /transfers`            | `inventory.transfers.create` | Traslado atómico de dos movimientos correlacionados                              |

`pageSize` de ledger usa 20 por defecto y máximo 100. `occurredAt` acepta ISO con
offset y se serializa como instante UTC. `expiryOn` acepta fecha civil ISO. Los
campos `minimumStock`, `quantity`, `quantityDelta` y `unitCost` son strings
decimales exactos; `quantityDelta` solo se devuelve desde el ledger y el cliente
no puede suministrarlo al crear.

Para artículo con lotes, RECEIPT acepta un `inventoryBatchId` existente o un
`newBatch` dentro del request, nunca ambos. No se crea lote sin recepción. Item
sin lotes rechaza cualquier batch. ISSUE y ajustes requieren motivo; costo solo
se admite en RECEIPT. No existe PATCH/DELETE de movimientos.

## Permisos y errores

OWNER/ADMIN tienen todas las operaciones. VETERINARIAN, ASSISTANT, RECEPTION,
GROOMER y CASHIER son de solo lectura. El endpoint de movimiento comprueba además
`inventory.adjustments.create` al recibir ADJUSTMENT_IN/OUT. PLATFORM_ADMIN no
omite tenant.

Conflictos públicos incluyen `INVENTORY_SKU_EXISTS`, `INVENTORY_ITEM_ARCHIVED`,
`INVENTORY_ITEM_HAS_STOCK`, `INVENTORY_LOT_TRACKING_IMMUTABLE`,
`INVENTORY_BATCH_REQUIRED`, `INVENTORY_BATCH_NOT_ALLOWED`,
`INVENTORY_BATCH_NOT_FOUND`, `INSUFFICIENT_STOCK`, `INVALID_INVENTORY_LOCATION`
y `INVALID_INVENTORY_TRANSFER`. Un ID cross-tenant se oculta como
`404 RESOURCE_NOT_FOUND`. No se devuelven errores SQL ni Prisma.
