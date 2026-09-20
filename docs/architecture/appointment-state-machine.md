# Máquina de estados de Appointment

## Propósito y etiquetas

El checkpoint 5A.1 verificó directamente el comportamiento de Lativet en
`05fea495cb13208b27bf470b3570987fd501a81e`. La primera tabla es
**VERIFIED LEGACY BEHAVIOR**. La máquina posterior es una **NEW EASYVET DESIGN
DECISION** y no debe confundirse con el enum legacy.

## Valores exactos observados en Lativet

| Valor legacy           | Significado observado     | Transiciones observadas                | Propuesta Easyvet                                   |
| ---------------------- | ------------------------- | -------------------------------------- | --------------------------------------------------- |
| `scheduled`            | Cita agendada             | Inserción y actualización libre        | `SCHEDULED` inicial                                 |
| `pending_confirmation` | Pendiente de confirmación | Actualización libre; visible en UI     | `CONFIRMED` o estado previo según decisión          |
| `waiting_room`         | Cita en sala de espera    | PATCH directo; no hay entidad/cola     | `IN_PROGRESS` o estado operativo separado, decisión |
| `confirmed`            | Confirmada                | PATCH directo                          | `CONFIRMED`                                         |
| `confirmed_by_clinic`  | Confirmada por clínica    | PATCH directo                          | `CONFIRMED` con actor si se conserva                |
| `confirmed_by_owner`   | Confirmada por owner      | PATCH directo                          | `CONFIRMED` con actor si se conserva                |
| `completed`            | Atención terminada        | PATCH directo                          | `COMPLETED` terminal                                |
| `cancelled`            | Cancelada                 | PATCH directo o DELETE físico desde UI | `CANCELLED` terminal, conservar fila                |
| `no_show`              | No asistió                | PATCH directo                          | `NO_SHOW` terminal con tolerancia                   |

El backend solo comprueba pertenencia a `APPOINTMENT_STATUSES`; no comprueba
actor, tiempo, estado previo, terminalidad, motivo ni auditoría. La UI solo
expone `scheduled` y `pending_confirmation`, aunque pruebas y API usan los
demás valores. No existe una matriz legacy de transiciones.

## Estado y asistencia no son el mismo concepto

`waiting_room` es un estado operativo de Appointment, no un modelo
`WaitingRoom`. La respuesta de asistencia de Google vive en
`google_attendee_response_status`, como valor externo separado. Attendance sync
persiste `accepted`, `declined` o `needsAction` (según Google), pero el mapeo
legacy devuelve `None` y no cambia el estado manual. Easyvet debe mantener esta
separación.

## Máquina propuesta para Easyvet

**NEW EASYVET DESIGN DECISION** — Estados canónicos:

| Estado        | Significado                            | ¿Ocupa recurso? | ¿Terminal? |
| ------------- | -------------------------------------- | --------------- | ---------- |
| `SCHEDULED`   | Creada y pendiente de confirmación     | Sí              | No         |
| `CONFIRMED`   | Confirmada por actor autorizado        | Sí              | No         |
| `IN_PROGRESS` | Atención iniciada o paciente recibido  | Sí              | No         |
| `COMPLETED`   | Fin operativo                          | No              | Sí         |
| `CANCELLED`   | No ocurrirá; se conservan motivo/actor | No              | Sí         |
| `NO_SHOW`     | No se presentó tras tolerancia         | No              | Sí         |

Transiciones recomendadas:

```text
SCHEDULED ──confirm──> CONFIRMED ──start──> IN_PROGRESS ──complete──> COMPLETED
    │                         │                 │
    ├──cancel──────────────┐  ├──cancel────────┤
    └──no_show (después)───┴──┴──no_show───────┘
```

| Desde                     | Hacia         | Condición mínima                                   |
| ------------------------- | ------------- | -------------------------------------------------- |
| `SCHEDULED`               | `CONFIRMED`   | Permiso y cita vigente sin conflicto               |
| `SCHEDULED`               | `IN_PROGRESS` | Atajo operativo autorizado, si producto lo permite |
| `SCHEDULED` / `CONFIRMED` | `CANCELLED`   | Permiso, motivo según política                     |
| `SCHEDULED` / `CONFIRMED` | `NO_SHOW`     | Inicio + tolerancia y permiso                      |
| `CONFIRMED`               | `IN_PROGRESS` | Recepción/profesional inicia atención              |
| `IN_PROGRESS`             | `COMPLETED`   | Actor autorizado                                   |
| `IN_PROGRESS`             | `CANCELLED`   | Corrección excepcional, motivo y permiso explícito |

No se permiten transiciones desde terminales, cambio de tenant, ni completar
sin atención iniciada salvo una corrección administrativa futura y auditada.
La API debe devolver error estable sin mutar la fila en transición inválida.

## Conflictos y estados activos

`SCHEDULED`, `CONFIRMED` e `IN_PROGRESS` ocupan recursos. Una transacción de
creación o reprogramación debe recalcular disponibilidad y comprobar conflictos
con la estrategia anti-carrera definida para PostgreSQL. El legado comparaba
globalmente todas las citas activas; Easyvet debe decidir si el conflicto se
aplica a profesional, Patient, sede, consultorio, equipo o capacidad.

## Cancelación

Cancelar no elimina Appointment. Debe validar tenant y permiso, comprobar que no
sea terminal, cambiar a `CANCELLED` y guardar `cancelledAt`,
`cancelledByMembershipId` y `cancellationReason` en una transacción. Libera el
rango para nuevas reservas. Google, SMTP y recordatorios quedan fuera de 5B.

El legado borra físicamente desde la UI y sincroniza Google antes del borrado;
eso es una diferencia deliberada del diseño Easyvet.

## Completar, no-show y reprogramar

`COMPLETED` cierra la reserva y no crea automáticamente una consulta clínica.
`NO_SHOW` requiere tolerancia configurable. Reabrir terminales no es parte de
5B. Antes de `IN_PROGRESS` se pueden editar Patient/Owner, profesional, sede,
tipo, razón y rango, siempre revalidando. Desde `IN_PROGRESS` solo notas y
cierre, salvo corrección administrativa futura. Reprogramar conserva la fila y
su estado; no es DELETE + INSERT.

## Permisos propuestos

Son diseño, no permisos implementados en este checkpoint:

`appointments.read`, `appointments.create`, `appointments.update`,
`appointments.confirm`, `appointments.start`, `appointments.complete`,
`appointments.cancel` y `appointments.manage_availability`.

La UI no puede sustituir la guardia server-side. La membership activa y el
tenant actual determinan el actor.

## PRODUCT DECISION REQUIRED

- Si `CONFIRMED` es obligatorio o se permite iniciar desde `SCHEDULED`.
- Tolerancia exacta de `NO_SHOW` y quién puede marcarlo.
- Política de cancelación tardía y motivo obligatorio.
- Si `waiting_room` será solo una vista derivada o un estado canónico adicional.
- Si una cita sin profesional asignado ocupa un recurso de sede.
- Si alguna corrección puede reabrir un estado terminal y qué auditoría exige.
- Si attendance externo requerirá una futura entidad de eventos separada.
