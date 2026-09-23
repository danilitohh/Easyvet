# Revisión final de FollowUps — Fase 6J

## Referencia Lativet

La revisión fue de solo lectura sobre el checkout legacy Lativet en el commit
`05fea495cb13208b27bf470b3570987fd501a81e`; no se ejecutó Lativet ni se conectó
a su base. Se revisaron `Backend/SEGUIMIENTOS/README.md`, `servicios.py`,
`persistencia.py` y `rutas.py`.

| Aspecto               | Lativet observado                                                                                           | Decisión Easyvet 6J                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Persistencia          | `clinical_followups` registra controles asociados a consulta; `control_reminders` representa recordatorios. | `ClinicalFollowUp` propio de Organization/Patient y sin tabla Reminder.                                                                          |
| Recordatorio/contacto | Flujo legacy programa envío de correo y almacena estado operativo del recordatorio.                         | Solo `reminderAt` nullable; reminderDue computado dentro de la aplicación. No email, SMS, WhatsApp, push, job o permiso de browser notification. |
| Resultado             | La finalización legacy proyecta datos en una consulta clínica sintética.                                    | Resultado y notas quedan en el mismo agregado con Practitioner/Patient/Owner snapshots; no se crea Encounter ni Evolution.                       |
| Próxima fecha         | Al completar puede insertar un FollowUp siguiente.                                                          | No hay recurrencia ni próxima ocurrencia automática; el usuario puede crear otro manualmente.                                                    |
| Agenda/Appointment    | Legacy puede proyectar acciones derivadas según el flujo.                                                   | Sin Appointment automático, cambio de agenda, inventario o facturación.                                                                          |
| Cambios históricos    | Flujo legacy permite administrar los seguimientos desde persistencia y rutas propias.                       | OPEN editable con CAS; COMPLETED y VOIDED terminales; corrección mediante VOID con motivo. Sin hard delete.                                      |

## Resultado de migración

El modelo usa `dueOn DATE` como fecha civil y `reminderAt TIMESTAMPTZ` como
instante, composite FKs tenant-safe, checks de lifecycle y auditoría sin
narrativa clínica. API, contratos, permisos, cola global, historia por Patient,
detalle, create/edit/complete/void y widget de dashboard se implementan en el
mismo corte. Las migraciones se aplican solo a `easyvet_dev` y `easyvet_test`;
datos seed y QA son ficticios. No se inicia Grooming ni otra fase como parte de
este cierre.
