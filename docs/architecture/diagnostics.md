# Diagnostics / Exámenes — Fase 6H

## Aggregate y alcance

`DiagnosticOrder` es el agregado clínico único para laboratorio, imagen,
patología y otros estudios. Siempre pertenece a una organización, paciente y
encuentro clínico del mismo tenant. Un encuentro admite `0..N` órdenes; no se
impone unicidad por nombre, categoría o fecha.

El V1 registra el estudio solicitado, su fecha, contexto clínico, profesional
responsable, resultado textual e interpretación. No crea `document_reference`,
archivos, PDFs, imágenes, DICOM, integraciones de laboratorio, cobros,
facturas, ventas, recordatorios ni movimientos de inventario.

## Lifecycle

```text
DRAFT ──request──> REQUESTED ──result──> RESULTED
                         │                 │
                         └──────void───────┴──> VOIDED
```

- `DRAFT` admite create/updateDraft y puede estar incompleto; `category` sí es
  obligatoria desde la creación.
- `REQUESTED` congela category, testName, requestedAt, razón, instrucciones,
  notas, responsable y snapshots. Solo se puede registrar un resultado o
  anular.
- `RESULTED` es de solo lectura salvo anulación; no se reemplaza ni reabre.
- `VOIDED` conserva la solicitud y, si existía, el resultado. No tiene delete ni
  transición de salida.

Para solicitar se requieren `testName`, `requestedAt`, Practitioner asignado y
un perfil profesional activo con `displayName`. El actor debe ser el
Practitioner responsable; no existe request-on-behalf en V1. Registrar resultado
requiere fecha y al menos uno de `resultText` o `interpretation`; puede hacerlo
cualquier Practitioner autorizado, no necesariamente quien solicitó. Anular
requiere motivo y Practitioner activo.

## Contexto histórico y archivo

Al solicitar se congelan `patientNameSnapshot`, `ownerDisplayNameSnapshot`,
`professionalDisplayNameSnapshot` y `professionalLicenseSnapshot`. El Owner se
resuelve desde `ClinicalEncounter.ownerIdAtTime`, no desde la relación Owner
actual del Patient; los datos históricos no se rehidratan después.

Un Encounter `VOIDED` bloquea create, update Draft, request y result. No cambia
automáticamente el estado de órdenes existentes: una orden `RESULTED`
permanece así. Una orden `DRAFT` o `REQUESTED` sigue legible, pero queda sin
mutaciones salvo que `REQUESTED` pueda anularse por Practitioner.

Un Patient `ARCHIVED` bloquea create/update Draft/request/result, conserva
lectura y permite la anulación autorizada. Se permite archivar con órdenes
pendientes; dichas órdenes quedan read-only y no se completan después. Esto
evita acoplar el archive del Patient a solicitudes externas aún no resueltas.

## Tenant, concurrencia y auditoría

Las FKs compuestas incluyen `organizationId` para Encounter, Patient y cada
Membership actor. Todas usan `ON DELETE RESTRICT`; no se exponen escrituras con
identificadores tenant desde el navegador. PostgreSQL verifica además versión,
coherencia de estados y metadata de solicitud/resultado/anulación.

El lock order es:

```text
ClinicalEncounter → Patient → DiagnosticOrder → Owner (si se snapshottea)
                   → Memberships ordenadas y deduplicadas
```

Las operaciones con `expectedVersion` son CAS y aumentan la versión una sola
vez por transición efectiva. Encuentro/Paciente y su cambio terminal comparten
locks con las operaciones de Diagnostics para que gane un único orden válido.

`ClinicalAuditEvent` usa entity `DIAGNOSTIC_ORDER` y acciones CREATED,
UPDATED, REQUESTED, RESULTED y VOIDED. Metadata conserva solo transición,
versión y estado; no incluye narrativa, resultados ni snapshots nominales.

## Persistencia de ejemplo

El seed idempotente añade tres órdenes ficticias a Norte (DRAFT, REQUESTED y
RESULTED) y una de demostración DRAFT a Sur. El seed solo está destinado a
entornos locales/de prueba.
