# Límites transaccionales del dominio clínico

Este documento registra los límites atómicos implementados en el Clinical Core
6B.2, la operación de frontend 6C.2B, el hardening 6C.3, Preventive Care
6E.2, Procedures/Surgery 6F.2A, Anesthesia 6F.2B y Documents/Consents/Signatures
6I. La UI y hardening de Procedures/Anesthesia se completaron en 6F.3 sin añadir
transacciones nuevas. No modifica la implementación actual de Agenda ni introduce
side effects externos.

## Regla general

Una transacción de base de datos debe proteger el hecho clínico y sus
referencias internas. Correo, PDF, Google Calendar, webhooks y archivos grandes
son efectos externos: se registran como trabajo pendiente/outbox después del
commit y deben ser reintentables e idempotentes. Ninguna integración externa
debe dejar una consulta medio guardada.

Todas las operaciones verifican `organizationId` en cada lookup. Un `patientId`,
`ownerId`, `membershipId` o `appointmentId` de otro tenant debe producir
`404`/`RESOURCE_NOT_FOUND`, nunca una fuga de existencia.

## Procedures/Surgery/Anesthesia 6F.3

La fase frontend conserva los límites transaccionales backend de 6F.2A/6F.2B:
los formularios solo presentan acciones autorizadas y cada mutación envía la
versión observada; no existen escrituras optimistas locales que se traten como
confirmadas. Observations usan CAS del AnesthesiaRecord padre y el servidor
actualiza versión, observation y auditoría de forma atómica. Cambiar el tenant
cancela/descarta lecturas pendientes del dominio clínico y vuelve a resolver
los recursos bajo el contexto nuevo. No se generan side effects sobre
Appointment, Prescription, Storage, PDF, notificaciones ni servicios externos.

## Flujos y atomicidad

| Flujo                      | Dentro de la transacción                                                                                                                                                                                                                                                                                                      | Después del commit                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Crear/editar draft         | Validar tenant, Patient/Owner, actor y versión; upsert de Record/Encounter; snapshots profesionales; referencias de Appointment; metadata de adjuntos; auditoría.                                                                                                                                                             | Previsualización/exportación bajo demanda; antivirus/storage final si aplica.                                                     |
| Finalizar                  | Comprobar permiso, actor Practitioner responsable, estado `DRAFT`, versión, Patient activo, Owner histórico, perfil y ClinicLocation; fijar `FINALIZED`, `finalizedAt`, actor/snapshots; congelar mediciones; proyectar peso; auditoría.                                                                                      | Generar PDF, notificar, crear recordatorio o sincronizar Agenda mediante outbox.                                                  |
| Addendum/evolución         | Insertar fila append-only con autor derivado de sesión, timestamp, al menos una narrativa y vínculo obligatorio al Record; vínculo opcional a Encounter `FINALIZED` no `VOIDED`; auditoría.                                                                                                                                   | Notificación o export actualizado. Nunca mutar el finalizado.                                                                     |
| Vital/peso                 | Insertar `VitalMeasurement`; actualizar `Patient.currentWeightKg` solamente si la medición es la vigente según regla de orden; auditoría.                                                                                                                                                                                     | Métricas o recordatorios.                                                                                                         |
| Vacunación/desparasitación | Crear `Vaccination` o `Deworming` DRAFT sobre Encounter, validar tenant/Patient, fechas, memberships y CAS; finalizar congela snapshots y registra auditoría. No modifica Patient ni crea efectos externos.                                                                                                                   | Ninguno en 6E.2; reminders, Appointment, inventario, documentos y notificaciones están postergados.                               |
| Prescripción               | Crear una `Prescription` sobre un Encounter existente; validar tenant, Patient derivado, estado y prescriptor. Create/update/finalize bloquean `ClinicalEncounter → Patient → Prescription`; el draft reemplaza todos sus items en una única transacción; finalizar/anular usan CAS, congelan snapshots y escriben auditoría. | PDF, email al Owner, Storage, inventario, ventas y facturación quedan fuera de 6D.2/6D.4.                                         |
| Procedimiento/cirugía      | `ClinicalProcedure` raíz única; create/update/finalize/void tenant-safe con CAS; detail de Surgery atómico con el draft; Encounter → Patient → Procedure → Owner histórico → Memberships ordenadas; snapshots y auditoría en la misma transacción.                                                                            | Sin efectos externos en 6F.2A; Consent, anestesia, documentos, Storage, notificación, inventario y facturación fuera de esa fase. |
| Anestesia                  | `AnesthesiaRecord` independiente; create/update/finalize/void y observations con CAS del padre; Encounter → Patient → Procedure vinculado → AnesthesiaRecord → Owner histórico → Memberships ordenadas; snapshots y auditoría sin payload clínico.                                                                            | Sin efectos externos en 6F.2B; frontend y Consent/documentos fuera de esa fase.                                                   |
| Hospitalización            | Abrir/actualizar estancia y sus observaciones; alta es transición validada y auditada.                                                                                                                                                                                                                                        | Kardex PDF y avisos al Owner.                                                                                                     |
| Diagnóstico                | Crear `DiagnosticOrder` y sus items; cada resultado es una transición idempotente y tenant-safe; no sobrescribir resultado previo sin versión.                                                                                                                                                                                | Ingesta de archivo, análisis externo y aviso al profesional.                                                                      |
| Consentimiento/firma       | 6I: lock Encounter → Patient → Consent → request; CAS de contenido y estado; reissue revoca requests pendientes; firma válida crea evidencia, request, Consent, ClinicalDocument y audit en una operación lógica; rollback best-effort de bytes ante fallo.                                                                   | No se entrega email/SMS automáticamente; la emisión retorna link/código de un solo uso al operador autorizado.                    |
| Documento clínico          | 6I: valida source/tenant/parent, genera o carga bytes, calcula hash, guarda metadata y audit; claves únicas por tenant/artefacto; compensación del objeto si falla la escritura relacional.                                                                                                                                   | El object store es externo a PostgreSQL; no hay transacción distribuida ni URL pública.                                           |
| FollowUp                   | Crear programa y ocurrencias; completar una ocurrencia con contacto, resultado, evolución y próxima fecha en una transacción; auditoría.                                                                                                                                                                                      | Recordatorio, email y eventual Appointment proyectado.                                                                            |
| Exportación                | Registrar autorización y auditoría; leer un snapshot consistente.                                                                                                                                                                                                                                                             | Renderizar PDF/DOCX y entregar URL expirable. No cambiar el hecho clínico.                                                        |

## Flujos que afectan a Patient

El `Patient` contiene proyecciones operativas, no toda la historia:

```text
ClinicalEncounter -> VitalMeasurement -> Patient.currentWeightKg
ClinicalEncounter -> Vaccination/Deworming (historia especializada, sin proyección)
```

El legacy también actualiza desde una consulta `microchip`, alergias,
condiciones crónicas, estado reproductivo y notas cuando esos campos vienen en
el payload. En Easyvet esas escrituras deben declararse como comandos de perfil
separados o como proyecciones explícitas; no deben esconderse en un guardado de
encounter.

Solo la proyección de peso de `VitalMeasurement` forma parte del Clinical Core.
Preventive Care 6E.2 no crea estados preventivos en `Patient`: un draft,
finalización o void no modifica ninguna columna del paciente. No hay rollback
ni outbox preventivo que coordinar en esta fase.

Al anular un encounter finalizado, la misma transacción recalcula el peso desde
la medición finalizada más reciente de encounters no anulados; si no queda
ninguna, establece null. El encounter anulado y sus mediciones permanecen.

La UI de 6C.2B envía `expectedVersion` tanto para finalizar como para anular. Una carrera o
transición de estado devuelve `409` sin optimistic update; el cliente conserva el formulario y
ofrece recarga explícita. Finalizar congela snapshots de profesional/licencia y anular exige un
motivo no vacío, pero nunca borra la evidencia clínica.

Prescriptions aplica la misma política de serialización: `voidEncounter` toma el
lock del Encounter antes de evaluar su estado, y archive de Patient toma el lock
del Patient antes de cambiarlo. Un update/finalize que obtiene primero el lock
puede completar antes del void; una operación que llega después no puede
confirmar contra un parent ya anulado. Los items y su versión se escriben en la
misma transacción y cada request perdedor queda sin audit.

Preventive Care aplica la misma política con lock order
`ClinicalEncounter → Patient → Vaccination/Deworming`; finalize añade Owner
histórico y Memberships ordenadas por ID. Las carreras contra `Encounter VOID`
pueden completar únicamente si adquieren primero el lock; un parent ya voided
bloquea create/update/finalize. `FINALIZED` no se auto-void y expone
`parentEncounterStatus`.

En 6E.4 `void` también bloquea y revalida el Membership actor como Practitioner
activo dentro de la transacción. Así una suspensión concurrente no puede pasar
la guardia HTTP y autorizar una anulación después de que cambie el estado de la
membresía.

La creación lazy de `ClinicalRecord` usa `INSERT ... ON CONFLICT DO NOTHING` dentro de la
transacción del primer Encounter. Dos requests simultáneas producen un único Record y dos drafts
válidos; solo el request que inserta el Record escribe el audit de creación.

Patient `ARCHIVED` conserva lecturas, pero bloquea toda nueva actividad clínica, incluidos
vitales agregados a drafts que ya existían. En Preventive Care bloquea `CREATE`, `PATCH` y
`FINALIZE`; el `VOID` de un preventivo ya finalizado sí permanece permitido como corrección de
evidencia histórica. Todas las operaciones comparan tenant, estado y versión en la misma
actualización atómica; una carrera perdedora no escribe audit ni cambia proyecciones.

El cambio de Owner no reescribe snapshots históricos. Archivar Patient no borra
encounters, documentos, consentimientos ni auditoría. Las citas futuras se
cancelan o reubican mediante el workflow de Agenda, no con un `DELETE` clínico.

## Idempotencia y concurrencia

- Todas las mutaciones llevan un `requestId`/idempotency key cuando provienen de
  reintentos de navegador o workers.
- Finalizar y firmar usan comparación de versión o `SELECT ... FOR UPDATE` en
  la fila agregada, no “último write gana”.
- Un resultado de laboratorio repetido con el mismo identificador externo no
  crea otro resultado; el conflicto se registra.
- Un recordatorio o Appointment proyectado usa una clave de deduplicación
  estable (`organizationId + source + sourceId + scheduledAt`).
- Los workers de outbox pueden reintentarse sin repetir email, PDF o cita.

## Side effects y boundaries

El servicio de aplicación debe exponer una operación por intención, por ejemplo
`FinalizeEncounter`, `AppendEvolution`, `RecordMeasurement` o
`CompleteFollowUp`. Cada operación abre una única transacción de dominio y
publica eventos de integración después del commit. No se recomienda que un
controller llame simultáneamente a Clinical, Agenda y correo.

El enlace con el Appointment actual de Easyvet es opcional. La regla propuesta
es que `Appointment` representa una reserva y `ClinicalEncounter` representa lo
que ocurrió; completar una reserva no crea automáticamente una consulta vacía.
Una futura aplicación puede ofrecer “iniciar consulta desde cita” dentro de la
misma pantalla, pero seguirá siendo una creación clínica explícita.

## Borrado, retención y trazabilidad

| Dato                    | Política propuesta                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Draft abandonado        | No hay delete en 6B; queda draft para una futura política de limpieza/retención.       |
| Encounter finalizado    | Nunca hard-delete; addendum/void legal.                                                |
| Documento firmado       | Inmutable por hash y versión; conservar evidencia aunque el enlace de descarga expire. |
| Patient/Owner archivado | Soft archive; historia legible para roles autorizados.                                 |
| Archivo no firmado      | Storage con ciclo de vida configurable y referencia auditada.                          |
| Audit/outbox            | Append-only o retención controlada; nunca cascada accidental desde Patient.            |

El endpoint de eliminación legacy que cascada `clinical_records`, consultas,
seguimientos, firmas y consentimientos es una incompatibilidad deliberada que
Easyvet no debe reproducir.

## Flujo de datos clínico

```text
Appointment (opcional)
        │ iniciar explícitamente
        ▼
ClinicalRecord ──< ClinicalEncounter (DRAFT)
                         │ finalize
                         ├──< ClinicalEvolution / Addendum
                         ├──< VitalMeasurement ──► Patient projection
                         ├──< Diagnosis / Prescription / Preventive / Procedure
                         ├──< DiagnosticOrder (solicitud + resultado + anulación)
                         ├──< Consent ──< SignatureRequest
                         ├──< FollowUp ──► Reminder/Appointment (outbox)
                         └──< DocumentVersion ──► Storage / export (outbox)
```

El diagrama marca relaciones de dominio, no necesariamente tablas que deban
crearse juntas. Cada satélite se habilita solo después de las decisiones de
producto y permisos documentadas en `clinical-decisions.md`.

En 6F.2A un Procedure requiere Encounter y Patient del mismo tenant. Create,
update y finalize serializan contra `Encounter VOIDED` y `Patient ARCHIVED` con
el orden Encounter → Patient → Procedure; una carrera que pierda frente al
cambio del padre no escribe agregado ni auditoría. Un Procedure ya finalizado
no se auto-anula al cambiar el padre. Void es una corrección explícita del
Practitioner autorizado: conserva evidencia y no genera efectos externos.

La transacción de cirugía trata `ClinicalSurgeryDetail` como extensión del
agregado: upsert/cambio de Assistant y eliminación al cambiar `SURGERY` a
`PROCEDURE` ocurren junto con el CAS del root. El orden de locks incluye Owner
histórico para snapshots y Memberships en orden determinista. La lista de rutas,
payloads y errores está en [procedures-api.md](procedures-api.md).

En 6F.2B Anesthesia usa el mismo patrón sin side effects externos. El lock de
Procedure se toma solo si el record está vinculado, y siempre antes del
AnesthesiaRecord para serializar contra `Procedure VOID`. Las observations son
filas hijas editables únicamente en Draft; no tienen version propia y delegan la
concurrencia en `AnesthesiaRecord.version`. La lista de rutas, payloads y
errores está en [anesthesia-api.md](anesthesia-api.md).

En 6G Hospitalization mantiene el orden Encounter → Patient → Hospitalization → Owner → Memberships y usa version para CAS en edición, activación, entries, discharge y void. Encounter VOID y Patient archive toman las mismas filas padre, por lo que una carrera no deja una mutación clínica parcial. La entrada Kardex y su auditoría se confirman en la misma transacción; un episodio DISCHARGED o VOIDED no recibe nuevas entries.

En 6H `DiagnosticOrder` mantiene solicitud y resultado en el agregado, con
transiciones CAS DRAFT → REQUESTED → RESULTED y VOID explícito. El orden de
locks es Encounter → Patient → DiagnosticOrder → Owner (al congelar contexto)
→ Memberships ordenadas/deduplicadas. Encounter VOID y Patient archive toman
los locks padre compatibles: si la operación clínica gana primero, el cambio
posterior del padre conserva su evidencia; si gana el cierre del padre, la
mutación Draft/Requested se rechaza. Archive de Patient se permite con órdenes
pendientes, que luego quedan de solo lectura salvo void. Auditoría lifecycle y
datos se escriben atómicamente; no hay dependencia de archivos ni side effects.

## Checklist para implementación futura

- [x] Tenant compuesto probado para lectura y escritura del Clinical Core.
- [x] Estados, versionado y transiciones cubiertos con tests de CAS y carrera
      de creación lazy.
- [x] Auditoría de actor, Membership y snapshots profesionales.
- [ ] Outbox idempotente para email, PDF, Storage y Agenda.
- [ ] No hard-delete de evidencia finalizada.
- [ ] Política de retención y firma revisada legalmente.
- [ ] Métricas para fallos de proyección Patient y reintentos.
