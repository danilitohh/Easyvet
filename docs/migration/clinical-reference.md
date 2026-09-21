# Referencia clínica legacy para Fase 6A

## Alcance y método

Esta referencia se construyó leyendo el checkout de Lativet ubicado en
`C:\\Users\\danil\\Downloads\\Lativet-reference`, sin ejecutarlo, sin abrir una
conexión a su base de datos y sin modificarlo. El checkout quedó verificado en
el commit solicitado `05fea495cb13208b27bf470b3570987fd501a81e` (`05fea49`,
`HEAD` detached). El grafo existente se consultó con Graphify en modo lectura;
no se regeneró para no alterar el checkout de referencia.

La fuente de verdad para esta fase son los archivos Python/JavaScript y los
README del checkout, no una suposición sobre la organización de Easyvet.

## Mapa de módulos observado

| Clasificación          | Módulos legacy                                                                                                         | Evidencia y responsabilidad                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Núcleo clínico         | `Backend/CONSULTORIO/Pacientes/Historia_clinica`, `Consultas`, `COMPARTIDO`                                            | `Historia_clinica` valida, persiste, exporta y coordina historia; `Consultas` persiste eventos clínicos; `COMPARTIDO` mantiene perfil clínico y proyecciones de Patient.                             |
| Eventos especializados | `Vacunas`, `Desparasitaciones`, `Cirugias_procedimientos`, `Hospitalizaciones_ambulatorios`, `Control`, `SEGUIMIENTOS` | Los dos primeros son reglas reutilizadas por `Consultas`; cirugía y hospitalización guardan datos dentro de una consulta y ofrecen exportadores; Control/Seguimientos generan y completan controles. |
| Diagnóstico            | `Ayudas_diagnosticas`, `Backend/CONSULTORIO/Examenes`                                                                  | Laboratorio e imagen viven en `clinical_consultations.document_reference`; `Examenes/resumen.py` es un selector de tablero, no una tabla clínica adicional.                                          |
| Documentos y evidencia | `Documentos`, `Formulas_medicas`, `Remisiones`                                                                         | PDFs/DOCX, consentimientos y firma electrónica; fórmula y remisión son documentos/proyecciones de una consulta, no entidades independientes en el esquema legacy.                                    |
| Integración operativa  | `Backend/AGENDA/Agenda_general`                                                                                        | El próximo control de una consulta puede crear, actualizar o eliminar un Appointment enlazado por `source_consultation_id`; también existe sincronización opcional con Google.                       |

Los README de cada módulo confirman la separación entre rutas, servicios,
persistencia y validación. No hay una frontera organizativa equivalente en el
modelo de datos legacy: todas las tablas clínicas carecen de `organization_id`.

## Rutas HTTP legacy verificadas

Estas son rutas observadas en `rutas.py`; se listan para entender capacidades,
no para portarlas literalmente:

| Módulo          | Rutas principales                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historia        | `POST /api/patients/<patient_id>/clinical-history/pdf`, `POST /api/records`, `DELETE /api/records/<record_id>`, `POST /api/records/<record_id>/delete`, `POST /api/evolutions`. |
| Consultas       | `POST /api/consultations`, `GET /api/consultations/<id>`, `GET /api/consultations/<id>/assets/<asset_index>`, `DELETE /api/consultations/<id>`.                                 |
| Documentos      | `/firmar/<token>`, `/api/consultations/<id>/document/pdf`, `/docx`, `/api/signature-requests/<token>`, `/send-code`, `/sign`, `POST /api/consents`.                             |
| Fórmulas        | `POST /api/consultations/<id>/formula/pdf`.                                                                                                                                     |
| Hospitalización | `POST /api/consultations/<id>/kardex/pdf`.                                                                                                                                      |
| Cirugía         | `POST /api/patients/<patient_id>/anesthesia-record/pdf`, `POST /api/patients/<patient_id>/surgical-report/pdf`.                                                                 |
| Remisión        | POST de exportación de remisión PDF.                                                                                                                                            |
| Seguimiento     | `POST /api/clinical-followups/<id>/complete`, `GET /api/jobs/control-reminders`.                                                                                                |

`CONSULTORIO/Examenes` no registra una ruta propia: selecciona consultas de
laboratorio, imagen y remisión para el dashboard.

## Entidades y campos observados

### `clinical_records` (historia)

`Backend/CONSULTORIO/Pacientes/Historia_clinica/validacion.py` acepta identidad
de Patient/Owner, apertura, área y motivo, anamnesis, notas, signos vitales
(temperatura, frecuencia cardiaca/respiratoria y peso), condición corporal,
hidratación, examen físico, diagnósticos presuntivo/diferencial/definitivo,
plan de procedimientos, medicación, solicitudes de laboratorio, pronóstico,
recomendaciones, adjuntos y consentimiento. El profesional y su matrícula son
obligatorios.

`persistencia.py` guarda un resumen estructurado más `payload_json`, con estado
`draft` o `finalized`, `finalized_at`, auditoría y retención. No existe una
restricción única por Patient: el historial puede listar varios records para el
mismo paciente.

### `clinical_consultations` (consulta/evento)

`Consultas/validacion.py` exige `record_id`, fecha, tipo, título, resumen y
profesional; admite indicaciones, próximo control, programación de seguimiento,
adjuntos, referencia documental, remisión y consentimiento. La tabla también
repite Patient/Owner y conserva una instantánea textual del profesional.

La allowlist legacy (`Backend/BASE_DE_DATOS/contexto.py`) contiene: `Consulta`,
`Vacunacion`, `Formula`, `Desparasitacion`, `Ambulatorio`, `Hospitalizacion`,
`Cirugia / procedimiento`, `Registro anestesico`, `Examen de laboratorio`,
`Imagen diagnostica`, `Control fotografico`, `Seguimiento`, `Documento` y
`Remision`. Es evidencia de tipos usados, no una recomendación de copiar el
enum sin decisión de producto.

### Evoluciones y estado

`save_clinical_record(payload, finalize=False)` crea un draft, permite actualizar
un draft y, al recibir `finalize=True`, marca el record como finalizado. Un
record finalizado no puede editarse por esa ruta. No hay endpoint separado de
finalización ni control explícito de versión. `save_evolution` siempre inserta
en `clinical_evolutions` con subjetivo, objetivo, valoración, plan y autor; por
tanto el legacy permite anexar una evolución después de finalizar la historia.

La semántica que se conserva para Easyvet es: el dato firmado no se reescribe;
una corrección posterior debe ser un addendum/evolución con autor, fecha y
motivo.

### Peso, signos vitales y Patient

`Consultas/persistencia.py` guarda `patient_weight_records` por consulta,
con fecha, profesional y fuente. Si existe un peso inicial distinto, crea un
baseline y luego sincroniza el peso vigente de Patient con el registro más
reciente. Los signos vitales del formulario se mezclan en el resumen de
Historia, no tienen una tabla temporal propia.

Las reglas de `Vacunas/reglas.py` y `Desparasitaciones/reglas.py` actualizan
`Patient.vaccination_status` y `Patient.deworming_status` como cadenas
`producto · fecha`; no hay tablas históricas dedicadas.

### Seguimientos, controles y Appointment

`Control/persistencia.py` y `SEGUIMIENTOS/persistencia.py` crean
`control_reminders` y `clinical_followups`. El seguimiento admite intervalos de
días/semanas/meses, genera como máximo 120 ocurrencias y tiene estado
`pending/completed`. Completar exige contacto, evolución y resultado; puede
crear la próxima ocurrencia y materializa un `clinical_consultations` sintético
de tipo `Seguimiento` (`followup-result-<id>`).

`Agenda_general/servicios.py` deriva la cita del próximo control, la enlaza con
`source_consultation_id` y conserva citas terminales. Esta integración es un
side effect de la consulta, no una identidad clínica.

### Prescripciones, diagnósticos y procedimientos

- **Fórmula:** el modo `formula` envía diagnóstico, lista de medicamentos y
  observaciones; los items que consume el exportador contienen nombre,
  presentación, cantidad, dosis/indicaciones, frecuencia, duración y
  observaciones. `Formulas_medicas` genera PDF con Patient, Owner, profesional,
  matrícula y espacios de firma. No existe tabla `prescriptions`/
  `prescription_items`, ni enlace automático al catálogo de inventario o a una
  venta.
- **Laboratorio e imagen:** los modos `laboratory` e `imaging` guardan solicitud,
  resultados/estado, profesional y adjuntos en `document_reference` JSON. La
  lógica puede fusionar solicitudes de laboratorio pendientes con la misma
  firma.
- **Procedimiento/cirugía:** el modo `procedure` guarda en una consulta el
  protocolo perioperatorio (consentimiento, ASA/riesgo, ayuno, responsables,
  área/lado, inicio/fin, hallazgos, sangrado, cierre, recuperación,
  comunicación y recomendaciones); solo hay exportadores de informe y
  anestesia.
- **Hospitalización/ambulatorio:** `document_reference` de tipo `hospamb`
  contiene ingreso, ubicación, turno, diagnóstico, tratamiento, medicación,
  monitorización, dieta y alta; el kardex resuelve una consulta padre.

El plan clínico y las recomendaciones son texto estructurado en `indications`
(`Interpretacion`, `Plan terapeutico`, `Plan diagnostico`, `Examenes
recomendados`, `Seguimiento`). La fórmula es un acto distinto con items y PDF;
no debe confundirse tratamiento narrativo con prescripción dispensable.

### Preventivos: campos reales

- **Vacunación:** el frontend captura fecha, estado, nombre/tipo de vacuna,
  vía, laboratorio/fabricante, lote, vencimiento, dosis y notas; exige
  profesional y permite próxima dosis/programación. El backend legacy persiste
  el evento como `consultation_type = Vacunacion` y solo proyecta
  `vaccination_status = "nombre · fecha"` en Patient.
- **Desparasitación:** captura fecha, fecha previa opcional, tipo/producto,
  dosis, observaciones y próxima fecha/programación; el backend persiste una
  consulta `Desparasitacion` y proyecta
  `deworming_status = "producto · fecha"`. La vía no tiene una columna propia
  verificada; no debe inventarse como enum Easyvet.

En ambos casos el record clínico es la evidencia; el string en Patient es solo
un resumen actual y puede quedar obsoleto si se edita sin evento histórico.

Además, `Consultas/persistencia.py` acepta explícitamente proyecciones de
perfil: `microchip`, `allergies`, `chronic_conditions`,
`reproductive_status` y `notes`. Se actualizan dentro de la misma transacción
que la consulta. No son “campos clínicos históricos” de la consulta y Easyvet
debe decidir si siguen siendo ediciones de Patient, snapshots del encounter o
ambas cosas.

### Documentos, consentimientos y firmas

`Documentos/validacion.py` y `persistencia.py` guardan consentimientos con
procedimiento, riesgos, beneficios, alternativas, coste, declaración y
identificación del propietario, firma del propietario y profesional, fecha y
referencias a record/consulta. Las solicitudes de firma usan hash SHA-256 del
contenido, OTP por correo con caducidad de 15 minutos, máximo cinco intentos,
estado `pending/code_sent/signed`, IP, user-agent, identidad del firmante y
evidencia de confirmación. La firma se añade al JSON de referencia documental.

Los adjuntos legacy se transportan como data URLs dentro de JSON. Para Easyvet
se debe conservar la evidencia, pero mediante un StorageService y metadatos,
no como blobs inline en cada consulta.

### Frontend y UX observados

`Frontend/CONSULTORIO/Pacientes/Consultas/Logica/interfaz.js` ofrece un modal
por perfil: consulta clínica, orden/documento, laboratorio, imagen, remisión,
seguimiento, control fotográfico, ambulatorio/hospitalización, procedimiento,
fórmula, desparasitación y vacunación. La consulta estándar presenta subjetivo,
objetivo, examen general/especial, interpretación, plan terapéutico, plan
diagnóstico, exámenes recomendados, próximo control, adjuntos y programación de
seguimiento. Guardar crea primero un record draft si no existe y luego guarda
la consulta; editar consulta es una operación explícita.

`Historia_clinica/Logica/interfaz.js` impide sincronizar el resumen local cuando
el record está `finalized` y agrega evoluciones en la timeline. El formulario de
Historia tiene botón “Guardar historia clínica” y el bundle público también
expone la acción explícita de finalizar; no se encontró autosave de la consulta
clínica. Sí existe autosave específico para tarjetas de kardex de
hospitalización (`Hospitalizaciones_ambulatorios/Logica/interfaz.js`), una
conducta que no debe generalizarse sin requisitos de concurrencia.

La UI refresca Patient, pesos, records, consultas y follow-ups después de
guardar; muestra avisos cuando se programa recordatorio o se crea/elimina una
cita de control. El estado `finalizado` de algunos dashboards diagnósticos no
es el mismo que `clinical_records.status`.

### Remisiones y controles fotográficos

`Remisiones` usa una consulta de tipo `Remision` con destino, motivo y
observaciones y exporta el documento. `Control fotografico` requiere adjuntos y
descripciones; ambos son perfiles de evento, no entidades clínicas core.

## Exportaciones y timestamps

Los exportadores observados son: historia clínica del Patient (incluye records,
consultas y evoluciones), documento clínico en PDF/DOCX, fórmula médica PDF,
remisión PDF, kardex de hospitalización, informe quirúrgico, registro anestésico,
consentimiento y certificados/plantillas documentales (incluida vacunación,
resumen, alta y remisión). Sus fuentes son el bundle clínico y/o
`document_reference`; el nombre de archivo se deriva del Patient, tipo y un
fragmento del id. La versión firmada debe ser reproducible por hash, no
regenerarse desde un draft mutado.

El legacy distingue `opened_at`, `consultation_at`, `evolution_at`, `created_at`,
`updated_at`, `finalized_at`, `signed_at` y `scheduled_for`/`completed_at` en
seguimientos. Easyvet debe conservar esas semánticas y no colapsarlas en un
único timestamp.

No se encontró catálogo clínico compartido para prescripciones: los items de
fórmula (nombre, presentación, cantidad, dosis, frecuencia, duración y
observaciones) son JSON y no se descuentan automáticamente del inventario.
Vincular Prescription con ventas/inventario requiere una decisión posterior.

## Flujo legacy sintetizado

```text
Patient -> clinical_record (draft)
             -> clinical_consultation (tipo + resumen + document_reference)
             -> finalize record
             -> weight/projection, preventive status, followups/reminders
             -> optional control Appointment + PDFs/signature/consent
             -> followup completion -> synthetic Seguimiento consultation
```

## Riesgos y límites de la referencia

1. No existe aislamiento multi-tenant: el esquema no contiene organización y
   las consultas se identifican por UUID sin una condición tenant-aware.
2. Record y consulta pueden eliminarse físicamente; el servicio de Historia
   además borra cascadas y trata de sincronizar citas. Easyvet no debe replicar
   esa eliminación para datos finalizados.
3. La finalización usa un booleano en un POST y las consultas no tienen estado
   o versión propios. Esto no es suficiente para concurrencia ni auditoría
   legal.
4. El propietario se obtiene del Patient actual al guardar; no queda garantizada
   una instantánea histórica completa. El profesional se guarda como texto.
5. `document_reference` y `payload_json` son flexibles y útiles para descubrir
   el producto, pero no deben convertirse automáticamente en el contrato de
   dominio de Easyvet.
6. La retención, la firma y los permisos clínicos dependen de jurisdicción y
   requieren validación legal/producto antes de una implementación.

## Autorización, informes y configuración legacy

`Backend/ADMINISTRACION/Usuarios/permisos.py` separa recursos como Historia,
Consultas, Vacunas, Fórmulas, Desparasitaciones, Hospitalización,
Procedimientos, Diagnósticos, Documentos, Remisiones, Consentimientos y
Recordatorios. `save_record` tiene una capacidad de `finalize` distinta de
`save_evolution`; el filtrado del bootstrap oculta consultas según el recurso
clínico. Esto respalda permisos Easyvet separados en vez de heredar acceso de
Patient.

`Backend/INFORMES/Clinicos` agrega conteos y consultas por tipo; no introduce
otra fuente de datos clínica. `Backend/ADMINISTRACION/Configuracion/compliance.py`
expone reglas configurables de consentimiento para intervenciones, procedimientos
y hospitalización, pero no debe convertirse en una retención legal fija para
Easyvet.

## Clasificación para migración

| Destino en Easyvet                                                                                  | Tratamiento propuesto                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ClinicalRecord, ClinicalEncounter/Consultation, Evolution/Addendum, VitalMeasurement                | Núcleo candidato de la siguiente fase, con tenant y auditoría.                             |
| Diagnosis, Prescription, Vaccination, Deworming, Procedure, Hospitalization, DiagnosticOrder/Result | Satélites, modelar después de decidir el núcleo y las reglas de cada workflow.             |
| Document, Consent, SignatureRequest, Referral, FollowUp/Reminder                                    | Satélites transaccionales y de evidencia; requieren Storage/Notificaciones.                |
| `payload_json`, IDs sintéticos, Google sync, formatos data URL                                      | Detalles de compatibilidad legacy; no son entidades nuevas ni deben copiarse sin decisión. |
