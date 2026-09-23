# Transacciones comerciales y concurrencia — Fase 9

## Completar una venta

Una transacción de PostgreSQL valida el CAS del Sale y cliente activo; obtiene
locks de InventoryItem en orden de ID, lotes en orden de par item/lote y sede;
agrupa la demanda para validar stock; luego bloquea caja si hay efectivo y
settings comerciales para número. En el mismo commit crea `SALE_OUT`, pagos,
movimientos CASH, Invoice, snapshots, estado final y auditoría operacional.
Falla de stock/caja/cliente/Invoice revierte todo. El orden común evita ciclos con
las mutaciones de Inventory y de Cash.

## Cerrar caja y anular

La caja se bloquea antes de recalcular ledger y cerrar. Pagos CASH, entradas y
salidas manuales también bloquean la misma fila; un competidor solo observa un
orden serializado válido. Anular bloquea Sale, luego Items/lotes/sede y luego
sesiones CASH afectadas ordenadas por ID. Si una sesión ya está cerrada, toda la
anulación se rechaza y no hay reversos parciales.

## Invariantes de base

- FKs compuestas incluyen `organizationId`; referencias usan `RESTRICT`.
- SaleItem solo cambia con padre DRAFT; Sale version debe avanzar una vez por
  modificación operacional.
- `SALE_OUT` es negativo y `SALE_REVERSAL_IN` positivo; el índice parcial por
  SaleItem/tipo impide duplicar consumo o reversión.
- Pagos, caja, auditoría y movimientos de inventario son evidencia append-only;
  las transiciones permitidas son trigger-guarded.
- Triggers diferidos comprueban al commit la evidencia completa de Sale e
  Invoice; un estado COMPLETED/VOIDED no puede quedar a medio aplicar.
- Settings bloqueados asignan números Invoice consecutivos únicos por tenant.

Las carreras se prueban contra PostgreSQL real en `easyvet_test`: última unidad
de stock, numeración cruzada de sedes, cierre frente a venta/entrada manual,
tenant cruzado, reverso efectivo e invariantes de no residuo.
