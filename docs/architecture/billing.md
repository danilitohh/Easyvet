# Billing / Facturación interna — Fase 9

`Invoice` es un comprobante comercial interno emitido al completar una venta.
Es inmutable salvo transición lógica `ISSUED → VOIDED`, siempre ligada a la
anulación de su Sale. Snapshot de organización, cliente, paciente, líneas,
importes, moneda, pagos y número se conserva para lectura e impresión.

El documento es interno de Easyvet: no equivale por sí mismo a factura
electrónica fiscal válida en todos los países. V1 no conecta DIAN, FEL/SAT u otra
autoridad, no calcula impuestos jurisdiccionales y no genera QR, CUFE/CUDE, notas
crédito fiscales ni XML tributario. La UI ordinaria lo denomina “comprobante” y
no presenta una declaración fiscal genérica.

`OrganizationCommercialSettings` contiene moneda ISO 4217 de tres letras,
prefijo y `nextInvoiceNumber`. El alta de organización crea la fila 1:1; la
migración inicial hace backfill de organizaciones existentes con los defaults
configurables `DEFAULT_CURRENCY_CODE` y `DEFAULT_INVOICE_PREFIX`. La reserva
bloquea settings, toma el siguiente número y lo incrementa dentro de la
transacción de completado; el número es único por tenant. No se reutiliza tras
anular.

La lectura está en `GET /api/v1/invoices` y `GET /api/v1/invoices/:invoiceId`,
ambos con `billing.read`. No hay endpoints para editar, volver a emitir o borrar.
La impresión de V1 usa `window.print()` y CSS de impresión del detalle web; no
requiere motor PDF ni servicio externo.
