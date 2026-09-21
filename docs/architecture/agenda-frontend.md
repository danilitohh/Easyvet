# Arquitectura del frontend de Agenda

## Alcance de Fase 5C.2A

Esta fase parte de la Agenda clínica de lectura construida sobre el backend de
Fase 5B. La pantalla vive en `/agenda` y el detalle de una cita en
`/agenda/citas/:appointmentId`. Fase 5C.2A añade únicamente programación:
crear, editar información, reprogramar y cancelar. Check-in, start, complete,
no-show, confirmaciones, administración de disponibilidad y drag-and-drop
siguen fuera de alcance.

## Estado navegable

La vista y la fecha civil se mantienen en la URL:

```text
/agenda?view=week&date=2026-09-21
```

`view` admite `month`, `week`, `day` y `list`. Las fechas se interpretan como
fechas civiles dentro de la zona horaria de la organización, nunca como una
fecha local del navegador. Abrir una cita conserva esos parámetros al navegar
a `/agenda/citas/:appointmentId`.

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

## Operaciones de programación

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

No hay optimistic updates. Después de una mutación exitosa la agenda se
refresca y el detalle conserva el resultado; un `409` se traduce a “El horario
ya no está disponible” y refresca los slots. La cancelación usa su endpoint
dedicado, conserva la cita en la agenda y actualiza el estado a `CANCELLED`.

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
la web (aproximadamente 758.85 kB sin comprimir y 223.94 kB gzip). FullCalendar
es el principal contribuyente esperado. No se hizo un refactor agresivo en este
checkpoint; se recomienda evaluar code-splitting/lazy loading del calendario en
un checkpoint posterior.

## Dependencias diferidas

Crear, editar, reprogramar, cancelar, check-in, iniciar, completar, marcar
`NO_SHOW`, confirmaciones y gestión de disponibilidad no forman parte de esta
entrega. Antes de añadirlas se debe cerrar Fase 5C.2 y conservar el aislamiento
tenant del backend.
