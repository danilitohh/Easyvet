# Reglas de negocio de Lativet

## Convenciones

- Cada regla incluye uno o más archivos donde se observó.
- “NECESITA REVISIÓN” significa que el código no permite asegurar la intención del negocio o que la regla depende de una decisión legal/operativa.
- Estas reglas describen el comportamiento legado; no implican que deba conservarse sin cambios en el SaaS.

## Autenticación, usuarios y permisos

1. Si no están configurados ambos valores de administrador, la aplicación no exige login y considera administrador al visitante. Origen: `Backend/COMPARTIDO/Rutas/web.py`, `Backend/COMPARTIDO/Autenticacion/rutas.py`.
2. Existen dos formas de autenticación: administrador de entorno y usuarios persistidos en `staff_users`. Origen: `Backend/COMPARTIDO/Autenticacion/rutas.py`, `Backend/ADMINISTRACION/Usuarios/persistencia.py`.
3. La opción “recordarme” hace permanente la sesión; su vigencia configurada es de 30 días. Origen: `Backend/COMPARTIDO/Rutas/web.py`, `Backend/COMPARTIDO/Autenticacion/rutas.py`.
4. Un veterinario debe tener matrícula profesional. Origen: `Backend/ADMINISTRACION/Usuarios/validacion.py`.
5. La contraseña es obligatoria al crear un usuario, pero opcional al editar; si se omite se conserva el hash anterior. Origen: `Backend/ADMINISTRACION/Usuarios/persistencia.py`.
6. Los permisos modernos usan `@actions:v1` y acciones por recurso. Una acción distinta de ver implica también el grant de visualización. Origen: `Backend/ADMINISTRACION/Usuarios/permisos.py`.
7. Los perfiles sin `@actions:v1` se consideran heredados y no se validan contra el catálogo moderno. El middleware solo autoriza por endpoint a perfiles detallados no administradores. Origen: `Backend/ADMINISTRACION/Usuarios/permisos.py`, `Backend/COMPARTIDO/Rutas/web.py`.
8. Los endpoints desconocidos fallan cerrados para perfiles detallados. Borrados que atraviesan dominios requieren grants de borrado de las entidades afectadas. Origen: `Backend/ADMINISTRACION/Usuarios/autorizacion.py`.
9. Las exportaciones para perfiles detallados requieren permiso de exportar y reciben un ticket firmado, ligado al usuario/recurso, de una hora. Origen: `Backend/COMPARTIDO/Rutas/web.py`.
10. El campo `is_active` se escribe, pero las lecturas y la autenticación lo fuerzan a verdadero. **NECESITA REVISIÓN:** determinar si se esperaba desactivación o solo borrado. Origen: `Backend/ADMINISTRACION/Usuarios/persistencia.py`.

## Configuración

1. La configuración es única para toda la instalación. Origen: tabla `settings` y `Backend/ADMINISTRACION/Configuracion/persistencia.py`.
2. Si se guarda configuración con contraseña SMTP vacía, se conserva la contraseña existente. Origen: `Backend/ADMINISTRACION/Configuracion/persistencia.py`.
3. La retención clínica predeterminada es 15 años; el código permite configurarla. **NECESITA REVISIÓN:** validar mínimo legal y si cambia por país/organización. Origen: `Backend/BASE_DE_DATOS/contexto.py`, `Backend/CONSULTORIO/Pacientes/Historia_clinica/persistencia.py`.
4. La zona horaria predeterminada es `America/Bogota`; los jobs y agenda la utilizan. Origen: `Backend/BASE_DE_DATOS/contexto.py`, `Backend/SEGUIMIENTOS/servicios.py`.

## Propietarios y pacientes

1. Un paciente debe pertenecer a un propietario existente. Origen: `Backend/CONSULTORIO/Pacientes/COMPARTIDO/validacion.py`, `persistencia.py`.
2. Se impide en servicio crear dos pacientes con el mismo nombre para el mismo propietario; la base no lo protege con un constraint. Origen: `Backend/CONSULTORIO/Pacientes/COMPARTIDO/servicios.py`.
3. La identificación de propietario es opcional, pero cuando existe el par tipo+número debe ser único. Origen: `Backend/BASE_DE_DATOS/database.py` y migración de contactos opcionales.
4. El peso informado debe ser positivo. Una consulta puede crear un registro de peso y el peso actual del paciente se recalcula desde la serie. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/validacion.py`, `persistencia.py`.
5. El estado clínico permitido es Activa/Fallecida. Marcar fallecida cancela recordatorios de control y seguimientos pendientes; puede reactivarse y ambos eventos quedan registrados. Origen: `Backend/CONSULTORIO/Pacientes/COMPARTIDO/persistencia.py`.
6. Borrar un paciente elimina de forma manual y amplia citas, recordatorios, seguimientos, firmas, consentimientos, consultas, evoluciones e historia relacionada, y deja auditoría. Origen: `Backend/CONSULTORIO/Pacientes/COMPARTIDO/persistencia.py`.
7. Borrar un propietario elimina también pacientes y datos clínicos/operativos/financieros relacionados. Origen: `Backend/CONSULTORIO/Pacientes/Propietarios/persistencia.py`.
8. **NECESITA REVISIÓN:** en el SaaS, los borrados físicos pueden ser incompatibles con retención clínica, fiscal, consentimiento y derecho de supresión; definir política por entidad.

## Historia clínica y evoluciones

1. La fecha de retención se calcula desde la fecha de referencia más los años configurados. Origen: `Backend/CONSULTORIO/Pacientes/Historia_clinica/persistencia.py`.
2. Una historia finalizada no puede editarse directamente. Finalizar fija estado y timestamp. Origen: `Backend/CONSULTORIO/Pacientes/Historia_clinica/persistencia.py`.
3. Una historia finalizada sí acepta evoluciones posteriores. Cada evolución extiende la fecha de retención. Origen: `Backend/CONSULTORIO/Pacientes/Historia_clinica/persistencia.py`.
4. La primera/única consulta estándar puede sincronizar su resumen clínico hacia la historia abierta, evitando mantener dos resúmenes divergentes. Origen: `_sync_single_consultation_record` en `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
5. El borrado de historia es una cascada manual que elimina entidades dependientes y registra el resumen de lo eliminado. Origen: `Backend/CONSULTORIO/Pacientes/Historia_clinica/persistencia.py`.

## Consultas y datos clínicos

1. Toda consulta se vincula a historia, paciente y propietario existentes y compatibles. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/{validacion,persistencia}.py`.
2. Solo se aceptan tipos incluidos en la allowlist clínica. Origen: `Backend/BASE_DE_DATOS/contexto.py`, `Backend/CONSULTORIO/Pacientes/Consultas/validacion.py`.
3. Los detalles de cada tipo se almacenan principalmente dentro de `document_reference` JSON/texto y resúmenes comunes. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py` y los módulos frontend clínicos.
4. Si se edita una consulta con adjuntos ya existentes, las referencias se restauran para no perder assets omitidos por el cliente. Origen: `_restore_consultation_asset_references` en `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
5. Los data URLs/base64 de adjuntos se compactan en respuestas de lista y se exponen mediante endpoints específicos de asset. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`, `rutas.py`.
6. Una consulta que exige consentimiento solo puede enlazar un consentimiento del mismo paciente. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
7. Guardar una consulta puede, en la misma operación lógica, actualizar el perfil del paciente, peso, estado preventivo, historia, recordatorio, seguimiento y cita de control. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
8. Al borrar una consulta se eliminan dependientes y se recalcula el peso actual del paciente. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
9. Exámenes de laboratorio pendientes con el mismo paciente/título pueden reutilizarse y los duplicados se fusionan. Origen: `_merge_laboratory_consultations` en `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
10. **NECESITA REVISIÓN:** qué campos de cada subtipo son clínicamente obligatorios, pues parte del contrato está solo en frontend.

## Vacunación y desparasitación

1. Guardar estos tipos de consulta actualiza un estado resumido del paciente con una representación compuesta de producto/nombre y fecha. Origen: módulos `Backend/CONSULTORIO/Pacientes/Vacunas`, `Desparasitaciones` y persistencia de Consultas.
2. Pueden crear recordatorios/control según el payload clínico. Origen: `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py`.
3. **NECESITA REVISIÓN:** el estado resumido en la ficha no sustituye un esquema normalizado de aplicaciones, lotes, fabricante o esquemas vacunales.

## Agenda, disponibilidad y reservas

1. Duraciones de cita y slots deben estar entre 15 y 240 minutos; fin debe ser posterior a inicio. Origen: `Backend/AGENDA/Agenda_general/validacion.py`.
2. Si existe al menos una regla de disponibilidad, la cita debe caber dentro de alguna regla, alinearse al slot y tener duración múltiplo del slot. Origen: `Backend/AGENDA/Agenda_general/persistencia.py`.
3. Los estados activos excluyen completada, cancelada y no-asistió. Origen: `Backend/BASE_DE_DATOS/contexto.py`, módulo Agenda.
4. El conflicto se calcula contra todas las citas activas; el código no separa de manera concluyente por profesional o ubicación. Origen: `Backend/AGENDA/Agenda_general/persistencia.py`. **NECESITA REVISIÓN:** confirmar si la clínica opera con un único recurso simultáneo.
5. Una reserva rápida crea propietario/paciente placeholder cuando no existen. Origen: `Backend/AGENDA/Reservas`.
6. Una cita de control derivada usa duración predeterminada de 30 minutos. Origen: persistencia de Consultas/Agenda.
7. Cambios de asistencia pueden sincronizarse con Google Calendar. Origen: `Backend/AGENDA/Integracion_Google`.

## Recordatorios y seguimientos

1. Los recordatorios de control vencidos pueden enviarse por un job HTTP usando la zona horaria configurada. Origen: `Backend/SEGUIMIENTOS/rutas.py`, `servicios.py`.
2. Un paciente fallecido no debe recibir recordatorios/seguimientos pendientes. Origen: `Backend/CONSULTORIO/Pacientes/COMPARTIDO/persistencia.py`, `Backend/SEGUIMIENTOS/servicios.py`.
3. Las series de seguimiento se generan cada N días, semanas o meses entre inicio y fin, con máximo de 120 instancias. Origen: `Backend/SEGUIMIENTOS/persistencia.py` y validación asociada.
4. Al editar la programación se borran/recrean solo instancias pendientes; resultados completados se conservan. Origen: `Backend/SEGUIMIENTOS/persistencia.py`.
5. Completar exige fecha de contacto, evolución y resultado; puede programar una siguiente tarea. Origen: `Backend/SEGUIMIENTOS/servicios.py`, `persistencia.py`.
6. Completar un seguimiento escribe además una consulta sintética de tipo Seguimiento en la historia. Origen: `Backend/SEGUIMIENTOS/servicios.py`.
7. Si el envío falla, el recordatorio vuelve a pendiente y conserva motivo/error. Origen: `Backend/SEGUIMIENTOS/servicios.py`.

## Documentos, consentimientos y firma

1. Crear una nueva solicitud de firma expira las solicitudes pendientes anteriores de la misma consulta. Origen: `Backend/CONSULTORIO/Pacientes/Documentos/persistencia.py`.
2. El token se genera con entropía criptográfica y vence a los siete días. Origen: `Backend/CONSULTORIO/Pacientes/Documentos/servicios.py`.
3. El código enviado por email tiene seis dígitos, vence a los quince minutos y se guarda hasheado junto con el token. Origen: `Backend/CONSULTORIO/Pacientes/Documentos/servicios.py`.
4. Hay un máximo de cinco intentos fallidos por código. Solicitar otro código reinicia el contador. Origen: servicios/persistencia de Documentos.
5. Antes de firmar se recalcula el hash del documento; si cambió, la firma se rechaza. Origen: `Backend/CONSULTORIO/Pacientes/Documentos/servicios.py`.
6. La firma requiere nombre, identificación y una data URL PNG; se registra email, IP, user-agent, fecha, hash y método de confirmación. Origen: servicios/persistencia de Documentos.
7. La evidencia se guarda en la solicitud y se integra de vuelta en el JSON de la consulta. Origen: `_document_reference_with_signature` en persistencia de Documentos.
8. El correo del propietario se enmascara en la respuesta pública. Origen: `_public_signature_request_data` en servicios de Documentos.
9. No se observó cooldown de reenvío ni límite de tamaño/decodificación completa para la firma. **NECESITA REVISIÓN:** cuotas, antifraude, validez legal y conservación.

## Peluquería

1. Un ingreso puede vincularse a propietario/paciente clínicos o guardar datos independientes de cliente/mascota. Origen: `Backend/CONSULTORIO/Peluqueria/validacion.py`, `persistencia.py`.
2. Nombre de mascota es obligatorio; servicios, fotos y consentimiento se guardan como JSON/texto; estados y rabia usan listas permitidas. Origen: validación/persistencia de Peluquería.
3. El consentimiento de peluquería se implementa mediante una consulta clínica sintética tipo documento y su solicitud de firma. Origen: `Backend/CONSULTORIO/Peluqueria/servicios.py`.
4. Borrar el ingreso puede borrar consulta de consentimiento y solicitudes de firma asociadas. Origen: servicios/persistencia de Peluquería.
5. Puede generar constancia de ingreso y PDF de consentimiento. Origen: rutas/servicios de Peluquería.

## Clientes de venta y documentos

1. Una venta mostrador puede usar `billing_clients` sin obligar a crear propietario/paciente clínico. Se conservan placeholders técnicos para registros heredados. Origen: `Backend/VENTAS/COMPARTIDO`, `Backend/VENTAS/Facturacion`.
2. Si se usa paciente, debe pertenecer al propietario indicado. Origen: validación/persistencia de Facturación.
3. Totales no pueden ser negativos. Origen: `Backend/VENTAS/Facturacion/validacion.py`.
4. Cotización y factura comparten tablas, pero solo factura afecta inventario y caja. Origen: `Backend/VENTAS/Facturacion/persistencia.py`.
5. Al crear factura, movimientos de inventario, pagos y caja se ejecutan bajo la transacción externa compartida. Origen: `Backend/VENTAS/Facturacion/persistencia.py`, `Backend/BASE_DE_DATOS/database.py`.
6. Un desglose de pago mixto debe sumar exactamente el total de la factura. Origen: validación de Facturación.
7. Editar una factura revierte stock, elimina pagos/caja anteriores y reconstruye todos los efectos desde el nuevo payload. Origen: persistencia de Facturación.
8. Borrar factura revierte stock, elimina dependencias y afecta cierres relacionados. Origen: persistencia de Facturación.

## Pagos

1. Solo una factura pendiente admite pagos; el monto no puede exceder el saldo. Origen: `Backend/VENTAS/Facturacion/persistencia.py`.
2. Registrar pago actualiza saldo/estado y crea movimiento automático de caja en la misma transacción. Origen: persistencia de Facturación/Caja.
3. Borrar pago elimina su movimiento de caja, recalcula factura e invalida el cierre mensual aplicable. Origen: persistencia de Facturación e Informes.
4. Los métodos de pago y cuentas de caja son listas de constantes del legado. **NECESITA REVISIÓN:** parametrización por tenant/país.

## Inventario, compras y vencimientos

1. Una factura que consume producto no permite stock negativo. Origen: `Backend/VENTAS/Facturacion/persistencia.py`.
2. Un ajuste manual sí puede dejar stock negativo; también algunas reversiones de compra. Origen: `Backend/VENTAS/Inventario/persistencia.py`. **NECESITA REVISIÓN:** decidir si es intención operativa o defecto.
3. El conteo físico calcula diferencia, genera ajuste y guarda/actualiza un snapshot por ítem. Origen: persistencia de Inventario.
4. Una compra puede marcarse para afectar o no inventario. Origen: validación/persistencia de Inventario y migración Supabase correspondiente.
5. El descuento de compra es global, no por línea. Origen: validación/persistencia de Inventario y migración de descuento total.
6. Editar compra revierte los movimientos anteriores y vuelve a aplicarlos; borrar revierte cuando correspondía. Origen: persistencia de Inventario.
7. Cualquier cambio financiero relevante invalida cierres mensuales afectados. Origen: Inventario e Informes Financieros.
8. **NECESITA REVISIÓN:** el modelo de vencimiento parece centrado en el ítem y no demuestra lotes independientes; aclarar FEFO, múltiples lotes y trazabilidad.

## Caja

1. Las cuentas fijas son caja menor, caja mayor y transferencia. Origen: `Backend/BASE_DE_DATOS/contexto.py`, módulo Caja.
2. Una sesión debe pasar a arqueo antes del cierre. Origen: `Backend/VENTAS/Caja/persistencia.py`.
3. Saldo esperado = base/apertura + ingresos − egresos; el cierre registra contado y diferencia. Origen: persistencia de Caja.
4. La asignación de cierre usa el efectivo contado cuando el destino difiere; transferencias generan movimientos pareados. Origen: persistencia de Caja.
5. Un movimiento manual anterior al cierre puede borrarse físicamente. Después del cierre, se marca anulado y se crea un movimiento opuesto en período/sesión abierta. Origen: persistencia de Caja.
6. Movimientos automáticos, vinculados o de reverso no admiten el borrado manual genérico; transferencias y préstamos tienen operaciones especializadas. Origen: persistencia/validación de Caja.
7. Aportes y devoluciones de socios se reflejan en caja y en `billing_partner_loans`. Origen: módulo Caja.
8. Reabrir sesiones y resets alteran saldos y requieren permisos peligrosos específicos. Origen: rutas de Caja y `autorizacion.py`.

## Informes y cierres

1. El resumen clínico/operativo reúne propietarios, pacientes, historias, consultas, agenda, peluquería, catálogo, compras, caja y auditoría reciente. Origen: `Backend/INFORMES/Clinicos/persistencia.py`.
2. El cierre mensual guarda un snapshot de la situación calculada. Origen: `Backend/INFORMES/Financieros/persistencia.py`.
3. Una modificación posterior no queda bloqueada; elimina o invalida cierres del período afectado. Origen: persistencia de Facturación, Inventario, Caja e Informes.
4. **NECESITA REVISIÓN:** si el producto futuro necesita cierre contable inmutable, reapertura autorizada, notas de crédito o auditoría fiscal formal.

## Backups, inicialización y correcciones

1. SQLite puede generar una copia de archivo con timestamp. PostgreSQL no tiene backup desde la aplicación. Origen: `Backend/BASE_DE_DATOS/database.py`, `rutas.py`.
2. La inicialización puede alterar esquema y ejecutar migraciones lógicas automáticamente. Origen: constructores de `Database`/`PostgresDatabase`.
3. Si falta un marcador histórico, una rutina puede respaldar y vaciar inventario/facturación, seguida de una restauración parcial del catálogo. Esto es una operación de transición, no una regla del producto. Origen: `Backend/VENTAS/Inventario/persistencia.py`, `Backend/BASE_DE_DATOS/database.py`.
4. Una migración Supabase de caja incluye una compensación de un movimiento específico de la clínica. No debe formar parte del nuevo modelo, seed ni migración. Origen: `Backend/BASE_DE_DATOS/supabase/migrations/20260909001110_cash_movement_void_reversal.sql`.
