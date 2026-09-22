# Revisión final de migración — Procedures, Surgery y Anesthesia

La comparación distingue la continuidad funcional de la implementación legacy
de las decisiones explícitas del modelo Easyvet. `POSTERGADO` identifica
alcance que no pertenece a este cierre y no constituye un bug de 6F.

| Legacy                                        | Easyvet                                                                                                      | Estado                      | Decisión                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Consulta genérica Surgery/Procedure           | `ClinicalProcedure` único con kind `PROCEDURE` o `SURGERY` y lifecycle independiente                         | REDISEÑADO INTENCIONALMENTE | Mantener una raíz de dominio con tipo explícito; no introducir `GenericClinicalEvent`.                                          |
| SurgeryDetail asociado al procedimiento       | `ClinicalSurgeryDetail` 0..1 presente solo para `SURGERY`                                                    | PRESERVADO                  | Conservar área, lado, sangrado, cierre y asistente con invariantes tenant-aware.                                                |
| Consulta de registro anestésico               | `AnesthesiaRecord` independiente vinculado obligatoriamente a Encounter/Patient y opcionalmente a Procedure  | REDISEÑADO INTENCIONALMENTE | Permitir anestesia standalone y múltiples registros; conservar lifecycle y snapshots propios.                                   |
| Monitorización almacenada como JSON           | `AnesthesiaObservation` tipada, ordenable y auditable bajo versión CAS del padre                             | REDISEÑADO INTENCIONALMENTE | Validar unidades/valores y no mezclar con mediciones generales del Patient.                                                     |
| Equipo quirúrgico en texto libre              | Responsable Practitioner y asistente clínico opcional seleccionado por Membership; snapshots en finalización | REDISEÑADO INTENCIONALMENTE | El responsable y el asistente tienen roles definidos; no mantener participantes arbitrarios en texto.                           |
| Status legacy                                 | `DRAFT → FINALIZED → VOIDED` por agregado                                                                    | REDISEÑADO INTENCIONALMENTE | Finalizados/anulados son evidencia histórica; no reabrir ni borrar físicamente.                                                 |
| Edición y eliminación                         | Draft editable con CAS; finalización bloquea edición; Void requiere motivo y conserva el registro            | REDISEÑADO INTENCIONALMENTE | Eliminar físicamente solo observation dentro de Draft, con CAS/auditoría del padre; no hard delete del procedimiento/anestesia. |
| Consentimiento quirúrgico                     | Sin modelo ni evidencia autoritativa en 6F                                                                   | POSTERGADO                  | Requiere decisión regulatoria y de producto sobre obligatoriedad, contenido y firma.                                            |
| Reportes/documentos de cirugía                | Sin documentos, Storage ni adjuntos en 6F                                                                    | POSTERGADO                  | Diseñar en el módulo documental con política de retención y acceso.                                                             |
| PDF anestésico                                | No se genera PDF                                                                                             | POSTERGADO                  | Exportación queda para una fase documental posterior.                                                                           |
| Medicamentos anestésicos                      | Campos de medicamentos/fluidos libres existentes; sin catálogo o dosificación estructurada                   | POSTERGADO                  | El modelo farmacológico estructurado requiere decisión de producto y validación clínica.                                        |
| Inventario asociado                           | Sin consumo ni movimientos de inventario por Procedure/Surgery/Anesthesia                                    | POSTERGADO                  | Integración con Inventory/Billing permanece fuera de 6F.                                                                        |
| Cita asociada / Appointment boundary          | No se altera ni finaliza la cita desde estos agregados                                                       | NO APLICA                   | Procedure/Anesthesia se vinculan con Encounter; no crear side effects o transiciones de Appointment.                            |
| Procedimientos históricos de fuentes externas | Sin importación automática o backfill                                                                        | POSTERGADO                  | Definir antes mapeo, provenance, tenant, zona horaria y calidad de datos.                                                       |
| Plantillas quirúrgicas editables              | No hay catálogo/configurador de cirugías                                                                     | PRODUCT DECISION REQUIRED   | Producto debe definir quién administra plantillas y su versionado clínico.                                                      |

## Limitaciones conocidas

Los siguientes elementos no están implementados y no son bugs de la fase:
Consent; documentos quirúrgicos/anestésicos; PDF; firma; modelo avanzado de
medicación; dispositivos de monitorización; ServiceCatalog; Inventory; Billing;
procedimientos históricos externos; y plantillas quirúrgicas configurables.

La guía de UI/API y los límites de permisos/tenant se encuentran en
[`../architecture/procedures-anesthesia-frontend.md`](../architecture/procedures-anesthesia-frontend.md),
[`../architecture/procedures-api.md`](../architecture/procedures-api.md) y
[`../architecture/anesthesia-api.md`](../architecture/anesthesia-api.md).
