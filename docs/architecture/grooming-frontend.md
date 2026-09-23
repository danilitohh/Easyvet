# Frontend de Grooming / Peluquería

Las pantallas son lazy-loaded y usan rutas propias:

- `/peluqueria`: cola con estado, sede, peluquero y fechas filtrables.
- `/peluqueria/nueva`: alta Draft; admite `?patientId=…` para preseleccionar
  Patient.
- `/peluqueria/:groomingVisitId`: detalle operativo y confirmaciones explícitas.
- `/peluqueria/:groomingVisitId/editar`: edición Draft o de observaciones
  permitidas durante la atención.
- `/pacientes/:patientId/historia/peluqueria`: timeline separado de evidencia
  clínica.

La cola muestra Patient, Owner, servicio, estado, sede, Groomer y contexto de
Appointment. En detalle, el enlace a Agenda solo se muestra con
`appointments.read`; la falta de ese permiso no bloquea Grooming. La edición de
Draft permite desvincular una cita que posteriormente se canceló. El selector
consulta citas compatibles del Patient en una ventana próxima menor a 90 días y
recupera por separado la cita ya vinculada para permitir cambiarla o quitarla.

Start, complete y void usan diálogos con versión visible y confirmación. Solo
Owner/Admin con `grooming.void` pueden anular; no hay acción de borrar. En estado
IN_PROGRESS se identifica claramente la atención y se exponen solo campos
operativos editables. Textos se interpolan como texto React, con límites de
longitud y multilinea; no se usa `dangerouslySetInnerHTML`.

Los hooks de lectura incluyen tenant y filtros en su clave, abortan peticiones
al cambiar de organización y no muestran resultados de la clave anterior. Las
mutaciones se cancelan al cambiar el tenant y el formulario/diálogo se limpia.
Estados, etiquetas y errores se expresan con texto además del color; formularios
usan labels y controles nativos. Las reglas CSS de Grooming adaptan cola,
formularios, detalle e historia a 390 px, tablet y escritorio.
