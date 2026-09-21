# Decisiones y preguntas abiertas de prescripciones — Fase 6D.1 / 6D.2

Este registro separa hechos verificados en Lativet, recomendaciones de diseño
para Easyvet y decisiones que requieren aprobación de producto. Las decisiones
cerradas de implementación de 6D.2 se registran al final del documento.

## Cierre de decisiones aplicado en 6D.2

- Toda receta requiere `ClinicalEncounter`; no existe bypass administrativo.
- Un Encounter admite `0..N` recetas. Crear se permite en `DRAFT` y `FINALIZED`,
  pero no en `VOIDED`.
- El ciclo es `DRAFT → FINALIZED → VOIDED`; no existe reapertura ni delete.
- El Patient se deriva del Encounter y el Owner se deriva de
  `ownerIdAtTime`; no se aceptan FKs arbitrarias desde el cliente.
- Finalizar exige items, Patient activo, prescriptor Practitioner con perfil y
  que el actor sea el prescriptor. El asistente puede crear/editar drafts,
  pero no finalizar/anular.
- Finalizar congela snapshots profesionales, de Patient, Owner y diagnóstico;
  no exige diagnóstico ni matrícula. Anular exige motivo y no elimina items.
- Todas las mutaciones utilizan `expectedVersion`; el reemplazo de items es
  atómico y los conflictos devuelven `409`.
- No se agregan efectos de PDF, documentos, Storage, firma, correo,
  inventario, ventas o facturación.

## Cierre de hardening aplicado en 6D.4

- Create, update y finalize serializan el Encounter padre, Patient y Prescription
  en el orden `Encounter → Patient → Prescription`; `voidEncounter` y archive de
  Patient comparten el prefijo de lock. La carrera parent-void queda definida:
  quien obtiene primero el lock confirma; la operación que llega después
  reevalúa estado y devuelve `PARENT_CLINICAL_ENCOUNTER_VOIDED` cuando aplica.
- El backend normaliza todos los items a posiciones contiguas `0..N-1` y la
  migración `20260921200000_harden_prescription_item_invariants` añade checks
  de posición no negativa y nombre no vacío, además de la unicidad existente.
- Patient `ARCHIVED` conserva lectura histórica, pero bloquea update/finalize de
  drafts existentes y cualquier create; la decisión se aplica dentro de la
  transacción que muta la Prescription.
- Finalize bloquea también el Owner histórico y el Membership prescriptor antes
  de leer sus datos; Owner update y professional-profile upsert comparten esos
  locks para evitar snapshots de identidad afectados por TOCTOU.
- La migración `20260921201000_harden_prescription_lifecycle_invariants` añade
  checks SQL de `version` positiva y coherencia de timestamps, actores, motivo y
  snapshots para estados terminales.
- La auditoría permanece append-only y operativa: versiones, cantidad de items
  y presencia de motivo; nunca texto de medicación, diagnóstico o PII.

## Registro de decisiones

| Tema                                         | Estado                                     | Decisión o pregunta                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Representación legacy                        | VERIFICADO LEGACY                          | `Formula` es `clinical_consultations` con JSON en `document_reference`; no existe entidad propia ni tabla de items.                                                                 |
| Entidad Easyvet                              | RECOMENDACIÓN EASYVET                      | Crear un agregado `Prescription` con `PrescriptionItem[]` relacional cuando se autorice 6D.2.                                                                                       |
| Encuentro requerido                          | RECOMENDACIÓN EASYVET / PRODUCTO PENDIENTE | El MVP debe exigir `ClinicalEncounter`; producto debe decidir si habrá receta administrativa/urgente/repetición sin Encounter. No se habilita un bypass en 6D.2 sin esa aprobación. |
| Relación con Record                          | RECOMENDACIÓN EASYVET                      | No duplicar `clinicalRecordId`; derivarlo desde `ClinicalEncounter`.                                                                                                                |
| Patient                                      | RECOMENDACIÓN EASYVET                      | Guardar `patientId` directo para consultas tenant-safe, con FK/invariante que lo iguale al Patient del Encounter.                                                                   |
| Owner                                        | RECOMENDACIÓN EASYVET                      | Derivar del Patient/Encounter; no aceptar Owner arbitrario. Copiar snapshot textual al finalizar si el documento lo necesita. No duplicar FK Owner en la primera versión.           |
| Múltiples recetas                            | RECOMENDACIÓN EASYVET                      | `Encounter 1 ── 0..N Prescription`; repetir crea una nueva receta y nunca reabre una finalizada.                                                                                    |
| Estado propio                                | RECOMENDACIÓN EASYVET                      | Usar `DRAFT → FINALIZED → VOIDED` porque la receta es evidencia/documento que puede anularse sin borrar.                                                                            |
| Crear/editar después de Encounter finalizado | PRODUCT DECISION REQUIRED                  | Recomendación segura: solo editar mientras Encounter y Prescription están en `DRAFT`; una nueva receta posterior requiere addendum/nuevo Encounter.                                 |
| Encounter anulado                            | RECOMENDACIÓN EASYVET                      | No cascadar automáticamente a Prescription. Conservar una receta finalizada y mostrar contexto `Encounter VOIDED`; anular la receta solo con acción explícita.                      |
| Inmutabilidad                                | RECOMENDACIÓN EASYVET                      | `FINALIZED` y `VOIDED` son inmutables; no hay hard delete.                                                                                                                          |
| Items                                        | RECOMENDACIÓN EASYVET                      | Tabla relacional ordenada con `position`, no JSON ni endpoints por item.                                                                                                            |
| Medicamento                                  | RECOMENDACIÓN EASYVET                      | Nombre/presentación libres en 6D.2; `medicationCatalogId` es una futura referencia nullable, nunca requisito inicial.                                                               |
| Cantidad                                     | RECOMENDACIÓN EASYVET                      | `quantityText` conserva fracciones y unidades humanas. No introducir Decimal+unidad sin requerimiento validado.                                                                     |
| Dosis, frecuencia y duración                 | RECOMENDACIÓN EASYVET                      | Campos de texto separados porque legacy los captura así; validar contenido, no inventar semántica farmacológica.                                                                    |
| Observaciones                                | RECOMENDACIÓN EASYVET                      | Usar `instructionsText` del item y `generalInstructionsText` de la receta; no duplicar `summary`/`indications`/`notes`.                                                             |
| Vía, concentración y unidades                | POSTERGADO / PRODUCT DECISION REQUIRED     | Añadir solo si regulación, UX o interoperabilidad exige valores estructurados.                                                                                                      |
| Diagnóstico                                  | RECOMENDACIÓN EASYVET                      | `diagnosisText` en Prescription; no serializarlo en un resumen genérico.                                                                                                            |
| Fecha clínica                                | RECOMENDACIÓN EASYVET                      | Un solo `issuedAt` para emisión clínica, separado de `createdAt`; convertir fecha civil mediante `Organization.timezone`.                                                           |
| Profesional/autoria                          | RECOMENDACIÓN EASYVET                      | `prescribedByMembershipId` debe ser Membership activa con `ClinicalRole.PRACTITIONER`; el actor de finalize debe ser elegible.                                                      |
| Snapshots profesionales                      | RECOMENDACIÓN EASYVET                      | Congelar nombre y matrícula/licencia al finalizar. Matrícula nullable solo si la política local del producto lo permite.                                                            |
| Snapshots Owner                              | PRODUCT DECISION REQUIRED                  | Recomendado nombre textual al finalizar; decidir si se conservan identificadores adicionales y qué PII permite la retención.                                                        |
| Asistente clínico                            | PRODUCT DECISION REQUIRED                  | Recomendación: puede crear/editar drafts con permisos, no finalizar/void. Confirmar delegación y reasignación de autor.                                                             |
| Permisos                                     | RECOMENDACIÓN EASYVET                      | `prescriptions.read`, `create`, `updateDraft`, `finalize`, `void`; no permisos por item.                                                                                            |
| Concurrencia                                 | RECOMENDACIÓN EASYVET                      | `version` + `expectedVersion` en update/finalize/void; rechazar stale writes con `409`.                                                                                             |
| Finalización                                 | RECOMENDACIÓN EASYVET                      | Una transacción valida tenant, Encounter, Patient, profesional e items; congela snapshots, asigna tiempos, incrementa versión y audita.                                             |
| Auditoría                                    | RECOMENDACIÓN EASYVET                      | Reutilizar `ClinicalAuditEvent`; no guardar el texto clínico completo en metadata.                                                                                                  |
| Anulación                                    | RECOMENDACIÓN EASYVET                      | `FINALIZED → VOIDED`, razón obligatoria, actor y timestamp; conservar items y snapshots.                                                                                            |
| PDF/documentos                               | RECOMENDACIÓN EASYVET                      | PDF futuro consume una Prescription finalizada; Storage/document versioning son satélites, no columnas blob en Prescription.                                                        |
| Firma                                        | PRODUCT DECISION REQUIRED                  | La presencia de nombre/matrícula no equivale a firma. Definir firma digital y entrega en fase documental posterior.                                                                 |
| Inventario                                   | RECOMENDACIÓN EASYVET                      | Prescription no descuenta stock, reserva lotes ni vende. Integración futura explícita e idempotente.                                                                                |
| Facturación                                  | RECOMENDACIÓN EASYVET                      | No crear venta/factura/cobro al prescribir.                                                                                                                                         |
| Medicamentos controlados                     | PRODUCT DECISION REQUIRED                  | Requieren requisitos regulatorios, firma y auditoría específicos antes de soportarse.                                                                                               |
| Receta sin Encounter                         | PRODUCT DECISION REQUIRED                  | Si se aprueba, debe ser un flujo claramente identificado y no una relación nullable silenciosa.                                                                                     |
| Repetición                                   | RECOMENDACIÓN EASYVET                      | Crear nuevo Draft copiando datos visibles; no modificar una receta finalizada.                                                                                                      |
| Frontend                                     | POSTERGADO                                 | Implementar en 6D.3 como sección de Encounter e historial Patient; no abrir una navegación paralela en 6D.2.                                                                        |

## Preguntas que producto debe cerrar antes de 6D.2

### 1. ¿Puede existir una receta sin ClinicalEncounter?

Opciones:

- **A — Encounter siempre requerido (recomendada):** simplifica aislamiento,
  autoría y trazabilidad; las repeticiones se modelan como nuevo Encounter o
  addendum.
- **B — Excepción administrativa/urgente:** exige un tipo de Encounter mínimo o
  un flujo de excepción auditable; no debe ser una receta huérfana.
- **C — Prescription independiente:** mayor flexibilidad, pero duplica
  invariantes, Record y controles de tenant; no se recomienda para el MVP.

### 2. ¿Se permite crear una receta con Encounter FINALIZED?

La recomendación es no editar un Encounter finalizado. Producto debe elegir si
un addendum crea una nueva receta ligada al Encounter original o si exige un
nuevo Encounter; ambas opciones conservan la inmutabilidad.

### 3. ¿La finalización es independiente o atómica con el Encounter?

La recomendación es lifecycle propio con finalización independiente después de
que el Encounter esté en estado elegible. Una finalización atómica con el
Encounter reduciría estados intermedios, pero impediría preparar recetas por
separado y requiere más cambios al Clinical Core.

### 4. ¿Qué representa exactamente `quantity`?

La UI legacy acepta enteros, pero el dato clínico puede ser `1/2`, `2 cajas` o
una indicación equivalente. La recomendación es `quantityText` hasta tener
catálogo, unidades y reglas regulatorias aprobadas.

### 5. ¿Qué identidad y firma se exige?

Producto/legal debe definir si la matrícula es obligatoria por país, si el PDF
requiere firma digital, qué evidencia de entrega se conserva y qué ocurre con
un profesional que pierde su Membership después de emitir.

### 6. ¿Puede un asistente preparar la receta?

La recomendación es sí para Draft, nunca para Finalize/Void. Deben definirse
delegación, revisión y atribución visible para no confundir operador técnico
con profesional prescriptor.

## Decisiones que no se deben reabrir accidentalmente

Salvo una nueva decisión explícita, 6D.2 debe mantener estos límites:

- no copiar el JSON legacy como única fuente de verdad;
- no añadir una FK de inventario para “preparar” integración futura;
- no usar eliminación física para corregir recetas finalizadas;
- no aceptar `organizationId`, `patientId`, Owner o profesional sin validación
  server-side;
- no colocar PDF, firma, correo o Storage dentro de una transacción clínica;
- no usar last-write-wins para contenido clínico;
- no iniciar Fase 6D.3 dentro de 6D.2.

## Autorización de siguiente fase

Las decisiones mínimas de Encounter requerido, política post-finalización,
lifecycle propio, autoría de asistentes, matrícula/firma y semántica de
cantidad quedaron cerradas para el backend 6D.2 y están reflejadas en la
sección de cierre. La implementación backend está **COMPLETADA**. El frontend
6D.3 continúa **PENDIENTE** y cualquier ampliación regulatoria o documental
requiere una decisión posterior.
