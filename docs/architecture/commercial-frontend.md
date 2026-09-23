# Frontend comercial — Fase 9

Rutas directas dentro del AppShell:

- `/ventas`, `/ventas/nueva`, `/ventas/:saleId` y `/ventas/:saleId/editar`.
- `/facturacion` y `/facturacion/:invoiceId`.
- `/caja`.

Los grupos de navegación y permisos limitan la visibilidad, pero el backend es
la autoridad. Las lecturas tenant-scoped abortan al desmontar o cambiar de
organización y limpian datos anteriores; formularios, pagos, sede, cliente,
selectores de inventario y diálogos se reinician al cambiar tenant.

`/ventas` filtra y pagina estados. El editor permite producto con stock/lote,
servicio y otro concepto, cliente opcional, descuento y reemplazo de borrador.
La UI usa `BigInt` fijo para vistas previas de importes; el total definitivo lo
recalcula el API. La ficha cobra con uno o varios medios, solicita caja al usar
efectivo y presenta errores de stock/CAS/caja. La anulación pide motivo y explica
el alcance del reverso. No se hace decremento optimista de inventario.

Facturación es de solo lectura, presenta snapshots de emisión y ofrece imprimir
el detalle con estilos responsive y de papel. Caja expone apertura,
movimientos manuales, ledger, cierre y sesiones históricas según permiso.

Etiquetas asociadas a controles, errores accesibles, estados visibles y layouts
sin overflow obligatorio a 390 px forman parte del contrato visual. El texto de
clientes/referencias se presenta como texto normal; no se inserta HTML libre.
