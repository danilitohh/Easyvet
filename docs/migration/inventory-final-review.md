# Legacy review — Inventory

## Referencia inspeccionada

`C:\Users\danil\Downloads\Lativet-reference`, commit
`05fea495cb13208b27bf470b3570987fd501a81e`. Revisión de código enfocada en los
módulos de Inventario/Productos/Vencimientos, movimientos, integración comercial,
pantallas y rutas legacy; el sistema Lativet no se ejecutó.

## Hallazgos observados

- El catálogo legacy concentra atributos operativos y datos comerciales del
  producto; los movimientos de compra y venta están acoplados a facturación y
  venta.
- El stock actual se mantiene en datos editables del producto y en estructuras
  auxiliares de movimientos/conteos. Se observan flujos legacy de ajuste y
  conciliación física junto con actualización de compras/ventas.
- El vencimiento vive en el producto/registro de inventario, no como lotes
  independientes con saldo separado por sede.
- Flujos administrativos legacy permiten editar o eliminar documentos/movimientos
  y sus relaciones, lo cual no es aceptable para el ledger auditable de Easyvet.
- La operación se organiza por sedes; la nueva frontera SaaS requiere que item,
  movimiento, lote, ubicación y actor tengan el mismo tenant explícito.
- El alcance revisado no justificó trasladar proveedores, orden de compra, costo
  promedio, documento de venta, caja o consumo clínico al nuevo módulo.

## Decisión Easyvet

Easyvet separa catálogo, vencimiento por lote, saldo derivado de ledger decimal y
traslado atómico multi-sede. Movimiento es append-only en API y PostgreSQL; cada
ajuste correctivo añade evidencia, no sobrescribe historia. Los vencimientos son
`DATE` civiles y mínimos se evalúan por sede usando el umbral común del Item.

No se migran filas ni saldos de Lativet. Los movimientos del seed son ficticios e
idempotentes. Sin efectos a Sales, Billing, Cash, Prescription, Clinical,
Patient, Agenda ni Grooming. Las entidades de comercial/finanzas, costeo,
conversión, conteos y consumo automático quedan POST-V1.
