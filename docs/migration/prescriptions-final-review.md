# Revisión final de Prescriptions — Fase 6D.4

Esta matriz cierra la comparación entre el checkout legacy de Lativet descrito
en [`prescriptions-reference.md`](./prescriptions-reference.md) y la
implementación de Easyvet. La auditoría cubre únicamente Prescriptions; no
habilita módulos posteriores.

| Comportamiento legacy                                                  | Easyvet                                                                                 | Estado                      | Decisión                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| Fórmula modelada como `Consultation` con `consultation_type = Formula` | Agregado `Prescription` ligado obligatoriamente a `ClinicalEncounter`                   | REDISEÑADO INTENCIONALMENTE | Mantener trazabilidad clínica y lifecycle propio           |
| Items serializados en JSON (`document_reference`)                      | `PrescriptionItem` relacional, ordenado por `position`                                  | REDISEÑADO INTENCIONALMENTE | Evitar JSON como única fuente y permitir reemplazo atómico |
| Edición last-write-wins                                                | Solo `DRAFT`, `expectedVersion` y `409 PRESCRIPTION_STALE`                              | REDISEÑADO INTENCIONALMENTE | Proteger evidencia clínica ante concurrencia               |
| Hard delete de la fórmula                                              | No existe `DELETE`; `FINALIZED → VOIDED` conserva evidencia                             | REDISEÑADO INTENCIONALMENTE | Retención histórica y auditoría append-only                |
| Profesional tomado del formulario genérico                             | Membership Practitioner activa, actor igual al prescriptor y perfil válido al finalizar | REDISEÑADO INTENCIONALMENTE | Separar identidad autenticada de texto enviado por cliente |
| Diagnóstico dentro de resumen/document reference                       | `diagnosisSnapshot` determinista al finalizar                                           | REDISEÑADO INTENCIONALMENTE | Congelar el contexto clínico sin recalcularlo              |
| PDF de fórmula                                                         | No se genera PDF ni documento en esta fase                                              | POSTERGADO                  | Fase documental posterior                                  |
| Patient/Owner actuales al renderizar                                   | Patient y Owner derivados del Encounter; snapshots históricos al finalizar              | REDISEÑADO INTENCIONALMENTE | Preservar el contexto clínico original                     |
| Inventario, ventas y cobro                                             | Sin FK, lookup ni side effect                                                           | POSTERGADO                  | Requiere decisión de producto independiente                |
| Múltiples fórmulas                                                     | Un Encounter admite `0..N` Prescriptions                                                | PRESERVADO                  | Crear una nueva receta no reabre otra                      |
| Firma, email y entrega                                                 | No implementados                                                                        | POSTERGADO                  | Fuera del núcleo clínico                                   |
| Medicamentos controlados y reglas jurisdiccionales                     | No implementados                                                                        | PRODUCT DECISION REQUIRED   | Requieren requisitos regulatorios explícitos               |

## Invariantes cerradas

- Lifecycle único: `DRAFT → FINALIZED → VOIDED`; no existen transiciones hacia
  atrás ni status arbitrario mediante `PATCH`.
- `FINALIZED` y `VOIDED` son inmutables; solo una receta `FINALIZED` puede
  anularse.
- Un Encounter `VOIDED` bloquea create/update/finalize de drafts, pero no
  elimina recetas ni cambia el estado de una receta ya `FINALIZED`.
- Create, update y finalize toman locks en orden `ClinicalEncounter → Patient →
Prescription`; finalize añade `Owner → Prescriber Membership` antes de leer
  snapshots. `voidEncounter`, archive de Patient, Owner update y profile upsert
  usan el mismo prefijo/fila correspondiente. Esto define la política de carrera:
  quien obtiene primero el lock del Encounter confirma su operación; la operación
  perdedora reevalúa el estado y devuelve un conflicto controlado.
- Update reemplaza todos los items dentro de una única transacción. El backend
  ordena y normaliza posiciones a `0..N-1`; la base exige posición no negativa,
  nombre no vacío y unicidad `(prescriptionId, position)`.
- Un Draft puede tener cero items. Finalize exige al menos uno y nombres no
  vacíos.
- Los snapshots de profesional, Patient, Owner y diagnóstico son server-side y
  se fijan únicamente al finalizar.
- PostgreSQL refuerza `version > 0` y la coherencia de metadata terminal en la
  migración `20260921201000_harden_prescription_lifecycle_invariants`; no hay
  bypass válido por escritura SQL directa.
- Todas las consultas tenant-scoped incluyen `organizationId`; no hay endpoints
  independientes para `PrescriptionItem`.

## Limitaciones conocidas

Permanecen deliberadamente postergados PDF/document generation, firma, email,
MedicationCatalog, Inventory, dispensing, billing, templates, repeat
prescription, controlled-drug rules y requisitos de licencia por jurisdicción.
