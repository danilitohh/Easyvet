# Propuesta de arquitectura de preventive care — Fase 6E.1

## Estado y límites

Este documento es una propuesta para Easyvet basada en la referencia legacy de
`05fea495cb13208b27bf470b3570987fd501a81e`. No modifica Prisma, migraciones,
backend, frontend, permisos, seed ni APIs. La implementación queda fuera de
6E.1 y no se inicia 6E.2.

La intención es conservar el valor clínico de la historia legacy sin copiar el
modelo polimórfico de texto ni sus efectos laterales implícitos.

## Objetivos

- Registrar múltiples vacunaciones y desparasitaciones por paciente y
  `ClinicalEncounter`.
- Mantener aislamiento por `Organization` mediante FKs compuestas y servicios
  tenant-safe.
- Separar el evento preventivo de `Patient` y de `Inventory`.
- Conservar una fecha clínica civil sin inventar horas o zonas horarias.
- Congelar identidad clínica y profesional cuando el evento se finalice.
- Permitir borradores y anulación explícita sin borrar evidencia finalizada.
- Exponer recordatorios/`nextDueDate` como datos clínicos, dejando citas,
  correo, certificados e inventario como integraciones explícitas.

## No objetivos de 6E.1

- Crear `Vaccination`, `Deworming`, enums o migraciones Prisma.
- Crear endpoints, DTOs, React, seed, jobs, emails, PDFs o certificados reales.
- Inventar un catálogo de vacunas, antiparasitarios, fabricantes, rutas o dosis.
- Descontar inventario, reservar lotes, vender, facturar o dispensar.
- Resolver regulación por país, firma digital o medicamentos/biológicos
  controlados.

## Agregado y relación con Clinical Core

La recomendación es modelar dos satélites explícitos, no un `PreventiveEvent`
con JSON ni otra consulta polimórfica:

```text
Organization
└── Patient
    └── ClinicalRecord (lazy, existente)
        └── ClinicalEncounter (requerido)
            ├── Vaccination 0..N
            └── Deworming 0..N
```

Cada entidad guarda `organizationId`, `clinicalEncounterId` y `patientId`.
`patientId` es una redundancia controlada para listas tenant-safe y debe estar
validada por FK compuesta contra el Patient del Encounter. No se duplica
`clinicalRecordId`: se deriva desde el Encounter.

### Alternativas evaluadas

| Alternativa                                      | Ventaja                                                                    | Coste/riesgo                                                                        | Resultado       |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------- |
| A. Tablas `Vaccination` y `Deworming` separadas  | Campos explícitos, checks específicos y políticas distintas de lote/estado | Dos contratos y listas que deben compartir convenciones                             | **Recomendada** |
| B. `PreventiveEvent` base + detalles             | Línea de tiempo SQL común y campos compartidos                             | Herencia/FKs más complejas; lifecycle y estados divergentes; puede terminar en JSON | No para MVP     |
| C. Un `PreventiveEvent` con `type` + `data Json` | Alta velocidad inicial                                                     | Pierde integridad, validación, índices y claridad clínica; repite el legacy         | Rechazada       |

Una línea de tiempo combinada puede componerse en API/frontend sin introducir la
tabla genérica que se rechaza para persistencia.

### Encounter requerido y multiplicidad

Recomendación MVP: todo evento preventivo requiere un `ClinicalEncounter` de
la misma organización y Patient. Un Encounter admite `0..N` vacunaciones y
`0..N` desparasitaciones; no se impone unicidad por producto, fecha o dosis.
Una repetición crea otro evento, nunca reabre uno finalizado.

Un flujo administrativo/retrospectivo sin Encounter es una decisión de producto
pendiente. Si se aprueba, debe ser un tipo de Encounter mínimo y auditable, no
una FK nullable silenciosa.

## Lifecycle y estados

Ambos satélites comparten el lifecycle de evidencia:

```text
DRAFT ──finalize──> FINALIZED ──void(reason)──> VOIDED
```

- `DRAFT`: editable; puede ser creado por un asistente con permisos clínicos.
- `FINALIZED`: datos clínicos, profesional y snapshots inmutables.
- `VOIDED`: terminal; conserva contenido, razón, actor y timestamps.
- No hay `DELETE` de un evento creado.

Un draft puede guardar campos todavía incompletos (por ejemplo lote,
vencimiento, notas o próxima fecha) siempre que las referencias tenant-safe y
el Encounter sean válidos. Finalizar exige el mínimo clínico del dominio:
producto, fecha aplicable, Patient activo y Practitioner responsable. Lote,
vencimiento, matrícula, firma y requisitos de biológicos solo se vuelven
obligatorios mediante una decisión de jurisdicción explícita.

La vacunación además necesita un estado clínico separado, porque el legacy
mezcla aplicación, próxima dosis, no aplicación y contraindicación en la misma
consulta. Se propone `applicationStatus` con valores inicialmente
`APPLIED`, `PLANNED`, `NOT_APPLIED`, `CONTRAINDICATED`, sujetos a confirmación de
producto. `Deworming` representa una administración; no se agrega un estado
clínico adicional hasta que producto defina eventos planificados o rechazados.

Reglas recomendadas:

- `Vaccination.applicationStatus = APPLIED` exige `administeredOn`.
- `PLANNED` exige `plannedOn` o `nextDueOn`, pero no inventa una aplicación.
- `NOT_APPLIED` y `CONTRAINDICATED` conservan la fecha de decisión y notas,
  pero no crean una dosis administrada.
- `Deworming` exige `administeredOn` al finalizar.

La fecha clínica es `Date` (día civil de la organización), no
`DateTime`/`timestamptz`. `createdAt`, `updatedAt`, `finalizedAt` y `voidedAt`
son timestamps técnicos en UTC. `nextDueOn` también es `Date`; si una futura
cita requiere hora, Agenda tendrá su propio timestamp convertido desde
`Organization.timezone`.

## Modelo conceptual común

Los nombres son contrato de diseño, no cambios de esquema autorizados.

| Campo                                            | Propósito e invariante                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `id`                                             | UUID estable.                                                                               |
| `organizationId`                                 | Tenant propietario; participa en todas las consultas y FKs.                                 |
| `clinicalEncounterId`                            | Encounter requerido, del mismo Patient y tenant.                                            |
| `patientId`                                      | Redundancia para lectura; debe coincidir con Encounter.                                     |
| `status`                                         | `DRAFT`, `FINALIZED`, `VOIDED`.                                                             |
| `version`                                        | Compare-and-set para update/finalize/void. Inicial `1`, siempre positiva.                   |
| `recordedByMembershipId`                         | Actor que crea/edita; puede ser asistente.                                                  |
| `administeredByMembershipId`                     | Practitioner responsable de una administración; requerido al finalizar un evento aplicado.  |
| `professionalDisplayNameSnapshot`                | Nombre histórico que se imprime/conserva.                                                   |
| `professionalLicenseSnapshot`                    | Matrícula/licencia histórica, nullable solo si política local lo permite.                   |
| `patientNameSnapshot`                            | Nombre del Patient al finalizar; no sustituye la FK.                                        |
| `ownerDisplayNameSnapshot`                       | Owner derivado del Patient/Encounter al finalizar. No se acepta Owner arbitrario.           |
| `clinicalDate` / `administeredOn`                | Fecha civil; usar `administeredOn` nullable en vacunación cuando el estado no sea aplicado. |
| `nextDueOn`                                      | Próxima fecha civil opcional; no es automáticamente una Appointment.                        |
| `notes`                                          | Narrativa clínica acotada, no JSON de contrato.                                             |
| `finalizedAt`, `finalizedByMembershipId`         | Evidencia de finalización.                                                                  |
| `voidedAt`, `voidedByMembershipId`, `voidReason` | Anulación terminal con motivo obligatorio.                                                  |
| `createdAt`, `updatedAt`                         | Auditoría técnica.                                                                          |

Owner se deriva del Patient. No se añade una FK Owner duplicada; el snapshot
textual de nombre protege certificados futuros frente a cambios de ficha.

El evento no duplica `VitalMeasurement` ni `Patient.currentWeightKg`. Si la
pantalla necesita mostrar peso, consulta los vitales del Encounter; solo se
capturaría un nuevo vital mediante el flujo de Clinical Core.

Microchip, especie, raza y sexo tampoco se copian al agregado por anticipación.
Un futuro Document renderer puede tomar esos datos o congelar un snapshot
documental específico cuando exista un requisito legal; el evento preventivo
conserva únicamente el nombre del Patient y el display name del Owner en
finalización.
Patient archivado bloquea alta, edición de draft y finalización, pero permite
lectura histórica según permisos y retención.

## `Vaccination`

Campos propios recomendados:

| Campo               | Decisión propuesta                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `applicationStatus` | Estado clínico independiente del lifecycle técnico.                                                                                |
| `vaccineName`       | Texto requerido al finalizar; admite nombre libre.                                                                                 |
| `vaccineType`       | Texto nullable en MVP; no fijar enum desde la lista legacy.                                                                        |
| `routeText`         | Texto nullable; la vía observada en legacy no debe cerrarse a un catálogo regulatorio sin país definido.                           |
| `manufacturerText`  | Snapshot textual del fabricante/laboratorio.                                                                                       |
| `lotNumber`         | Texto nullable en MVP; su obligatoriedad es decisión regulatoria pendiente.                                                        |
| `expiresOn`         | Fecha civil nullable; validar `expiresOn >= administeredOn` cuando ambas existan.                                                  |
| `doseText`          | Texto libre (por ejemplo `1 ml`); no convertir a Decimal/unidad sin catálogo.                                                      |
| `doseTypeText`      | `Refuerzo`, primovacunación, revacunación, dosis única u otra como texto controlado por UI; enum futuro solo con política estable. |
| `notes`             | Observaciones de aplicación/contraindicación.                                                                                      |
| `previousDoseOn`    | No se agrega por defecto; una dosis previa es otro evento. Solo añadir si producto necesita capturar historia externa sin evento.  |

El lote, vencimiento y fabricante son snapshots de la aplicación. No son
referencias a inventario ni deben cambiar si se edita un catálogo futuro.

## `Deworming`

Campos propios recomendados:

| Campo                      | Decisión propuesta                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `productName`              | Texto requerido al finalizar.                                                                              |
| `dewormingTypeText`        | Conserva el valor legacy (`Interna`, `Externa`, etc.) como texto nullable hasta separar modalidad y vía.   |
| `routeText`                | No se crea automáticamente: la fuente legacy mezcla ruta y tipo. Requiere decisión de producto/regulación. |
| `administeredOn`           | Fecha civil requerida al finalizar.                                                                        |
| `previousAdministrationOn` | Fecha civil opcional de referencia declarada por el Owner/profesional; no reemplaza un evento histórico.   |
| `doseText`                 | Texto libre.                                                                                               |
| `nextDueOn`                | Fecha civil opcional.                                                                                      |
| `notes`                    | Observaciones clínicas.                                                                                    |

No se deriva un estado resumido en Patient. La historia de administraciones es
la fuente de verdad.

## Profesional, asistente y snapshots

El actor que realiza la mutación se obtiene de la sesión y nunca del body. El
`administeredByMembershipId` debe ser Membership activa del mismo tenant con
`ClinicalRole.PRACTITIONER` cuando el evento se finaliza como administrado.
`recordedByMembershipId` conserva al asistente u operador técnico.

`MembershipRole.VETERINARIAN` o `ASSISTANT` no sustituyen a `ClinicalRole`.
Un `PLATFORM_ADMIN` tampoco obtiene bypass: las rutas siguen requiriendo
tenant activo y permisos clínicos explícitos, igual que el resto de Clinical
Core.

Recomendación de permisos:

| Capacidad           | Practitioner                                             | Clinical Assistant     |
| ------------------- | -------------------------------------------------------- | ---------------------- |
| Leer                | Sí                                                       | Sí                     |
| Crear draft         | Sí                                                       | Sí                     |
| Editar draft        | Sí                                                       | Sí                     |
| Finalizar           | Sí, siendo responsable o conforme a delegación explícita | No                     |
| Anular              | Sí, con política del producto                            | No                     |
| Exportar/constancia | Según permiso separado                                   | Según permiso separado |

El nombre y matrícula del perfil profesional se congelan al finalizar. Si el
producto permite que un asistente prepare el draft, debe exigir que el
Practitioner responsable quede asignado antes de `FINALIZED`.

## Patient/Owner y proyecciones

No se añaden `vaccinationStatus` ni `dewormingStatus` a Patient. Esos strings
legacy son una proyección mutable y pueden quedar obsoletos. Las pantallas
obtendrán el último evento por fecha/estado, y cualquier resumen futuro se
reconstruirá en una consulta tenant-safe o en una proyección explícitamente
derivada.

El cambio de Owner no reescribe snapshots finalizados. Archivar Owner o Patient
no borra eventos; las mutaciones que impliquen una administración nueva se
bloquean cuando Patient está `ARCHIVED`.

El MVP no resuelve registros retrospectivos o aplicaciones externas. Si se
aprueban después, el contrato debe distinguir `source = INTERNAL|EXTERNAL`,
permitir profesional/fecha inciertos sin atribuirlos falsamente a una
Membership de la clínica y conservar el texto del carné/origen. Ese flujo no
debe degradar el requisito de Encounter ni reutilizar el nombre del actor de la
sesión como administrador externo.

## Reminders, Agenda, documentos e inventario

- `nextDueOn` es dato clínico, no una cita implícita.
- Anular un evento no recalcula ni crea automáticamente una nueva fecha: el
  `nextDueOn` queda como evidencia histórica del evento anulado y deja de ser
  fuente activa. Una proyección futura debe excluir `VOIDED` y recalcularse
  desde los eventos restantes.
- Una integración posterior puede crear una Appointment de control con
  `sourcePreventiveCareId` mediante operación idempotente, fuera de la
  transacción clínica; si el usuario elimina la fecha, se cancela la cita por
  comando explícito.
- Un futuro reminder/outbox debe ser tenant-scoped e idempotente, con fecha y
  tipo del evento, sin mandar correo dentro de la transacción de la aplicación.
- Un certificado/constancia solo se genera desde un evento `FINALIZED`, usando
  snapshots; la firma digital y el almacenamiento se mantienen fuera del
  agregado.
- No existe FK a `Inventory`, lote de stock, compra, venta o facturación en
  6E.2. La vacunación puede conservar lote/fabricante como texto histórico.

Un futuro `inventoryBatchId` nullable podría enlazar una aplicación con un lote
real, pero nunca sustituye los snapshots `manufacturerText`, `lotNumber` y
`expiresOn`, ni convierte el registro clínico en una transacción de inventario.

No se crea una unicidad clínica artificial como
`UNIQUE(patientId, vaccineName, administeredOn)`: dos productos o dosis el
mismo día son válidos.

No se implementan automáticamente series, protocolos, número de dosis,
`VaccineCatalog` ni reglas por especie/país. Una futura configuración puede
proponer una próxima dosis, pero el evento guardado conserva el valor elegido
por el profesional.

## Auditoría y concurrencia

Se reutiliza `ClinicalAuditEvent` append-only. La futura migración añadirá solo
los valores mínimos para crear, actualizar draft, finalizar y anular cada
satélite. Metadata: entidad, acción, actor, versión anterior/nueva, estado,
Patient/Encounter y presencia de datos regulados; nunca dosis, diagnóstico,
PII completa o texto clínico duplicado.

Toda mutación usa `expectedVersion` y transacción. Orden de locks recomendado:

```text
ClinicalEncounter → Patient → Owner histórico → Membership responsable → Preventive record
```

Create/update/finalize/void revalidan tenant, parent status, Patient y actor
dentro de la misma transacción. `PARENT_VOIDED`, `PATIENT_ARCHIVED` y stale
versiones devuelven errores deterministas (`404` seguro para cross-tenant y
`409` para conflictos). Una carrera entre `voidEncounter` y finalize confirma
solo la operación que conserva el lock; la otra reevalúa y falla sin side
effects.

## Contratos API propuestos para 6E.2

Los DTOs deben separar resumen, detalle y mutaciones, igual que Prescriptions,
sin exponer Prisma directamente:

- `GET /patients/:patientId/vaccinations` y
  `GET /patients/:patientId/dewormings`: listas tenant-safe paginables.
- `GET /vaccinations/:id` y `GET /dewormings/:id`: detalle con Encounter,
  Patient/Owner snapshots y estado del parent.
- `POST /clinical-encounters/:encounterId/vaccinations` y `/dewormings`: crea
  draft; Patient/Encounter se derivan del parent.
- `PATCH /vaccinations/:id` y `/dewormings/:id`: reemplaza campos de draft con
  `expectedVersion`.
- `POST /vaccinations/:id/finalize` y `/dewormings/:id/finalize`.
- `POST /vaccinations/:id/void` y `/dewormings/:id/void`, con motivo.

No se proponen endpoints por lote, por dosis ni por items; no hay delete.

## Índices e invariantes de base propuestos

- Unique `(id, organizationId)` para FKs compuestas.
- Índices `(organizationId, patientId, administeredOn/createdAt)` y
  `(organizationId, clinicalEncounterId, createdAt)`.
- Índice `(organizationId, status)` y, si se materializa, `(organizationId,
nextDueOn)`.
- Checks de `version > 0`, estado/lifecycle coherente, fechas no futuras solo
  si producto las prohíbe, `expiresOn >= administeredOn`, nombres no vacíos y
  motivo obligatorio en `VOIDED`.
- FKs `RESTRICT` para historia y responsables; no cascada destructiva.

## Migración legacy → Easyvet

La migración futura debe ser explícita y revisable:

| Legacy                                                                    | Destino propuesto                                 | Riesgo                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `clinical_consultations` con `consultation_type = Vacunacion`             | `Vaccination` ligado al Encounter del `record_id` | Estado `Proxima` puede ser plan, no aplicación; `consultation_at` suele ser `T12:00` sintético.    |
| `title` / `summary.Vacuna`                                                | `vaccineName`                                     | Resolver nombre libre y duplicados.                                                                |
| `summary.Estado`, tipo, vía, laboratorio, lote, vencimiento, dosis, notas | Campos propios y snapshots                        | Parseo de texto; valores vacíos y etiquetas antiguas deben conservarse en un reporte de migración. |
| `indications.Proxima vacunacion` / `Proximo control`                      | `nextDueOn`                                       | Puede representar recordatorio o cita; no migrar Appointment automáticamente sin reconciliación.   |
| `professional_name/license`                                               | Membership + snapshots                            | No existe FK profesional legacy; requiere matching manual o identidad “legacy desconocida”.        |
| `clinical_consultations` con `consultation_type = Desparasitacion`        | `Deworming` ligado al Encounter                   | `deworming_type` mezcla modalidad/vía; no convertir a enum.                                        |
| `summary.Producto`, tipo, dosis, observaciones                            | Campos propios                                    | Texto estructurado con variaciones.                                                                |
| `indications.Ultima desparasitacion`                                      | `previousAdministrationOn` opcional               | Es una declaración, no un evento histórico.                                                        |
| `patients.vaccination_status`/`deworming_status`                          | No migrar como fuente; recalcular resumen         | Es una proyección mutable y puede contradecir historia.                                            |
| `control_reminders` y citas derivadas                                     | Integración posterior/outbox                      | Evitar duplicar comunicaciones o reservas durante backfill.                                        |

Antes de una migración real se necesita un reporte de filas ambiguas,
conservación del `consultation_id` de origen y una estrategia para consultas
sin Encounter equivalente. No se debe hacer una conversión masiva silenciosa.

## Alcance de la futura Fase 6E.2

Solo después de cerrar las decisiones pendientes, 6E.2 puede implementar:

1. modelos/enums y migración Prisma tenant-safe;
2. FKs, checks e índices;
3. permisos y guardas por `ClinicalRole`;
4. DTOs, servicios y endpoints de listas/detalle/draft/finalize/void;
5. transacciones, lock order, CAS, parent race y auditoría;
6. snapshots profesionales, Patient y Owner;
7. pruebas PostgreSQL reales de tenant, lifecycle, archive, fechas,
   conflictos, recordatorios y ausencia de inventario;
8. seed únicamente ficticio y documentación de contrato.

Frontend, certificados, email, Agenda y migración histórica amplia quedan
posteriores (6E.3 o fases específicas).

## Fase 6E.3 — integración frontend futura

La UI futura se integrará en la historia del Patient y el detalle del Encounter:

```text
Patient history → Preventive care
Encounter detail → Vaccinations / Dewormings
```

Puede ofrecer una línea de tiempo combinada cronológica con filtros por tipo,
sin unificar las tablas. El flujo de creación partirá del Encounter y separará:

- vacunación: producto, estado, lote, vencimiento, dosis, fecha civil y próxima
  dosis;
- desparasitación: producto, tipo, dosis, fecha civil y próxima fecha.

Ambos tendrán guardar draft, revisión y finalización, edición de drafts y
anulación con motivo. No habrá selector duplicado de Patient/Encounter ni
requests fuera del tenant activo.

Los drafts pueden carecer de lote, vencimiento, notas y próxima fecha. La
finalización exige los datos clínicamente definidos (Encounter/Patient válidos,
producto, fecha aplicable y Practitioner responsable); cualquier requisito de
lote, vencimiento, jurisdicción o certificado se mantiene como decisión
regulatoria y no se inventa en la UI.
