# Revisión final Lativet → Easyvet: Ventas, Facturación y Caja

Referencia inspeccionada en modo lectura: `C:\Users\danil\Downloads\Lativet-reference`,
commit `05fea495cb13208b27bf470b3570987fd501a81e`. Lativet no se ejecutó ni se
modificó.

| Tema           | Lativet observado                                                   | Easyvet Fase 9                                                                |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Venta/líneas   | Agregado de venta editable, items y total mutable                   | `Sale` DRAFT versionado; `SaleItem` reemplazo completo, Decimal y tenant-safe |
| Descuentos     | Totales y descuentos guardados en el flujo de venta                 | Cálculo autoritativo server-side, descuento limitado al bruto de cada línea   |
| Cliente        | Owner/Patient asociados por flujo heredado                          | Patient deriva Owner; Owner-only o consumidor final; snapshots al completar   |
| Pagos          | Medios de pago gestionados dentro de la venta                       | `SalePayment` POSTED/VOIDED, varios medios y suma exacta, sin crédito         |
| Caja           | Apertura, movimientos y cierres ligados al flujo operativo          | Caja por sede, ledger append-only, saldo derivado, CAS y cierre no reabrible  |
| Factura/recibo | Secuencia local y documento comercial de la app                     | Invoice interna inmutable, número secuencial tenant-safe e impresión browser  |
| Inventario     | Stock acoplado al flujo comercial y movimientos heredados editables | `SALE_OUT`/`SALE_REVERSAL_IN` ledger con relación explícita a SaleItem        |
| Correcciones   | Edición/eliminación posible en partes del flujo legado              | Void lógico con motivo, evidencia compensatoria y sin borrado físico          |
| Permisos/UI    | Pantallas y capacidades heredadas de la aplicación                  | Rutas Easyvet separadas por módulo; permisos del backend; UI por rol y mobile |

La migración conserva comportamientos operativos útiles —varios medios de pago,
recibos, caja por sede y relación producto-stock—, pero sustituye la mutabilidad
por snapshots, CAS, restricciones SQL y movimientos compensatorios. No copia
tablas ni nombres heredados a un framework genérico.

## Frontera deliberada V1

El Invoice emitido es un comprobante comercial interno, no una factura
electrónica fiscal universal. Quedan post-V1: integración tributaria, reglas de
impuestos, notas crédito, gateway/refund externo, conciliación bancaria,
proveedores/compras, crédito/cartera, cuotas, promociones, loyalty, devoluciones,
ServiceCatalog y precios por sede.

## Verificación

La inspección de legacy se limitó a ventas, facturación, caja/cierres, productos,
stock, clientes, permisos, frontend y tests. Los flujos Easyvet se verifican con
tests PostgreSQL aislados en `easyvet_test` y QA manual ficticio solo en
`easyvet_dev`; nunca en producción, `veterinary_saas` ni bases externas.

### Cierre técnico y QA

- Las tres migraciones comerciales se aplicaron a `easyvet_dev`; las migraciones
  previas se conservaron y no se ejecutó reset. Docker reportó PostgreSQL
  `healthy`. Las suites de integración usan `easyvet_test`.
- QA manual dejó cinco ventas ficticias en `easyvet_dev`: dos completadas y tres
  anuladas lógicamente, cinco invoices secuenciales (`INV-000001`–`INV-000005`),
  seis pagos y ledger de inventario con cada `SALE_OUT` compensado exactamente
  una vez para ventas anuladas. La caja cerró de $100.000 a $130.000 COP
  esperados/contados, diferencia $0. No hubo hard delete ni datos QA en seed.
- La venta con insuficiencia de stock conservó el estado Draft y no escribió
  pago, comprobante ni movimiento de inventario. Se verificaron servicio,
  Owner-only, Patient, consumidor final, pagos mixtos, reversión cash/stock,
  movimientos manuales y cierre.
- Con una membresía de QA temporal en Sur se verificó tenant switch Norte→Sur,
  lista vacía y respuesta 404 genérica para deep link de la venta Norte; la
  membresía fue retirada después de confirmar que no tenía datos dependientes.
  No hubo efectos clínicos/de agenda ni alteración del peso de Luna. Las vistas
  solicitadas se comprobaron a 390 px sin overflow horizontal.
- Las pruebas de concurrencia cubren consumo simultáneo del mismo stock,
  finalización simultánea de una misma venta, `PATCH` vs `COMPLETE`, `VOID` vs
  `VOID`, `VOID` vs cierre de caja, cierre vs pago cash, cierre vs movimiento
  manual y asignación secuencial de invoice entre sedes.
- Última suite de integración PostgreSQL: `test:db` 214/214; el frontend tiene
  362 pruebas y la suite ordinaria de API 28 pruebas. `test:all` se ejecutó de
  nuevo en el cierre final, con resultados registrados en `MIGRATION_STATUS.md`.
  Formato, lint, typecheck, build, `prisma:generate` y `prisma:validate` también
  pasan.
- El build avisa que el chunk principal (868,63 kB minificado / 247,08 kB gzip)
  supera el umbral configurado de 500 kB. Las pantallas comerciales permanecen
  en chunks lazy. No se hizo manualmente una prueba de impresión física/media
  print ni se certificaron todos los breakpoints tablet.

### Auditoría de dependencias

`npm audit` encontró cinco nombres de paquetes afectados en dos advisories
(3 HIGH, 2 MODERATE): `prisma` directo de desarrollo, `@prisma/config` y
`deepmerge-ts` transitivos de configuración/CLI, y `vitest` directo de
desarrollo con `@vitest/mocker` transitivo. El advisory de Vitest concierne al
servidor HMR de desarrollo cuando se expone a clientes no confiables; el de
`deepmerge-ts` requiere una estructura de objeto recursiva para agotar la pila.
No se encontraron imports de Prisma CLI/config ni `deepmerge-ts` en el runtime
de `apps/api`, `apps/web` o `packages`; `npm audit --omit=dev` aún lo enumera por
el peer opcional de Prisma. Por tanto no hay evidencia de que estas rutas sean
alcanzables en el runtime actual de Easyvet, aunque exponer el HMR públicamente
sí crea riesgo de desarrollo evitable.

No se aplicaron upgrades: las propuestas disponibles implican un salto mayor
de Vitest o downgrade/cambio breaking de Prisma; no se identificó una
actualización patch/minor compatible y claramente segura para limpiar el
conjunto. No se ejecutó `npm audit fix --force`.

### Límites y problemas restantes

No se conocen bugs funcionales pendientes. La factura sigue siendo comprobante
interno, no documento tributario. Impuestos, DIAN/e-invoicing, notas crédito,
reembolsos de procesador, gateways, compras/proveedores, crédito/cartera,
contabilidad, promociones, loyalty, devoluciones y precios por sede siguen
post-V1. La impresión browser no equivale a generar un PDF fiscal.
