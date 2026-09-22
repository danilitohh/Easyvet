# Decisiones: procedimientos, cirugía y anestesia

Registro de recomendaciones y decisiones de 6F.1. El Design Gate 6F.1.1 está
COMPLETADO. La matriz PS-* que sigue conserva el histórico de preguntas y
propuestas; donde diga “pendiente”, “resolver en gate” o proponga otra opción,
prevalecen las decisiones normativas de la sección final y los contratos
literales [6F.2A](procedures-core-6f2.md) y
[6F.2B](anesthesia-core-6f2.md). Este documento no implementa ni autoriza
cambios funcionales. La fase backend 6F.2A ya está implementada; para su
comportamiento vigente prevalecen el contrato y
[procedures-api.md](procedures-api.md). La anestesia continúa pendiente en 6F.2B.

| ID    | Tema                             | Estado / decisión propuesta                                                                                                                                                                        |
| ----- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PS-01 | Agregados                        | `ClinicalProcedure` + `ClinicalSurgeryDetail` 1:1 opcional + `AnesthesiaRecord` + `AnesthesiaObservation`. Recomendado; ratificar en gate.                                                         |
| PS-02 | Procedure vs Surgery             | No dos raíces; `procedureType=PROCEDURE\|SURGERY`, con extensión quirúrgica. Recomendado.                                                                                                          |
| PS-03 | Encounter                        | Requerido; DRAFT/FINALIZED permite child, VOIDED bloquea escritura. Recomendado, alinear Clinical Core.                                                                                            |
| PS-04 | Cardinalidad                     | Encounter 0..N procedures y anestesias; Anesthesia->Procedure opcional. Resolver si se admite anestesia standalone.                                                                                |
| PS-05 | Lifecycle                        | DRAFT→FINALIZED→VOIDED, no reopen ni hard delete; decidir si Void también aplica a DRAFT. Recomendación: sí, con motivo/audit.                                                                     |
| PS-06 | Tiempo                           | TIMESTAMPTZ UTC para hechos; `nextControlOn` civil sólo si se acuerda; no convertir fecha legacy sin zona. Recomendado.                                                                            |
| PS-07 | Mínimos de finalización          | Nombre, performedAt, Encounter válido, Practitioner responsable/perfil. ¿Indication, técnica, hallazgos, riesgo, consentimiento y campos quirúrgicos obligatorios por tipo? Producto debe definir. |
| PS-08 | Diagnóstico                      | Indication en texto; sin FK/catálogo ahora. Recomendado.                                                                                                                                           |
| PS-09 | Técnica/hallazgos/complicaciones | Texto tipado; “no hubo” debe diferenciarse de omitido. Recomendado; UX define cómo.                                                                                                                |
| PS-10 | Recuperación                     | recoveryStatus/postoperativePlan/recommendations; no follow-up automático. nextControl sólo clínico, no Appointment. Recomendado.                                                                  |
| PS-11 | Anesthesia                       | Agregado aparte. Confirmar si puede ser independiente o siempre debe enlazarse a procedure/surgery. Bloquea cardinalidad y validación.                                                             |
| PS-12 | ASA/urgencia                     | No usar `Emergency` como ASA. Confirmar ASA I–V y campo separado de urgencia.                                                                                                                      |
| PS-13 | Vitals                           | VitalMeasurement general; series intraoperatorias en AnesthesiaObservation con unidades/tiempo. Recomendado.                                                                                       |
| PS-14 | Medicaciones/materiales          | Descripción clínica solamente; no stock/Kardex/Prescription/Billing. Fuera de 6F.2.                                                                                                                |
| PS-15 | Profesional                      | Practitioner activo responsable; snapshots backend. ¿Sólo responsable puede finalizar o delegación autorizada? Recomendado sólo responsable al inicio.                                             |
| PS-16 | Equipo                           | Legacy nombres libres. Propuesta memberships + snapshots/roles quirúrgicos; decidir si fase necesita múltiples participantes o solo responsable/anestesiólogo/auxiliar.                            |
| PS-17 | Clinical Assistant               | Sugerencia: permiso explícito para crear/editar drafts y quizá cargar observación; no finalizar. Role matrix requiere decisión de producto.                                                        |
| PS-18 | Snapshots                        | Patient name, owner histórico del Encounter y Professional al finalizar; licencia nullable. Recomendado.                                                                                           |
| PS-19 | Owner/Patient                    | Patient debe coincidir con Encounter; owner tomado de ownerIdAtTime. ARCHIVED: historial read-only, bloquear actividad nueva; Void correctivo permitido. Recomendado.                              |
| PS-20 | Consent                          | `consentSigned` checkbox no es prueba. Consent formal firmado futuro, ligado a patient/procedure/Encounter; obligatoriedad por tipo y requisitos legales requieren decisión de producto.           |
| PS-21 | Docs/firma/PDF/Storage           | Fuera de 6F.2; diseñar luego referencia durable y autorización.                                                                                                                                    |
| PS-22 | Inventory/Billing                | Sin side effects ni costo/stock automático. Fuera de 6F.2.                                                                                                                                         |
| PS-23 | Void de Procedure/Anesthesia     | Motivo + actor + fecha; preserva evidencia y bloquea más cambios. Recomendado.                                                                                                                     |
| PS-24 | Void de Encounter padre          | Hijos no se borran; parent VOID bloquea writes, historial child sigue visible. Definir advertencia/reason cuando haya child FINALIZED.                                                             |
| PS-25 | Archive Patient                  | Lectura histórica; bloquear create/edit/finalize nueva actividad. Recomendado, salvo Void correctivo.                                                                                              |
| PS-26 | Concurrencia                     | expectedVersion/CAS, transacción atómica, lock order `Encounter -> Patient -> child -> memberships ordenadas`. Recomendado y probar carreras.                                                      |
| PS-27 | Audit                            | Reusar ClinicalAuditEvent; eventos específicos si enum exige; sólo metadatos mínimos sin datos clínicos/PII. Recomendado.                                                                          |
| PS-28 | Permisos                         | Separar `clinicalProcedures.*` y `anesthesiaRecords.*` para read/create/updateDraft/finalize/void. Confirmar matriz rol/Assistant; servidor manda.                                                 |
| PS-29 | Schema                           | Entidades conceptuales; decidir tabla PerioperativeMedication vs items texto por fase. No JSON abierto.                                                                                            |
| PS-30 | Constraints                      | FKs tenant-safe, RESTRICT, unique SurgeryDetail, checks status/tiempo, índices por tenant/paciente/Encounter/instante. Recomendado.                                                                |
| PS-31 | API                              | Rutas por Encounter para create, por ID para operaciones; contratos Zod, allow-list, CAS; no CRUD de finalizados. Recomendado.                                                                     |
| PS-32 | UI                               | Módulos/rutas propios, lista/detalle/draft y operaciones con review/CAS; formularios cirugía y anestesia según decisión de asociación. Recomendado.                                                |
| PS-33 | Legacy import                    | No automático en 6F.2; mapping ambiguo requiere staging/provenance/review. Fuera.                                                                                                                  |
| PS-34 | Retención                        | No reproducir hard-delete legacy. Retención/anonimización necesita política separada. Decisión pendiente.                                                                                          |

## Matriz de migración conceptual

No ejecutar en 6F.2. Valores y reglas siguientes son clasificación documental, no scripts.

| Campo/origen Lativet                                                                                         | Destino conceptual                      | Clasificación          | Regla / riesgo                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consultation_type=Cirugia / procedimiento`                                                                  | `ClinicalProcedure.procedureType`       | TRANSFORMADO           | Variantes de acento/espacios se normalizan a SURGERY sólo tras regla/versionado explícitos; Procedure general sin diccionario necesita revisión.                      |
| `id`                                                                                                         | legacy source reference/idempotency map | DIRECTO condicionado   | UUID legacy text puede no cumplir UUID; no usar como nueva PK sin validar formato/colisión.                                                                           |
| `title`, JSON `name`                                                                                         | `name`                                  | TRANSFORMADO           | Preferencia documentada; si ambos difieren preservar conflicto para revisión.                                                                                         |
| `document_reference.description`, `summary`, `indications`                                                   | description / indication                | AMBIGUO                | Resumen puede mezclar campos repetidos; no concatenar ciegamente ni perder evidencia.                                                                                 |
| `record_id`, `patient_id`                                                                                    | ClinicalRecord/Patient/Encounter        | AMBIGUO                | No existe Encounter ID en `clinical_consultations`. No crear Encounter sintético implícito ni asignar por cercanía temporal sin regla aprobada.                       |
| `owner_id`                                                                                                   | Owner snapshot                          | TRANSFORMADO/AMBIGUO   | Owner debe coincidir con `ClinicalEncounter.ownerIdAtTime`; cambio histórico divergente va a staging/revisión, no se reemplaza por tutor actual.                      |
| `consultation_at` / fecha local UI                                                                           | `performedAt`                           | AMBIGUO                | Falta zona/hora fiable; fecha UI puede guardarse como mediodía local. Sólo transformar con timezone organizacional verificable y decisión de timestamp.               |
| `startTime`, `endTime`                                                                                       | `startedAt`, `endedAt`                  | AMBIGUO                | Parsear sólo formatos válidos; combinar fecha + timezone sólo si se resuelve sin inferencia.                                                                          |
| `professional_name/license`                                                                                  | professional snapshots                  | TRANSFORMADO           | Puede preservarse como legacy snapshot; no asignar una Membership por coincidencia de nombre/licencia sin validación.                                                 |
| `surgicalResponsible`, `anesthesiaResponsible`, `auxiliary`                                                  | participantes/Memberships               | AMBIGUO                | Texto libre; resolver contra personas y roles sólo con match verificable. No fabricar Membership.                                                                     |
| protocolo cirugía `anestheticRisk`, `fastingStatus`, `area`, `side`, `bleeding`, `closure`, `findings`, etc. | SurgeryDetail/Procedure                 | TRANSFORMADO           | Aliases, nulos y duplicados requieren parser por versión; valores fuera de vocabulario quedan como legacy text o revisión, no enum inventado.                         |
| `preoperative/intraoperative/postoperative[]`                                                                | PerioperativeMedication                 | TRANSFORMADO           | Campos libres; preservar strings; sin resolver producto ni generar consumo.                                                                                           |
| `consent_required`, `consent_id`                                                                             | relación futura Consent                 | AMBIGUO                | Validar Patient, consulta y evidencia de firma. Sólo vincular IDs verificados.                                                                                        |
| `consentSigned`                                                                                              | Consent firmado                         | DESCARTADO COMO PRUEBA | Checkbox aislado no demuestra firma/identidad. Se puede retener valor raw con provenance sólo en archivo histórico autorizado.                                        |
| Consent fields/signature                                                                                     | futuro Consent/Document                 | TRANSFORMADO/AMBIGUO   | Preservar metadata si su cadena de custodia es clara; no convertir texto/dibujo en firma válida sin política y archivos originales.                                   |
| attachments/document_reference                                                                               | Document/Storage                        | AMBIGUO                | No mover binarios por Fase 6F.1/6F.2; refs caducadas/duplicadas no son documento durable garantizado.                                                                 |
| `status` del protocolo                                                                                       | ClinicalProcedure.status                | DESCARTADO COMO ESTADO | No correlaciona de modo fiable con DRAFT/FINALIZED/VOIDED. Puede mapearse sólo como atributo histórico descriptivo, nunca como lifecycle autoritativo.                |
| `complications`, `observations`, `recoveryStatus`                                                            | campos clínicos tipados                 | TRANSFORMADO           | Revisar prioridad entre campo JSON y root/summary; “sin complicación” debe distinguirse de falta de dato.                                                             |
| anestesia `procedureId`                                                                                      | AnesthesiaRecord link                   | AMBIGUO                | Resolver a consulta del mismo Patient/Record y convertirse sólo si destino Procedure está mapeado sin duda. Huérfanos se reportan.                                    |
| `asa`, timestamps, medications, airway, fluids                                                               | AnesthesiaRecord                        | TRANSFORMADO/AMBIGUO   | `Emergency` no es ASA; medicaciones son narrativa; formato de timestamp/units requiere validación.                                                                    |
| anesthesia `monitoring[]`                                                                                    | AnesthesiaObservation                   | AMBIGUO                | Tiempo relativo/HH:mm/string sin timezone/unidades completas; crear readings sólo si instante/unidades son deducibles y validados. No completar intervalos faltantes. |
| `record_id` appointments/source consultation                                                                 | Appointment                             | AMBIGUO                | Referencia de control/seguimiento no prueba que la cita sea la cirugía. No crear Appointment desde protocolo.                                                         |
| filas borradas legacy/audit inexistente                                                                      | Void/audit                              | DESCARTADO             | No hay historia borrada recuperable ni actor/razón de transiciones físicas. No inventar audit.                                                                        |

## Decisiones normativas cerradas por 6F.1.1

| Tema                         | Decisión final                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agregado/kind                | `ClinicalProcedure` único; `ClinicalProcedureKind = PROCEDURE \| SURGERY`.                                                                                                                                      |
| Surgery detail               | Relación 1:0..1; solo `SURGERY`; lista exacta y mutación anidada están en contrato 6F.2A.                                                                                                                       |
| Encounter/cardinalidad       | Encounter obligatorio, estados elegibles DRAFT/FINALIZED; 0..N Procedures; VOIDED bloquea escrituras Draft.                                                                                                     |
| Lifecycle/delete             | DRAFT → FINALIZED → VOIDED; no hard delete, DELETE endpoint ni Void Draft.                                                                                                                                      |
| Finalize Procedure           | Solo performedAt, procedureName no vacío, Practitioner responsable y ProfessionalProfile.displayName son mínimos.                                                                                               |
| Campos                       | indication, narrative description, technique específica, findings, nullable complications, recoveryNotes y postoperativePlan semánticamente separado; no nextControlOn ni duplicación diagnóstica.              |
| Tiempo                       | Procedure no tiene startedAt/endedAt; performedAt UTC requerido al finalizar. Anesthesia mantiene su intervalo.                                                                                                 |
| Anesthesia                   | Agregado/lifecycle propio; Encounter/Patient obligatorios; link a Procedure nullable y 0..N en ambos lados.                                                                                                     |
| Anesthesia finalize          | startedAt/endedAt ordenados, Practitioner responsable, perfil/displayName y finalización por el mismo actor; no se exigen ASA ni lecturas.                                                                      |
| Anesthesia data              | medicationsText/fluidsText libres; asaClassification String nullable; no catálogo ni medicamentos estructurados.                                                                                                |
| Equipo                       | Alternativa B: responsable Practitioner por registro; assistantMembershipId opcional solo en SurgeryDetail; no Participant genérico.                                                                            |
| Monitorización               | AnesthesiaObservation tipada, independiente de VitalMeasurement; mutation Draft con CAS sobre version padre, audit y orden observado ASC.                                                                       |
| Parent VOID/Patient archived | No auto-void de evidencia final; reportar estado actual de padres. Los registros DRAFT quedan bloqueados por padre VOID/Patient archived; la historia final permite lectura y void correctivo por Practitioner. |
| Consent/documentos           | No Consent, booleano consentSigned autoritativo, PDF, firma, Storage ni documentos en 6F.2.                                                                                                                     |
| Roles/permisos               | Claves `procedures.*` y `anesthesia.*`; Practitioner todo; Assistant read/create/updateDraft; ninguna herencia de OWNER/ADMIN/Platform Admin.                                                                   |
| CAS/locks/audit              | expectedVersion en mutation; Encounter → Patient → Procedure vinculado → agregado → Owner histórico cuando snapshot → Memberships ordenadas. Reutilizar ClinicalAuditEvent, sin payload clínico.                |
| DB/migración                 | FKs compuestas tenant-safe, RESTRICT, checks de lifecycle/version/tiempo y límites de validación cruzada en servicio bajo parent lock. Sin backfill automático legacy.                                          |
| API/índices/fases            | Contratos, rutas, paginación 20/max100, orden e índices mínimos están definidos literalmente en los dos contratos; 6F.2A y 6F.2B son fases separadas.                                                           |

Temas que sí permanecen futuros son únicamente decisiones regulatorias/producto:
consentimiento obligatorio por tipo, plantillas quirúrgicas, licencias por
jurisdicción, procedimientos históricos externos, ServiceCatalog, inventario,
farmacología anestésica avanzada y dispositivos/integración de monitorización.
Ninguno bloquea el schema de 6F.2.

## Contratos backend aprobados (aún no implementados)

- [6F.2A — ClinicalProcedure + ClinicalSurgeryDetail](procedures-core-6f2.md):
  modelos/enums, migración, permisos, APIs/Zod, transición de kind y SurgeryDetail
  transaccionales, CAS, snapshots, locks, audit, seed y DB tests.
- [6F.2B — AnesthesiaRecord + AnesthesiaObservation](anesthesia-core-6f2.md):
  modelos, relación opcional al Procedure, observaciones con parent CAS,
  migración, permisos, APIs/Zod, snapshots, locks, audit, seed y DB tests.
- Las fases se ejecutan separadamente; el presente checkpoint no inicia 6F.2A.

## Resultado Fase 6F.1

- Procedures/Surgery analysis: **COMPLETADO**.
- Design Gate 6F.1.1: **COMPLETADO**.
- Backend 6F.2: **PENDIENTE**.
- Frontend: **PENDIENTE**.
- Esquema, migraciones, API, permisos y frontend: **sin cambios**.
