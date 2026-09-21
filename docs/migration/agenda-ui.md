# Migración de Agenda — programación y lectura

## Resultado

Fase 5C.1 reemplazó el placeholder visual de `/agenda` por una lectura real de
las citas de Easyvet. Fase 5C.2A añade las operaciones de programación desde
React consumiendo los endpoints ya existentes de Fase 5B; no introduce tablas,
endpoints ni permisos nuevos.

## Alcance implementado

- Calendario mensual, semanal, diario y de lista.
- Estado `view`/`date` compartible en la URL.
- Detalle en `/agenda/citas/:appointmentId`.
- Filtros por sede, profesional, estado y paciente con búsqueda paginada.
- Zona horaria obtenida de la organización activa y conversión civil con
  Temporal.
- Cancelación de peticiones y limpieza de datos al cambiar de tenant.
- Estados de carga, error, vacío y advertencia parcial de referencias.
- Responsive desktop/tablet/390 px y controles básicos de accesibilidad.

## Operaciones de programación de Fase 5C.2A

- `/agenda/nueva` requiere `appointments.create` y permite sede, Patient activo,
  Owner derivado, profesional opcional, fecha, hora, duración, motivo y notas.
- `/agenda/citas/:appointmentId/editar` requiere `appointments.update` y solo
  envía `reason`, `notes` y `assignedMembershipId`; no cambia el horario.
- `/agenda/citas/:appointmentId/reprogramar` requiere `appointments.update` y
  usa exclusivamente `POST /appointments/:id/reschedule`.
- El detalle expone `Cancelar cita` solo para estados y permisos válidos; el
  modal solicita `cancellationReason` y usa el endpoint dedicado.
- Las mutaciones deshabilitan el submit mientras están pendientes, no hacen
  optimistic update y refrescan Agenda después de confirmar el backend.

## Verificación

La suite web cubre mapeo de eventos, estados, fechas civiles, rangos, filtros,
navegación URL/tenant, construcción de mutaciones, timezone, derivación
Patient → Owner, edición, reprogramación, conflictos y cancelación. También se
conserva la suite existente del AppShell, auth, owners y patients. La
verificación completa del repositorio se ejecuta como parte del checkpoint de
esta fase.

## Manual QA realizado

Con `owner.norte@demo.local` y la contraseña local del seed, contra la base
`easyvet_dev`, se verificaron:

- login y navegación desde Dashboard a `/agenda`;
- mes con cuatro citas seed y estados `SCHEDULED`, `WAITING_ROOM`,
  `COMPLETED` y `CANCELLED`;
- navegación mes → semana → día → lista, con actualización de `view`/`date`;
- hora mostrada en `America/Bogota`, filtros cargados desde API y detalle
  navegable en `/agenda/citas/:appointmentId`;
- detalle de Patient, Owner, sede, profesional, estado, duración y
  confirmaciones.

El checkpoint 5C.1.1 añadió la pasada manual siguiente:

- En viewport emulado de 390 px, la navegación móvil, filtros, selector de
  vista, Day/List/Month, detalle, cierre y scroll funcionaron sin overflow
  horizontal (`scrollWidth` 375 px frente a `innerWidth` 390 px).
- El usuario `multi@demo.local` cambió Norte → Sur → Norte. Sur mostró solo sus
  dos citas y sus filtros tenant-specific; el detalle Norte se cerró al
  cambiar, no quedaron eventos Norte renderizados y la agenda Norte se
  recuperó al volver.
- El deep link de la cita Norte `00000000-0000-4000-8000-000000000601` bajo
  Sur devolvió `Recurso no encontrado` (404 lógico tenant-safe).
- La cita Norte respondió `2030-01-08T14:00:00.000Z`/`14:30:00.000Z` y se
  mostró como 09:00–09:30 en `America/Bogota`, confirmando que la hora visual
  usa `Organization.timezone` y no la zona del navegador.

El smoke también encontró y corrigió un ciclo de actualización de FullCalendar
al sincronizar `datesSet`; después de la corrección la pantalla dejó de quedar
en blanco. La verificación responsive y el cambio de tenant quedan registrados
en el checkpoint 5C.1.1.

La base histórica `veterinary_saas` no se modificó ni se utiliza para desarrollo
o QA. El flujo local normal apunta a `easyvet_dev`; las pruebas DB apuntan a
`easyvet_test`. No se añadieron mutaciones de Agenda ni se requirió un test de
regresión adicional durante este checkpoint.

## Fuera de alcance

Las operaciones de Agenda —crear, editar, reprogramar, cancelar, check-in,
iniciar, completar, `NO_SHOW`, confirmaciones y disponibilidad— quedan en
**PENDIENTE FASE 5C.2**. El hardening final queda en **PENDIENTE FASE 5D**.
