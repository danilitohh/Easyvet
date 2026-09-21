# Prescriptions frontend read-only — Fase 6D.3A

La interfaz web de Prescriptions está limitada a lectura. La autoridad sigue
siendo el backend y la vista solo se habilita cuando la Membership activa tiene
`prescriptions.read`.

## Routing

- `/pacientes/:patientId/historia/prescripciones` lista las recetas paginadas
  del Patient.
- `/pacientes/:patientId/historia/prescripciones/:prescriptionId` muestra el
  detalle read-only.
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

El frontend nunca envía comandos de create, update, finalize o void en esta
fase.

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

La Fase 6D.3A no incluye crear o editar drafts, finalizar, anular, modificar
items, PDF, Documents, Storage, firma, email, MedicationCatalog, Inventory,
Sales o Billing. Esas operaciones quedan para 6D.3B o fases posteriores.
