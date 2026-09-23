# API de FollowUps — Fase 6J

Prefijo global: `/api/v1`. Todos los endpoints requieren sesión, tenant activo,
`TenantContextGuard` y permisos efectivos. IDs de ruta son UUID. No existe
DELETE.

| Método y ruta                           | Permiso              | Comportamiento                                            |
| --------------------------------------- | -------------------- | --------------------------------------------------------- |
| `GET /follow-ups`                       | `followUps.read`     | Cola tenant-scoped con filtros y paginación.              |
| `GET /follow-ups/dashboard`             | `followUps.read`     | Conteos civiles por timezone y hasta cinco OPEN próximos. |
| `GET /patients/:patientId/follow-ups`   | `followUps.read`     | Historia del Patient, todos los estados.                  |
| `GET /follow-ups/:followUpId`           | `followUps.read`     | Detail; un recurso de otro tenant responde 404.           |
| `POST /patients/:patientId/follow-ups`  | `followUps.create`   | Crea `OPEN`, version 1.                                   |
| `PATCH /follow-ups/:followUpId`         | `followUps.update`   | Edita únicamente `OPEN`, CAS obligatorio.                 |
| `POST /follow-ups/:followUpId/complete` | `followUps.complete` | Completa y congela snapshots, CAS obligatorio.            |
| `POST /follow-ups/:followUpId/void`     | `followUps.void`     | Anula con motivo, CAS obligatorio.                        |

Query de lista: `page` (default 1), `pageSize` (default 20, máximo 100),
`status`, `patientId`, `assignedMembershipId`, `sourceClinicalEncounterId`,
`dueFrom`, `dueTo`, `reminderBefore` ISO con offset/Z y `sort` (`due_asc`,
`due_desc`, `created_desc`). El orden es determinista: fecha, `createdAt DESC`,
`id ASC`; la historia Patient usa `due_desc` por defecto. `dueFrom/dueTo` son
fechas civiles e inclusivas.

Create admite `title`, `reason`, `dueOn`, `reminderAt`, `assignedMembershipId`,
`sourceClinicalEncounterId` y `notes`. Patch exige `expectedVersion` y al menos
un campo editable que cambie. Complete exige `expectedVersion` y `outcome`, con
`completionNotes` opcional. Void exige `expectedVersion` y `reason`. Los DTOs
rechazan propiedades adicionales y los contratos compartidos Zod validan
payloads/respuestas.

Errores estables incluyen `FOLLOW_UP_NOT_FOUND`, `FOLLOW_UP_STALE`,
`FOLLOW_UP_IMMUTABLE`, `INVALID_FOLLOW_UP_STATE`, `FOLLOW_UP_TITLE_REQUIRED`,
`FOLLOW_UP_OUTCOME_REQUIRED`, `PATIENT_ARCHIVED`,
`SOURCE_CLINICAL_ENCOUNTER_VOIDED`, `PROFESSIONAL_PROFILE_REQUIRED` y
`FOLLOW_UP_BUSY`. No se devuelven detalles SQL/Prisma.
