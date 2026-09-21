# Propuesta de dominio clínico de Easyvet

**Fase:** 6A — análisis y arquitectura  
**Estado:** propuesta documental; no implementada  
**Dependencias actuales:** `Organization`, `Membership`, `Owner`, `Patient` y
`Appointment` ya existen en Easyvet. Este documento no agrega modelos ni
migraciones.

## Principios

1. La organización es el límite de seguridad. Toda fila clínica debe tener
   `organizationId` y sus referencias a Patient, Owner, Membership y Appointment
   deben validarse con claves compuestas tenant-aware.
2. Un hecho clínico finalizado es evidencia histórica. No se edita ni se borra
   físicamente; las correcciones son addenda/evoluciones trazables.
3. Se separa el evento clínico de sus documentos, recordatorios, archivos y
   side effects. Un PDF o un Appointment no es la fuente de verdad de una
   consulta.
4. El núcleo se mantiene pequeño. Fórmulas, diagnósticos especializados,
   procedimientos y documentos se modelan como satélites, no como campos
   indefinidos en una mega-entidad.
5. La identidad actual de Patient/Owner no reemplaza los snapshots históricos
   necesarios para leer un documento antiguo.

## Núcleo propuesto

| Concepto                                        | Responsabilidad                                                                                               | Cardinalidad propuesta                                                                                     | Estado/nota                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `ClinicalRecord`                                | Contenedor longitudinal tenant-scoped del expediente de un Patient; índice y metadatos de apertura/retención. | **Uno por `Organization + Patient`**, con `UNIQUE(organizationId, patientId)`; lazy al primer uso clínico. | No tiene lifecycle `DRAFT/FINALIZED`; el lifecycle pertenece al encounter. |
| `ClinicalEncounter` (visible como Consultation) | Evento clínico individual: consulta presencial, control, vacunación, fórmula, diagnóstico o procedimiento.    | Muchos por `ClinicalRecord`; puede tener `appointmentId` nullable para walk-in.                            | `DRAFT` → `FINALIZED`; una vez finalizado es inmutable.                    |
| `ClinicalEvolution` / `Addendum`                | Nota append-only que amplía o corrige un encounter/record sin reescribirlo.                                   | Muchos por record; opcionalmente uno por encounter.                                                        | Siempre autor, fecha, motivo y contenido; no “desbloquea” el original.     |
| `VitalMeasurement`                              | Medición temporal estructurada (peso, temperatura, frecuencias, hidratación/condición si aplica).             | Muchos por Patient; opcionalmente enlazados a encounter.                                                   | La última medición puede proyectarse a `Patient.currentWeightKg`.          |
| `Diagnosis`                                     | Hallazgo clínico estructurado, conservando texto libre y tipo (`PRESUMPTIVE`, `DIFFERENTIAL`, `DEFINITIVE`).  | Muchos por encounter; catálogo opcional posterior.                                                         | No convertir el texto legacy en un catálogo obligatorio en 6B.             |
| `ClinicalAuditEvent`                            | Evidencia de creación, edición de draft, finalización, addendum, firma y exportación.                         | Muchos por cada agregado clínico.                                                                          | Puede ser módulo transversal, pero es requisito de seguridad clínica.      |

### ClinicalRecord versus Consultation

El legacy tiene `clinical_records` y `clinical_consultations`: el primero
concentra motivo, examen, diagnósticos y resumen; el segundo representa eventos
tipados y puede contener `document_reference`. La relación correcta para
Easyvet es **contenedor longitudinal versus evento**, no dos copias editables
del mismo formulario.

Se recomienda que el backend escriba primero el encounter y derive un resumen
de record de forma explícita, si el producto requiere un resumen rápido. No se
debe sincronizar de manera implícita “la única consulta hacia todos los campos”
como hace `_sync_single_consultation_record` en el legacy.

El legacy permite múltiples `clinical_records` porque `save_clinical_record`
puede insertar uno nuevo, el esquema no tiene unique por Patient y varios
flujos (consulta clínica, consulta externa, peluquería y formularios) crean un
record draft si no encuentran el “primary record”. El frontend elige el record
con mayor `opened_at`; no hay evidencia de episodios legales separados. Se
clasifica como **artefacto histórico de implementación / NEEDS REVIEW**, no
como requisito de producto. En una migración futura, varios records del mismo
Patient se consolidarían en un `ClinicalRecord` longitudinal; encounters y
evoluciones conservarían su `eventAt` original y una separación legal tendría
que ser una decisión explícita.

### Ciclo de vida y bloqueo

```text
DRAFT --finalize (CAS/version check)--> FINALIZED
FINALIZED --void (reason)-------------> VOIDED
FINALIZED --addendum------------------> FINALIZED + ADDENDUM
```

- Crear y editar draft requiere versión optimista (`version` o `updatedAt` con
  comparación) para no perder cambios concurrentes.
- Finalizar es una transición explícita, idempotente y autorizada; almacena
  `finalizedAt`, `finalizedByMembershipId` y snapshot profesional.
- No se propone “reopen” general. Una excepción administrativa futura debe
  generar un evento de auditoría y no sobrescribir la evidencia original.
- Un draft no tiene delete en 6B; los abandonados se resolverán en una fase de
  retención/limpieza posterior.
- `VOIDED` solo se permite desde `FINALIZED`, conserva el contenido, motivo,
  actor y timestamps. No se reutiliza el encounter; se crea otro si hubo un
  error.

## Mapa de satélites

| Satélite                               | Relación con el núcleo                                  | Propuesta de datos                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Prescription` + `PrescriptionItem`    | Un encounter puede emitir una fórmula.                  | Cantidad, vía, frecuencia, duración, instrucciones y estado; el PDF es una representación. Decidir si se permite editar tras finalizar.            |
| `VaccinationEvent`                     | Encounter tipo vacunación.                              | Vacuna, lote, laboratorio, vía, dosis, vencimiento, fecha, profesional; proyección de estado y recordatorio.                                       |
| `DewormingEvent`                       | Encounter tipo desparasitación.                         | Producto/tipo, dosis, fecha y próxima fecha; proyección de estado.                                                                                 |
| `ProcedureEvent`                       | Encounter de cirugía/procedimiento.                     | Protocolo perioperatorio, anestesia, consentimiento, hallazgos, complicaciones y recuperación.                                                     |
| `Hospitalization`                      | Admisión/estancia/alta asociada a uno o más encounters. | Estado, ingreso, ubicación, responsable, monitorización, tratamiento, dieta, alta; definir si ambulatorio es el mismo agregado.                    |
| `DiagnosticOrder` + `DiagnosticResult` | Solicitud y resultado de laboratorio/imagen.            | Estado, profesional, prueba, specimen/metadata, resultado, interpretación y archivos. El resultado puede llegar después de finalizar la solicitud. |
| `Document` + `DocumentVersion`         | Representación exportable o archivo adjunto.            | Tipo, hash, storage key, mime, tamaño, versión, source encounter; nunca data URL en una fila clínica.                                              |
| `Consent`                              | Consentimiento para acto/procedimiento.                 | Riesgos, beneficios, alternativas, coste, declaración, firmante, encounter y estado.                                                               |
| `SignatureRequest`                     | Flujo de firma y evidencia criptográfica.               | Hash de versión, OTP/estado, identidad, timestamp, IP/UA y evidencia; el documento firmado es inmutable.                                           |
| `Referral`                             | Remisión a especialista/servicio externo.               | Destino, motivo, observaciones, estado y documentos.                                                                                               |
| `FollowUp` + `Reminder`                | Plan y ejecución de controles.                          | Programa, ocurrencia, contacto, resultado, próxima fecha y estado; no es sinónimo de Consultation.                                                 |

Vacunación, desparasitación, seguimiento y control pueden mostrarse como
secciones del mismo encounter, pero cada uno debe tener un contrato de datos
claro. No se propone una tabla placeholder ni un JSON sin esquema como modelo
definitivo.

## Tabla de decisión de entidades

| Concepto                         | Legacy real                                          | Nueva entidad | Embebido | Postergado | Razón                                                               |
| -------------------------------- | ---------------------------------------------------- | ------------- | -------- | ---------- | ------------------------------------------------------------------- |
| ClinicalRecord                   | `clinical_records`                                   | Sí, núcleo    | No       | No         | Contenedor longitudinal, retención y timeline.                      |
| Consultation / ClinicalEncounter | `clinical_consultations`                             | Sí, núcleo    | No       | No         | Evento clínico individual y vínculo opcional a Appointment.         |
| Evolution / Addendum             | `clinical_evolutions`                                | Sí, núcleo    | No       | No         | Corrección/seguimiento append-only posterior a finalización.        |
| VitalMeasurement                 | `patient_weight_records` + vitals en texto           | Sí, mínimo    | No       | No         | Preserva series temporales y proyecta peso actual.                  |
| Diagnosis                        | Tres campos de texto en record; texto en consultas   | Recomendado   | No       | Sí         | Separar tipos sin obligar catálogo antes de tiempo.                 |
| Prescription                     | Lista JSON de fórmula                                | Sí, satélite  | No       | Sí         | Dosis/frecuencia/curso necesitan validación e historial.            |
| PrescriptionItem                 | Elementos de la lista JSON                           | Sí, satélite  | No       | Sí         | Evita mezclar receta con venta/inventario.                          |
| Vaccination                      | Tipo de consulta + estado string en Patient          | Sí, satélite  | No       | Sí         | Lotes, vencimiento y próximas dosis requieren historia propia.      |
| Deworming                        | Tipo de consulta + estado string en Patient          | Sí, satélite  | No       | Sí         | Producto, dosis, vía y próximas fechas deben ser trazables.         |
| Procedure                        | Consulta `Cirugia / procedimiento` + JSON            | Sí, satélite  | No       | Sí         | Protocolos y consentimiento tienen invariantes propias.             |
| Hospitalization                  | Consulta `Ambulatorio/Hospitalizacion` + JSON/kardex | Sí, satélite  | No       | Sí         | Ingreso, estancia, alta y observaciones necesitan ciclo de vida.    |
| DiagnosticOrder                  | Consulta `Examen de laboratorio/Imagen diagnostica`  | Sí, satélite  | No       | Sí         | Solicitud y estado se separan del resultado.                        |
| DiagnosticResult                 | Items/adjuntos dentro de `document_reference`        | Sí, satélite  | No       | Sí         | Resultados asincrónicos y archivos versionados.                     |
| Document                         | Consulta `Documento` y exportadores                  | Sí, satélite  | No       | Sí         | Metadata/version/hash separada de Storage.                          |
| Consent                          | Tabla `consents`                                     | Sí, satélite  | No       | Sí         | Consentimiento puede ser independiente y ligado a record/encounter. |
| Referral                         | Consulta `Remision` + JSON                           | Sí, satélite  | No       | Sí         | Destino, motivo, profesional y resultado externo.                   |
| FollowUp                         | `clinical_followups` + reminder                      | Sí, satélite  | No       | Sí         | Programa/ocurrencia no es equivalente a encounter.                  |

La columna “Nueva entidad” es una decisión de arquitectura, no una orden de
implementar todos los renglones en 6B.

## Profesional y snapshots

El actor debe ser `Membership` (que ya une User y Organization), con
`professionalUserId`/`professionalMembershipId` cuando el usuario exista. En
cada record, encounter, evolución, documento firmado y resultado se conserva
además:

- `professionalNameSnapshot`;
- `professionalLicenseSnapshot` (si aplica a la jurisdicción);
- `authoredAt` y `authoredByMembershipId`.

La relación viva permite permisos y revocación; el snapshot permite leer la
evidencia si la persona cambia de nombre, rol o deja la organización.

El schema actual aún no ofrece `displayName` ni matrícula profesional para
Membership/User. Esto es un bloqueo de diseño para finalizar clínica. La
solución recomendada es un perfil profesional 1:1 de Membership, separado del
rol organizacional, con nivel clínico explícito; queda fuera de la implementación
de este gate.

## Patient, Owner y Appointment

- **Patient:** un archivo no cambia de Patient por un cambio de propietario.
  El encounter guarda `patientId` y, cuando la política lo requiera,
  `ownerIdAtTime` como relación histórica. Patient archivado conserva lectura de
  historia, pero 6B rechaza nuevos eventos y finalizaciones.
- **Owner:** `patients.read` no implica `clinicalRecords.read`. La información
  de contacto e identificación del propietario y la firma tienen controles más
  estrictos.
- **Appointment:** puede enlazarse opcionalmente desde un encounter (`appointmentId`)
  y debe conservar la separación entre reserva operativa y evidencia clínica.
  La creación de una consulta no debe crear automáticamente una cita salvo que
  un servicio futuro de controles lo decida después de commit. La sincronización
  con Agenda/Google queda fuera de 6A.

Lativet es single-clinic y no aporta una entidad comparable a `ClinicLocation`.
En Easyvet sí existe ese agregado tenant-scoped. La propuesta es capturar
`clinicLocationId` en el encounter cuando el evento ocurre en una sede,
mantenerlo como referencia histórica para procedimiento, hospitalización y
diagnóstico, y permitir `null` solo si el producto acepta atención fuera de
sede. No se debe inferir la sede desde Appointment cuando el evento fue un
walk-in.

## Decisión sobre entidades core

### En 6B (candidato mínimo)

1. `ClinicalRecord` con tenant, Patient, apertura, timestamps y auditoría
   básica; sin estado clínico propio.
2. `ClinicalEncounter`/`Consultation` con tenant, Patient, record, Appointment
   opcional, tipo revisable, título/resumen, estado, timestamps, profesional y
   snapshots.
3. `ClinicalEvolution`/`Addendum` append-only, con vínculo obligatorio al
   `ClinicalRecord` y vínculo opcional a un `ClinicalEncounter` cuando se quiera
   contextualizar la nota.
4. `VitalMeasurement` mínimo para peso y signos vitales usados por la primera
   consulta.
5. Infraestructura de `ClinicalAuditEvent` o integración con el audit log
   transversal antes de permitir finalización clínica.

### Después del núcleo

`Diagnosis`, `Prescription`, `VaccinationEvent`, `DewormingEvent`,
`ProcedureEvent`, `Hospitalization`, `DiagnosticOrder/Result`, `Document`,
`Consent`, `SignatureRequest`, `Referral`, `FollowUp` y `Reminder` se implementan
por workflows, con sus propios tests y permisos. No se deben crear todos en una
única migración de 6B.

## Decisiones de producto aún requeridas

1. ¿Un Patient tiene un único expediente longitudinal por organización o puede
   abrir episodios legales separados?
2. ¿La finalización se aplica a cada encounter, al record completo o a ambos?
3. ¿Qué tipos de encounter son obligatorios para el MVP y cuáles quedan como
   perfiles satélite?
4. ¿Se acepta texto libre de diagnóstico inicialmente o se requiere catálogo y
   codificación?
5. ¿Qué actos requieren consentimiento y firma, quién puede firmar y qué
   jurisdicción/retención aplica?
6. ¿Un seguimiento completado debe proyectarse como consulta visible o como una
   ocurrencia separada con vista de timeline?
7. ¿Qué nivel de detalle de hospitalización, laboratorio e imagen se requiere
   antes de integrar StorageService?
8. ¿Qué datos de Owner deben congelarse en cada documento histórico?
9. ¿Qué roles pueden ver historia sensible y qué acceso tendrá un portal del
   propietario, si se crea?
10. ¿La ficha Patient necesita timeline paginada por fecha/tipo/profesional o
    vistas segmentadas por módulo? Se recomienda evitar un endpoint bootstrap
    gigante: `ClinicalRecord`, encounters, medidas y documentos deben paginarse
    por separado.
11. ¿Qué unidades, campos y rangos de signos vitales se habilitan por especie?
    Solo se deben estructurar los observados (peso, temperatura, frecuencias,
    mucosas, turgencia, hidratación y condición corporal); el resto puede seguir
    como texto clínico.

## Roadmap posterior

```text
6A análisis (este documento)
  -> decisión de cardinalidad, estados, permisos y retención
6B núcleo: record + encounter + evolution + vitales + auditoría
  -> 6C diagnóstico y prescripción
  -> 6D preventivos, procedimientos y hospitalización
  -> 6E documentos, consentimientos, firmas y StorageService
  -> 6F seguimientos, recordatorios y proyección a Agenda
  -> hardening legal, tenant isolation, exports y migración de datos
```

La siguiente fase autorizada, si se aprueba, debe implementar únicamente el
núcleo acordado y no inferir los satélites pendientes.

## Consultas previsibles y rendimiento

La timeline debe poder filtrar por `patientId`, rango de `eventAt`, tipo,
profesional, estado y texto indexable de título/resumen sin cargar todos los
documentos. La lectura de una ficha debe ser paginada/segmentada y usar
proyecciones de resumen; los PDFs y adjuntos se solicitan aparte. Búsqueda
full-text, analítica y reporting transversal quedan postergados.
