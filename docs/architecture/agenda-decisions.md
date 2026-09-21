# Decisiones de Agenda 5B

## DECIDIDO E IMPLEMENTADO

1. `Appointment` requiere Patient y Owner reales, ambos `ACTIVE`, del tenant
   activo, y `Patient.ownerId` debe coincidir con `ownerId`.
2. `ClinicLocation` es obligatoria, `ACTIVE` y del mismo tenant.
3. El profesional es una Membership opcional; no existe `Professional` ni texto
   libre. Membership y User deben estar `ACTIVE`.
4. `createdByMembershipId` se deriva de `TenantContext.membershipId`, nunca del
   cliente.
5. No se crea `AppointmentType` ni `typeCode`; `reason` describe el motivo.
6. `AvailabilityRule` entra en 5B; `ScheduleBlock` queda fuera.
7. Sin regla aplicable se permite reservar. Con regla aplicable la cita debe
   caber completamente y alinearse al slot.
8. Conflictos: Patient y Membership asignada; no Owner ni Location completa.
9. Intervalos PostgreSQL son UTC y half-open `[start, end)`.
10. `btree_gist` y exclusion constraints `tstzrange` protegen concurrencia real.
11. Confirmación es independiente (`ownerConfirmedAt`, `clinicConfirmedAt`).
12. Cancelar conserva la fila y metadatos; no se borra Appointment.
13. Archivar Patient se bloquea si tiene citas futuras bloqueantes; no se cancela
    automáticamente.
14. No se implementan Google, recordatorios, SMTP, booking público ni calendario
    React.

## Máquina de estados

Estados: `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`,
`NO_SHOW`. Las transiciones y endpoints están en
`appointment-state-machine.md`; no existe PATCH arbitrario de status.

## Permisos implementados

```text
appointments.read
appointments.create
appointments.update
appointments.cancel
appointments.checkIn
appointments.start
appointments.complete
appointments.markNoShow
availability.read
availability.manage
```

Matriz inicial:

| Rol           | Agenda                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| OWNER / ADMIN | Todos los permisos de Agenda y disponibilidad                           |
| VETERINARIAN  | read/create/update/checkIn/start/complete/markNoShow; availability.read |
| ASSISTANT     | read/create/update/checkIn; availability.read                           |
| RECEPTION     | read/create/update/cancel/checkIn/markNoShow; availability.read         |
| GROOMER       | appointments.read                                                       |
| CASHIER       | appointments.read                                                       |

VETERINARIAN no tiene cancel por defecto. No se añadieron permisos clínicos ni
tabla de permisos.

## API y contratos

Los contratos Zod y DTOs aceptan únicamente campos de negocio permitidos. Tenant,
status inicial, auditoría, confirmación y cancelación se derivan en servidor.
Las listas exigen rango máximo de 90 días; detalles cross-tenant devuelven 404.

## POSTERGADO

`AppointmentType`, `ScheduleBlock`, Reservation, WaitingRoom, Professional,
CalendarIntegration, Consultation, FollowUp, Reminder, Google Calendar,
recurrencia, recursos/equipos, auditoría legal y frontend calendario.

## HARDENING CERRADO EN FASE 5D

- Los endpoints de workflow, edición, cancelación y confirmación usan una
  actualización condicional por estado para que una acción obsoleta reciba
  `409` y no sobrescriba la operación de otro usuario.
- Las reglas activas del mismo alcance, sede y día no pueden solaparse; la
  precedencia Membership > sede permanece explícita y los límites adyacentes
  siguen siendo válidos con intervalos `[start, end)`.
- Se verificaron rangos de lectura de 90 días, FKs tenant-aware, estados
  terminales, semántica de slots, timezone de organización y DST ambiguo/no
  existente. El detalle comparativo está en
  `docs/migration/agenda-final-review.md`.

## Estado de salida

Fase 5D queda completada después de pasar los gates del repositorio y la QA
manual sobre `easyvet_dev`. Las fases clínicas, Google, notificaciones y
booking público no comienzan automáticamente.
