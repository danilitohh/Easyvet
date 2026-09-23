# API de Grooming / Peluquería

Todas las rutas requieren sesión y Membership activa. Las rutas de datos usan
`TenantContext.organizationId` del servidor; un identificador de otro tenant
responde 404. Las mutaciones no aceptan `organizationId` ni `ownerIdAtTime` del
cliente.

## Rutas

| Método y ruta                                            | Permiso                | Resultado                                                    |
| -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------ |
| `GET /api/v1/grooming-visits`                            | `grooming.read`        | Cola paginada y filtrable                                    |
| `GET /api/v1/patients/:patientId/grooming-visits`        | `grooming.read`        | Historial operativo del Patient                              |
| `GET /api/v1/grooming-visits/:groomingVisitId`           | `grooming.read`        | Detalle tenant-safe                                          |
| `GET /api/v1/grooming/groomers`                          | `grooming.read`        | Opciones mínimas de miembros con `grooming.perform` efectivo |
| `POST /api/v1/patients/:patientId/grooming-visits`       | `grooming.create`      | Crea DRAFT, versión 1                                        |
| `PATCH /api/v1/grooming-visits/:groomingVisitId`         | `grooming.updateDraft` | Edición CAS de campos permitidos                             |
| `POST /api/v1/grooming-visits/:groomingVisitId/start`    | `grooming.perform`     | DRAFT → IN_PROGRESS y snapshots                              |
| `POST /api/v1/grooming-visits/:groomingVisitId/complete` | `grooming.complete`    | IN_PROGRESS → COMPLETED                                      |
| `POST /api/v1/grooming-visits/:groomingVisitId/void`     | `grooming.void`        | IN_PROGRESS/COMPLETED → VOIDED                               |

No existe DELETE.

## Listado y errores

Query acepta `status`, `patientId`, `clinicLocationId`,
`assignedGroomerMembershipId`, `appointmentId`, `from`, `to`, `page` y
`pageSize`. El tamaño por defecto es 20 y el máximo 100. El orden de cola es
determinista: IN_PROGRESS, DRAFT y luego actividad reciente.

Las operaciones PATCH/START/COMPLETE/VOID requieren `expectedVersion`; si la
versión ya cambió se responde 409 `STALE_GROOMING_VISIT` (CAS). Otros errores
estables incluyen `GROOMING_VISIT_NOT_FOUND`, `GROOMING_VISIT_IMMUTABLE`,
`INVALID_GROOMING_VISIT_STATE`, `GROOMING_SERVICE_REQUIRED`, `GROOMER_REQUIRED`,
`PATIENT_ARCHIVED`, `ACTIVE_GROOMING_VISIT_EXISTS`,
`APPOINTMENT_NOT_ELIGIBLE` y `APPOINTMENT_ALREADY_HAS_GROOMING_VISIT`.

La opción de Groomer solo serializa `id`, `displayName` y `role`, sin correo ni
contactos. La cita relacionada se omite en la respuesta si la membership no
tiene `appointments.read`; la operación Grooming sigue disponible sin Agenda.

START exige servicio no vacío, Groomer activo elegible, sede activa, Patient
activo y Appointment no terminal, si existe. COMPLETE y VOID guardan autor y
hora; VOID exige motivo. Las observaciones se tratan como texto plano. La
auditoría operativa registra transición y campos cambiados sin copiar notas.
