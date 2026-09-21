# Decisiones y preguntas abiertas de preventive care — Fase 6E.1

Este registro separa hechos del legacy, recomendaciones de Easyvet y asuntos
que requieren decisión de producto/regulación. La Fase 6E.1 es un gate de
diseño: no autoriza modelos Prisma, migraciones, endpoints ni React.

## Hechos cerrados por la referencia legacy

- `Vacunacion` y `Desparasitacion` son valores de `clinical_consultations`;
  no existen tablas propias.
- Vacunación captura fecha, profesional, estado, nombre, tipo, vía, fabricante,
  lote, vencimiento, dosis, notas y próxima dosis.
- Desparasitación captura fecha, fecha previa opcional, tipo/producto, dosis,
  notas y próximo control. Su campo `type` mezcla modalidad y vía.
- El contenedor común exige historia, Patient, Owner derivado, título, resumen,
  profesional y matrícula; la ruta es `POST/GET/DELETE /api/consultations`.
- Los detalles se serializan en `summary`/`indications`; `document_reference`
  queda vacío en ambos flujos.
- Guardar proyecta `patients.vaccination_status` o `deworming_status` como
  `nombre/producto · fecha`; el backfill toma el último evento por fecha.
- `next_control` crea/actualiza `control_reminders` y una cita derivada; una
  fecha vacía elimina esos efectos operativos. Google Calendar es opcional.
- El profesional legacy es texto obligatorio, sin FK a una identidad; no hay
  snapshots Owner/Patient ni integración de inventario.
- Legacy permite borrar físicamente consultas y usar estados de aplicación en
  el mismo contenedor, por lo que no se copia ese lifecycle de forma literal.

## Decisiones recomendadas para Easyvet

| Tema                              | Estado                                     | Decisión/recomendación                                                                                          |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Entidades                         | RECOMENDACIÓN EASYVET                      | Dos satélites explícitos: `Vaccination` y `Deworming`; no `PreventiveEvent` JSON.                               |
| Encounter                         | RECOMENDACIÓN MVP / PRODUCTO PENDIENTE     | Encounter obligatorio, mismo tenant y Patient; no evento huérfano.                                              |
| Record                            | CERRADO                                    | Derivar `ClinicalRecord` desde Encounter; no duplicar `clinicalRecordId`.                                       |
| Multiplicidad                     | RECOMENDACIÓN EASYVET                      | `Encounter 1 ── 0..N Vaccination` y `0..N Deworming`; repetir crea otra fila.                                   |
| Lifecycle técnico                 | RECOMENDACIÓN EASYVET                      | `DRAFT → FINALIZED → VOIDED`; terminales inmutables, sin delete.                                                |
| Estado clínico de vacuna          | PRODUCTO PENDIENTE                         | Mantener separado `applicationStatus`: `APPLIED`, `PLANNED`, `NOT_APPLIED`, `CONTRAINDICATED`.                  |
| Estado clínico de desparasitación | RECOMENDACIÓN EASYVET                      | Administración finalizada no necesita un segundo estado hasta que producto defina planes/no-aplicaciones.       |
| Fecha                             | RECOMENDACIÓN EASYVET                      | `Date` civil para administración/plan y `nextDueOn`; timestamps UTC solo para auditoría técnica.                |
| Hora y timezone                   | CERRADO                                    | No convertir la fecha legacy `T12:00` en hora clínica real; Agenda decide sus horas en `Organization.timezone`. |
| Nombre de vacuna                  | RECOMENDACIÓN EASYVET                      | Texto libre requerido al finalizar; no imponer catálogo en 6E.2.                                                |
| Fabricante/laboratorio            | RECOMENDACIÓN EASYVET                      | Snapshot textual nullable; no FK al catálogo ni inventario.                                                     |
| Lote                              | PRODUCTO/REGULACIÓN PENDIENTE              | Nullable en MVP; decidir cuándo es obligatorio para biológicos regulados.                                       |
| Vencimiento                       | PRODUCTO/REGULACIÓN PENDIENTE              | `Date` nullable; si existe, no puede ser anterior a `administeredOn`.                                           |
| Dosis                             | RECOMENDACIÓN EASYVET                      | Texto libre (`doseText`) para evitar falsa precisión de unidades.                                               |
| Tipo de dosis                     | RECOMENDACIÓN EASYVET                      | Texto controlado por UI; enum solo cuando la política sea estable.                                              |
| Vía de vacunación                 | PRODUCTO/REGULACIÓN PENDIENTE              | `routeText` inicialmente; no fijar catálogo internacional desde legacy.                                         |
| Tipo/vía de desparasitación       | DECISIÓN REQUERIDA                         | Conservar `dewormingTypeText`; no inventar `route` porque legacy mezcla Interna/Externa/Oral/Topica/Inyectable. |
| Próxima dosis                     | RECOMENDACIÓN EASYVET                      | `nextDueOn Date`; no asumir que crea una cita o recordatorio.                                                   |
| Recordatorios                     | POSTERGADO                                 | Job/outbox idempotente posterior; nunca email dentro de la transacción clínica.                                 |
| Appointment                       | POSTERGADO                                 | Integración explícita por comando, con referencia al preventivo y sin cambiar su lifecycle.                     |
| Profesional responsable           | RECOMENDACIÓN EASYVET                      | Membership activa con `ClinicalRole.PRACTITIONER` al finalizar una administración.                              |
| Actor técnico                     | CERRADO                                    | `recordedByMembershipId` conserva quién creó/editó; no se confunde con responsable clínico.                     |
| Asistente                         | RECOMENDACIÓN EASYVET / PRODUCTO PENDIENTE | Puede crear/editar drafts; no finalizar/anular salvo delegación futura explícita.                               |
| Snapshots profesionales           | RECOMENDACIÓN EASYVET                      | Congelar nombre/matrícula al finalizar.                                                                         |
| Snapshots Patient/Owner           | RECOMENDACIÓN EASYVET                      | Congelar nombre del Patient y display name del Owner derivado; no aceptar Owner del cliente.                    |
| Proyección en Patient             | CERRADO                                    | No añadir strings de última vacuna/desparasitación; derivar desde historia.                                     |
| Patient archivado                 | CERRADO                                    | Lectura histórica sí; alta, edición de draft y finalize no.                                                     |
| Owner archivado                   | RECOMENDACIÓN EASYVET                      | No mutar snapshots; bloquear nuevas operaciones que requieran identidad activa según política del core.         |
| Inventario                        | CERRADO PARA 6E.2                          | Sin FK, descuento, reserva de lote, compra, venta o dispensación.                                               |
| Certificado                       | POSTERGADO                                 | Consumir eventos finalizados y snapshots en módulo documental; no tabla ni firma en 6E.2.                       |
| Auditoría                         | CERRADO                                    | Reutilizar `ClinicalAuditEvent`, append-only y metadata operativa mínima.                                       |
| Concurrencia                      | CERRADO                                    | `version` + `expectedVersion`; stale writes devuelven `409`.                                                    |
| Lock order                        | CERRADO                                    | `ClinicalEncounter → Patient → Owner → Membership → preventive record`.                                         |
| Parent race                       | CERRADO                                    | `voidEncounter` y finalize compiten por el prefijo; quien llega después reevalúa y falla sin side effects.      |
| Permisos                          | RECOMENDACIÓN EASYVET                      | `vaccinations.read/create/updateDraft/finalize/void` y equivalentes `dewormings`, derivados de roles clínicos.  |
| API                               | RECOMENDACIÓN EASYVET                      | Rutas segmentadas por agregado; sin endpoint genérico de blobs ni delete.                                       |
| Frontend                          | POSTERGADO                                 | 6E.3; primero contrato backend y pruebas reales.                                                                |

## Tabla exacta por dominio

| Decisión                | Vaccination                                                   | Deworming                                         | Rationale                                                                                  |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Requires Encounter      | Sí para MVP                                                   | Sí para MVP                                       | Deriva Record/Patient y evita eventos huérfanos; retrospectivos son decisión aparte.       |
| Lifecycle               | `DRAFT → FINALIZED → VOIDED` + `applicationStatus`            | `DRAFT → FINALIZED → VOIDED`                      | Consistencia del Clinical Core; el estado de aplicación no debe confundirse con lifecycle. |
| Múltiples por Encounter | `0..N`                                                        | `0..N`                                            | Dos productos/dosis en una visita son válidos.                                             |
| Profesional             | Practitioner responsable al finalizar; actor técnico separado | Igual                                             | `ClinicalRole` y snapshots; no nombres arbitrarios del cliente.                            |
| Asistente               | Crear/editar draft; no finalizar/anular                       | Igual                                             | Evita atribuir una administración regulada sin responsable.                                |
| Fecha                   | `administeredOn` o `plannedOn` civil según estado             | `administeredOn` civil                            | No convertir `T12:00` legacy en precisión clínica.                                         |
| `nextDueDate`           | `nextDueOn Date` opcional                                     | `nextDueOn Date` opcional                         | Dato clínico; no crea Appointment/Reminder automáticamente.                                |
| Producto                | `vaccineName` libre inicialmente                              | `productName` libre inicialmente                  | No catálogo obligatorio en 6E.2.                                                           |
| Lote                    | Snapshot textual; obligatoriedad pendiente                    | No verificado en legacy; no agregar sin requisito | Trazabilidad regulatoria debe ser explícita.                                               |
| Vencimiento             | `expiresOn Date` nullable; check si existe                    | No verificado; no agregar por simetría            | La evidencia solo demuestra vencimiento de vacuna.                                         |
| Vía                     | `routeText` nullable                                          | Mantener `dewormingTypeText`; route pendiente     | Legacy mezcla modalidad/vía en desparasitación.                                            |
| Dosis                   | `doseText`                                                    | `doseText`                                        | Acepta `1 ml`, tableta o “según peso” sin falsa unidad.                                    |
| Snapshots               | Profesional, Patient y Owner al finalizar                     | Igual                                             | Certificados/documentos futuros necesitan identidad histórica.                             |
| Void                    | Motivo, actor, timestamp; no recalcular próxima fecha         | Igual                                             | Preserva evidencia y excluye el evento de proyecciones activas.                            |
| Inventario              | Sin FK ni side effect; posible batch nullable futuro          | Igual                                             | Evento clínico ≠ stock ≠ venta.                                                            |
| Reminders               | Solo integración posterior explícita                          | Igual                                             | `nextDueOn` no dispara jobs dentro del agregado.                                           |

La tabla es una recomendación de diseño; las filas marcadas como pendientes no
se convierten en invariantes hasta la aprobación de producto/regulación.

## Preguntas que producto debe cerrar antes de 6E.2

### 1. ¿Puede existir un registro preventivo sin Encounter?

- **A — No (recomendada):** incluso un registro administrativo usa un Encounter
  mínimo, conserva autoría y simplifica tenant/retención.
- **B — Sí, retrospectivo:** requiere una bandera de origen, fecha incierta y
  permisos específicos; no debe ser una FK nullable sin semántica.

### 2. ¿Qué significa exactamente la fecha de una vacuna `PLANNED`?

Decidir si es fecha prevista (`plannedOn`), fecha de decisión clínica o una
aplicación no realizada. La migración no puede inferirlo desde `T12:00`.

### 3. ¿La desparasitación tendrá estado clínico propio?

El legacy solo registra la administración. Si producto necesita “recomendada”,
“no aplicada” o “contraindicada”, debe aprobar una máquina de estados separada
de `DRAFT/FINALIZED/VOIDED`.

### 4. ¿Lote y vencimiento son obligatorios?

Definir por país, especie, tipo de biológico y política de trazabilidad. La
propuesta MVP los conserva como snapshots opcionales y no integra inventario.

### 5. ¿Qué vías y unidades se soportan?

Confirmar catálogo regulatorio, unidades de dosis y si `Oral/Topica/Inyectable`
en desparasitación representan vía o clase del producto. Hasta entonces los
campos permanecen textuales.

### 6. ¿Quién puede finalizar y anular?

Confirmar si solo el Practitioner responsable puede finalizar, si otro
Practitioner puede delegarse y quién puede `VOID` una evidencia finalizada.
Assistant no debe obtener esas capacidades por su MembershipRole genérico.

### 7. ¿Se necesita historia preventiva externa?

Si se importan vacunas/desparasitaciones aplicadas fuera de la clínica, decidir
cómo identificar al profesional desconocido, si la fecha puede ser aproximada y
qué texto se conserva como fuente original.

### 8. ¿`nextDueOn` crea recordatorio o cita?

Confirmar si solo alimenta un panel, si genera un reminder por correo, o si
reserva una Appointment. Cada efecto necesita idempotencia, permisos y auditoría
propios.

### 9. ¿Qué exige el certificado?

Definir campos legales, especie/raza, Owner, firma, jurisdicción, idioma,
versión de plantilla y qué ocurre cuando el evento se anula después de emitirlo.

### 10. ¿Se conserva un identificador legacy?

Para migración histórica se recomienda conservar `legacySourceId` y el tipo
original en una estrategia de trazabilidad revisable, pero producto debe aprobar
si esa metadata vive en la entidad o en un mapa de migración externo.

### 11. ¿Qué requisitos dependen de jurisdicción?

La obligatoriedad de lote/vencimiento, matrícula, firma, certificado, vía,
biológicos regulados y medicamentos controlados no se decide por intuición. Se
requiere país/mercado objetivo y evidencia normativa antes de convertirlos en
checks globales. Los protocolos por especie y las series vacunales quedan como
configuración futura, no como enums hardcodeados.

## Gate de autorización de 6E.2

6E.2 solo puede comenzar cuando exista decisión explícita sobre:

1. Encounter obligatorio o flujo retrospectivo;
2. significado de fechas y estado `PLANNED`;
3. permisos de asistente, responsable y anulación;
4. obligatoriedad de lote/vencimiento y catálogo de vías/unidades;
5. recordatorios/Appointment y certificado;
6. estrategia de trazabilidad de datos legacy.

Con esas respuestas, 6E.2 implementará únicamente modelos, migración,
permisos, transacciones, CAS, locks, snapshots, auditoría y pruebas de backend.
La UI, los certificados, correo, inventario y migración histórica amplia no se
incluyen en ese gate salvo nueva autorización.

## Estado final de 6E.1

El análisis y el diseño propuesto están documentados. No se implementó
vacunación ni desparasitación, no se creó una migración y la Fase 6E.2 no se
inició.
