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

## Concurrencia y disponibilidad

Las acciones de edición, cancelación, confirmación y transición aplican un
compare-and-set sobre el estado leído. Si otro operador ganó la carrera, la
segunda petición recibe `409 INVALID_APPOINTMENT_STATE` y la fila permanece
intacta. Las exclusiones PostgreSQL siguen siendo la autoridad final para
solapamientos de Patient/Membership y sus errores se convierten a una respuesta
controlada sin filtrar SQL ni stack trace.

Las reglas activas de un mismo alcance (sede o Membership), sede y día no se
pueden solapar; los límites adyacentes sí son válidos porque todos los
intervalos usan `[start, end)`. Un alcance específico puede solaparse con el
general: la precedencia Membership > sede elimina la ambigüedad. La ausencia
de reglas activas aplicables se expone como `UNRESTRICTED`.

## Pruebas

La suite de Agenda cubre todas las transiciones válidas e inválidas, acciones
terminales, confirmación independiente, reprogramación, reglas solapadas y
adyacentes, DST de salto y repetición, y carreras reales de dos requests donde
exactamente uno obtiene 201 y el otro 409.
