# Revisión final del legado — Diagnostics / Exámenes 6H

## Evidencia legacy

Revisión de solo lectura del checkout Lativet en el commit
`05fea495cb13208b27bf470b3570987fd501a81e`.

- `Backend/CONSULTORIO/Examenes/resumen.py`: `select_orders` solo selecciona
  consultas con tipo “Examen de laboratorio”, “Imagen diagnostica” o
  “Remision” y limita el dashboard a doce elementos. No modela por sí mismo un
  ciclo de estados/resultados.
- `Backend/CONSULTORIO/Pacientes/Ayudas_diagnosticas/persistencia.py`: las
  ayudas diagnósticas buscan y comparan firmas de laboratorio sobre
  `clinical_consultations`; interpretan elementos `document_reference` y
  estados libres “reportado/reported”. Una consolidación de coincidencias
  elimina físicamente consultas duplicadas de la misma firma.
- `Backend/CONSULTORIO/Pacientes/Consultas/persistencia.py` y
  `Backend/BASE_DE_DATOS/database.py`: la unidad persistida es una consulta
  genérica, con tipo libre y `document_reference` TEXT; no hay FKs compuestas
  dedicadas para orden, Encounter, Patient o actores clínicos.
- Tests legacy en `Backend/Pruebas/test_database.py`, `test_web.py` y
  `test_modular_backend.py` comprueban la persistencia flexible, estado
  reportado y selección del dashboard; no establecen un lifecycle relacional
  tenant-safe equivalente al nuevo agregado.
- El legacy también reutiliza `document_reference` para referencias y exports
  documentales. La representación permite compatibilidad visual, pero no es
  una base adecuada para resultados estructurados sin introducir el alcance de
  Documents/Storage.

## Mapeo de decisión

| Legacy                                            | Easyvet 6H                                                                                        | Decisión                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Exámenes como selector/dashboard                  | Historial clínico paginado por Patient + sección en Encounter                                     | Se preserva el punto de lectura, con rutas y permisos propios                                          |
| Tipos laboratorio/imagen/remisión                 | `DiagnosticCategory` LABORATORY/IMAGING/PATHOLOGY/OTHER                                           | Se modelan cuatro categorías cerradas; remisión queda en OTHER y patologías tienen categoría explícita |
| Consulta genérica como solicitud                  | `DiagnosticOrder` relacional y ligado a `ClinicalEncounter`                                       | Se reemplaza el registro libre por aggregate clínico con FKs tenant-safe                               |
| `document_reference` con items y estados libres   | `resultText` + `interpretation`                                                                   | Se postergan archivos, PDF, export, DICOM e integración; no se migra JSON opaco                        |
| Deduplicación con DELETE por firma de laboratorio | Multiplicidad `0..N`, sin unicidad artificial por nombre/categoría/fecha; void preserva evidencia | No se borran registros al corregirlos                                                                  |
| Edición de consulta compartida                    | DRAFT → REQUESTED → RESULTED/VOIDED, CAS                                                          | Solicitud emitida y resultado pasan a ser evidencia inmutable                                          |
| Historial por Patient                             | Lista por Patient y detalle contextual del Encounter con snapshots                                | Se conserva la lectura, reforzando aislamiento, audit y contexto histórico                             |

## Límite deliberado

No se implementó la carga de archivos ni se reinterpretaron `document_reference`
legacy. No se importó el historial antiguo ni se cambió Lativet. La migración
`20260922130000_add_diagnostic_orders` añade solo el nuevo agregado y enums a
las bases locales de desarrollo y pruebas autorizadas; no accede a
`veterinary_saas`, producción ni un servicio externo.
