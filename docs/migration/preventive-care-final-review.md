# Revisión final de Preventive Care — Fase 6E.4

Esta matriz cierra la comparación con el comportamiento observado en Lativet.
No es un plan para iniciar el siguiente módulo y no autoriza side effects que
no estén explícitamente descritos aquí.

| Comportamiento legacy observado                           | Easyvet                                             | Estado                      | Decisión                                               |
| --------------------------------------------------------- | --------------------------------------------------- | --------------------------- | ------------------------------------------------------ |
| Vacunación embebida en `clinical_consultation`            | Tabla `Vaccination` ligada a `ClinicalEncounter`    | PRESERVADO                  | Separación de satélite con vínculo clínico obligatorio |
| Desparasitación embebida en `clinical_consultation`       | Tabla `Deworming` ligada a `ClinicalEncounter`      | PRESERVADO                  | Misma frontera transaccional                           |
| `Patient.vaccination_status`                              | No existe proyección en `Patient`                   | REDISEÑADO INTENCIONALMENTE | La historia es la fuente de verdad                     |
| `Patient.deworming_status`                                | No existe proyección en `Patient`                   | REDISEÑADO INTENCIONALMENTE | Evita estados derivados obsoletos                      |
| Estados Aplicada / Próxima / No aplicada / Contraindicada | `DRAFT` / `FINALIZED` / `VOIDED` con `nextDueOn`    | REDISEÑADO INTENCIONALMENTE | Lifecycle auditable e irreversible                     |
| Fecha de aplicación                                       | `administeredOn` civil `YYYY-MM-DD`                 | PRESERVADO                  | Sin desplazamiento por timezone                        |
| Próxima fecha / seguimiento                               | `nextDueOn` validado y ordenado                     | REDISEÑADO INTENCIONALMENTE | No crea reminders ni citas                             |
| Lote, vencimiento, laboratorio y dosis                    | Campos explícitos; vencimiento anterior es warning  | PRESERVADO                  | Validación y snapshot según lifecycle                  |
| Profesional responsable                                   | Membership Practitioner + perfil + snapshot         | PRESERVADO                  | Se congela al finalizar                                |
| Edición y borrado libre                                   | PATCH solo DRAFT; VOID con motivo; no DELETE/reopen | REDISEÑADO INTENCIONALMENTE | Conserva evidencia clínica                             |
| Certificado o documento descargable                       | Fuera de Preventive Care                            | POSTERGADO                  | Requiere decisión documental posterior                 |
| Agenda, seguimiento o notificaciones automáticas          | Ningún side effect                                  | POSTERGADO                  | Requiere outbox y decisión de producto                 |
| Inventario/ventas/facturación                             | Ninguna integración                                 | POSTERGADO                  | Fuera del alcance 6E                                   |
| Catálogos/protocolos por especie                          | Texto y enums mínimos                               | PRODUCT DECISION REQUIRED   | No inventar catálogo clínico                           |
| Importación histórica masiva                              | No implementada                                     | POSTERGADO                  | Requiere mapeo, provenance y auditoría                 |

## Resultado del gate

El alcance Preventive Care queda **COMPLETADO** para Vaccination y Deworming.
Las limitaciones marcadas como POSTERGADO o PRODUCT DECISION REQUIRED son
conscientes y no representan fallos del módulo actual. Fase 6E.4 no crea tablas
ni migraciones adicionales.
