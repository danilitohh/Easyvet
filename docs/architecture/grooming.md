# Grooming / Peluquería — Fase 7

`GroomingVisit` es un agregado operativo tenant-scoped para registrar servicios
de baño, corte y cuidado estético. Su modelo no representa una consulta ni
genera transacciones comerciales.

## Relaciones e invariantes

- Cada visita pertenece a una Organization, Patient, Owner histórico y
  ClinicLocation del mismo tenant. `ownerIdAtTime` se copia desde el Patient al
  crear y no se modifica si después cambia su propietario.
- `appointmentId` es opcional. Si se usa, PostgreSQL exige que cita, Patient y
  sede coincidan dentro del tenant; una cita puede pertenecer a una sola visita
  Grooming. Agenda conserva su propio estado.
- `assignedGroomerMembershipId` puede ser nulo en DRAFT. Antes de START, el
  miembro asignado debe estar activo y tener permiso efectivo
  `grooming.perform`; el rol por sí solo no concede autoridad.
- START y las acciones durante atención se autorizan por el permiso efectivo
  del actor, no por igualdad con el Groomer asignado. La asignación identifica
  responsabilidad operativa y su snapshot histórico.
- `serviceSummary` es texto libre, no un catálogo ni una cotización. V1 no
  persiste precio, total, consumo o datos de venta.
- Al iniciar se congelan nombres de Patient, Owner y Groomer para la lectura
  histórica. Perfil clínico no es requisito.

## Lifecycle

```text
DRAFT ──start──> IN_PROGRESS ──complete──> COMPLETED ──void──> VOIDED
                         └────────void──────────────────────> VOIDED
```

Drafts no se borran ni anulan en V1. Cada escritura lleva `expectedVersion` y
aumenta `version`; escrituras desactualizadas responden 409. COMPLETED y VOIDED
son terminales, salvo anulación de COMPLETED. La anulación conserva notas,
relaciones y snapshots.

`grooming.perform` basta para iniciar y modificar los campos operativos de una
visita IN_PROGRESS; `grooming.complete` basta para finalizarla. No se restringe
al Groomer que aparece asignado; OWNER/ADMIN también pueden operar como actor.

Patient ACTIVE se requiere para crear, editar, iniciar y completar. El archivo
del Patient comparte su bloqueo de fila con Grooming y devuelve
`ACTIVE_GROOMING_VISIT_EXISTS` si hay una visita IN_PROGRESS. DRAFT,
COMPLETED y VOIDED no impiden archivar; los registros históricos siguen siendo
legibles y pueden anularse por permisos.

Las operaciones mutables serializan y toman bloqueos en orden Patient →
Appointment (si aplica) → GroomingVisit → Membership de Groomer. La auditoría
append-only usa `OperationalAuditEvent`, no `ClinicalAuditEvent`; metadata
contiene actor, transición, versión y nombres de campos, nunca el contenido de
notas.

## Límites V1

Grooming no crea ni cambia Appointment, ClinicalRecord, Encounter, Evolution,
Diagnostic, Sale o Invoice; tampoco cobra, descuenta Inventory ni proyecta peso
al Patient. El detalle del módulo está en [la referencia de API](grooming-api.md)
y [la guía de frontend](grooming-frontend.md).

Fuera de V1 quedan ServiceCatalog, precios/paquetes, inventario, venta/factura
automática, fotos, consentimiento propio, notificaciones, reserva en línea y
recurrencia.
