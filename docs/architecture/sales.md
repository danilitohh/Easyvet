# Sales / Ventas — Fase 9

Sales registra ventas comerciales tenant-scoped. Una venta nace como borrador y
solo cambia mediante operaciones explícitas: `DRAFT → COMPLETED → VOIDED`.
No hay reapertura, edición de ventas completadas ni borrado físico.

## Borradores y líneas

`Sale` requiere una sede activa y conserva la moneda que tenía la organización
al crearse. Puede vincularse a un Patient, solo a un Owner o a ningún cliente.
Al seleccionar Patient, el backend deriva el Owner actual y rechaza cualquier
Owner conflictivo enviado por el cliente. Al completar, congela nombres y datos
de identificación permitidos; detalle e Invoice usan esos snapshots incluso si
el registro de origen cambia después.

`SaleItem` es una colección ordenada que se reemplaza completa dentro de la
transacción de edición del borrador. `PRODUCT` referencia un InventoryItem activo
y, si tiene control por lote, un batch del mismo item/tenant. El backend deriva
su descripción. `SERVICE` y `OTHER` reciben texto plano y nunca afectan stock.
No existe catálogo de servicios en V1.

## Importes y pagos

La API transporta cantidad como decimal string con escala 6 e importes con escala 4. El servidor usa `Prisma.Decimal`; PostgreSQL conserva `DECIMAL(20,4)` para
dinero y `DECIMAL(20,6)` para cantidad. Por línea, bruto es cantidad × precio,
redondeado una vez a cuatro posiciones con half-up; el descuento está entre cero
y el bruto. Subtotal, descuentos y total se vuelven a calcular en servidor.

Al completar, la suma de pagos debe igualar exactamente el total. Se admiten
`CASH`, `CARD`, `TRANSFER` y `OTHER`; V1 no registra pagos parciales, cambio,
crédito ni devolución externa. Cada pago es evidencia persistente. Un pago en
efectivo requiere que el servidor encuentre y bloquee la caja abierta de la sede;
el cliente nunca selecciona el `cashSessionId`.

## Stock, comprobante y anulación

Completar reserva el número interno de Invoice, crea pagos, movimientos de caja
y movimientos `SALE_OUT`, congela snapshots y cambia estado dentro de una sola
transacción. Si falta stock, falla la transacción completa. No se descuenta
optimistamente en navegador.

Anular una venta completada no borra su ledger: agrega `SALE_REVERSAL_IN`, anula
los pagos y el comprobante, y agrega reversos de efectivo cuando la caja original
sigue abierta. Si esa caja ya cerró, no se permite la anulación automática. El
motivo queda asociado a la venta y al comprobante.

Las restricciones, carreras y orden de bloqueo compartido están en
[`commercial-transactions.md`](commercial-transactions.md). API y flujos UI:
[`sales-api.md`](sales-api.md) y
[`commercial-frontend.md`](commercial-frontend.md).

## Límites V1

Invoice es un comprobante comercial interno de Easyvet; no afirma validez fiscal
universal ni implementa DIAN, FEL/SAT, impuestos, notas crédito fiscales,
contabilidad, pasarela, reembolso de tarjeta/banco, compras, cuentas por cobrar,
crédito, devoluciones o promociones. Las limitaciones completas están en
[`billing.md`](billing.md) y [`commercial-final-review.md`](../migration/commercial-final-review.md).
