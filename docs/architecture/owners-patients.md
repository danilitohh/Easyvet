# Owners y Patients (Fases 4A y 4B)

## Modelo

`Organization` es la frontera de seguridad. `Owner` y `Patient` almacenan
`organizationId` y todos los servicios reciben ese valor explícitamente. Un
`Patient` tiene un Owner principal; la relación usa una FK compuesta
`(ownerId, organizationId)` para que PostgreSQL también impida mezclar
organizaciones.

Owner conserva `firstName`, `lastName` opcional, identificación extensible,
contactos, dirección, notas y estado. La identificación es opcional y solo se
considera duplicada cuando existen tipo y número normalizado dentro de la misma
organización.

Patient conserva nombre, especie y raza como texto extensible, sexo explícito,
nacimiento opcional con indicador de aproximación, color, microchip, peso actual
como snapshot, esterilización, notas y estado. No contiene consultas, vacunas,
historia, fotos ni peso longitudinal.

## Consultas y respuestas

Los listados usan `page`/`pageSize` (por defecto 20, máximo 100), `search`,
`status=ACTIVE|ARCHIVED|ALL`, y ordenamiento mediante allowlists de campos. Las
búsquedas de Owner cubren nombre, documento, email y teléfono; las de Patient
cubren nombre, microchip y datos básicos del Owner. Nunca se acepta un campo de
orden arbitrario ni `organizationId` del cliente.

Los detalles exponen únicamente campos de dominio seguros. Owner puede incluir
sus Patients activos; Patient incluye un resumen mínimo de su Owner. No se
simulan arrays de consultas, facturas o citas.

## Archive

Archive reemplaza el borrado físico en Fase 4A. Las operaciones son idempotentes,
no cascadan y escriben `archivedAt`. Los listados activos excluyen archivados;
los detalles directos de un recurso archivado siguen disponibles con permiso y
tenant correctos. La restauración, merge de propietarios, transferencia de
responsabilidad y auditoría formal quedan para fases posteriores.

## Límites de fase

No se crean múltiples propietarios por paciente, catálogos de razas, historial
de peso, eventos clínicos, storage de fotos ni módulos de agenda/clínica.
`currentWeightKg` es una proyección conveniente y no sustituye las mediciones
clínicas futuras.

## Frontend de Fase 4B

Las rutas funcionales son:

- `/propietarios`, `/propietarios/nuevo`, `/propietarios/:ownerId` y
  `/propietarios/:ownerId/editar`.
- `/pacientes`, `/pacientes/nuevo`, `/pacientes/:patientId` y
  `/pacientes/:patientId/editar`.

Las páginas usan `ownersApi`/`patientsApi` y hooks de estado remoto propios; no
hay `fetch` directo en los componentes. La búsqueda se debouncea 320 ms y los
listados conservan filtros y paginación del backend.

No se agregó TanStack Query: el proyecto no lo tenía instalado y los hooks
manuales son suficientes para esta superficie. Cada hook incluye el
`organizationId` activo como dependencia, limpia los datos inmediatamente al
cambiar de organización y vuelve a consultar; esto evita mostrar datos de la
organización anterior.

Los permisos del frontend controlan botones y rutas (`AccessDenied`), pero el
backend sigue siendo la autoridad. Los archivados se muestran con estado
distinguible y confirmación accesible. La ficha de Patient solo muestra datos
existentes, edad calculada y peso actual; no contiene tabs clínicas,
facturación ni saldos.

## Cierre de Fase 4C

La revisión final, la matriz legacy, las decisiones `NEEDS REVIEW`, las reglas
de archive y los límites conocidos están en
`docs/migration/owners-patients-final-review.md`. La secuencia comprobada para
futuros módulos está en `docs/architecture/module-pattern.md`.

Fase 4C deja como invariantes: todo acceso se acota por organización activa;
Patient solo referencia Owners del mismo tenant; `status` y `archivedAt` son
consistentes; el peso es un snapshot acotado; la fecha de nacimiento es civil y
no futura; y un Owner con Patients activos no se puede archivar. Restore,
responsables múltiples, historia clínica y redacción de PII por rol siguen
requiriendo decisión de dominio.
