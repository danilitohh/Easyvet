# Configuración de organización (Fase 10)

La ruta `/configuracion` reúne tres secciones pequeñas de la Organization activa:
General, Sedes y Comercial. No acepta un `organizationId` del cliente para leer
ni escribir.

## General

Se editan nombre, locale y zona horaria. Slug y estado quedan fuera del formulario.
La zona se valida en backend con el runtime IANA de `Intl.DateTimeFormat`.
Los timestamps históricos continúan en UTC; el cambio solo altera futuras
interpretaciones de fechas civiles y presentación.

## Sedes

`ClinicLocation` permite crear y editar nombre, dirección y ciudad, además de
inactivar o reactivar sin borrar historial. Inactivar toma un lock exclusivo de
la sede y bloquea si existe una sesión de caja abierta, peluquería en curso,
cita futura en estado bloqueante o cita en curso. Apertura de caja, agenda,
peluquería, ventas y movimientos de inventario sincronizan sus escrituras de
operación con el estado activo de la sede.

Las sedes inactivas siguen disponibles para lectura histórica, pero las
validaciones de cada dominio impiden iniciar nuevas operaciones allí. Una sede
de otro tenant responde como no encontrada.

## Comercial

Se exponen `currencyCode` e `invoicePrefix`; nunca `nextInvoiceNumber`.
La moneda predeterminada se copia a nuevas ventas y a sesiones de caja nuevas.
Ventas, facturas y sesiones existentes conservan su snapshot; cambiar el
predeterminado no los renumera ni recalcula. Cambiar el prefijo solo afecta
facturas futuras y la secuencia continúa.

El snapshot de moneda de sesiones de caja antiguas se inicializa durante la
migración usando la configuración comercial de su Organization (o la moneda de
Organization como fallback). No se cambia el ledger de efectivo.
