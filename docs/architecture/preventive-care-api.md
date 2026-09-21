# Preventive Care API — Fase 6E.2

El backend de Preventive Care es un módulo NestJS tenant-safe. El prefijo global
es `/api/v1`; todas las mutaciones derivan `organizationId` y el actor desde la
sesión, nunca desde el body.

## Recursos y endpoints

Vaccination y Deworming tienen el mismo lifecycle y seis operaciones cada uno:

| Método | Ruta                                             | Permiso                    | Resultado                  |
| ------ | ------------------------------------------------ | -------------------------- | -------------------------- |
| GET    | `/patients/:patientId/vaccinations`              | `vaccinations.read`        | Lista paginada por Patient |
| GET    | `/vaccinations/:vaccinationId`                   | `vaccinations.read`        | Detalle tenant-safe        |
| POST   | `/clinical-encounters/:encounterId/vaccinations` | `vaccinations.create`      | Crea `DRAFT`               |
| PATCH  | `/vaccinations/:vaccinationId`                   | `vaccinations.updateDraft` | Actualiza DRAFT con CAS    |
| POST   | `/vaccinations/:vaccinationId/finalize`          | `vaccinations.finalize`    | `DRAFT → FINALIZED`        |
| POST   | `/vaccinations/:vaccinationId/void`              | `vaccinations.void`        | `FINALIZED → VOIDED`       |

Para Deworming se reemplaza `vaccinations` por `dewormings` y
`:vaccinationId` por `:dewormingId`.

## Contratos

Los contratos Zod compartidos están en `packages/contracts/src/index.ts` y los
DTOs HTTP en `apps/api/src/vaccinations` y `apps/api/src/dewormings`. Las fechas
clínicas son strings civiles `YYYY-MM-DD`; los timestamps de auditoría y
lifecycle son ISO UTC. `page` inicia en 1, `pageSize` en 20 y tiene máximo 100.

Los filtros de lista son `status`, `clinicalEncounterId`, `from` y `to`.
Cuando se usa un rango de fechas se excluyen drafts sin `administeredOn`. El
orden determinista es `administeredOn DESC NULLS LAST`, `createdAt DESC`, `id ASC`.

## Reglas de mutación

- Create solo acepta Encounter `DRAFT` o `FINALIZED`, crea siempre `DRAFT` y
  exige Patient `ACTIVE`.
- PATCH solo afecta DRAFT, requiere `expectedVersion` y aumenta `version` de
  forma compare-and-set.
- Finalize requiere `administeredOn`, nombre de vacuna/producto, responsable
  Practitioner activo con perfil `displayName`, y que el actor sea exactamente
  el responsable. Calcula los cinco snapshots en la misma transacción.
- Void requiere Practitioner, `expectedVersion` y motivo no vacío; no hay reopen
  ni DELETE. Un preventivo finalizado conserva su estado si después se anula el
  Encounter padre, pero expone `parentEncounterStatus`.
- Patient archivado bloquea create, PATCH y finalize; permite lectura histórica y
  void autorizado de un registro ya finalizado.

Cada mutación crea un `ClinicalAuditEvent` con entity type `VACCINATION` o
`DEWORMING`, acción genérica (`CREATED`, `UPDATED`, `FINALIZED`, `VOIDED`) y
metadata mínima de versiones. No se generan Appointment, Reminder, FollowUp,
Notification, inventario, documentos, Storage ni proyecciones en Patient.

## Aislamiento y concurrencia

Las tablas usan FKs compuestas con `organizationId` y `onDelete: RESTRICT`.
Las transacciones bloquean en orden `ClinicalEncounter → Patient → Preventive`;
finalize añade Owner histórico y Memberships ordenadas por ID. Un recurso de
otro tenant se responde como `404`, y una carrera con la misma versión produce
un único ganador y un `409` stale.

## Implementación y validación

La migración `20260921212106_add_preventive_care_backend` se aplica solo en los
PostgreSQL locales `easyvet_dev` y `easyvet_test`. El seed es ficticio,
idempotente y no se modifica para integrar datos externos. La suite de
integración `preventive-care.controller.integration.spec.ts` cubre lifecycle,
roles, aislamiento, fechas, snapshots, auditoría y CAS.
