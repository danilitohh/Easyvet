# Procedures/Surgery API — Fase 6F.2A

Estado: backend implementado. Esta fase incluye únicamente el agregado clínico
`ClinicalProcedure` y su extensión quirúrgica `ClinicalSurgeryDetail`; no incluye
anestesia, frontend ni documentos.

## Contratos

Los esquemas Zod y tipos compartidos viven en `packages/contracts/src/index.ts`;
los DTO HTTP con validación estricta viven en `apps/api/src/procedures/`. El
tenant y Membership actor se derivan de la sesión. `organizationId`, estado,
versión inicial, creador, snapshots y campos de transición no son editables por
el cliente. `kind` es obligatorio en create y acepta solo `PROCEDURE` o
`SURGERY`; el lifecycle propio es `DRAFT`, `FINALIZED` o `VOIDED`.

Los campos narrativos son texto plano y nullable en Draft: `indication`,
`description`, `technique`, `findings`, `complications`, `recoveryNotes`,
`postoperativePlan` y `notes`. `description` y `technique` mantienen semánticas
distintas. `performedAt` acepta una fecha ISO con `Z` u offset; puede ser null
en Draft y es obligatoria para finalizar. No se impone una regla global de
fecha futura/pasada.

`ClinicalSurgeryDetail` es parte del aggregate root, con cero o una fila cuando
`kind=SURGERY`. Su objeto opcional incluye `assistantMembershipId`,
`surgicalArea`, `surgicalSide`, `bleedingNotes` y `closureNotes`; el Assistant
puede ser Practitioner o Clinical Assistant activo con perfil. No hay ruta
independiente para este detalle.

## Rutas

Todas las rutas incluyen el prefijo `/api/v1` y tenant de sesión:

| Método | Ruta                                           | Permiso                  | Resultado                                                                                       |
| ------ | ---------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/patients/:patientId/procedures`              | `procedures.read`        | Historial paginado con resumen, filtros `status`, `kind`, `clinicalEncounterId`, `from` y `to`. |
| GET    | `/procedures/:procedureId`                     | `procedures.read`        | Detalle con narrativa, snapshots, contexto padre y cirugía opcional.                            |
| POST   | `/clinical-encounters/:encounterId/procedures` | `procedures.create`      | Crea un Draft y opcionalmente su SurgeryDetail.                                                 |
| PATCH  | `/procedures/:procedureId`                     | `procedures.updateDraft` | Actualiza Draft mediante `expectedVersion`; permite transición de kind y detalle atómica.       |
| POST   | `/procedures/:procedureId/finalize`            | `procedures.finalize`    | Finaliza Draft mediante `expectedVersion`.                                                      |
| POST   | `/procedures/:procedureId/void`                | `procedures.void`        | Anula FINALIZED mediante `expectedVersion` y motivo requerido.                                  |

La lista usa `page=1`, `pageSize=20` por defecto, con máximos 10,000 y 100
respectivamente. Orden: `performedAt DESC NULLS LAST`, `createdAt DESC`, `id ASC`.
Sin filtros de fecha incluye Drafts sin `performedAt`; si se manda `from`/`to`,
el filtro se aplica sobre `performedAt` y el rango invertido falla.
Resúmenes no incluyen narrativa; el detalle sí.

Create admite Draft mínimo, sin exigir campos clínicos. Un Encounter en
`DRAFT` o `FINALIZED` admite procedimientos; `VOIDED` no. Patient debe estar
activo para crear/editar/finalizar. Historical reads de evidencia final
permanecen disponibles aunque cambie/archive un padre.

## Mutaciones y concurrencia

Update, finalize y void son CAS de una fila: la versión observada debe coincidir
con `expectedVersion`; el ganador incrementa versión y solo el ganador escribe
auditoría. Update de Draft sin cambios devuelve `PROCEDURE_NO_CHANGES`.
`SURGERY → PROCEDURE` elimina el SurgeryDetail en la misma transacción; un kind
`PROCEDURE` no admite detail. `FINALIZED` y `VOIDED` son inmutables y no hay
DELETE físico.

Lock order para cambios dependientes de padres:
`ClinicalEncounter → Patient → ClinicalProcedure → Owner histórico cuando se
congela → Memberships en orden de ID`. Así create/update/finalize serializan
contra void de Encounter y archive de Patient sin TOCTOU. Finalize exige nombre
y fecha realizada, responsable Practitioner activo con perfil y que el actor
sea ese responsable. Surgery Assistant asignado requiere perfil al finalizar.

Finalizar congela `patientNameSnapshot`, `ownerDisplayNameSnapshot` del Owner
histórico fijado por Encounter, y nombre/licencia del Practitioner. Si cirugía
tiene Assistant, congela `assistantDisplayNameSnapshot`. Mutar luego nombre,
Owner actual o perfil no altera historia final. Void requiere un Practitioner
autorizado, motivo y evidencia FINALIZED; no se admite void directo de Draft.

## Errores previsibles

- `404`: `PROCEDURE_NOT_FOUND`, `CLINICAL_ENCOUNTER_NOT_FOUND` y
  `OWNER_NOT_FOUND`; IDs de otro tenant se comportan como no encontrados.
- `403`: falta de permiso para el rol/actor de la operación.
- `409`: `PROCEDURE_STALE`, `PROCEDURE_IMMUTABLE`,
  `INVALID_PROCEDURE_STATE`, `PROCEDURE_NO_CHANGES`,
  `SURGERY_DETAIL_NOT_ALLOWED`, `PROCEDURE_NAME_REQUIRED`,
  `PROCEDURE_PERFORMED_AT_REQUIRED`, `RESPONSIBLE_PRACTITIONER_REQUIRED`,
  `PROFESSIONAL_PROFILE_REQUIRED` o `ASSISTANT_PROFILE_REQUIRED`.
- `400`: DTO/timestamp inválido, `INVALID_DATE_RANGE` o
  `VOID_REASON_REQUIRED`.

## Persistencia, audit y alcance

La migración `20260922020040_procedures_surgery_backend` añade ambos enums,
tablas, FKs tenant-aware `RESTRICT`, checks de versión/lifecycle/snapshots,
relaciones compuestas e índices, sin backfill. Se aplicó únicamente a
`easyvet_dev` y `easyvet_test`. `ClinicalAuditEvent` usa entity
`CLINICAL_PROCEDURE` y acciones `CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`;
metadata contiene solo versiones, nunca narrativa clínica.

El seed idempotente incluye ejemplos ficticios para Norte y Sur. La suite de
integración de procedimientos comprueba aislamiento, permisos, transiciones de
kind, snapshots, carreras CAS y auditoría contra PostgreSQL `easyvet_test`.
Consent, anestesia, documentos/PDF/Storage, firma, inventario, billing,
catálogos y UI están fuera de 6F.2A.
