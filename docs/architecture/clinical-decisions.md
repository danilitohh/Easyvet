# Decisiones y preguntas abiertas del dominio clínico

Este documento convierte la lectura de Lativet en decisiones explícitas para
Easyvet. `DECIDIDO` describe una regla de arquitectura propuesta; `POR DECIDIR`
requiere aprobación de producto/legal; `POSTERGADO` queda fuera del núcleo de
Fase 6B.

Para no mezclar hechos y diseño, las conclusiones usan además estas etiquetas:

- **VERIFIED LEGACY BEHAVIOR:** se observó directamente en código, rutas, SQL o
  frontend de Lativet.
- **EASYVET DESIGN RECOMMENDATION:** propuesta tenant-safe derivada del hallazgo.
- **PRODUCT DECISION REQUIRED:** no puede cerrarse solo leyendo el legacy.
- **POSTPONED:** depende de decisiones posteriores y no entra en 6B.

## Decisiones propuestas

| Tema                     | Estado      | Decisión para Easyvet                                                                                                                                                     | Razón/evidencia legacy                                                                                          |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tenant                   | DECIDIDO    | Toda entidad clínica incluye `organizationId`; las relaciones compuestas validan el mismo tenant.                                                                         | Las tablas legacy no tienen tenant y sus UUID no bastan para aislamiento.                                       |
| Identidad del expediente | POR DECIDIR | Base recomendada: un `ClinicalRecord` longitudinal activo por `Organization + Patient`, con encounters ilimitados. Permitir episodios solo si el producto/legal lo exige. | Legacy permite varios `clinical_records` por Patient y lista un bundle completo; no hay unique `patient_id`.    |
| Consulta versus historia | DECIDIDO    | `ClinicalRecord` es contenedor/timeline; `ClinicalEncounter` (UI: Consultation) es un evento. No se duplican formularios.                                                 | Legacy separa `clinical_records` y `clinical_consultations`, pero sincroniza implícitamente una consulta única. |
| Finalización             | DECIDIDO    | Transición explícita `DRAFT -> FINALIZED` con control de versión y actor; no editar finalizados.                                                                          | Legacy bloquea record finalizado, pero usa `finalize` booleano dentro de POST y no versiona.                    |
| Correcciones             | DECIDIDO    | Addendum/evolución append-only con motivo y autor; no reopen general ni hard delete.                                                                                      | Legacy permite `save_evolution` después de finalizar, pero no formaliza el concepto de addendum.                |
| Estado de Consultation   | DECIDIDO    | Encounter tendrá estado propio, aunque legacy no lo tenga. `DRAFT`, `FINALIZED`, `VOIDED`.                                                                                | Sin estado de consulta no hay bloqueo ni concurrencia granular.                                                 |
| Profesional              | DECIDIDO    | Actor vivo = `Membership`; guardar snapshot de nombre/matrícula en cada evidencia.                                                                                        | Legacy solo persiste `professional_name`/`professional_license`.                                                |
| Patient archivado        | DECIDIDO    | Historia existente legible; crear/finalizar nuevos eventos bloqueado por defecto, con excepción administrativa auditable.                                                 | Archive debe preservar historia, no borrar evidencia.                                                           |
| Owner histórico          | DECIDIDO    | Guardar `ownerId` cuando corresponda y snapshots de nombre/contacto/identificación en documentos y actos sensibles.                                                       | Legacy toma el Owner actual al guardar y no garantiza el contexto histórico.                                    |
| Appointment              | DECIDIDO    | Relación opcional; no es entidad clínica. Un futuro servicio puede proyectar controles después del commit.                                                                | Legacy enlaza `source_consultation_id` y sincroniza próximos controles.                                         |
| Vitals/peso              | DECIDIDO    | `VitalMeasurement` temporal; `Patient.currentWeightKg` es proyección, no fuente histórica.                                                                                | Legacy tiene `patient_weight_records`, pero mezcla otros signos en texto.                                       |
| Diagnóstico              | DECIDIDO    | Mantener texto libre y tipo presumptive/differential/definitive al inicio; catálogo posterior.                                                                            | Legacy usa tres textos y payload flexible.                                                                      |
| Adjuntos                 | DECIDIDO    | Metadata + StorageService futuro; no data URLs en la fila clínica.                                                                                                        | Legacy embebe data URLs en `document_reference`.                                                                |
| Firma                    | DECIDIDO    | Versionar documento y firmar hash inmutable; OTP/auditoría son satélites.                                                                                                 | Legacy ya registra hash SHA-256, OTP, IP, UA e identidad.                                                       |
| Auditoría                | DECIDIDO    | Crear evento de auditoría en cada transición y exportación sensible.                                                                                                      | Legacy registra acciones, pero no existe un límite tenant-aware en sus tablas.                                  |

## Permisos propuestos

Los permisos se asignan al `Membership` activo y siempre se evalúan junto al
tenant. No deben derivarse automáticamente de `patients.read`.

| Permiso                                       | Uso                                           |
| --------------------------------------------- | --------------------------------------------- |
| `clinical.records.read`                       | Leer expediente y timeline.                   |
| `clinical.records.create`                     | Abrir expediente/evento.                      |
| `clinical.records.update-draft`               | Cambiar un draft propio o permitido.          |
| `clinical.records.finalize`                   | Finalizar y fijar evidencia.                  |
| `clinical.records.addendum`                   | Añadir evolución/corrección trazable.         |
| `clinical.records.void`                       | Anular draft o corregir duplicado con motivo. |
| `clinical.measurements.read/create`           | Leer/registrar peso y signos.                 |
| `clinical.diagnoses.read/create`              | Consultar/registrar diagnósticos.             |
| `clinical.prescriptions.read/create/finalize` | Fórmulas y sus items.                         |
| `clinical.preventive.read/create`             | Vacunación y desparasitación.                 |
| `clinical.procedures.read/create`             | Procedimientos y cirugía.                     |
| `clinical.diagnostics.read/create/result`     | Solicitudes y resultados.                     |
| `clinical.documents.read/create/export`       | Documentos y exportaciones.                   |
| `clinical.consents.read/create/sign`          | Consentimientos y firma.                      |
| `clinical.followups.read/create/complete`     | Planes, ocurrencias y controles.              |

Matriz inicial sugerida:

| Rol existente         | Lectura clínica                                        | Escritura clínica                                                     | Finalizar/firma                                          |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `OWNER` / `ADMIN`     | Amplia dentro de la organización                       | Según política; no implica conocimiento clínico automático            | Delegable a profesional autorizado; toda acción auditada |
| `VETERINARIAN`        | Sí                                                     | Encounters, diagnósticos, medidas, tratamientos y satélites asignados | Sí, según licencia/estado                                |
| `ASSISTANT`           | Solo si se concede `clinical.records.read`             | Draft y medidas no sensibles; no finaliza por defecto                 | No                                                       |
| `RECEPTION`           | Agenda y datos administrativos; clínica no por defecto | No                                                                    | No                                                       |
| `GROOMER` / `CASHIER` | No clínica                                             | No                                                                    | No                                                       |
| `PLATFORM_ADMIN`      | Sin acceso clínico por defecto                         | No                                                                    | No                                                       |

La matriz no sustituye una política de mínimo privilegio. Se necesitan pruebas
cross-tenant para cada permiso y no debe existir un bypass por rol global.

## Máquinas de estado propuestas

Estas máquinas separan el comportamiento observado de una implementación futura:

| Agregado                 | VERIFIED LEGACY BEHAVIOR                                                                                               | EASYVET DESIGN RECOMMENDATION                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ClinicalRecord/Encounter | Record `draft/finalized`; una historia finalizada bloquea edición; la consulta no tiene estado propio.                 | `DRAFT -> FINALIZED`; `FINALIZED -> ADDENDUM` sin reabrir; `VOIDED` solo con motivo y audit.                                   |
| Hospitalization          | Ambulatorio/hospitalización guarda admisión, seguimiento/kardex y alta dentro de consulta/JSON; kardex tiene autosave. | `PLANNED -> ADMITTED -> IN_CARE -> DISCHARGED` y `CANCELLED`; modelar solo cuando se apruebe el satélite. **POSTPONED.**       |
| DiagnosticOrder          | Laboratorio/imagen se guardan como consulta con estados/resultados en JSON; puede fusionarse una solicitud pendiente.  | `REQUESTED -> IN_PROGRESS -> RESULTED -> REVIEWED` con resultados versionados. **POSTPONED.**                                  |
| Document/Signature       | Documento se genera desde consulta; solicitud de firma `pending/code_sent/signed`, hash y expiración.                  | Documento versionado; firma `PENDING -> CODE_SENT -> SIGNED/EXPIRED/REJECTED`; cambiar contenido invalida hash. **POSTPONED.** |
| FollowUp/Reminder        | Follow-up `pending/completed`; reminder pendiente y job de vencidos.                                                   | Separar plan, ocurrencia y reminder; completar es idempotente y puede proyectar Appointment. **POSTPONED.**                    |

No se propone crear enums de satélites en 6B hasta cerrar los estados y las
políticas de transición con producto.

## PII, seguridad y cumplimiento

La anamnesis, diagnósticos, medicamentos, identificación del propietario,
consentimientos, firmas, IP y documentos constituyen datos sensibles. Por eso:

- los endpoints clínicos no deben devolver campos extra por conveniencia;
- los listados deben aplicar tenant + permiso antes de cargar relaciones;
- exports y descargas deben auditarse y usar URLs de Storage de corta duración;
- no se fija un plazo de retención en código hasta recibir política jurídica por
  país; `retentionUntil` debe ser configurable y auditable;
- una firma requiere hash de la versión exacta, identidad del firmante y
  evidencia verificable; cambiar el documento invalida el hash pendiente;
- se debe documentar cifrado, backup, borrado legal y respuesta a solicitudes
  de acceso antes de producción.

## Decisiones abiertas que bloquean satélites

1. Cardinalidad de `ClinicalRecord` y significado legal de “expediente”.
2. Catálogo y codificación de diagnósticos.
3. Lista mínima de campos y unidades para signos vitales por especie.
4. Reglas de edición/void de fórmula, vacuna, cirugía y resultados.
5. Consentimientos obligatorios por procedimiento y validez de firma electrónica
   en cada país.
6. Estados y reconciliación de laboratorio/imagen asincrónicos.
7. Si una ocurrencia completada de FollowUp aparece como Consultation o como
   evento propio en la timeline.
8. Storage, retención, antivirus, límites de tamaño y redacción de documentos.

## Alcance exacto de una eventual Fase 6B

Si el usuario aprueba la siguiente fase, el alcance propuesto es únicamente:

1. `ClinicalRecord` tenant-safe y endpoints de lectura/creación.
2. `ClinicalEncounter`/Consultation con draft, edición, finalización y
   optimistic concurrency.
3. `ClinicalEvolution`/Addendum append-only.
4. `VitalMeasurement` para peso y signos básicos, incluyendo la proyección de
   peso vigente de Patient.
5. Auditoría y permisos mínimos de esos cuatro agregados.
6. Tests unitarios, de integración, cross-tenant y de archivado.

No incluye aún diagnóstico codificado, prescripciones, vacunas, desparasitación,
procedimientos, hospitalización, documentos, firmas, remisiones, seguimiento,
Storage ni UI clínica completa. Eso requiere fases posteriores.
