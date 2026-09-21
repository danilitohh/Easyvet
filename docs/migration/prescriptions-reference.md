# Referencia legacy de prescripciones / fórmulas médicas

## Alcance y fuente

Esta revisión corresponde a la Fase 6D.1. Se inspeccionó el checkout de
`Lativet-reference` en el commit exacto
`05fea495cb13208b27bf470b3570987fd501a81e` (`05fea49`), en modo lectura y sin
ejecutar el sistema legacy ni conectarse a su base de datos.

La inspección cubrió:

- `Backend/CONSULTORIO/Pacientes/Formulas_medicas/`.
- `Frontend/CONSULTORIO/Pacientes/Formulas_medicas/`.
- La integración compartida de `Consultas`, `Historia_clinica`, `Documentos`,
  `Ventas`, `Inventario`, exportación/PDF, permisos y pruebas.

Lo que sigue describe comportamiento observado en legacy. Las propuestas de
Easyvet están separadas y no constituyen implementación.

## Hallazgo principal: Formula no es una entidad propia en legacy

Lativet no tiene una tabla `prescriptions`, `formulas` ni `prescription_items`.
Una fórmula es una especialización del registro genérico
`clinical_consultations` con:

```text
consultation_type = "Formula"
```

La consulta genérica se expone mediante:

- `POST /api/consultations` para crear o actualizar según la presencia de `id`.
- `GET /api/consultations/:id` para detalle.
- `DELETE /api/consultations/:id` para eliminación física.
- `POST /api/consultations/:consultation_id/formula/pdf` para el PDF específico
  de fórmula.

La ruta específica de fórmulas solo genera el PDF; la escritura usa el flujo
general de consultas. El backend valida que el registro usado por el PDF tenga
`consultation_type == "Formula"`.

## Modelo legacy observado

### Tabla `clinical_consultations`

| Campo                            | Uso observado                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                             | Identificador de la consulta.                                                              |
| `record_id`                      | FK a `clinical_records`; la fórmula aparece dentro de la historia.                         |
| `patient_id`                     | FK a `patients`; se obtiene también desde el record.                                       |
| `owner_id`                       | FK a `owners`; al guardar se toma el Owner actual del Patient.                             |
| `consultation_at`                | Fecha/hora de la consulta; para fórmula se construye desde la fecha civil con `T12:00`.    |
| `consultation_type`              | Tipo genérico; debe ser exactamente `Formula`.                                             |
| `title`                          | Se fija como `Formula medica`.                                                             |
| `summary`                        | Texto estructurado con diagnóstico, preview de medicamentos y observaciones.               |
| `indications`                    | Texto estructurado con preview de medicamentos.                                            |
| `attachments_summary`            | Se limpia al guardar una fórmula desde el formulario.                                      |
| `document_reference`             | JSON con `kind`, diagnóstico, observaciones y array completo de medicamentos.              |
| `referred_to`                    | Campo genérico; el formulario de fórmula limpia el seguimiento.                            |
| `consent_required`, `consent_id` | Campos genéricos de consulta; no se exige consentimiento específico en la ruta de fórmula. |
| `professional_name`              | Nombre profesional obligatorio para guardar la consulta genérica.                          |
| `professional_license`           | Matrícula/licencia obligatoria para guardar la consulta genérica.                          |
| `created_at`, `updated_at`       | Timestamps de persistencia.                                                                |

La tabla tiene FKs separadas a record, patient y owner, pero no tiene un
`organization_id` ni FKs compuestas tenant-safe. Tampoco tiene estado de
prescripción, versión, CAS, `issued_at`, `finalized_at`, `voided_at` o razón de
anulación.

### Campos exactos del medicamento legacy

El frontend normaliza cada fila con esta forma, que después se serializa dentro
del JSON de `document_reference`:

| Campo JSON     | Control visible                     | Comportamiento                                                                 |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `name`         | Nombre                              | Texto; al menos una fila debe tener nombre.                                    |
| `presentation` | Presentación                        | Texto libre.                                                                   |
| `quantity`     | Cantidad                            | Número visible, mínimo 1, paso 1; se normaliza como texto y por defecto `"1"`. |
| `dosage`       | Posología (forma de administración) | Texto libre; acepta `posology` como alias al leer.                             |
| `frequency`    | Frecuencia                          | Texto libre.                                                                   |
| `duration`     | Duración                            | Texto libre.                                                                   |
| `observations` | Observación                         | Texto libre; acepta `notes` como alias al leer.                                |

La UI permite repetir y eliminar filas. Al guardar se eliminan las filas sin
`name`; no hay catálogo de medicamentos, FK de inventario, unidades clínicas,
concentración normalizada, vía separada ni reglas regulatorias de medicamento
controlado.

## Creación, edición y eliminación

El formulario genérico de consultas cambia a modo fórmula cuando el tipo es
`Formula`. Exige:

1. fecha de fórmula;
2. diagnóstico presuntivo y/o final;
3. al menos un medicamento con nombre.

Después construye `summary`, `indications` y `document_reference` a partir de
los mismos datos. La consulta puede editarse mediante el mismo endpoint
genérico y la actualización sobrescribe todos los campos enviados. No se
observó control de versión ni rechazo de una escritura obsoleta: la semántica
es last-write-wins.

La eliminación genérica es física. El flujo elimina la consulta y sus registros
dependientes de peso, recordatorios, seguimientos y solicitudes de firma cuando
corresponde, y registra una auditoría de acción `delete`. No existe una
transición `VOIDED` específica para fórmulas.

## Fecha, historia y relaciones

La pantalla etiqueta la fecha como `Fecha formula`, pero el frontend advierte
que la historia se ordena por la fecha de radicación/registro, no por la fecha
establecida. El backend guarda la fecha como un timestamp local naive con hora
`12:00`; no hay una política tenant-safe de zona horaria equivalente a
Easyvet.

La fórmula aparece como un evento de consulta en la historia clínica del
Patient. El Patient y el Owner se resuelven desde la consulta para mostrar el
PDF. El Owner guardado es el Owner actual del Patient al momento de guardar; no
hay snapshot histórico dedicado.

## PDF, documentos y firma

`generate_formula_pdf` obtiene configuración de clínica, consulta, Patient y
Owner, y llama al generador compartido de PDF. El PDF muestra diagnóstico,
medicamentos, observaciones, identidad profesional y datos del paciente/Owner.
La ruta devuelve el archivo como payload de exportación.

El PDF contiene un bloque visual para profesional, pero la ruta específica de
fórmula no inicia por sí misma un flujo de firma digital. Las capacidades de
documentos, solicitudes de firma y códigos de confirmación viven en módulos
compartidos y no forman parte de una entidad Formula.

## Permisos y aislamiento observados

La autorización legacy clasifica la fórmula mediante el recurso clínico
derivado de la consulta, no mediante un permiso propio. Las acciones relevantes
son:

| Operación     | Endpoint               | Acción legacy                                                  |
| ------------- | ---------------------- | -------------------------------------------------------------- |
| Crear/editar  | `save_consultation`    | `save`, resuelto a `create` o `edit` según exista el registro. |
| Leer          | `get_consultation`     | `view`.                                                        |
| Descargar PDF | `generate_formula_pdf` | `export`.                                                      |
| Eliminar      | `delete_consultation`  | `delete`.                                                      |

Los grants clínicos explícitos permiten trabajar con todos los tipos de
consulta, incluyendo `Formula`; un grant de estado no concede por sí mismo
permiso para cambiar contenido clínico. La autorización no crea un recurso
formula-specific y las tablas legacy no tienen aislamiento por organización en
sus claves foráneas.

## Inventario, ventas y side effects

La revisión no encontró decremento de stock, reserva de inventario, creación de
venta, factura, cobro ni ajuste de caja al guardar una fórmula. La fórmula es un
registro clínico y el PDF es una exportación. Cualquier enlace con catálogo,
inventario o facturación tendría que ser una decisión posterior explícita.

El guardado genérico puede actualizar un registro de peso cuando el payload lo
incluye, pero la fórmula no introduce un side effect de peso propio.

## Pruebas y presentación compartida

Las pruebas legacy observadas cubren, entre otros casos:

- presentación de fórmula dentro de la historia clínica;
- exportación/PDF de fórmula;
- fixtures con `consultation_type = "Formula"` y medicamentos JSON;
- sincronización/renderizado de la lista repetible de medicamentos;
- guardado genérico de consultas de tipo fórmula;
- autorización clínica explícita para todos los tipos de consulta.

La historia usa la presentación común de consultas y etiqueta el tipo como
`Formula medica`. No hay una prueba que garantice una entidad relacional de
items porque tal entidad no existe en legacy.

## Límites de extrapolación

Estos hallazgos no justifican copiar el modelo legacy a Easyvet. En particular,
la ausencia de estado, CAS, tenant compuesto, snapshots y anulación es una
limitación del sistema anterior, no una decisión para el nuevo producto. La
propuesta de Easyvet y las decisiones que aún requieren producto están en:

- `docs/architecture/prescriptions-proposal.md`;
- `docs/architecture/prescriptions-decisions.md`.

Esta Fase 6D.1 no modifica Prisma, migraciones, backend, frontend, permisos ni
tests de Easyvet.
