# Cash / Caja — Fase 9

Cada `CashSession` pertenece a una sede y transita una sola vez de `OPEN` a
`CLOSED`. Un índice parcial garantiza como máximo una caja abierta por sede y
organización. No hay reapertura. `version` protege cada movimiento/cierre con
compare-and-swap.

`CashMovement` es ledger append-only de importes firmados: pago de venta,
reversión de venta, entrada manual o salida manual. En UI el usuario ingresa un
importe positivo y elige entrada/salida; el servidor deriva el signo. Cada
movimiento manual exige motivo, fecha/hora y referencia opcional. El saldo
esperado en caja se deriva de base de apertura más `SUM(amountDelta)`; no existe
un saldo editable.

Abrir, agregar movimiento, cobro de venta, void y cerrar bloquean la fila de la
caja antes de leer saldo o escribir ledger. Una salida que deja saldo negativo
responde `409 CASH_INSUFFICIENT_BALANCE`. Cerrar recalcula el saldo dentro del
lock y congela contado, esperado y diferencia; una carrera obsoleta requiere
revisar el arqueo de nuevo. Una sesión cerrada es de solo lectura.

Rutas bajo `/api/v1/cash-sessions`: listar e historial (`cash.read`),
`GET /current?clinicLocationId=…` (`cash.read`), `POST /open` (`cash.open`),
`POST /:cashSessionId/movements` (`cash.movements`) y
`POST /:cashSessionId/close` (`cash.close`). Un cliente no proporciona tenant ni
actor. Los cierres no se reabren y los reembolsos externos no se simulan.

El frontend de `/caja` selecciona sede, muestra apertura/saldo/ledger, permite
entrada y salida con motivo y muestra arqueo/histórico. El saldo del cierre se
recalcula en PostgreSQL, no en React.
