# Arquitectura del frontend de Agenda

## Alcance de Fase 5C.2B

Esta fase parte de la Agenda clínica de lectura y de las operaciones de
programación construidas sobre el backend de Fase 5B. La pantalla vive en
`/agenda` y el detalle de una cita en `/agenda/citas/:appointmentId`.
Fase 5C.2B añade el workflow operativo (check-in, iniciar, completar, no-show
y confirmación clínica) y la administración de disponibilidad recurrente.
Google Calendar, recordatorios, booking público, drag-and-drop y módulos
clínicos siguen fuera de alcance.

## Estado navegable

La vista y la fecha civil se mantienen en la URL:

```text
/agenda?view=week&date=2026-09-21
```

`view` admite `month`, `week`, `day` y `list`. Las fechas se interpretan como
fechas civiles dentro de la zona horaria de la organización, nunca como una
fecha local del navegador. Abrir una cita conserva esos parámetros al navegar
a `/agenda/citas/:appointmentId`. Los cambios deliberados de vista/fecha crean
entradas de historial para que Atrás/Adelante y refresh reproduzcan la misma
agenda; el cambio de tenant usa reemplazo y limpia cualquier deep link anterior.

## Calendario y zona horaria

- FullCalendar React `7.1.0` usa únicamente los plugins estándar MIT de mes,
  tiempo, lista y tema Breezy; no se usa ningún paquete premium.
- `temporal-polyfill` `1.0.5` convierte límites civiles a instantes con IANA
  timezone sin depender de la zona horaria de Windows/macOS.
- `GET /api/v1/organization/current` es la fuente de `Organization.timezone`.
  FullCalendar recibe esa misma zona y el texto de la interfaz la hace visible.
- La semana comienza el lunes para coincidir con la configuración del
  calendario y con el rango enviado al endpoint de citas.

## Flujo de datos

`agendaApi.ts` concentra las llamadas HTTP y valida las respuestas con los
contratos compartidos. `useAgenda.ts` añade:

- `AbortController` por recurso, cancelando la petición anterior cuando cambia
  el rango, el filtro o el tenant.
- invalidación de organización, filtros, selección de paciente, rango y
  detalle al cambiar `activeMembership.organization.id`.
- respuestas obsoletas abortadas y `409` de workflow tratados como estado
  stale multi-usuario, con recarga explícita y sin optimistic update.
- fallback de filtros profesionales a los profesionales observados en las
  citas cuando el rol actual no tiene `memberships.read`.

Las citas se mapean a eventos en `agendaUtils.ts`, que es la única frontera
entre el contrato backend y FullCalendar. El estado no asignado se filtra en
cliente porque el endpoint de lectura no acepta `assignedMembershipId=null`.

## Filtros y detalle

Los filtros tenant-safe son sede, profesional, estado y paciente. El buscador
de pacientes usa la API paginada existente; no carga todo el catálogo en el
navegador. Los seis estados muestran etiqueta en español y una combinación de
tono, texto y punto visual para no depender solamente del color.

El detalle es un modal accesible que mantiene la información principal en
lectura y expone únicamente las operaciones permitidas por estado y permiso.
Incluye paciente, owner,
fecha/hora en la zona de la organización, duración, sede, profesional, motivo,
notas, observaciones, confirmaciones y metadatos de cancelación cuando
corresponde.

## Operaciones de programación y workflow

Las rutas operativas son:

- `/agenda/nueva` para crear una cita;
- `/agenda/citas/:appointmentId/editar` para editar `reason`, `notes` y
  `assignedMembershipId`;
- `/agenda/citas/:appointmentId/reprogramar` para cambiar exclusivamente
  `startsAt` y `endsAt` mediante el endpoint explícito `reschedule`.

Las tres rutas están protegidas por `appointments.create` o
`appointments.update`; la cancelación vive en el detalle y exige
`appointments.cancel`. El frontend solo controla affordances: los guards del
backend siguen siendo la autoridad.

El selector de Patient usa la búsqueda paginada de Patients activos. Al elegir
un Patient, el Owner se deriva de `patient.ownerId` y se muestra como lectura;
el payload nunca permite escoger un Owner independiente. Sede y memberships
se cargan desde lookups tenant-safe, filtrando sedes, memberships y usuarios
activos; `assignedMembershipId` puede ser `null`.

La fecha y hora se editan como valores civiles de `Organization.timezone` y se
convierten a instantes explícitos mediante Temporal. La duración es un valor de
UI que genera `endsAt`; no se persiste como campo propio. Antes de crear o
reprogramar se consulta `/agenda/available-slots`. Si la respuesta es
`UNRESTRICTED`, se permite hora manual y se informa que el backend seguirá
validando conflictos.

El detalle expone las acciones de workflow solo cuando el estado y el permiso
son compatibles: `Registrar llegada` (`SCHEDULED → WAITING_ROOM`), `Iniciar
atención` (`WAITING_ROOM → IN_PROGRESS`), `Completar cita`
(`IN_PROGRESS → COMPLETED`) y `No asistió` (`SCHEDULED/WAITING_ROOM →
NO_SHOW`). La confirmación clínica es independiente del estado y usa su
endpoint dedicado. La confirmación del Owner se muestra como lectura; no se
simula una acción pública desde el backoffice.

No hay optimistic updates. Después de una mutación exitosa la agenda se
refresca y el detalle conserva el resultado. Un `409` de workflow recarga el
detalle para resolver carreras de estado y muestra un mensaje de cita
desactualizada. Day/List refrescan automáticamente cada 45 segundos.

El resumen operativo de Day/List cuenta citas por estado y permite filtrar la
vista al pulsar un estado; reutiliza la colección ya cargada y no realiza una
segunda consulta.

## Administración de disponibilidad

`/agenda/disponibilidad` requiere `availability.read`; crear, editar, activar y
desactivar requieren además `availability.manage`. Las reglas se agrupan por
sede y se editan con horario civil `HH:mm`, día de semana (lunes primero en la
UI, `0 = domingo` en el contrato), intervalo de 15–240 minutos y Membership
opcional. `membershipId = null` se presenta como “Horario general de sede”.

Si no hay reglas activas aplicables, la UI explica explícitamente el modo
`UNRESTRICTED`. La desactivación es lógica mediante `DELETE`; no se crea
`ScheduleBlock` ni ninguna tabla adicional. Tras una mutación se invalidan los
slots cargados para que crear y reprogramar vuelvan a consultar disponibilidad.

Los hooks de Agenda cancelan peticiones de slots, referencias y detalle al
cambiar fecha, filtros o tenant. Los formularios redirigen a `/agenda` cuando
detectan un cambio de organización para no conservar IDs del tenant anterior.

## Accesibilidad y responsive

Se conservan controles nativos de teclado para filtros, botones con nombres
explícitos, `aria-live` para el período, estados `role="status"`, etiquetas
descriptivas en eventos y foco gestionado por el modal existente. La grilla se
reorganiza para tablet y 390 px sin habilitar operaciones táctiles de arrastre.

El checkpoint 5C.1.1 verificó con viewport emulado de 390 px que Day/List/Month,
filtros, navegación móvil, detalle y scroll no producen overflow horizontal.
También se verificó el aislamiento Norte → Sur → Norte y el deep link cross-tenant
con respuesta lógica `Recurso no encontrado`.

## Advertencia de bundle

El build de producción mantiene el warning de Vite por el chunk principal de
la web (aproximadamente 775 kB sin comprimir y 228 kB gzip en el cierre de
Fase 5D). FullCalendar
es el principal contribuyente esperado. No se hizo un refactor agresivo en este
checkpoint; code-splitting/lazy loading queda como mejora posterior y no se
introduce complejidad de bundler/CDN/SSR en esta fase.

## Dependencias diferidas

Consulta, historia clínica, tipos configurables, bloques, Google Calendar,
recordatorios y booking público permanecen fuera de Fase 5D. La matriz de
cierre está en `docs/migration/agenda-final-review.md`.
