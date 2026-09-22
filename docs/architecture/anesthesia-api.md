# Anesthesia API — Fase 6F.2B

Estado: backend implementado. Esta fase incluye únicamente `AnesthesiaRecord`
como agregado clínico y `AnesthesiaObservation` como serie de monitorización
editable mientras el agregado está en `DRAFT`; no incluye frontend, documentos,
consentimiento, PDF, Storage, inventario, facturación, prescripciones
estructuradas ni integración con dispositivos.

## Contratos

Los esquemas Zod y tipos compartidos viven en `packages/contracts/src/index.ts`;
los DTO HTTP con validación estricta viven en `apps/api/src/anesthesia/`. El
tenant, Patient, actor, status inicial, versionado, snapshots y campos terminales
son server-owned.

`startedAt`, `endedAt` y `observedAt` aceptan solo instantes ISO-8601 con `Z` u
offset explícito. `startedAt` es obligatorio al finalizar; `endedAt` puede quedar
null y, cuando existe, debe ser mayor o igual a `startedAt`. ASA,
medicamentos, fluidos, vía aérea, complicaciones, recuperación y notas son texto
narrativo nullable. Medicamentos y fluidos no tienen tabla estructurada ni side
effects.

Las observaciones requieren `observedAt` y al menos un campo clínico no vacío.
HR/RR aceptan enteros `>= 0`; temperatura debe ser `> 0`; SpO₂ queda en
`0..100`; EtCO₂ es `>= 0`; presión, plano y notas son texto. No hay rango
clínico adicional ni relación con `VitalMeasurement`.

## Rutas

Todas las rutas incluyen el prefijo `/api/v1` y tenant de sesión:

| Método | Ruta                                                                  | Permiso                  | Resultado                                                                                         |
| ------ | --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| GET    | `/patients/:patientId/anesthesia-records`                             | `anesthesia.read`        | Historial paginado con filtros `status`, `clinicalEncounterId`, `clinicalProcedureId`, `from/to`. |
| GET    | `/anesthesia-records/:anesthesiaRecordId`                             | `anesthesia.read`        | Detalle con narrativa completa, conteo de observaciones y estados actuales de padres.             |
| POST   | `/clinical-encounters/:encounterId/anesthesia-records`                | `anesthesia.create`      | Crea un Draft standalone o vinculado opcionalmente a Procedure/Surgery.                           |
| PATCH  | `/anesthesia-records/:anesthesiaRecordId`                             | `anesthesia.updateDraft` | Actualiza Draft mediante `expectedVersion`.                                                       |
| POST   | `/anesthesia-records/:anesthesiaRecordId/finalize`                    | `anesthesia.finalize`    | Finaliza Draft mediante `expectedVersion`; actor debe ser el responsable.                         |
| POST   | `/anesthesia-records/:anesthesiaRecordId/void`                        | `anesthesia.void`        | Anula FINALIZED mediante `expectedVersion` y motivo requerido.                                    |
| GET    | `/anesthesia-records/:anesthesiaRecordId/observations`                | `anesthesia.read`        | Lista observaciones paginadas en orden `observedAt ASC, createdAt ASC, id ASC`.                   |
| POST   | `/anesthesia-records/:anesthesiaRecordId/observations`                | `anesthesia.updateDraft` | Agrega observación Draft e incrementa la versión del padre una vez.                               |
| PATCH  | `/anesthesia-records/:anesthesiaRecordId/observations/:observationId` | `anesthesia.updateDraft` | Corrige observación Draft e incrementa la versión del padre una vez.                              |
| DELETE | `/anesthesia-records/:anesthesiaRecordId/observations/:observationId` | `anesthesia.updateDraft` | Elimina físicamente una observación Draft; `expectedVersion` viaja en query string.               |

La lista de registros usa `page=1`, `pageSize=20` por defecto, máximo 100, y
ordena por `startedAt DESC NULLS LAST`, `createdAt DESC`, `id ASC`. Con filtros
`from/to`, el rango se aplica sobre `startedAt` y un rango invertido falla.
El detalle no carga toda la serie para evitar payloads grandes; la serie se lee
con la ruta propia de observations.

## Mutaciones y concurrencia

`AnesthesiaRecord.version` gobierna todo el agregado. PATCH, finalize, void y
cada operación de observations exigen `expectedVersion`; solo el ganador
incrementa la versión y escribe auditoría. Updates sin cambios devuelven
`ANESTHESIA_NO_CHANGES`; versiones obsoletas devuelven `ANESTHESIA_STALE`.

Orden global de locks:

```text
ClinicalEncounter → Patient → ClinicalProcedure vinculado
→ AnesthesiaRecord → Owner histórico → Memberships ordenadas
```

Create omite el lock del agregado porque todavía no existe. Un registro
standalone omite el lock de Procedure. Observations bloquean el mismo agregado
padre antes de insertar, corregir o eliminar la fila hija. Si `Encounter VOID`,
`Procedure VOID` o `Patient ARCHIVED` ganan primero el lock padre, las mutaciones
Draft fallan sin side effects; si el agregado gana primero y confirma, el cambio
del padre continúa después. Un Anesthesia FINALIZED conserva su lifecycle aunque
un padre se anule después.

Finalize exige responsable Practitioner activo, User activo, perfil profesional
con `displayName`, y que el actor sea el mismo Membership responsable. Al
finalizar se congelan `patientNameSnapshot`, `ownerDisplayNameSnapshot` desde el
Owner histórico del Encounter, y nombre/licencia profesional vigente. La licencia
puede ser null. Void solo acepta FINALIZED, motivo trim no vacío y Practitioner
autorizado.

## Errores previsibles

- `404`: `ANESTHESIA_RECORD_NOT_FOUND`, `ANESTHESIA_OBSERVATION_NOT_FOUND`,
  `CLINICAL_ENCOUNTER_NOT_FOUND`, `CLINICAL_PROCEDURE_NOT_FOUND`,
  `PATIENT_NOT_FOUND` u `OWNER_NOT_FOUND`; otro tenant se comporta como no
  encontrado.
- `403`: falta de permiso o Membership activo para el tenant.
- `409`: `ANESTHESIA_STALE`, `ANESTHESIA_IMMUTABLE`,
  `INVALID_ANESTHESIA_STATE`, `ANESTHESIA_NO_CHANGES`,
  `PARENT_CLINICAL_ENCOUNTER_VOIDED`, `PARENT_CLINICAL_PROCEDURE_VOIDED`,
  `PATIENT_ARCHIVED`, `ANESTHESIA_STARTED_AT_REQUIRED`,
  `RESPONSIBLE_PRACTITIONER_REQUIRED`, `PROFESSIONAL_PROFILE_REQUIRED`,
  `ANESTHESIA_OBSERVATION_EMPTY` o `INVALID_ANESTHESIA_TIME_RANGE`.
- `400`: DTO/timestamp inválido, `INVALID_DATE_RANGE` o
  `VOID_REASON_REQUIRED`.

## Persistencia, audit y alcance

La migración `20260922043000_anesthesia_backend` añade el enum
`AnesthesiaRecordStatus`, tablas `anesthesia_records` y
`anesthesia_observations`, FKs compuestas tenant-aware, checks de lifecycle,
tiempo, versión y observaciones no vacías, además de índices de historia,
Encounter, status, responsable, Procedure y orden de monitorización. La
migración `20260922050000_anesthesia_backend_alignment` alinea defaults de UUID
con Prisma y recrea los índices de lectura con el orden pactado.

`ClinicalAuditEvent` usa entity `ANESTHESIA_RECORD` y acciones `CREATED`,
`UPDATED`, `FINALIZED`, `VOIDED`. Las mutaciones de observations se auditan como
`UPDATED` del agregado padre con metadata operacional; no se guardan valores de
monitorización, narrativas, nombres ni PII.

El seed idempotente crea datos ficticios para Norte y Sur: un record draft
standalone, un record finalizado ligado a cirugía y un draft del otro tenant,
con tres observaciones. La suite de integración cubre aislamiento, permisos,
link opcional/Procedure, lifecycle, timestamps, snapshots de Owner histórico,
Patient archivado, CAS, carreras con padres y auditoría privada contra
PostgreSQL `easyvet_test`.
