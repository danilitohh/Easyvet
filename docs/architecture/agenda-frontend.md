# Arquitectura del frontend de Agenda

## Alcance de Fase 5C.1

Esta fase entrega una Agenda clínica funcional de solo lectura sobre el backend
de Fase 5B. La pantalla vive en `/agenda` y el detalle de una cita en
`/agenda/citas/:appointmentId`. No se implementan mutaciones, disponibilidad,
drag-and-drop ni acciones de ciclo de vida; esas capacidades quedan para
Fase 5C.2.

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

El detalle es un modal accesible y de solo lectura. Incluye paciente, owner,
fecha/hora en la zona de la organización, duración, sede, profesional, motivo,
notas, observaciones, confirmaciones y metadatos de cancelación cuando
corresponde.

## Accesibilidad y responsive

Se conservan controles nativos de teclado para filtros, botones con nombres
explícitos, `aria-live` para el período, estados `role="status"`, etiquetas
descriptivas en eventos y foco gestionado por el modal existente. La grilla se
reorganiza para tablet y 390 px sin habilitar operaciones táctiles de arrastre.

## Dependencias diferidas

Crear, editar, reprogramar, cancelar, check-in, iniciar, completar, marcar
`NO_SHOW`, confirmaciones y gestión de disponibilidad no forman parte de esta
entrega. Antes de añadirlas se debe cerrar Fase 5C.2 y conservar el aislamiento
tenant del backend.
