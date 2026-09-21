# Referencia legacy de vacunación y desparasitación — Fase 6E.1

## Alcance y fuente

Este documento reconstruye únicamente el comportamiento observable de Lativet
en el commit exacto `05fea495cb13208b27bf470b3570987fd501a81e`. El checkout
`C:\Users\danil\Downloads\Lativet-reference` se inspeccionó en modo lectura;
no se hizo `checkout`, no se ejecutó la aplicación, no se abrió una base y no se
modificó ese repositorio. Para facilitar la búsqueda se creó un archivo temporal
desde `git archive` y se ejecutó un inventario estructural Graphify sobre esa
copia; sus artefactos no pertenecen a Lativet ni a Easyvet.

La evidencia se clasificó como `VERIFICADO LEGACY`. Toda decisión de destino
que no sea una copia literal aparece en la propuesta o en el registro de
decisiones de Easyvet.

## Archivos y puntos de entrada verificados

| Área                        | Archivos del commit legacy                                                                                                                                                                    | Responsabilidad observable                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo y persistencia     | `Backend/BASE_DE_DATOS/contexto.py`, `Backend/BASE_DE_DATOS/database.py`                                                                                                                      | Tipos `Vacunacion` y `Desparasitacion`; tablas `patients`, `clinical_records`, `clinical_consultations`, `control_reminders`, `appointments`. |
| Validación y guardado común | `Backend/CONSULTORIO/Pacientes/Consultas/validacion.py`, `persistencia.py`, `servicios.py`, `rutas.py`                                                                                        | Contrato común, transacción, auditoría, consulta por historia, edición y borrado físico.                                                      |
| Regla de vacunación         | `Backend/CONSULTORIO/Pacientes/Vacunas/reglas.py`, `README.md`                                                                                                                                | Proyección del último resumen a `patients.vaccination_status`.                                                                                |
| Regla de desparasitación    | `Backend/CONSULTORIO/Pacientes/Desparasitaciones/reglas.py`, `README.md`                                                                                                                      | Proyección del último resumen a `patients.deworming_status`.                                                                                  |
| Perfil de Patient           | `Backend/CONSULTORIO/Pacientes/COMPARTIDO/persistencia.py`, `validacion.py`                                                                                                                   | Lectura, edición directa y backfill de los dos strings preventivos.                                                                           |
| Recordatorios y agenda      | `Backend/SEGUIMIENTOS/persistencia.py`, `servicios.py`; `Backend/AGENDA/Agenda_general/servicios.py`, `persistencia.py`                                                                       | Recordatorio de control, email, cita derivada y sincronización Google opcional.                                                               |
| Autorización                | `Backend/ADMINISTRACION/Usuarios/permisos.py`                                                                                                                                                 | Recursos `consultorio:vaccines` y `consultorio:deworming`; mapeo por `consultation_type`.                                                     |
| Frontend                    | `Frontend/CONSULTORIO/Pacientes/Vacunas/Logica/interfaz.js`, `Desparasitaciones/Logica/interfaz.js`, `Consultas/Logica/interfaz.js`, `Consultas/Vistas/vistas.html`, `Frontend/public/app.js` | Formulario, normalización, tabla de historial, dashboard y certificados.                                                                      |
| Pruebas                     | `Backend/Pruebas/test_database.py`, `test_modular_backend.py`, `test_api.py`, `test_web.py`, `test_clinical_exports.py`                                                                       | Recordatorios, side effects, exportaciones, permisos y contratos de consulta.                                                                 |

## Contenedor clínico y relación con Consultation

El modelo legacy no tiene tablas propias para vacunaciones o
desparasitaciones. `clinical_consultations` es el contenedor polimórfico y
requiere:

- `record_id`, `patient_id` y `owner_id` existentes;
- `consultation_at`, `consultation_type`, `title` y `summary` no nulos;
- `professional_name` y `professional_license` no nulos;
- `indications`, `attachments_summary`, `document_reference` y `consent_*`
  opcionales.

`consultation_type` acepta exactamente `Vacunacion` y `Desparasitacion` dentro
del catálogo común de tipos. La ruta genérica es:

- `POST /api/consultations`: crea o actualiza si se envía `id`;
- `GET /api/consultations/<consultation_id>`: detalle;
- `GET /api/consultations/<consultation_id>/assets/<asset_index>`: adjunto;
- `DELETE /api/consultations/<consultation_id>`: eliminación física y limpieza
  de dependientes.

No hay endpoint específico de vacunas o antiparasitarios. El backend no
interpreta columnas normalizadas para sus detalles; el frontend serializa
pares `Etiqueta: valor` en `summary`/`indications` y los vuelve a leer.

Enviar `id` al mismo `POST` permite editar cualquier estado sin una transición
de lifecycle propia; `DELETE /api/consultations/<id>` elimina físicamente la
consulta y sus dependientes. No hay una operación de `VOID` equivalente.

El `ClinicalRecord` padre contiene narrativa general y estado de la historia.
Guardar un preventivo no copia todos sus datos al Record; la sincronización
especial de `Consultas/persistencia.py` solo aplica a una única consulta de
tipo `Consulta`.

## Vacunación: contrato real

### Campos capturados por el frontend

`Frontend/CONSULTORIO/Pacientes/Consultas/Vistas/vistas.html` y
`Consultas/Logica/interfaz.js` capturan:

| Campo de formulario                            | Requerido en UI | Semántica observada                                                                                                 |
| ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `vaccination_date`                             | Sí              | Fecha civil de aplicación; se convierte en `consultation_at = fechaT12:00`.                                         |
| `vaccination_professional`                     | Sí en el flujo  | Selector de usuarios/profesionales; sincroniza `professional_name` y matrícula.                                     |
| `vaccination_status`                           | Sí              | `Aplicada`, `Proxima`, `No aplicada`, `Contraindicada`. Se normaliza en frontend; el backend común no crea un enum. |
| `vaccination_name` / `vaccination_name_custom` | Sí              | Lista de nombres (Rabia, Triple felina, etc.) o nombre libre cuando se elige `__custom__`. Se copia a `title`.      |
| `vaccination_type`                             | No              | Monovalente, bivalente, trivalente, tetravalente, polivalente, combinada u otra.                                    |
| `vaccination_route`                            | No              | Subcutánea, intramuscular, intranasal, oral, intradérmica u otra.                                                   |
| `vaccination_lab`                              | No              | Texto libre con datalist de fabricantes.                                                                            |
| `vaccination_lot`                              | No              | Lote textual.                                                                                                       |
| `vaccination_expiration_date`                  | No              | Fecha de vencimiento civil.                                                                                         |
| `vaccination_dose`                             | No              | Texto libre, por ejemplo `1 ml`.                                                                                    |
| `vaccination_notes`                            | No              | Observaciones de aplicación.                                                                                        |
| `vaccination_requires_followup`                | No              | Activa programación del próximo control/dosis.                                                                      |
| `vaccination_next_date`                        | Condicional     | Fecha estimada de próxima dosis.                                                                                    |
| `vaccination_followup_interval_value/unit`     | Condicional     | Intervalo positivo en `days`, `weeks` o `months`.                                                                   |
| `vaccination_dose_type`                        | No              | `Refuerzo`, `Primovacunacion`, `Revacunacion`, `Dosis unica` u otra.                                                |
| `vaccination_reminder_days`                    | No              | Preferencia visual de recordatorio: 0, 1, 3, 7, 15 o 30 días.                                                       |
| `vaccination_followup_reason`                  | Condicional     | Motivo; la UI lo prellena con tipo de dosis y vacuna.                                                               |

El modo edición vuelve a parsear `summary` e `indications`; no existe una
fuente relacional aparte. El detalle de la tabla muestra fecha, nombre, estado,
laboratorio, lote, observaciones, próxima dosis, adjuntos y usuario.

### Serialización y validación

El frontend genera, entre otros, estos pares:

- `summary`: `Vacuna`, `Estado`, `Tipo de vacuna`, `Via de aplicacion`,
  `Laboratorio`, `Lote`, `Fecha de vencimiento`, `Dosis`, `Observaciones`.
- `indications`: `Proxima vacunacion`, `Intervalo recomendado`, `Tipo de
dosis`, `Recordatorio`, `Seguimiento`.

La fecha es obligatoria y la próxima fecha se calcula desde la fecha de
aplicación cuando no se introduce manualmente. El backend común exige
`record_id`, tipo, título, resumen, profesional y matrícula; valida fechas y
seguimientos genéricos, pero no valida lote, fabricante, vía, dosis o la
coherencia entre estado y próxima dosis.

El `status` de vacunación es una etiqueta clínica de la UI: `Aplicada` indica
que se registró como aplicada, `Proxima` una dosis programada, `No aplicada`
una recomendación aún no aplicada y `Contraindicada` que no debe aplicarse por
condición clínica. No es el lifecycle de la consulta, no cambia el estado de
`clinical_records` y no tiene un enum SQL propio.

`document_reference` queda vacío para una vacunación. Los adjuntos se manejan
por el contenedor común, no por una entidad preventiva.

## Desparasitación: contrato real

El formulario de `Consultas/Vistas/vistas.html` y su lógica específica
capturan:

| Campo                                        | Requerido en UI      | Semántica observada                                                                                                                                    |
| -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `deworming_date`                             | Sí                   | Fecha civil de administración; se convierte en `consultation_at = fechaT12:00`.                                                                        |
| `deworming_last_date`                        | No                   | Fecha previa informada por el usuario. No se usa como FK ni como historial separado.                                                                   |
| `deworming_type`                             | No                   | Valores `Interna`, `Externa`, `Interna y externa`, `Oral`, `Topica`, `Inyectable`. Mezcla modalidad y vía; no hay columna `route` separada verificada. |
| `deworming_product`                          | Sí                   | Producto textual; se copia a `title`.                                                                                                                  |
| `deworming_dose`                             | No                   | Texto libre.                                                                                                                                           |
| `deworming_notes`                            | No                   | Observaciones.                                                                                                                                         |
| `deworming_requires_followup`                | No                   | Activa seguimiento periódico.                                                                                                                          |
| `deworming_followup_interval_value/unit`     | Condicional          | Intervalo positivo en días, semanas o meses.                                                                                                           |
| `deworming_followup_reason`                  | Condicional          | Motivo del seguimiento.                                                                                                                                |
| `professional_name` / `professional_license` | Sí en contrato común | Identidad textual obligatoria para guardar la consulta; no existe selector específico del módulo.                                                      |

La UI exige fecha y producto, genera `summary` con `Tipo`, `Producto`, `Dosis`
y `Observaciones`, e `indications` con `Ultima desparasitacion` y
`Seguimiento`. `document_reference` queda vacío. La identidad profesional
queda en los campos comunes de la consulta; no existe un selector profesional
propio equivalente al de vacunación.

El valor de `deworming_type` es el único dato de modalidad/vía observado. No
debe reinterpretarse como una vía normalizada en Easyvet sin una decisión de
producto.

El modo preventivo oculta los campos clínicos genéricos de peso: no hay un
`weight_kg` propio de vacunación/desparasitación ni un peso dentro de sus
resúmenes. El formulario general mantiene `patient_weight_records` para otros
tipos de consulta; Easyvet debe reutilizar `VitalMeasurement` si se pesa al
Patient, no duplicarlo en estos satélites.

## Efectos laterales sobre Patient

Durante `save_consultation`, antes de insertar/actualizar la consulta, se
construye `patient_profile_updates` y las reglas específicas añaden:

- vacunación: `patients.vaccination_status = "<nombre> · <fecha>"`;
- desparasitación: `patients.deworming_status = "<producto o tipo> · <fecha>"`.

La fecha usa la del formulario y cae a los primeros diez caracteres de
`consultation_at`. La operación actualiza Patient dentro de la misma transacción
que la consulta. No hay una colección histórica en Patient ni snapshots
inmutables de Owner/Patient en la consulta.

En arranque/listado, `_backfill_patient_preventive_care_statuses` ordena por
Patient, `consultation_at DESC` y `updated_at DESC`, toma el primer preventivo
de cada clase y repara el string resumido. Editar o borrar no reconstruye un
agregado normalizado: el backfill puede corregir la proyección en una lectura
posterior. Los campos preventivos también son editables directamente desde el
perfil de Patient, por lo que no son una fuente histórica confiable.

## Recordatorios, disponibilidad y citas derivadas

Si existe `next_control`/`next_control_at`, el backend crea o actualiza un
`control_reminders` único por consulta. El recordatorio conserva fecha,
Patient, Owner, estado `pending/sent`, intentos y errores. El servicio clasifica
el tipo como `vaccination` o `deworming` y puede enviar email al Owner; el
intervalo/reminder-days de la UI no se persiste como una política propia en
`control_reminders`.

El mismo guardado llama a `_sync_next_control_appointment`:

- con próxima fecha crea/actualiza una cita derivada con
  `source_consultation_id`, Patient, Owner, motivo/título y profesional;
- una fecha sin hora se materializa a las 09:00;
- sin próxima fecha elimina la cita derivada y, si aplica, cancela su evento de
  Google Calendar;
- la sincronización externa de Google ocurre fuera de la persistencia clínica
  y puede devolver una advertencia sin deshacer la consulta.

Esta cita de control no es la identidad del preventivo. En Easyvet debe
tratarse como efecto operativo explícito e idempotente, no como FK de inventario
ni como sustituto de `nextDueDate`.

## Profesional, Owner, Patient e inventario

- `clinical_consultations.professional_name` y `professional_license` son
  obligatorios a nivel SQL. El backend acepta texto enviado por el cliente y
  no exige una FK a `staff_users`; el frontend enriquece el texto con el usuario
  activo cuando puede.
- `owner_id` se deriva del Patient/ClinicalRecord al guardar. La consulta
  también conserva `patient_id` y `owner_id`, pero no un snapshot de nombres.
- No se encontró FK de vacuna o desparasitante a inventario, lote de stock,
  compras, dispensación, facturación o ventas. Fabricante y lote de vacuna son
  solo texto clínico.
- La certificación de vacunación es una plantilla frontend (`Constancia de
vacunacion`) que lee la historia; no es una tabla de certificados ni prueba
  de firma regulada.
- No se encontró una plantilla o ruta equivalente dedicada a un certificado de
  desparasitación; no se debe inferir que el dominio lo requiere.

## Permisos y aislamiento observados

`permisos.py` declara `consultorio:vaccines` y `consultorio:deworming`, cada uno
con `view/create/edit/delete/export`, y `clinical_resource()` los resuelve por
`consultation_type`. La ruta HTTP sigue siendo la de consultas; el control se
aplica como recurso clínico derivado. No hay tenant: toda la base es una sola
instalación, los IDs no incluyen `organization_id` y el borrado físico es
posible.

## Pruebas legacy relevantes

- `test_modular_backend.py` verifica que los nombres personalizados y las fechas
  de fallback se proyectan, y que una regla no altera el tipo de consulta
  equivocado.
- `test_database.py` verifica que un `next_control` de vacunación o
  desparasitación crea un recordatorio con el tipo y título correctos, y que el
  backfill repara `deworming_status` desde historia existente.
- `test_api.py`, `test_web.py` y `test_clinical_exports.py` cubren el contenedor
  de consultas, permisos, historial y documentos/constancias.

## Límites y ambigüedades para migración

1. El legacy no define si una dosis `Proxima` es un evento planificado o una
   aplicación histórica; ambos estados viven en el mismo `clinical_consultations`.
2. `deworming_type` mezcla tipo y vía, y no debe mapearse automáticamente a un
   enum de ruta.
3. No hay semántica de unidad para dosis, ni reglas de lote/vencimiento, ni
   validación de fabricante regulado.
4. No hay actor Membership, snapshots ni lifecycle clínico propio para estos
   subtipos.
5. El borrado físico y los strings proyectados no deben copiarse sin una
   decisión explícita de retención y reconstrucción en Easyvet.

## Resolución del Design Gate 6E.1.1

Lo anterior describe **VERIFIED LEGACY BEHAVIOR**. Las siguientes decisiones
son el contrato **NEW EASYVET DESIGN DECISION** y no una afirmación de que el
legacy ya las implemente:

- Vaccination y Deworming siempre requieren ClinicalEncounter; no hay evento
  standalone en el MVP.
- Ambos agregados independientes usan `PreventiveRecordStatus` común:
  `DRAFT`, `FINALIZED`, `VOIDED`. El `status` legacy se rediseña
  intencionalmente; Easyvet no tendrá `applicationStatus` en 6E.2.
- `administeredOn` y `nextDueOn` son fechas civiles. `expiryOn` existe solo en
  Vaccination y es nullable. No se crea Reminder, Appointment, FollowUp ni
  Notification desde `nextDueOn`.
- El laboratorio legacy se nombra `laboratoryName`; la dosis es
  `doseText`; el `deworming_last_date` y el intervalo redundante no se copian.
- No se incorporan proyecciones `vaccinationStatus`/`dewormingStatus` a
  Patient, ni FK a inventario, ni certificados en 6E.2.
- Los estados del Encounter padre, Patient archivado, snapshots, Membership
  responsable/administeredBy, CAS, auditoría y locks siguen el contrato
  literal de `docs/architecture/preventive-care-core-6e2.md`.

Estas decisiones cierran las ambigüedades estructurales para 6E.2. La
importación de registros legacy sin profesional o contexto completo queda
**POSTERGADA** y no se resuelve inventando una Membership.
