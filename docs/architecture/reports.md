# Informes (Fase 10)

Informes son conteos y agregados acotados por tenant. No devuelven listas de
pacientes, propietarios, narrativas clínicas ni valoración contable de inventario.
Los cuatro informes se consultan por separado y cada uno requiere su permiso.

## Definiciones

- Operacional: citas por `startsAt`; seguimientos abiertos/vencidos/para hoy como
  estado actual; peluquería por `createdAt`; hospitalizaciones activas a la hora
  de consulta e ingresos/egresos por sus timestamps respectivos.
- Clínico: solo evidencia con estado final válido y timestamp de finalización,
  resultado o firma dentro del intervalo. Lo anulado no cuenta como finalizado.
  Incluye consultas, prescripciones, vacunas, desparasitaciones, procedimientos,
  anestesias, resultados diagnósticos, egresos y consentimientos firmados.
- Comercial: ingresos son `grandTotal` de ventas `COMPLETED`; `VOIDED` se excluye
  y se cuenta aparte. Descuentos y ticket promedio usan ventas completadas.
  Pagos cuentan solo `POSTED` de ventas completadas y se agrupan por método y
  moneda. Facturas emitidas se cuentan por fecha de emisión; anuladas por su fecha
  de anulación. Cierres usan su fecha de cierre y diferencias firmadas.
- Inventario: productos por estado actual; stock bajo por combinación producto/
  sede según ledger; lotes vencidos o por vencer con saldo positivo; movimientos
  dentro del intervalo. No se calcula costo ni valoración monetaria.

El filtro de sede valida que pertenezca al tenant. En métricas asociadas a un
Encounter o venta se aplica esa sede; seguimientos sin Encounter fuente no se
atribuyen a una sede. Los saldos de inventario son actuales aunque el periodo
limite el conteo de movimientos.

Los montos comerciales se agrupan por `currencyCode` en todo el recorrido. El
backend no suma COP con USD ni la UI los presenta como un total único. Los
valores decimales viajan como strings.

## Rango y rendimiento

`from` y `to` son fechas civiles `YYYY-MM-DD` interpretadas en la zona horaria de
Organization. Las columnas timestamp usan el intervalo UTC inclusivo/exclusivo
`[inicio de from, inicio del día posterior a to)`, que respeta cambios DST.
El rango máximo es de 366 fechas inclusivas; el valor predeterminado son los
últimos 30 días. Métricas de estado actual (por ejemplo, hospitalizaciones
activas y seguimientos abiertos) son snapshots y no se restringen a eventos
históricos del rango.

Los contadores usan `COUNT`, `GROUP BY` y agregados SQL/Prisma filtrados por
`organizationId`; no se hidratan tablas completas en Node. No hay exportaciones,
conciliación bancaria, materialized views ni constructor de reportes en V1.
