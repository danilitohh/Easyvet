# Frontend clínico

## Alcance de Fase 6C.1

El frontend clínico expone únicamente lectura del núcleo clínico existente:

- `/pacientes/:patientId/historia` muestra el `ClinicalRecord`, encuentros paginados y evoluciones de record sin encuentro.
- `/pacientes/:patientId/historia/encuentros/:encounterId` muestra el snapshot histórico del encuentro, narrativa, planes, signos vitales y evoluciones relacionadas.
- La pantalla de historia enlaza desde la ficha de Patient únicamente cuando la membresía efectiva tiene `clinicalRecords.read`.
- Las mutaciones clínicas se habilitan progresivamente por fase y permiso; las acciones de
  finalización, anulación y evolución se describen en 6C.2B.

## Autorización y tenant

Las rutas se protegen por `clinicalRecords.read` y `clinicalEncounters.read`; las secciones de vitales, evoluciones y citas se habilitan de forma independiente con `clinicalVitals.read`, `clinicalEvolutions.read` y `appointments.read`. La ausencia de `clinicalRole` no se compensa con `patients.read`, y `PLATFORM_ADMIN` no recibe acceso clínico por sí solo.

Los hooks cancelan solicitudes en curso y limpian sus datos al cambiar `activeMembership.organization.id`. Un encuentro obtenido por otro tenant se presenta como recurso no encontrado. Los errores 401/403/404/409/500 pasan por la capa de mensajes públicos existente.

## Fechas, snapshots y accesibilidad

Las fechas se formatean con el timezone de `GET /organization/current`. El paciente actual y el propietario histórico se presentan con etiquetas explícitas. Los estados tienen texto visible (`Borrador`, `Finalizado`, `Anulado`), y el borrado lógico del paciente se muestra como `Archivado`. Los textos clínicos se renderizan como texto plano escapado con saltos conservados; no se usa HTML inseguro.

La carga de las páginas es lazy para mantener el shell principal liviano. Las tarjetas y listas se adaptan a 390px sin depender de color para comunicar estado.

## Fase 6C.2A — borradores y perfil profesional

- `/perfil/profesional` lee y actualiza únicamente el perfil de la membresía activa. El backend
  deriva `membershipId` y `organizationId` de `TenantContext`; el payload no puede sustituirlos.
- `/pacientes/:patientId/historia/nueva` crea encuentros `DRAFT` y
  `/pacientes/:patientId/historia/encuentros/:encounterId/editar` actualiza únicamente drafts
  mediante `expectedVersion`.
- El formulario consulta sede activa, citas del paciente en un rango acotado y profesionales
  `PRACTITIONER` activos del tenant; si la membresía actual es Practitioner se preselecciona como
  responsable. Las citas canceladas/no-show no se ofrecen y la sede de la cita debe coincidir.
- Fecha/hora y mediciones se convierten con `Organization.timezone` usando instantes explícitos;
  la zona horaria del navegador no es autoridad. Los cambios de tenant abortan solicitudes y
  limpian identificadores de paciente, cita, sede, profesional y versión.
- Los `409 CLINICAL_ENCOUNTER_STALE` conservan los valores locales y exigen recarga explícita.
  Un encuentro que dejó de ser `DRAFT` abandona el editor y se muestra en lectura. No hay
  autosave ni `beforeunload`; la confirmación cubre la navegación interna por los botones del
  formulario.
- Los vitales se agregan únicamente a drafts con `clinicalVitals.create`; son append-only y un
  peso en borrador nunca modifica `Patient.currentWeightKg`.

## Fase 6C.2B — finalización, evoluciones y anulación

- El detalle de consulta DRAFT muestra una revisión previa a finalizar. La acción solo aparece
  para una membresía Practitioner activa que coincide con `responsibleMembershipId`, tiene el
  permiso de finalización y un perfil profesional con nombre; el backend vuelve a validar todas
  estas condiciones.
- La finalización envía `expectedVersion` y no usa optimistic update. Un `409` conserva el
  contexto, exige recarga explícita y vuelve a consultar el estado antes de continuar.
- Una consulta FINALIZED muestra el snapshot histórico de profesional/licencia y queda sin
  edición, nuevos vitales o guardado de draft. Una consulta VOIDED conserva historia y vitales,
  muestra la razón de anulación y no admite evoluciones.
- En DRAFT la revisión usa el perfil vigente del profesional responsable; en FINALIZED/VOIDED
  solo se presenta el snapshot persistido en el encuentro.
- Las evoluciones son append-only: pueden vincularse a un encuentro FINALIZED o al Record del
  paciente existente. El formulario exige al menos una narrativa no vacía, deriva autor y tenant
  del backend y muestra el autor clínico. No hay edición ni borrado.
- Anular exige motivo y `expectedVersion`, confirma que la historia se conservará y recalcula la
  proyección de peso del Patient dentro de la transacción. Los conflictos de versión/estado se
  muestran como estado stale accionable, sin perder los valores locales.
- Los controles se ocultan según permisos efectivos y estado; el cambio de tenant cancela cargas,
  limpia identificadores y no permite reutilizar estado de otra organización.

## Fase 6C.3 — hardening cerrado

- Los hooks clínicos incluyen el `organizationId` activo en sus dependencias y limpian datos antes
  de cada carga; las páginas de formulario también reinician valores, versiones, IDs y errores al
  cambiar de tenant.
- La UI no intenta calcular estado clínico: peso, snapshots, lifecycle y autorización proceden
  del backend. Los estados stale/immutable ofrecen una decisión explícita y no hacen merge
  automático.
- Los formularios mantienen texto plano escapado, límites de 20.000 caracteres, saltos de línea,
  labels asociados y diálogos con foco. El paginado evita cargar la historia completa.
- Encounter finalizado/anulado no expone controles de edición/vitales/evolución incompatibles; un
  deep link al editor abandona a la vista histórica.

Los satélites clínicos (prescripciones, procedimientos, diagnóstico, hospitalización, documentos,
firmas y seguimiento) y el hardening de 6C.3 permanecen fuera de esta fase.
