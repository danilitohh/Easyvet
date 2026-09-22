# Diagnostics frontend — Fase 6H

## Rutas y permisos

- `/pacientes/:patientId/historia/diagnosticos` — historial; `diagnostics.read`.
- `/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId` — detalle;
  `diagnostics.read`.
- `/pacientes/:patientId/historia/encuentros/:encounterId/diagnosticos/nuevo` —
  Draft nuevo contextual; `diagnostics.create`.
- `/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId/editar` —
  edición Draft; `diagnostics.updateDraft`.

El acceso a “Diagnósticos y exámenes” aparece en la historia solo con permiso de
lectura. El detalle del Encounter lista órdenes filtradas por ese encuentro y
permite solicitar solo si la membresía tiene create, el paciente está activo y
el encuentro no está anulado. Ninguna UI sustituye la autorización del backend.

## Flujo y manejo de datos

La lista distingue categoría/estado/fecha/profesional/encuentro. El formulario
solo crea o actualiza Draft y deriva el Patient/Encounter de la ruta. Un
Practitioner puede quedar preseleccionado como responsable; un asistente no se
propone como responsable. La emisión de solicitud incluye revisión explícita,
identidad, versión y aviso de inmutabilidad. La captura de resultado y la
anulación usan diálogos separados; un resultado terminal no ofrece reemplazo.

Las lecturas pasan por `apiClient` y validación Zod. Los recursos son tenant-keyed,
se vacían al cambiar la organización y abortan requests pendientes. Formularios,
IDs/versiones y diálogos se reinician al cambiar de tenant; deep links cruzados
devuelven no encontrado. También se valida que el ID de paciente de la URL
coincida con el recurso para evitar cruces accidentales dentro de un tenant.
Un CAS stale conserva texto local y nunca aplica merge/retry automático.

## Accesibilidad y seguridad visual

Los controles tienen labels asociados, errores y warnings con roles semánticos,
estados verbales además de color, diálogos accesibles con cierre Escape/foco y
acciones operables por teclado. Las filas usan enlaces semánticos; texto clínico
se renderiza como texto React plano, incluidos saltos de línea, sin
`dangerouslySetInnerHTML`.

La interfaz usa filas fluidas, grids con columnas mínimas cero y componentes
compartidos para reducir overflow a 390 px. La verificación manual de cada
modal/pantalla se registra en `MIGRATION_STATUS.md` al cerrar QA local.
