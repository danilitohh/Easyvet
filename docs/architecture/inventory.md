# Inventory / Inventario — Fase 8

Inventory administra un catálogo operativo básico, lotes y movimientos por
Organization y ClinicLocation. Fase 9 añade consumo solo al completar una Sale y
reversión solo al anularla; no crea órdenes de compra, proveedores ni consumo
automático desde Prescription, Clinical o Grooming.

## Fuente de verdad

`InventoryMovement.quantityDelta` es la única fuente de verdad de cantidades. El
stock de artículo, sede y lote siempre se calcula como suma decimal de movimientos
filtrados por `organizationId`, `inventoryItemId`, `clinicLocationId` y, cuando
corresponde, `inventoryBatchId`. No existe `currentStock` editable ni un saldo
materializado que pueda separarse del ledger.

Los importes de cantidad usan PostgreSQL `DECIMAL(20,6)` y el API los serializa
como strings decimales. La UI no convierte esos strings a `number` para sumar,
restar o decidir si hay stock; los cálculos autoritativos usan `Prisma.Decimal` y
PostgreSQL `SUM`.

## Modelo

- `InventoryItem`: nombre, SKU nullable, tipo MEDICATION/SUPPLY/RETAIL/OTHER,
  unidad base, indicador de lotes, mínimo nullable, descripción/notas y estado
  ACTIVE/ARCHIVED. SKU se recorta, normaliza a mayúsculas y es único por tenant.
- `InventoryBatch`: artículo y Organization obligatorios, número de lote,
  vencimiento civil `DATE` nullable y notas. Lote único por Organization/item.
  Tenant, item y número de lote son identidad inmutable; no hay API para borrar
  lotes. La FK de movimientos impide borrarlos si tienen historia.
- `InventoryMovement`: ledger append-only con delta firmado, tipo, sede/lote,
  instante de operación, motivo, referencia, costo unitario opcional, actor y
  grupo de traslado. Correcciones se registran con otro movimiento.

Restricciones PostgreSQL validan textos requeridos, SKU normalizado, mínimo y
costo no negativos, delta distinto de cero, signo acorde al tipo, referencias
tenant-composite con `ON DELETE RESTRICT`, inmutabilidad del ledger y coherencia
de lotes. Un trigger serializa escrituras en la fila Item, verifica sede activa,
estado activo del artículo, modo de lotes y evita que el saldo del lote/sede
quede negativo incluso ante una escritura SQL que omita el servicio.

## Integración comercial Fase 9

`InventoryMovement` agrega `saleId` y `saleItemId` nullable con FK compuesta de
tenant y `ON DELETE RESTRICT`. `SALE_OUT` negativo se crea en la misma transacción
que cobra y completa la venta; `SALE_REVERSAL_IN` positivo solo acompaña un void
comercial. Ambos conservan referencia estructurada al `SaleItem`; no se modifica
ni borra el movimiento original. Triggers de signo y evidencia diferida exigen
consumo/reverso exactamente una vez al commit. El reverso puede conservar su sede
histórica aunque luego quede inactiva, pero un artículo archivado no se reactiva
ni recibe movimiento.

Para completar o anular se toman locks deterministas de artículos, lotes y sede,
y se valida la demanda agrupada antes de insertar salidas. La consulta de stock
continúa siendo `SUM(quantityDelta)`; no hay decremento materializado ni cálculo
optimista en UI. Véase [`commercial-transactions.md`](commercial-transactions.md).

## Escritura y concurrencia

Todas las operaciones de stock corren en una transacción. El orden de lock es:

1. Item de la Organization (`FOR UPDATE`) para serializar cada escritor del item.
2. Batch cuando existe.
3. Location(s) activas, ordenadas por ID para traslados.
4. Calcular saldo exacto e insertar movimiento(s).

ISSUE, ADJUSTMENT_OUT y TRANSFER_OUT validan `available >= requested` bajo ese
lock. Una carrera insuficiente devuelve `409 INSUFFICIENT_STOCK`. Un traslado
crea `TRANSFER_OUT` y `TRANSFER_IN` con el mismo UUID, delta neto cero y destinos
distintos; el trigger diferido rechaza pares parciales o desbalanceados al commit.

`lotTracking=false` requiere `inventoryBatchId=null`; `lotTracking=true` requiere
lote en todo movimiento. Solo RECEIPT puede crear un lote dentro de su misma
transacción. El flag se puede cambiar únicamente antes del primer movimiento.
ISSUE, ajustes y traslado reciben cantidad positiva en el contrato; el servicio
asigna el signo correspondiente.

## Umbral y vencimientos

`minimumStock` es un solo umbral del artículo, aplicado por igual en cada sede;
no es configurable por sede en V1. `lowStock` se deriva cuando el stock de una
sede activa es menor o igual al mínimo. No se persiste ni genera notificaciones,
órdenes de compra o sugerencias.

`expiryOn` es una fecha civil `YYYY-MM-DD`, no un instante. Los estados se derivan
en lectura usando la fecha local de `Organization.timezone`: EXPIRED cuando es
anterior a hoy; EXPIRING_SOON desde hoy hasta hoy + 30 días, ambos inclusive; OK
después. Se puede recibir un lote vencido para dejar constancia del inventario
real. No se auto-descarta ni pone en cuarentena.

## Tenant, permisos y auditoría

Todos los recursos, relaciones, bloqueos y proyecciones se limitan al tenant
activo. FKs compuestas evitan asociar item, lote, sede o actor de otra
Organization; un UUID cross-tenant responde 404 sin confirmar su existencia.
PLATFORM_ADMIN no obtiene bypass de tenant.

OWNER y ADMIN poseen `inventory.read` y los seis permisos de mutación. VETERINARIAN,
ASSISTANT, RECEPTION, GROOMER y CASHIER solo reciben `inventory.read`. Crear
ajustes requiere adicionalmente `inventory.adjustments.create`; transferir exige
`inventory.transfers.create`.

El movimiento es la evidencia autoritativa de cada cambio cuantitativo. La
metadata de Item conserva `createdAt`/`updatedAt`; no se introduce un subsistema
de auditoría genérico en esta fase. Los eventos de un movimiento no se editan ni
eliminan por API o trigger. Desactivar una sede conserva su stock e historial,
pero bloquea nuevos movimientos.

## Fronteras y limitaciones POST-V1

Sin proveedores, compras, cuentas por pagar, factura de proveedor, venta/caja,
precio promocional, costeo promedio/FIFO, barcode, seriales, reservas, workflow
de conteo, conversión de unidades, mínimo por sede, sugerencias de compra,
consumo clínico/grooming automático, cuarentena de lote ni warehouse externo.
El acoplamiento explícito con Sale no agrega compras, devoluciones ni dispensación.
No hay reactivación de Items archivados. Véanse [`inventory-api.md`](inventory-api.md),
[`inventory-frontend.md`](inventory-frontend.md) y la revisión de migración
[`inventory-final-review.md`](../migration/inventory-final-review.md).
