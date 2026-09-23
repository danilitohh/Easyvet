# FollowUps / recordatorios internos — Fase 6J

## Modelo

`ClinicalFollowUp` es un agregado de continuidad del cuidado, tenant-scoped
por `organizationId`, ligado obligatoriamente a Patient y opcionalmente a un
Encounter del mismo tenant y Patient. También conserva Membership de creación,
asignación, finalización y anulación mediante FKs tenant-safe `RESTRICT`.
No es hijo del ciclo de vida del Encounter ni sustituye a una Evolution.

El estado es `OPEN`, `COMPLETED` o `VOIDED`. Solo se permiten
`OPEN → COMPLETED`, `OPEN → VOIDED` y `COMPLETED → VOIDED`. No hay reopen ni
hard delete. Cada edición/transición requiere `expectedVersion`; una operación
ganadora incrementa versión exactamente una vez. Las restricciones SQL exigen
versión positiva y estados/snapshots consistentes.

`dueOn` es `DATE` y viaja como `YYYY-MM-DD` sin conversión de zona horaria.
`reminderAt` es un único `TIMESTAMPTZ` nullable: la UI convierte hora local de
Organization a instant explícito; el servidor conserva ese instante. `reminderDue`
es calculado al leer (`OPEN && reminderAt <= now`), no es estado persistido ni
una entidad Reminder.

## Finalización y conservación histórica

Completar exige resultado no vacío y Membership Practitioner activa con perfil
profesional configurado. El actor no tiene que ser el Membership asignado. En la
transacción se congelan nombre de Patient, Owner y Practitioner/licencia; se usa
el Owner de `sourceEncounter.ownerIdAtTime` si existe source, o Owner actual del
Patient si no. El source solo puede ser Encounter del mismo tenant/Patient en
`DRAFT` o `FINALIZED` para create/update/complete. Si luego se anula, un FollowUp
OPEN queda solo anulable y muestra advertencia; un FollowUp COMPLETED permanece
COMPLETED y conserva sus snapshots.

Patient archivado conserva lecturas históricas; bloquea create/update/complete,
pero no void. No se auto-anulan seguimientos abiertos.

## Concurrencia y privacidad

Orden de locks: `Patient → source Encounter → ClinicalFollowUp → Owner (complete)
→ Memberships ordenadas y deduplicadas`. Los writers históricos que toman
Encounter antes de Patient se protegen con `NOWAIT` al intentar el parent y
reintentos acotados únicamente para `55P03`; contención persistente responde
`FOLLOW_UP_BUSY`. Archive comparte primero el lock del Patient.

Auditoría registra transición, versiones y nombres de campos modificados; no
incluye title, reason, notes, outcome, completion notes ni void reason. Detail y
list exponen resúmenes clínicos necesarios, sin correo de User ni datos de
contacto del Owner. El texto se renderiza como texto, nunca como HTML.

## Efectos y límites de V1

Completar no crea ClinicalEncounter, ClinicalEvolution, Appointment, Reminder,
Document, evento de inventario, Sale o Invoice; tampoco muta peso de Patient ni
envía email, SMS, WhatsApp o push. No hay polling, scheduler, outbox ni
recurrencia. Recordatorios externos, preferencias, campañas, integración de
calendario, próxima ocurrencia automática y Appointment automático quedan
post-V1. El detalle de transacciones se encuentra en
[`clinical-transactions.md`](clinical-transactions.md), autorización en
[`clinical-authorization.md`](clinical-authorization.md) y endpoints en
[`follow-ups-api.md`](follow-ups-api.md).
