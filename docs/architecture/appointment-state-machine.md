# Máquina de estados de Appointment

## Propósito

Esta es la máquina propuesta para Fase 5B. No afirma que Lativet tuviera
exactamente estos nombres: la auditoría solo confirma la distinción operacional
entre citas activas, completadas, canceladas y no-asistió. La implementación
debe usar un estado canónico y transiciones server-side, no cadenas libres
enviadas por el frontend.

## Estados

| Estado        | Significado                                                                | ¿Ocupa recurso? | ¿Terminal? |
| ------------- | -------------------------------------------------------------------------- | --------------- | ---------- |
| `SCHEDULED`   | Creada y pendiente de confirmación.                                        | Sí              | No         |
| `CONFIRMED`   | Confirmada por una operación autorizada.                                   | Sí              | No         |
| `IN_PROGRESS` | La atención comenzó o el paciente está siendo recibido.                    | Sí              | No         |
| `COMPLETED`   | La cita operativa terminó. No implica que exista aún una consulta clínica. | No              | Sí         |
| `CANCELLED`   | No ocurrirá; se conserva el motivo y el actor.                             | No              | Sí         |
| `NO_SHOW`     | El paciente/cliente no se presentó después de la ventana definida.         | No              | Sí         |

`status` no debe mezclarse con el estado clínico de Patient ni con el resultado
de una consulta. Un recordatorio o seguimiento tampoco es una transición de
Appointment.

## Transiciones válidas

```text
SCHEDULED ──confirm──> CONFIRMED ──start──> IN_PROGRESS ──complete──> COMPLETED
    │                         │                 │
    ├──cancel──────────────┐  ├──cancel────────┤
    └──no_show (después)───┴──┴──no_show───────┘
```

| Desde         | Hacia         | Condición mínima                                                                       |
| ------------- | ------------- | -------------------------------------------------------------------------------------- |
| `SCHEDULED`   | `CONFIRMED`   | Actor con permiso de confirmar; la cita sigue vigente y sin conflicto.                 |
| `SCHEDULED`   | `IN_PROGRESS` | Atajo operativo autorizado para clínicas que no requieren confirmación previa.         |
| `SCHEDULED`   | `CANCELLED`   | Actor autorizado, motivo opcional u obligatorio según política.                        |
| `SCHEDULED`   | `NO_SHOW`     | Solo después de `startsAt` más la tolerancia definida y con permiso.                   |
| `CONFIRMED`   | `IN_PROGRESS` | El profesional/recepción inicia la atención.                                           |
| `CONFIRMED`   | `CANCELLED`   | Actor autorizado; conserva motivo y timestamp.                                         |
| `CONFIRMED`   | `NO_SHOW`     | Vencida la tolerancia de llegada y sin inicio.                                         |
| `IN_PROGRESS` | `COMPLETED`   | Actor autorizado; no crea automáticamente `ClinicalConsultation`.                      |
| `IN_PROGRESS` | `CANCELLED`   | Corrección operativa excepcional antes de cerrar; requiere permiso explícito y motivo. |

El atajo `SCHEDULED → IN_PROGRESS` y la tolerancia exacta de no-asistencia son
decisiones configurables por producto, no permisos para aceptar cualquier
transición arbitraria.

## Transiciones inválidas

- Cualquier estado terminal (`COMPLETED`, `CANCELLED`, `NO_SHOW`) hacia un
  estado activo.
- `CANCELLED → COMPLETED` o `NO_SHOW → COMPLETED`.
- `COMPLETED → CANCELLED` como forma de borrar historia.
- `SCHEDULED → COMPLETED` sin pasar por atención iniciada, salvo una operación
  administrativa de corrección que deberá quedar auditada en una fase futura.
- `CONFIRMED → COMPLETED` sin `IN_PROGRESS`, salvo que producto defina un atajo
  explícito; no se debe introducir por conveniencia de UI.
- Cambiar una cita de un tenant a otro, aunque el id exista en ambos.

La API debe devolver un error estable de transición inválida y no alterar la
fila. El frontend no debe ocultar una transición para hacerla parecer válida.

## Citas activas y conflictos

Para disponibilidad y solapamiento, los estados que ocupan recursos son
`SCHEDULED`, `CONFIRMED` e `IN_PROGRESS`. Los estados terminales liberan el
recurso para nuevas reservas. Una transacción debe volver a comprobar el estado
y el rango temporal antes de insertar o reprogramar.

La regla concreta de recurso (profesional, paciente, sede, consultorio,
equipo/capacidad) está en decisión de producto. Esta máquina solo define que una
cita activa participa en el conflicto; no convierte la sede completa en un
recurso único.

## Cancelación

Cancelar no elimina la cita. Debe:

1. validar tenant y permiso;
2. comprobar que el estado no es terminal;
3. cambiar a `CANCELLED` dentro de una transacción;
4. guardar `cancelledAt`, `cancelledByMembershipId` y motivo;
5. liberar el rango para conflictos posteriores;
6. no enviar Google, SMTP ni recordatorios en 5B.

La política de cancelación tardía, quién puede cancelar y si se requiere motivo
son decisiones de producto. Un evento de auditoría completo se posterga, pero
los campos de cancelación no deben perderse.

## Completar y no-asistencia

Completar representa el fin operativo de la reserva; no crea por sí solo una
consulta clínica, evolución, peso o factura. Esas relaciones se diseñarán en
fases posteriores.

`NO_SHOW` es un resultado terminal de asistencia. Solo puede aplicarse después
de una ventana de gracia definida y no debe disparar por sí mismo un correo o
seguimiento. Si el usuario se presenta tarde, se permite iniciar la cita desde
un estado activo mientras no se haya marcado no-asistencia.

Reabrir una cita terminal no se propone para 5B. Si la clínica necesita corregir
un error, se requiere una acción administrativa explícita, motivo y auditoría
antes de añadirla al modelo.

## Edición y reprogramación

### Antes de `IN_PROGRESS`

Se pueden editar, con permiso y comprobaciones tenant-aware:

- `startsAt` y `endsAt`;
- sede;
- profesional asignado;
- tipo;
- paciente/propietario, respetando las invariantes;
- razón y notas operativas.

Toda modificación de horario, sede o profesional se trata como una
reprogramación: recalcula timezone, availability, blocks y conflictos en la
misma transacción. El estado se conserva; reprogramar no es cancelar + crear.

### Desde `IN_PROGRESS`

No se cambia el intervalo, sede, paciente ni profesional como edición normal.
Solo se permiten notas operativas y el cierre de la transición, salvo una
corrección administrativa futura.

### Estados terminales

No se edita el contexto operativo de una cita terminal. La consulta de historial
puede mostrarla y filtros autorizados pueden ocultarla, pero no se reemplaza ni
se elimina.

5B no requiere una tabla de historial de reprogramaciones. Antes de ofrecer
auditoría legal, se deberá decidir qué campos, actor, motivo y versiones se
conservan; la API no debe prometer ese historial todavía.

## Permisos operativos propuestos

Los nombres son una propuesta para ampliar el catálogo existente, no permisos
implementados en 5A:

| Acción                   | Permiso sugerido                              | Nota                                                   |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| Ver citas                | `appointments.read`                           | Siempre filtrado por `TenantContext`.                  |
| Crear                    | `appointments.create`                         | Exige Patient/Owner registrados en el MVP recomendado. |
| Editar/reprogramar       | `appointments.update`                         | No permite cambiar tenant.                             |
| Confirmar/iniciar        | `appointments.confirm` / `appointments.start` | Producto debe decidir si se separan.                   |
| Completar                | `appointments.complete`                       | No crea consulta clínica automáticamente.              |
| Cancelar                 | `appointments.cancel`                         | Conserva motivo y actor.                               |
| Gestionar disponibilidad | `appointments.manage_availability`            | Reglas y bloques de sede/profesional.                  |

La capacidad de actuar como profesional se deriva de la membership activa y de
la matriz de permisos; no se crea una entidad `Professional` ni se confía en la
UI.

## Decisiones pendientes relacionadas con la máquina

- Si `CONFIRMED` es obligatorio o puede omitirse.
- Duración de la tolerancia antes de `NO_SHOW`.
- Si la cancelación tardía exige motivo y/o rol administrativo.
- Si la sede permite citas sin profesional asignado.
- Si el producto necesita reabrir estados terminales con auditoría.
- Si el resultado de asistencia debe separarse del `status` en una futura
  `AttendanceEvent`.
