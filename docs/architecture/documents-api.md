# API de documentos y consentimientos

Todas las rutas internas usan `/api/v1`, sesión autenticada, tenant activo y permiso
específico. UUID inválido falla en validación; un recurso de otro tenant responde
como no encontrado. Los secretos de storage no forman parte de las respuestas.

## Documentos

| Método y ruta                         | Permiso                                          | Uso                                                                    |
| ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `GET /patients/:patientId/documents`  | `documents.read`                                 | Lista paginada; filtros status/type/origin/encounter.                  |
| `GET /documents/:documentId`          | `documents.read`                                 | Metadata tenant-safe.                                                  |
| `GET /documents/:documentId/file`     | `documents.read`                                 | Descarga autenticada, no-store, nosniff e integridad verificada.       |
| `POST /documents/generate`            | `documents.generate` + permiso de lectura source | PDF de tipo/source elegible, idempotente por versión.                  |
| `POST /patients/:patientId/documents` | `documents.upload`                               | Multipart `file` PDF/PNG/JPEG y metadata opcional de Encounter/source. |
| `POST /documents/:documentId/void`    | `documents.void`                                 | Anulación lógica con razón; bytes retenidos.                           |

Upload máximo 10 MiB, firma mágica y MIME deben coincidir. Generación rechaza fuente
no finalizada, anulada, cruzada de Patient/tenant o bloqueada por Encounter/Patient.
La API no sirve rutas locales ni crea URL pública.

## Consentimientos

| Método y ruta                                                         | Permiso                  | Uso                                                                 |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `GET /patients/:patientId/consents`                                   | `consents.read`          | Historial del Patient.                                              |
| `GET /consents/:consentId`                                            | `consents.read`          | Detalle y estado de padres.                                         |
| `POST /patients/:patientId/clinical-encounters/:encounterId/consents` | `consents.create`        | Crea Draft contextual.                                              |
| `PATCH /consents/:consentId`                                          | `consents.updateDraft`   | Edita Draft con `expectedVersion`.                                  |
| `POST /consents/:consentId/issue`                                     | `consents.issue`         | Congela contenido/snapshots, emite token + OTP de una sola lectura. |
| `POST /consents/:consentId/signature-request/reissue`                 | `consents.issue`         | Revoca pendientes y crea request nuevo.                             |
| `POST /consents/:consentId/void`                                      | `consents.void`          | Void con CAS y razón.                                               |
| `GET /public/signatures/:token`                                       | Público por bearer token | Contexto de firma mínimo, sin número documental completo.           |
| `POST /public/signatures/:token/sign`                                 | Público por bearer token | OTP + aceptación + nombre + typed o multipart PNG drawn.            |

Errores públicos de token/OTP/expiración se normalizan a `SIGNATURE_UNAVAILABLE`.
Las operaciones internas devuelven conflictos de versión/estado con códigos de
dominio. Ver validación completa de DTOs y fuentes en controladores/contratos.
