# Prescriptions frontend — Fases 6D.3A–6D.3B

La interfaz web combina lectura histórica con operaciones explícitas sobre
borradores. La autoridad sigue siendo el backend; los permisos de la
Membership activa solo controlan affordances de UX y cada mutación usa el
contrato compartido.

## Routing

- `/pacientes/:patientId/historia/prescripciones` lista las recetas paginadas
  del Patient.
- `/pacientes/:patientId/historia/prescripciones/:prescriptionId` muestra el
  detalle y las acciones permitidas para ese lifecycle.
- `/pacientes/:patientId/historia/encuentros/:encounterId/prescripciones/nueva`
  crea un draft únicamente desde un Encounter DRAFT o FINALIZED.
- `/pacientes/:patientId/historia/prescripciones/:prescriptionId/editar`
  edita un draft existente; el Encounter padre se resuelve desde la receta.
- El detalle del Encounter incorpora la misma lista filtrada por
  `clinicalEncounterId`.

Las páginas se cargan lazy junto con las demás rutas clínicas. Los enlaces
respetan back, forward, refresh y deep links.

## API client y estado

`prescriptionsApi` usa exclusivamente `apiClient`, valida respuestas con los
contratos Zod compartidos y acepta `AbortSignal`. `usePatientPrescriptions`,
`useEncounterPrescriptions` y `usePrescription` limpian datos inmediatamente al
cambiar de tenant o de identificador, abortan requests pendientes y no
conservan IDs ni contenido de la organización anterior.

`prescriptions.create`, `prescriptions.updateDraft`,
`prescriptions.finalize` y `prescriptions.void` son permisos independientes.
Clinical Assistant puede preparar drafts, pero no finaliza ni anula; la
finalización visible exige que el actor Practitioner sea el prescriptor actual
y tenga perfil profesional configurado.

La creación no ofrece selector de Patient o Encounter: ambos son contexto de
la URL y el Patient se deriva en backend. Editar reemplaza atómicamente el
conjunto completo de items con `expectedVersion`; un `409 PRESCRIPTION_STALE`
mantiene los cambios locales y solo una acción explícita recarga la versión
actual. No hay merge automático.

El editor permite cero items en un draft, texto libre para los campos clínicos,
nombre de medicamento obligatorio, agregar/quitar y ordenar con controles
accesibles arriba/abajo. El cliente normaliza `position` antes de enviar y
nunca envía snapshots, tenant, auditoría o identidad derivada.

Finalizar solo está disponible desde el detalle, abre una revisión explícita y
envía el `expectedVersion` visible. Anular solo aplica a `FINALIZED`, exige
motivo y conserva la evidencia; no existe delete físico. Si el Encounter padre
se anula durante edición/finalización, la UI recarga el contexto y sale del
flujo sin transformar la prescripción histórica.

## Presentación

Los estados se muestran como Borrador, Finalizada y Anulada, siempre con texto
y no únicamente color. Un draft muestra el aviso “Borrador. Esta prescripción
aún no ha sido finalizada.”. Una receta anulada conserva items, diagnóstico y
snapshots, y muestra motivo y hora de anulación.

La lista muestra creación, emisión cuando existe, profesional, cantidad de
items, Encounter relacionado y aviso si el Encounter padre está anulado. El
detalle separa:

- Patient al emitir y Patient actual;
- Responsable al momento de emisión;
- profesional y matrícula históricas;
- diagnóstico snapshot;
- items en `position ASC`;
- estado actual del Encounter padre y sus timestamps.

Los textos largos se renderizan como texto plano con `white-space: pre-wrap`.
No se usa `dangerouslySetInnerHTML`, y no se muestran stock, precio, SKU, lote,
factura, pago, PDF, impresión, email o firma.

## Permisos y tenant safety

`clinicalRecords.read`, `patients.read` y los permisos organizacionales no
implican acceso a recetas. La ruta y la sección se ocultan sin
`prescriptions.read`; un deep link sin permiso termina en AccessDenied. Un
detalle cuyo Patient de la URL no coincide con el Patient de la receta se trata
como recurso no encontrado, sin revelar otro tenant.

Un Patient archivado conserva lectura histórica. Si el Encounter está
`VOIDED`, la receta sigue mostrando su propio lifecycle y recibe un aviso
independiente; un `FINALIZED` no se presenta como anulada por herencia.

## Responsive y accesibilidad

La lista, el detalle, items largos, avisos, enlaces y paginación colapsan en
mobile sin overflow horizontal. Los encabezados, estados, alertas y enlaces
son semánticos y navegables por teclado. La jerarquía visual usa los tokens
clínicos existentes de Easyvet y no agrega otra librería de componentes.

## Alcance diferido

No se implementan PDF, Documents, Storage, firma, email, MedicationCatalog,
Inventory, Sales, Billing ni flujos de fármacos controlados. La Fase 6D.4
queda pendiente para hardening posterior.
