# Propuesta de arquitectura de prescripciones — Fase 6D.1

## Estado y alcance

Este documento es un diseño previo a implementación. La Fase 6D.1 solo analiza
el comportamiento legacy y propone el contrato del dominio para una futura
Fase 6D.2. No se crean modelos Prisma, migraciones, endpoints, permisos ni
componentes React en este checkpoint.

La fuente legacy y sus límites están en
`docs/migration/prescriptions-reference.md`.

## Objetivos

La prescripción de Easyvet debe:

- conservar una orden clínica legible y auditable;
- pertenecer a una organización y a un Patient sin posibilidad de cruce de
  tenant;
- estar ligada a un `ClinicalEncounter` para aportar contexto clínico;
- permitir borradores sin convertirlos en evidencia finalizada;
- congelar el contenido que se entrega al propietario;
- soportar anulación explícita sin eliminación física;
- mantener el alcance clínico separado de inventario, ventas, PDFs y firma;
- conservar los campos útiles de la fórmula legacy sin repetir su modelo JSON.

## No objetivos de 6D.1

Quedan fuera de esta fase:

- `Prescription` y `PrescriptionItem` en Prisma;
- catálogo farmacológico, búsqueda por principio activo o equivalencias;
- inventario, lotes, vencimientos, venta, factura o cobro;
- firma digital, envío de correo, Storage y generación real de PDF;
- receta electrónica regulada, medicamentos controlados y firma avanzada;
- autosave, notificaciones, recordatorios y dispensación;
- cambios a `ClinicalEncounter`, `ClinicalEvolution` o Patient existentes.

## Concepto y relación con Clinical Core

La prescripción es un agregado clínico satélite, no una evolución ni un campo
JSON del encuentro:

```text
Organization
└── ClinicalRecord (derivado por Patient)
    └── ClinicalEncounter
        └── Prescription
            └── PrescriptionItem[]
```

### Regla de encuentro

Recomendación: toda prescripción MVP requiere un `ClinicalEncounter` del mismo
Patient y organización. No se crea una prescripción huérfana ni se duplica
`clinicalRecordId`; el Record se deriva mediante el Encounter. Un flujo
administrativo, urgente o de repetición sin encuentro es una decisión de
producto pendiente, no un bypass que deba introducirse en 6D.2.

La prescripción conserva `encounterId` como relación obligatoria y se consulta
por Patient mediante el encuentro. Si una pantalla necesita filtrar sin cargar
el árbol, puede añadirse un índice derivado, pero no otra relación de dominio
redundante en la primera versión.

### Propuesta conceptual de modelos

Los nombres y campos son un contrato conceptual; no son un cambio de esquema
autorizado por este documento.

#### `Prescription`

| Campo conceptual              | Propósito                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                          | Identificador estable.                                                                                     |
| `organizationId`              | Tenant propietario; participa en todas las claves de acceso.                                               |
| `encounterId`                 | `ClinicalEncounter` requerido.                                                                             |
| `patientId`                   | Copia denormalizada para consultas tenant-safe y lectura; debe coincidir con el Patient del Encounter.     |
| `status`                      | `DRAFT`, `FINALIZED` o `VOIDED`.                                                                           |
| `diagnosisText`               | Diagnóstico presuntivo y/o final de la receta, separado del resumen narrativo del Encounter.               |
| `generalInstructionsText`     | Indicaciones generales de la receta; evita usar un blob `summary` para datos estructurados.                |
| `prescribedByMembershipId`    | Membership profesional responsable; debe tener `ClinicalRole.PRACTITIONER`.                                |
| `professionalNameSnapshot`    | Nombre que se imprimirá y conservará al finalizar.                                                         |
| `professionalLicenseSnapshot` | Matrícula/licencia al finalizar, nullable si la política local lo permite.                                 |
| `ownerNameSnapshot`           | Identidad textual del Owner al finalizar para documentos históricos; no reemplaza el Owner del Patient.    |
| `issuedAt`                    | Instante clínico de emisión, distinto de `createdAt`; se normaliza a UTC desde la zona de la organización. |
| `finalizedAt`                 | Instante de transición a `FINALIZED`.                                                                      |
| `voidedAt`, `voidedReason`    | Evidencia de anulación, solo tras `VOIDED`.                                                                |
| `version`                     | Contador entero para optimistic concurrency.                                                               |
| `createdAt`, `updatedAt`      | Auditoría técnica de persistencia.                                                                         |

`patientId` se recomienda como redundancia controlada porque simplifica las
listas y evita joins accidentales fuera de tenant. El servicio y una FK
compuesta deben imponer que `(organizationId, patientId)` coincida con el
Encounter. `clinicalRecordId`, `ownerId` y `ownerIdAtTime` no se duplican como
FK de primera versión: el Owner histórico se toma del snapshot del Encounter y
se copia como texto estable al finalizar si se necesita para documentos.

#### `PrescriptionItem`

Cada medicamento es una fila relacional ordenada, no un array JSON:

| Campo conceptual         | Propósito                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                     | Identificador estable.                                                                                                   |
| `prescriptionId`         | Prescripción propietaria.                                                                                                |
| `position`               | Orden explícito, único dentro de la prescripción.                                                                        |
| `medicationName`         | Nombre libre visible en la receta.                                                                                       |
| `presentationText`       | Presentación declarada por el profesional.                                                                               |
| `quantityText`           | Cantidad expresada como texto para conservar `1/2`, `2 cajas` u otra unidad humana sin inventar semántica farmacológica. |
| `dosageText`             | Dosis/forma de administración.                                                                                           |
| `frequencyText`          | Frecuencia.                                                                                                              |
| `durationText`           | Duración.                                                                                                                |
| `instructionsText`       | Instrucciones u observaciones específicas del ítem.                                                                      |
| `createdAt`, `updatedAt` | Timestamps técnicos; no cambian el orden clínico.                                                                        |

Se evita una tabla de catálogo o una FK a Inventario en la primera versión. Un
futuro `medicationCatalogId` puede ser nullable y auxiliar, nunca la única
fuente del texto histórico. No se agregan `route`, `concentration`, `doseUnit`,
`frequencyUnit` o `durationUnit` hasta que producto/regulación defina su
semántica. Los campos de dosis, frecuencia y duración permanecen texto libre
validado por no vacío cuando el profesional los necesite.

La separación entre `generalInstructionsText` e `instructionsText` evita la
duplicación legacy de `summary`, `indications` y `observations`: lo general
vive en Prescription y lo específico en PrescriptionItem.

### Matriz legacy → Easyvet

| Campo legacy             | Significado                             | Required en legacy                      | Propuesta Easyvet                                                              |
| ------------------------ | --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `name`                   | Nombre del medicamento.                 | Sí para al menos un item de la fórmula. | `medicationName`, requerido por item al finalizar.                             |
| `presentation`           | Presentación comercial o forma visible. | No.                                     | `presentationText`, nullable y libre.                                          |
| `quantity`               | Cantidad indicada.                      | No; la UI inicia en `1`.                | `quantityText`, nullable hasta que exista una política de unidades.            |
| `dosage` / `posology`    | Dosis y forma de administración.        | No.                                     | `dosageText`, texto libre; no convertir en Decimal sin decisión.               |
| `frequency`              | Frecuencia de administración.           | No.                                     | `frequencyText`, texto libre; no enum automático.                              |
| `duration`               | Duración del tratamiento.               | No.                                     | `durationText`, texto libre; admite expresiones como “hasta nueva indicación”. |
| `observations` / `notes` | Observación específica del medicamento. | No.                                     | `instructionsText`; lo general va en `generalInstructionsText`.                |
| `formula_diagnosis`      | Diagnóstico presuntivo y/o final.       | Sí en el formulario legacy.             | `diagnosisText` de Prescription, validado como contenido clínico.              |
| `formula_observations`   | Observaciones generales de la fórmula.  | No.                                     | `generalInstructionsText`; no duplicar un tercer campo de notas.               |

En legacy también son obligatorios para la consulta genérica el tipo, título,
resumen y la identidad textual del profesional. En Easyvet esos datos se
reemplazan por invariantes de Encounter, diagnóstico, items y snapshots de
Membership, no por campos enviados sin validación por el cliente.

## Lifecycle e inmutabilidad

Se recomienda una máquina propia porque una receta es un documento clínico que
puede finalizarse o anularse independientemente del Encounter:

```text
DRAFT ──finalize──> FINALIZED ──void(reason)──> VOIDED
```

- `DRAFT`: editable; puede tener cero o más items durante composición, pero no
  puede exportarse como evidencia final.
- `FINALIZED`: contenido clínico e items inmutables. Solo permite lecturas,
  exportaciones futuras y la transición a `VOIDED`.
- `VOIDED`: terminal; conserva todo el contenido y exige razón, actor y hora.

No hay `DELETE` de una receta creada. El borrador puede cancelarse mediante una
acción de producto futura o quedar fuera de listados, pero no se debe borrar
evidencia que ya haya sido finalizada.

### Encuentro finalizado

Recomendación operativa: se crean y editan recetas solo mientras el Encounter
está en `DRAFT`. Finalizar el Encounter no reabre ni muta recetas finalizadas.
La política para emitir una nueva receta después de que el Encounter esté
`FINALIZED` requiere una decisión de producto: la opción segura es un nuevo
Encounter/addendum que enlace la nueva receta, no editar la anterior.

### Encuentro anulado

Anular el Encounter no elimina automáticamente las recetas. Una Prescription
`FINALIZED` conserva su estado y se muestra con el contexto de que el encuentro
padre está `VOIDED`; la UI puede requerir confirmación para usarla como
documento. No se hace cascada silenciosa porque destruiría evidencia y no existe
equivalente legacy que justifique esa pérdida.

## Profesional, autoría y snapshots

`prescribedByMembershipId` debe referir a un Membership activo de la misma
organización con capacidad clínica `PRACTITIONER` y perfil profesional válido
según las reglas del Clinical Core. El actor que finaliza debe ser el
profesional responsable o una política explícita de delegación; no se acepta un
nombre/matrícula arbitrarios del cliente.

En `FINALIZED` se congelan `professionalNameSnapshot` y
`professionalLicenseSnapshot`. Esto protege la receta si el perfil cambia o la
Membership deja la organización. `issuedAt` es el momento clínico elegido por
el profesional; `createdAt` sigue siendo el momento técnico de alta.

El Owner no se elige desde el formulario: se deriva del Patient/Encounter. Se
recomienda copiar su nombre (y, cuando el modelo legal lo apruebe, identificador
no sensible) al finalizar para que futuros documentos no dependan del Owner
actual. El Patient sigue siendo la identidad clínica principal.

### Asistente clínico

La recomendación coherente con Clinical Core es permitir a un asistente crear y
editar borradores si tiene `prescriptions.create`/`prescriptions.updateDraft`,
pero no finalizar ni anular. La finalización exige el Practitioner responsable.
Producto debe confirmar si una receta en borrador creada por asistente puede ser
asignada posteriormente a otro profesional sin perder auditoría.

## Permisos propuestos

Los permisos son capacidades del recurso, no roles hardcodeados:

| Permiso                     | Alcance                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `prescriptions.read`        | Listar y ver recetas de la organización permitida.                       |
| `prescriptions.create`      | Crear un borrador ligado a un Encounter válido.                          |
| `prescriptions.updateDraft` | Editar cabecera e items mientras esté `DRAFT`.                           |
| `prescriptions.finalize`    | Ejecutar la transición a `FINALIZED`; además exige Practitioner/autoría. |
| `prescriptions.void`        | Anular una receta finalizada con razón; no elimina contenido.            |

No se añade un permiso por item. El recurso clínico padre y las comprobaciones
de Membership determinan el acceso efectivo.

## Invariantes tenant-safe y de dominio

La futura implementación debe rechazar con `404` seguro o `409` según el caso:

1. `Prescription.organizationId` no coincide con la organización de sesión.
2. `encounterId` no pertenece a la organización.
3. `patientId` no coincide con el Patient del Encounter.
4. Patient archivado/inactivo para una nueva creación o finalización.
5. Encounter `VOIDED` o estado no elegible para editar/finalizar.
6. `prescribedByMembershipId` de otra organización, inactivo o sin rol clínico.
7. Finalización sin al menos un item con `medicationName` no vacío.
8. `position` duplicado o campos de item fuera de los límites definidos.
9. Edición/anulación sin `expectedVersion` coincidente.
10. Cambios de tenant durante una mutación frontend; la petición debe
    cancelarse y revalidarse.

Las FKs compuestas y los servicios tenant-safe deben reflejar estas reglas; no
se confía en IDs recibidos del cliente.

Un Patient `ARCHIVED` no puede recibir una receta nueva ni finalizar un draft,
pero sus prescripciones históricas permanecen consultables según los permisos de
lectura y la política de retención.

## Concurrencia y transacciones

`Prescription.version` usa compare-and-set. Toda edición de borrador reemplaza
la cabecera y la colección de items en una sola transacción:

1. localizar por `organizationId + id + status = DRAFT + version = expectedVersion`;
2. validar Encounter, Patient, Owner derivado y Membership;
3. validar y normalizar todos los items;
4. actualizar cabecera, eliminar/recrear o sincronizar items y aumentar versión;
5. registrar `ClinicalAuditEvent` en la misma transacción.

El endpoint de finalización debe bloquear/releer la receta, validar de nuevo el
estado y la versión, congelar snapshots, establecer `issuedAt`/`finalizedAt`,
incrementar `version` y escribir auditoría antes del commit. No se hace trabajo
externo (PDF, correo, Storage, inventario o facturación) dentro de la
transacción.

## Auditoría

Se reutiliza `ClinicalAuditEvent`, no un sistema paralelo. La futura migración
debe extender sus enums de entidad/acción con el mínimo necesario para:

- `CREATE` de borrador;
- `UPDATE_DRAFT` con conteo/identificadores operativos, no texto clínico
  completo;
- `FINALIZE`;
- `VOID` con referencia a la razón según política de PII.

El evento conserva `organizationId`, actor, timestamp, entidad, id, versión
anterior/nueva y metadata técnica. La receta y sus items son la fuente de la
evidencia; el audit no debe duplicar diagnósticos o dosis.

## PDF, documentos y firma

La receta debe poder alimentar un futuro documento, pero el documento no forma
parte del agregado base:

- `Prescription` conserva contenido clínico y snapshots.
- Un futuro módulo de documentos genera PDF versionado a partir de una receta
  `FINALIZED`.
- Storage devuelve una referencia inmutable; no se guarda un blob ni una URL
  mutable en la receta.
- Firma digital, firma del propietario y evidencia de entrega son flujos
  posteriores con permisos y auditoría propios.
- Si una receta se anula después de haber producido un documento, el `VOID` no
  borra el PDF histórico; el documento se marca o relaciona como anulado en la
  fase documental.

No se debe marcar una receta como firmada porque el PDF tenga un bloque visual
con nombre/matrícula.

## Inventario y facturación

Una prescripción no descuenta existencias, reserva lotes, factura ni registra
dispensación. La frontera explícita es:

```text
Prescription (indicación clínica)
≠ Inventory transaction (stock/lote)
≠ Sale/Billing (precio/cobro)
```

Una integración futura deberá usar comandos/eventos idempotentes y permisos
separados; no se introduce una FK ni side effect en 6D.2.

## Múltiples prescripciones

La cardinalidad recomendada es `Encounter 1 ── 0..N Prescription`. El legacy no
impone unicidad y permite varias consultas de tipo fórmula. Una repetición crea
una nueva receta `DRAFT` (posiblemente copiando datos visibles), nunca reabre ni
reutiliza una `FINALIZED`.

## Contratos futuros

Los contratos TypeScript/DTO de 6D.2 deberían separar resumen, detalle y
mutaciones, sin exponer modelos Prisma directamente:

- `PrescriptionSummary`: id, estado, Patient, Encounter, `issuedAt`, profesional
  snapshot, cantidad de items y versión.
- `PrescriptionDetail`: resumen más diagnóstico, instrucciones, snapshots,
  lifecycle timestamps e items ordenados.
- `PrescriptionItem`: representación estable de los siete campos de item
  propuestos y `position`.
- `CreatePrescription`: Encounter implícito por ruta, diagnóstico,
  instrucciones e items iniciales.
- `UpdatePrescription`: `expectedVersion` y reemplazo completo del draft.
- `FinalizePrescription`: `expectedVersion` y, si producto lo aprueba, un
  `issuedAt` clínico validado por el servidor.
- `VoidPrescription`: `expectedVersion` y razón obligatoria.

Estos nombres son una frontera de contrato propuesta; no se implementan en
6D.1.

## APIs propuestas para Fase 6D.2

Son contratos sugeridos, no endpoints implementados:

| Método  | Ruta                                                     | Propósito                                              |
| ------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `GET`   | `/api/v1/clinical-encounters/:encounterId/prescriptions` | Listar recetas del Encounter, tenant-safe.             |
| `POST`  | `/api/v1/clinical-encounters/:encounterId/prescriptions` | Crear borrador con cabecera e items.                   |
| `GET`   | `/api/v1/prescriptions/:id`                              | Obtener detalle y estado.                              |
| `PATCH` | `/api/v1/prescriptions/:id`                              | Actualizar un borrador completo con `expectedVersion`. |
| `POST`  | `/api/v1/prescriptions/:id/finalize`                     | Finalizar con CAS y snapshots.                         |
| `POST`  | `/api/v1/prescriptions/:id/void`                         | Anular con razón y CAS.                                |

La respuesta debe incluir `version`, estado, `patient`, `encounter`, snapshots y
items ordenados. Un endpoint de búsqueda por Patient puede añadirse cuando la
UX lo necesite, siempre con `organizationId` en la consulta.

## UX futura

La Fase 6D.3 debería integrar una sección de Prescripciones en el detalle del
Encounter y una vista de historial del Patient, sin crear una navegación
paralela desconectada. El flujo mínimo es:

1. lista de recetas con estado y fecha de emisión;
2. detalle de receta finalizada en modo lectura;
3. formulario de borrador con diagnóstico, instrucciones e items repetibles;
4. resumen y confirmación de finalización;
5. anulación explícita con razón;
6. mensaje claro cuando el Encounter está finalizado/anulado o el Patient no
   permite nueva actividad.

La fecha civil se convierte con `Organization.timezone`; nunca se usa la zona
del navegador como fuente de verdad.

## Alcance exacto propuesto para 6D.2

La siguiente fase, si producto aprueba las decisiones abiertas, debe implementar
únicamente:

1. `PrescriptionStatus` y modelos `Prescription`/`PrescriptionItem` con FKs
   compuestas tenant-safe.
2. Migración Prisma reversible y validación de índices/constraints.
3. Permisos `prescriptions.*` y guardas de Membership/ClinicalRole.
4. Servicios transaccionales de create, update-draft, finalize y void con CAS.
5. Auditoría mediante `ClinicalAuditEvent`.
6. Endpoints REST propuestos y pruebas unitarias/API/DB de aislamiento,
   invariantes, lifecycle y concurrencia.
7. Seed mínimo solo si los tests necesitan datos de demostración; no inventar
   medicamentos de catálogo ni side effects.

No incluye PDF, firma, inventario, facturación, frontend ni una política de
receta sin Encounter. La implementación de frontend queda para 6D.3.

## Internacionalización y regulación

Los textos de medicamentos, presentaciones, dosis, frecuencias y duraciones no
deben asumir nomenclatura colombiana ni un idioma único. Las etiquetas y textos
legales del futuro PDF pertenecen a la capa de presentación/documentos; el
agregado guarda el contenido clínico introducido por el profesional. Requisitos
de medicamentos controlados, unidades oficiales, firma o interoperabilidad
requieren una decisión regulatoria antes de estructurarse.

## Estado de implementación

No se implementó ninguna prescripción en esta fase. No se modificaron Prisma,
migraciones, backend, frontend, permisos ni tests de Easyvet.
