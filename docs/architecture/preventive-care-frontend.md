# Preventive Care frontend — Fase 6E.3A

## Alcance

La Fase 6E.3A incorpora la lectura de `Vaccination` y `Deworming` dentro de
la historia clínica. No agrega operaciones de escritura, cambios de Prisma ni
dependencias comerciales. Las acciones de creación, edición, finalización y
anulación quedan reservadas para la Fase 6E.3B.

## Rutas

- `/pacientes/:patientId/historia/preventivos`: lectura combinada. Se puede
  entrar si el usuario tiene al menos uno de los permisos preventivos.
- `/pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId`: detalle
  protegido por `vaccinations.read`.
- `/pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId`:
  detalle protegido por `dewormings.read`.

La historia clínica y el detalle de un encuentro muestran cada bloque de forma
independiente. La ausencia de un permiso oculta únicamente su dominio; nunca
se usa una respuesta del dominio contrario para completar datos.

## Datos y aislamiento

Los clientes frontend de vacunaciones y desparasitaciones son módulos
separados. Validan cada respuesta con los contratos Zod compartidos y envían
`AbortSignal` a `apiClient`. Los hooks limpian los datos visibles al cambiar de
organización, paciente, encuentro o página, y abortan la solicitud anterior.

Las fechas civiles (`administeredOn`, `nextDueOn`, `expiryOn`) se renderizan
por componentes de `YYYY-MM-DD`, sin construir objetos `Date`. Los timestamps
técnicos se formatean con la zona horaria de la organización.

## Historial y lifecycle

- `DRAFT`, `FINALIZED` y `VOIDED` se muestran como estados de solo lectura.
- Los registros finalizados o anulados prefieren sus snapshots históricos de
  paciente, propietario, profesional y administrador.
- Un borrador usa los datos vivos permitidos por el contrato y muestra una
  advertencia discreta de que aún no ha sido finalizado.
- Un registro cuyo encuentro padre está anulado conserva su estado propio y
  muestra una advertencia histórica; no se modifica desde la UI.
- Pacientes archivados se identifican visualmente sin habilitar acciones.

## Seguridad y accesibilidad

El detalle comprueba que el recurso pertenezca al paciente de la ruta y trata
un deep link cruzado como `404`. No se usa `dangerouslySetInnerHTML` ni se
inyecta HTML desde notas, nombres o campos clínicos. Los enlaces tienen rutas
semánticas, los estados usan texto además de color y las listas conservan una
estructura navegable a 390 px.

## Pruebas

`PreventiveCare.test.tsx` cubre permisos separados, listas vacías y paginación
independiente, snapshots, lifecycle, fechas civiles, timezone, tenant switch,
abort/carga stale, deep links cruzados, paciente archivado, texto no confiable,
ausencia de CTAs de mutación y responsive estructural. La matriz completa de
validación se ejecuta con los scripts raíz documentados en `MIGRATION_STATUS.md`.
