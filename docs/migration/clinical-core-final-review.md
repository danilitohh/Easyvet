# Revisión final del Clinical Core — Fase 6C.3

Esta matriz compara comportamiento observado en Lativet con el núcleo cerrado de
Easyvet. La referencia legacy es `05fea495cb13208b27bf470b3570987fd501a81e`
(`05fea49`), revisada desde `docs/migration/clinical-reference.md`.

| Comportamiento legacy                                                           | Easyvet                                                                                                                                     | Estado                      | Decisión                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Historia clínica por Patient, con creación implícita al guardar el primer hecho | Un `ClinicalRecord` único por `Organization + Patient`, creado lazy en la transacción del primer Encounter y protegido por unique compuesto | PRESERVADO                  | La cardinalidad única evita duplicados históricos; la carrera concurrente tiene regresión API/DB                  |
| Draft editable y finalización de historia                                       | `ClinicalEncounter` `DRAFT → FINALIZED` con `expectedVersion`, perfil y snapshots profesionales                                             | REDISEÑADO INTENCIONALMENTE | Se usa una máquina de estados por Encounter para CAS y evidencia granular                                         |
| Correcciones posteriores como evolución                                         | `ClinicalEvolution` append-only, ligada a Encounter finalizado o al Record                                                                  | PRESERVADO                  | No hay PATCH/DELETE ni reapertura                                                                                 |
| Evolución completamente vacía                                                   | Legacy acepta notas narrativas; Easyvet exige al menos un campo con contenido real                                                          | REDISEÑADO INTENCIONALMENTE | Invariante de evidencia mínima, validada en API y frontend                                                        |
| Signos vitales dentro del resumen clínico                                       | `VitalMeasurement` temporal e inmutable, solo en drafts; lectura en finalizados/anulados                                                    | REDISEÑADO INTENCIONALMENTE | Se normaliza para ordenar mediciones y proyectar peso sin mutar evidencia                                         |
| Profesional y matrícula en la consulta                                          | Membership con `ClinicalRole`, perfil opcional y snapshots al finalizar                                                                     | REDISEÑADO INTENCIONALMENTE | El actor finalizador debe ser el Practitioner responsable; matrícula sigue siendo nullable                        |
| Peso actual sincronizado desde la medición más reciente                         | `Patient.currentWeightKg` es proyección de `FINALIZED` no `VOIDED`, ordenada por `measuredAt`, `createdAt`, `id`                            | REDISEÑADO INTENCIONALMENTE | Finalizar/anular recalcula en la misma transacción; no se usa `finalizedAt`                                       |
| Eliminación física de records/consultas                                         | No hay endpoints de hard delete; FKs y auditoría usan `RESTRICT`                                                                            | REDISEÑADO INTENCIONALMENTE | La evidencia finalizada se conserva; política legal de retención queda pendiente                                  |
| Auditoría de acciones clínicas                                                  | `ClinicalAuditEvent` append-only, tenant-safe, con actor, acción y metadata operativa mínima                                                | PRESERVADO                  | No se almacenan textos clínicos ni existe API de modificación                                                     |
| Appointment como origen de la consulta                                          | Relación opcional, validada por tenant, Patient y sede; Agenda no cambia al finalizar/anular                                                | REDISEÑADO INTENCIONALMENTE | Appointment sigue siendo reserva operativa; su estado live se muestra solo como contexto                          |
| Owner tomado del Patient al guardar                                             | `ownerIdAtTime` conserva el Owner histórico y no cambia si el Patient cambia de Owner                                                       | REDISEÑADO INTENCIONALMENTE | La relación histórica se distingue del Patient/Owner actual; snapshots textuales completos quedan para documentos |
| Sede física requerida y reutilizable                                            | `clinicLocationId` obligatorio, FK compuesto; una sede inactiva sigue haciendo legible la historia                                          | PRESERVADO                  | Solo sedes activas se aceptan para alta/edición de drafts                                                         |
| Patient archivado                                                               | Historia legible; no se permiten nuevos Encounter, Evolution ni VitalMeasurement                                                            | REDISEÑADO INTENCIONALMENTE | Actividad nueva exige Patient `ACTIVE`; se mantiene el acceso histórico                                           |
| Timestamps separados de creación                                                | `occurredAt`, `measuredAt` y `createdAt` se conservan como instantes ISO explícitos                                                         | PRESERVADO                  | La UI convierte la fecha civil con `Organization.timezone`; no se inventan límites futuros                        |
| Fechas futuras                                                                  | Lativet no aporta una regla clínica general verificable                                                                                     | PRODUCT DECISION REQUIRED   | Easyvet acepta instantes ISO válidos y deja límites de futuro para una decisión de producto                       |
| Aislamiento por organización                                                    | Todas las lecturas y escrituras clínicas incluyen tenant; FKs compuestos impiden cruces                                                     | REDISEÑADO INTENCIONALMENTE | Cross-tenant responde `404` seguro y no filtra SQL/Prisma                                                         |
| Autosave, documentos, firma, PDFs, follow-ups y recordatorios                   | No implementados en el núcleo                                                                                                               | POSTERGADO                  | Requieren satélites, Storage, política legal y decisiones de producto                                             |

## Hallazgos de cierre

- Se corrigió un bug real: un Vital podía insertarse en un draft de un Patient ya
  archivado. Ahora el servicio exige Patient activo, igual que create/update,
  finalize y evolution.
- No se requirió migración Prisma ni cambio de esquema en 6C.3.
- La auditoría de queries no encontró `findUnique({ id })` clínico sin tenant;
  los accesos usan `organizationId` o claves compuestas.
- Finalización, anulación y actualización de drafts usan compare-and-set por
  `id + organizationId + status + version`; no hay last-write-wins.
- El bundle mantiene las páginas clínicas lazy; el warning del chunk principal
  se conserva como deuda de optimización posterior.

## Limitaciones conocidas

Los satélites (prescripciones, vacunas, desparasitación, procedimientos,
hospitalización, diagnósticos, documentos, consentimientos, firmas, follow-ups,
Storage, PDFs, notificaciones y telemedicina), autosave, rich text, firma
profesional, catálogo diagnóstico y política legal de retención permanecen
POSTERGADOS. No son bugs del Clinical Core.
