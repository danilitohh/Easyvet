# Máquina de estados de Appointment 5B

## Estado implementado

La máquina de Easyvet no copia literalmente el enum legacy. Se implementa en un
único helper de `AppointmentsService`; los controllers solo invocan acciones
nombradas.

## Estados

| Estado         | Significado                                       | Bloquea conflictos | Terminal |
| -------------- | ------------------------------------------------- | ------------------ | -------- |
| `SCHEDULED`    | Cita creada y aún no iniciada                     | Sí                 | No       |
| `WAITING_ROOM` | Check-in realizado                                | Sí                 | No       |
| `IN_PROGRESS`  | Atención iniciada                                 | Sí                 | No       |
| `COMPLETED`    | Atención finalizada; conserva intervalo histórico | Sí                 | Sí       |
| `CANCELLED`    | Cancelada con metadatos de cancelación            | No                 | Sí       |
| `NO_SHOW`      | No asistió                                        | No                 | Sí       |

La confirmación no es estado: `ownerConfirmedAt` y `clinicConfirmedAt` son
timestamps independientes.

## Transiciones válidas

```text
SCHEDULED ──check-in──> WAITING_ROOM ──start──> IN_PROGRESS ──complete──> COMPLETED
    │                         │
    ├──start──────────────────┘
    ├──cancel
    └──no-show
WAITING_ROOM ──cancel | no-show
```

| Desde          | Hacia          | Endpoint                          |
| -------------- | -------------- | --------------------------------- |
| `SCHEDULED`    | `WAITING_ROOM` | `POST /appointments/:id/check-in` |
| `SCHEDULED`    | `IN_PROGRESS`  | `POST /appointments/:id/start`    |
| `SCHEDULED`    | `CANCELLED`    | `POST /appointments/:id/cancel`   |
| `SCHEDULED`    | `NO_SHOW`      | `POST /appointments/:id/no-show`  |
| `WAITING_ROOM` | `IN_PROGRESS`  | `POST /appointments/:id/start`    |
| `WAITING_ROOM` | `CANCELLED`    | `POST /appointments/:id/cancel`   |
| `WAITING_ROOM` | `NO_SHOW`      | `POST /appointments/:id/no-show`  |
| `IN_PROGRESS`  | `COMPLETED`    | `POST /appointments/:id/complete` |

No se permiten `COMPLETED → SCHEDULED`, `CANCELLED → IN_PROGRESS`,
`NO_SHOW → COMPLETED`, ni cualquier transición desde terminal. Se devuelve
`INVALID_APPOINTMENT_TRANSITION` sin mutar la fila.

## Cancelación y reprogramación

Cancelar cambia el estado, guarda `cancelledAt`,
`cancelledByMembershipId` y `cancellationReason`, y nunca borra la fila.
`IN_PROGRESS`, `COMPLETED` y `NO_SHOW` no pueden cancelarse.

Reprogramar usa `POST /appointments/:id/reschedule`, solo acepta `SCHEDULED`,
conserva el estado y revalida timezone, disponibilidad, Patient y Membership.

## Disponibilidad y conflictos

Los intervalos son UTC y half-open `[start, end)`. Los estados bloqueantes son
`SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS` y `COMPLETED`; `CANCELLED` y `NO_SHOW`
no bloquean. Las exclusion constraints `tstzrange` de PostgreSQL protegen
Patient y Membership frente a concurrencia real.

## Confirmación

`POST /appointments/:id/confirm-by-clinic` y
`POST /appointments/:id/confirm-by-owner` solo escriben su timestamp. No envían
notificaciones ni cambian `AppointmentStatus`; los endpoints son autenticados y
tenant-safe.

## Pruebas

La suite de Agenda cubre todas las transiciones válidas e inválidas, cancelación,
confirmación independiente, reprogramación y una carrera real de dos requests
con el mismo Patient/Membership donde exactamente uno obtiene 201 y el otro 409.
