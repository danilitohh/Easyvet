# Frontend FollowUps — Fase 6J

## Rutas y vistas

- `/seguimientos`: cola global; muestra OPEN inicialmente y filtros calculados
  Todos abiertos, Vencidos, Hoy, Próximos y Recordatorios.
- `/seguimientos/:followUpId`: deep link tenant-safe con estado, vencimiento,
  reminder, asignación, source y snapshots de completion/void.
- `/seguimientos/:followUpId/editar`: edición de OPEN con CAS.
- `/pacientes/:patientId/historia/seguimientos`: todos los estados históricos.
- `/pacientes/:patientId/seguimientos/nuevo`: alta desde Patient; admite
  `sourceClinicalEncounterId` para precargar source desde Encounter.

La navegación global se muestra solo con `followUps.read`. La historia de
Patient conserva permiso independiente del permiso de leer Encounter.
`ClinicalEncounterDetailPage` enlaza la creación solo si Encounter es DRAFT o
FINALIZED, Patient está activo y el usuario tiene create.

## Fechas, datos y mutaciones

`dueOn` permanece string `YYYY-MM-DD` de `<input type="date">`; no se parsea con
`new Date('YYYY-MM-DD')` ni se transforma a `toISOString`. `reminderAt` se
captura en campos locales y se convierte usando `Organization.timezone`, con
rechazo de horas civiles inexistentes. Selector de asignación usa
`GET /clinical/members` y muestra solo nombre/rol, nunca correo/licencia.
Selector source usa Encounter del mismo Patient y solo DRAFT/FINALIZED.

Lecturas se cancelan y limpian por tenant; las mutaciones se abortan al cambiar
de tenant/desmontar. Al cambiar Organization también se vacían los campos,
source, asignación y errores locales. Un 409 stale conserva lo escrito y ofrece
recarga explícita, sin merge silencioso. Paciente archivado muestra historial,
bloquea create/edit/complete y permite void. El source anulado bloquea edit y
complete, conserva la opción void.

El widget de dashboard es opcional por `followUps.read`; errores quedan dentro
de su tarjeta y no bloquean los indicadores demo ni navegación. Mutaciones
publican refresco ligero en vistas montadas. No se solicitan permisos de
notificación del navegador ni se introduce polling/websocket.

Listas/formularios usan labels nativos, `<input type=date/time>`, botones con
estado, `Modal` accesible, badges con texto además de color y texto plano. CSS
responde a viewport 390 px, tablet y desktop sin tabla ancha.
