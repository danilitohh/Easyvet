# Revisión final de Grooming — Fase 7

## Revisión del legacy

Revisión read-only del repositorio `C:\Users\danil\Downloads\Lativet-reference`
en el commit `05fea495cb13208b27bf470b3570987fd501a81e` (sin ejecutar
Lativet). El módulo `grooming_documents` mezclaba recepción del servicio con
consentimientos/documentos y recordatorios; el responsable se manejaba como
texto libre. La relación con Agenda no era una FK tenant-safe estable. Se
encontró eliminación física que podía borrar además consulta clínica sintética,
firmas y recordatorios relacionados. Servicios y registro operativo podían
participar indirectamente del flujo de venta/inventario. La experiencia legado
se inspeccionó junto con referencias de Patient/Owner, permisos, Agenda,
frontend y tests para identificar dichos cruces.

Easyvet separa el agregado operativo de los documentos/consentimientos
clínicos, exige Membership Groomer elegible y usa una relación opcional con
Appointment bajo las mismas claves de tenant, Patient y sede. No existe precio,
venta, inventario ni estado de consulta clínica en `GroomingVisit`. La
corrección histórica es anulación lógica con auditoría operativa; jamás hard
delete.

## Modelo y migración

La migración `20260923000000_grooming_module` agrega `GroomingVisit`,
`OperationalAuditEvent`, enums, claves foráneas compuestas, índices de cola e
historial, unicidad por Appointment, y checks SQL de versión y consistencia del
lifecycle. Se aplicó solo a `easyvet_dev` y `easyvet_test`; ambas bases quedan
con Prisma al día. No se creó `scheduledFor`: Agenda es la autoridad temporal.

Para bases locales vacías, revertir significa una operación destructiva y solo
debe hacerse antes de distribuir/aplicar la migración; primero debe preservarse
cualquier dato que se quiera conservar. El orden conceptual es quitar primero
`operational_audit_events` y `grooming_visits`, después el índice compuesto
añadido a `appointments`, y finalmente los enums. En una base con datos, la
migración no tiene rollback automático: respaldar, planear retención y ejecutar
una migración correctiva revisada en lugar de borrar registros. Nunca revertir
una base compartida o productiva como tarea rutinaria.

## Seed, QA y cierre

El seed es idempotente y agrega usuarios ficticios de Groomer/Recepción y cuatro
visitas: Norte DRAFT, IN_PROGRESS y COMPLETED, más Sur DRAFT. Los registros
manuales de QA no se incorporan al seed y no se eliminan físicamente.

Limitaciones posteriores a V1: catálogo/precio/paquetes, consumo de inventario,
venta/factura automática, fotos antes/después, consentimiento específico,
notificaciones, reservas online y citas recurrentes. Son extensiones futuras,
no defectos de esta implementación.
