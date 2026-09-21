# Decisiones cerradas — Preventive Care Design Gate 6E.1.1

Este registro cierra las decisiones estructurales de Vaccination y Deworming
antes de Prisma. No autoriza implementación. La evidencia legacy corresponde a
`05fea495cb13208b27bf470b3570987fd501a81e`.

## Matriz de decisiones

| Tema                     | Decisión 6E.1.1                                                                                           | Estado  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------- |
| Encounter                | Siempre requerido; no existe evento standalone en MVP.                                                    | CERRADO |
| Parent al crear          | Solo Encounter `DRAFT` o `FINALIZED`; `VOIDED` rechaza.                                                   | CERRADO |
| Parent al editar draft   | Permitido mientras parent no sea `VOIDED`.                                                                | CERRADO |
| Parent al finalizar      | Solo parent `DRAFT` o `FINALIZED`.                                                                        | CERRADO |
| Parent VOID posterior    | Preventivo `FINALIZED` permanece `FINALIZED`; exponer `parentEncounterStatus`.                            | CERRADO |
| Multiplicidad            | `0..N` Vaccinations y `0..N` Dewormings por Encounter.                                                    | CERRADO |
| Modelo                   | Dos tablas independientes; sin `PreventiveEvent`, STI, JSON polimórfico ni payload genérico.              | CERRADO |
| Lifecycle                | Enum común `PreventiveRecordStatus`: `DRAFT`, `FINALIZED`, `VOIDED`.                                      | CERRADO |
| applicationStatus        | No se implementa. Los labels legacy se rediseñan intencionalmente.                                        | CERRADO |
| Administrado             | `administeredOn DATE`, nullable en draft y requerido al finalizar.                                        | CERRADO |
| nextDue                  | `nextDueOn DATE nullable`; si existe `>= administeredOn`, igualdad permitida.                             | CERRADO |
| Fecha futura             | No se bloquea `administeredOn > today`; queda decisión futura de producto.                                | CERRADO |
| Vencimiento              | `expiryOn DATE nullable` solo Vaccination; no check duro contra administeredOn.                           | CERRADO |
| Lote                     | `lotNumber String nullable`, trim, libre, no unique.                                                      | CERRADO |
| Laboratorio              | Un solo nombre: `laboratoryName String nullable`; sin Supplier/Inventory FK.                              | CERRADO |
| Nombre vacuna            | `vaccineName String`; nullable en draft, requerido no vacío al finalizar.                                 | CERRADO |
| Tipo vacuna              | `vaccineType String nullable`; sin enum inicial.                                                          | CERRADO |
| Vía vacuna               | `route String nullable`; columna propia de texto, sin catálogo.                                           | CERRADO |
| Producto desparasitación | `productName String`; nullable en draft, requerido no vacío al finalizar.                                 | CERRADO |
| Tipo desparasitación     | `dewormingType String nullable`; no comparte enum con vaccineType.                                        | CERRADO |
| Vía desparasitación      | No se agrega en 6E.2: legacy mezcla vía/modalidad.                                                        | CERRADO |
| Dosis                    | `doseText String nullable` para ambos dominios.                                                           | CERRADO |
| Intervalo legacy         | No se conserva; si hay fecha calculada se guarda únicamente `nextDueOn`.                                  | CERRADO |
| Última fecha legacy      | `deworming_last_date` no se copia; la historia previa es otro evento.                                     | CERRADO |
| Follow-up legacy         | Se transforma a `nextDueOn` cuando hay fecha; no Reminder/FollowUp.                                       | CERRADO |
| Reason Deworming         | No existe `reason` separado en MVP; el follow-up reason no tiene esa semántica.                           | CERRADO |
| Notes                    | `notes String nullable` en ambos; narrativa acotada.                                                      | CERRADO |
| Responsable              | Membership `ACTIVE`, User `ACTIVE`, `ClinicalRole.PRACTITIONER` y perfil con `displayName`.               | CERRADO |
| Autor de finalize        | Actor de sesión debe ser exactamente el responsable; no finalize-on-behalf.                               | CERRADO |
| administeredBy           | Opcional; Practitioner o Clinical Assistant activos con clinicalRole no nulo.                             | CERRADO |
| Assistant                | Read/create/update draft/administeredBy; nunca finalize/void.                                             | CERRADO |
| Snapshots                | Solo al FINALIZE; nunca rehidratar desde entidades actuales.                                              | CERRADO |
| Patient/Owner            | `patientNameSnapshot` y `ownerDisplayNameSnapshot` al finalizar; Owner deriva de `ownerIdAtTime`.         | CERRADO |
| Organization snapshot    | No en core; queda para Document/Certificate futuro.                                                       | CERRADO |
| Patient projections      | No agregar status/last/next preventivos a Patient.                                                        | CERRADO |
| Inventario               | Sin FK, stock, reserva, venta, factura o producto en 6E.2.                                                | CERRADO |
| Reminders/Agenda         | `nextDueOn` no crea Reminder, Appointment, FollowUp ni Notification.                                      | CERRADO |
| Documentos               | Certificados, PDF, Storage y Signature postergados.                                                       | CERRADO |
| Auditoría                | Reusar `ClinicalAuditEvent`; agregar entidades `VACCINATION`/`DEWORMING` y acciones genéricas existentes. | CERRADO |
| Concurrencia             | `version=1`, `expectedVersion`, CAS en PATCH draft, finalize y void.                                      | CERRADO |
| Lock order               | Encounter → Patient → Preventive; finalize añade Owner → Memberships ordenadas por ID.                    | CERRADO |
| Parent races             | Tests obligatorios VOID vs Create/Update/Finalize desde 6E.2.                                             | CERRADO |
| Patient archived         | Bloquea create/update draft/finalize; permite read y void histórico autorizado.                           | CERRADO |
| Draft delete             | No endpoint DELETE; drafts abandonados permanecen.                                                        | CERRADO |
| Void                     | Solo FINALIZED → VOIDED; motivo requerido; sin reopen/hard delete.                                        | CERRADO |
| Mínimo Vaccination       | administeredOn, vaccineName, responsable Practitioner y perfil válido.                                    | CERRADO |
| Mínimo Deworming         | administeredOn, productName, responsable Practitioner y perfil válido.                                    | CERRADO |
| Composite FKs            | Todas las relaciones incluyen `organizationId`; Encounter también `patientId`.                            | CERRADO |
| createdBy                | `createdByMembershipId` server-derived y requerido.                                                       | CERRADO |
| finalized/voided by      | IDs tenant-safe; finalize == responsable, void Practitioner autorizado.                                   | CERRADO |
| Índices                  | Historia por patient/date, Encounter, status y responsable; sin sobreindexar.                             | CERRADO |
| Permisos                 | Dominios separados `vaccinations.*` y `dewormings.*`.                                                     | CERRADO |
| APIs                     | Seis endpoints por dominio, sin child/delete/standalone.                                                  | CERRADO |
| Contratos                | Zod propios de lista, draft, update, finalize, void, summary/detail.                                      | CERRADO |
| Listas                   | 20 por defecto, 100 máximo; status/Encounter/date range; fecha DESC NULLS LAST.                           | CERRADO |
| Migración legacy         | Consultation → Encounter + agregado; proyecciones y campos ambiguos no se copian automáticamente.         | CERRADO |
| Registros externos       | Importación histórica con contexto incompleto postergada; no inventar Practitioner.                       | CERRADO |

## Modelos definitivos

La lista literal de campos, nullability e invariantes está en
[preventive-care-core-6e2.md](preventive-care-core-6e2.md). Ese documento es la
única fuente normativa para implementar 6E.2.

## Únicas decisiones futuras permitidas

No quedan decisiones estructurales para el schema de 6E.2. Solo siguen abiertas
decisiones genuinamente regulatorias o de producto:

- obligatoriedad jurisdiccional de lote o licencia;
- importación de historia externa/retrospectiva;
- certificados y firma;
- biológicos controlados;
- protocolos por especie;
- vínculo opcional con inventario.

## Gate de autorización

6E.2 no puede comenzar hasta que se verifique que la implementación respeta
literalmente `preventive-care-core-6e2.md`, incluyendo parent VOID, Patient
archived, CAS, lock order, role matrix, APIs y pruebas de carreras. Este
checkpoint no modifica código funcional.
