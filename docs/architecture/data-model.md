# Modelo de datos fundamental

## Alcance de Fases 3A, 3B, 3C, 4A, 5B, 6B.1, 6B.2, 6E.2 y 6F.2A

Estas fases definen el núcleo multi-tenant y sesiones de autenticación. Las
autorización por permisos y el primer dominio veterinario de propietarios y
pacientes. Agenda 5B añade reservas operativas y disponibilidad. Fases 6B.1 y
6B.2 añaden la fundación persistente y las operaciones transaccionales del
núcleo clínico; 6F.2A agrega Procedures/Surgery. Inventario, ventas y
facturación siguen fuera de alcance.

### Fundación clínica 6B.1

```text
Organization
 ├─ Membership ── ClinicalRole? ── MembershipProfessionalProfile (0..1)
 ├─ Patient ── ClinicalRecord (0..1)
 │             ├─ ClinicalEncounter (DRAFT | FINALIZED | VOIDED)
 │             ├─ ClinicalEvolution (append-only)
 │             └─ VitalMeasurement
 └─ ClinicalAuditEvent (append-only)
```

Las cinco tablas clínicas tienen `organizationId` directo y FKs compuestas
tenant-aware. La migración usa `RESTRICT` para conservar historia, checks de
estado/timestamps en Encounter y checks positivos para mediciones numéricas.
Las rutas 6B.2 aplican lazy record, CAS, snapshots profesionales, proyección
de peso y auditoría append-only. No hay borrado físico ni endpoints de
satélites clínicos.

```text
User (identidad global)
  │
  └── Membership (relación + rol + estado)
          │
          └── Organization (frontera del tenant)
                  │
                  └── ClinicLocation[] (sedes futuras)

User ── Session (sesión opaca con contexto tenant opcional)

Organization
  ├── Owner[] ── Patient[]
  └── Patient[] (tenant explícito para consultas seguras)

Organization
  ├── ClinicLocation[] ── AvailabilityRule[]
  └── Appointment[] ── Patient + Owner + Membership

ClinicalEncounter
  └── Prescription[] ──< PrescriptionItem[]
  ├── Vaccination[]
  └── Deworming[]
```

## Entidades

- `Organization`: tenant de Easyvet. `slug` es único; `timezone`, `locale` y
  `currencyCode` son configuración mínima, no branding ni suscripción.
- `ClinicLocation`: sede perteneciente a una organización. No es una frontera
  de seguridad independiente.
- `User`: identidad global con email normalizado, hash de contraseña, estado y
  rol de plataforma. No tiene `organizationId`.
- `Membership`: vínculo explícito entre `User` y `Organization`. La combinación
  `userId + organizationId` es única.
- `Session`: sesión de navegador asociada a un usuario. Guarda `tokenHash`,
  expiración, revocación, `lastSeenAt` opcional y `activeMembershipId` opcional;
  nunca almacena el token en claro.
- `Owner`: responsable clínico tenant-scoped. Usa nombre separado, contacto e
  identificación opcional; `documentNumberNormalized` participa en la
  unicidad por organización y tipo.
- `Patient`: paciente tenant-scoped con un Owner principal. Conserva identidad
  base, especie/raza como texto extensible, sexo, nacimiento opcional, snapshot
  de peso y estado de archive; no contiene historia clínica.
- `Appointment`: reserva operativa tenant-scoped con Patient, Owner y sede,
  Membership asignada opcional, estado explícito, instantes UTC, confirmación
  independiente y metadatos de cancelación.
- `AvailabilityRule`: ventana semanal civil por sede y Membership opcional; sus
  horas se guardan como `HH:mm` y no representan bloques ni calendarios externos.
- `Prescription`: indicación clínica tenant-scoped ligada obligatoriamente a un
  `ClinicalEncounter` y a su Patient derivado. Su ciclo es `DRAFT`, `FINALIZED`,
  `VOIDED`; conserva snapshots al finalizar y nunca se elimina físicamente.
- `PrescriptionItem`: línea ordenada de una receta. Sus campos clínicos son
  texto introducido por el profesional; no referencia catálogo ni inventario.
- `Vaccination` y `Deworming`: satélites preventivos independientes, siempre
  ligados al Encounter y Patient del mismo tenant. Comparten
  `PreventiveRecordStatus` (`DRAFT`, `FINALIZED`, `VOIDED`), versionado CAS,
  snapshots al finalizar y auditoría; no proyectan campos en `Patient`.

## Estados y roles

- `OrganizationStatus`: `ACTIVE` opera normalmente, `SUSPENDED` bloquea la
  operación temporalmente y `ARCHIVED` conserva el tenant fuera de operación.
- `ClinicLocationStatus`: `ACTIVE`, `SUSPENDED` o `ARCHIVED` para una sede.
- `UserStatus`: `ACTIVE` o `SUSPENDED` para la identidad global.
- `MembershipStatus`: `INVITED`, `ACTIVE` o `SUSPENDED`. `INVITED` solo modela
  el estado futuro; no implementa invitaciones.
- `PlatformRole.USER` y `PLATFORM_ADMIN` administran la plataforma Easyvet.
  `PLATFORM_ADMIN` no concede automáticamente acceso a pacientes de ninguna
  organización.
- `MembershipRole`: `OWNER`, `ADMIN`, `VETERINARIAN`, `ASSISTANT`, `RECEPTION`,
  `GROOMER` y `CASHIER`. La matriz de permisos de Fase 4A añade capacidades
  explícitas de Owner y Patient.
- `OwnerStatus` y `PatientStatus`: `ACTIVE` o `ARCHIVED`; archivar conserva
  datos y no ejecuta cascadas destructivas.
- `PatientSex`: `MALE`, `FEMALE` o `UNKNOWN`. `sterilized` es independiente.
- `AppointmentStatus`: `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS`, `COMPLETED`,
  `CANCELLED` y `NO_SHOW`.

## Constraints e índices

- UUID en todas las claves primarias.
- `User.email` y `Organization.slug` tienen unique constraint.
- `Membership(userId, organizationId)` tiene unique constraint compuesto.
- Índices explícitos en `Membership.organizationId`, `Membership.userId`,
  `ClinicLocation.organizationId`, `Session.userId`,
  `Session.activeMembershipId` y `Session.expiresAt`.
- Owner tiene unique compuesto por `organizationId + documentType +
documentNumberNormalized`, más índices tenant/status y de nombre.
- Patient tiene índices tenant/status, tenant/owner, tenant/nombre y
  tenant/microchip. Una FK compuesta `(ownerId, organizationId)` impide asociar
  un paciente con un Owner de otra organización incluso si falla una validación
  de aplicación.
- Appointment y AvailabilityRule tienen FK compuestas tenant-aware e índices
  por organización, tiempo, estado, Patient, Membership y sede. Appointment usa
  `TIMESTAMPTZ(3)` y constraint `endsAt > startsAt`.
- La migración habilita `btree_gist` y crea exclusion constraints `tstzrange`
  para Patient y Membership en estados bloqueantes, con intervalos half-open
  `[start, end)`.
- Prescription usa FKs compuestas `(organizationId, patientId)` y
  `(organizationId, clinicalEncounterId, patientId)` para impedir cruces de
  tenant o del Patient del Encounter. Sus índices cubren tenant/Patient,
  tenant/Encounter, estado y prescriptor. `PrescriptionItem` solo referencia
  a su Prescription, con `(prescriptionId, position)` único; ambos usan
  `ON DELETE RESTRICT`.
- Vaccination/Deworming usan FKs compuestas `(clinicalEncounterId,
organizationId, patientId)`, `(patientId, organizationId)` y Memberships
  tenant-safe, además de índices por Patient/fecha, Encounter, status y
  responsable. Sus migraciones añaden checks de fecha civil, lifecycle,
  snapshots finales y `version >= 1`; todas las relaciones usan `RESTRICT`.
- Los servicios normalizan emails a minúsculas antes de escribir o buscar.

## Delete y archive behavior

Las relaciones de `ClinicLocation`, `Membership` y `Session.userId` hacia sus padres usan
`ON DELETE RESTRICT` y `ON UPDATE CASCADE`. Se evita eliminar por cascada una
organización, usuario o relación de acceso; el estado `ARCHIVED`/`SUSPENDED`
debe usarse para conservar historial. `Session.activeMembershipId` usa
`ON DELETE SET NULL` para preservar la sesión sin conservar un contexto inválido.
Las migraciones no eliminan datos.

Owner y Patient no tienen `DELETE` físico en Fase 4A/5B. `POST /owners/:id/archive`
y `POST /patients/:id/archive` marcan `ARCHIVED` y `archivedAt`; no cascadan a
pacientes ni a futuras dependencias clínicas. Los listados usan `ACTIVE` por
defecto y aceptan `status=ARCHIVED` o `status=ALL`. Un detalle directo puede
leer un recurso archivado si el usuario conserva el permiso y el tenant es el
mismo.

Archivar Patient se bloquea si tiene citas futuras en estados bloqueantes. Las
citas canceladas o no-show liberan el archive; no se cancelan automáticamente.

## Estrategia de pruebas

Las pruebas de constraints viven en
`apps/api/src/infrastructure/database/model.integration.spec.ts` y
`apps/api/src/appointments/appointments.controller.integration.spec.ts` y usan una
base PostgreSQL separada (`easyvet_test`). Se ejecutan explícitamente con
`RUN_DB_TESTS=1` y `DATABASE_URL_TEST`; la suite normal no puede borrar ni
modificar `veterinary_saas`. La migración se aplica a la base de pruebas con
`prisma migrate deploy` antes de ejecutar la suite.

La idempotencia del seed se verifica ejecutando `npm run db:seed` dos veces y
comprobando que permanecen 2 organizaciones, 2 sedes, 3 usuarios, 4
memberships, 4 Owners, 6 Patients, 3 AvailabilityRules, 6 Appointments,
3 Prescriptions, 3 PrescriptionItems, 2 Vaccinations, 3 Dewormings,
5 ClinicalProcedures y 2 ClinicalSurgeryDetails.

### Procedures/Surgery 6F.2A

`ClinicalProcedure` es el agregado raíz con `kind` (`PROCEDURE`/`SURGERY`),
estado propio `DRAFT → FINALIZED → VOIDED`, CAS por `version` y Encounter/Patient
obligatorios del mismo tenant. `ClinicalSurgeryDetail` es una extensión 1:0..1
que solo existe para kind `SURGERY`; cambios de kind y detalle son atómicos.
Ambas tablas conservan historia con FKs `RESTRICT`, tenant-composite,
constraints de lifecycle/snapshots y los índices definidos en la migración
`20260922020040_procedures_surgery_backend`.

Finalizar congela los snapshots de Patient, Owner histórico del Encounter y
Practitioner; en cirugía puede congelar además el Assistant seleccionado. El
modelo no crea raíces separadas, ni tablas de anestesia, Consent, documentos,
inventario o facturación. Las rutas y contratos se documentan en
[`procedures-api.md`](procedures-api.md); la migración se aplicó solo a
`easyvet_dev` y `easyvet_test`.
