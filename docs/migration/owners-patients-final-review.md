# Revisión final de Owners + Patients (Fase 4C)

## Alcance y evidencia

La revisión cubre el flujo Database → Prisma → NestJS → tenant/permissions →
REST → React → UX. La comparación legacy se hizo contra
`docs/migration/owners-patients-reference.md` y las fuentes de auditoría que
ese documento cita. El checkout actual no contiene los módulos Lativet; por
eso no se inventan reglas fuera de la evidencia documentada.

## Matriz de comportamiento

| Comportamiento                              | Lativet                                     | Easyvet                                                             | Estado                      | Decisión                                           |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| Owner con nombre, identificación y contacto | Datos opcionales y búsqueda por contacto    | Campos tenant-scoped, búsqueda acotada y normalización              | PRESERVADO                  | Mantener contrato de Fase 4A                       |
| Separación nombre/apellido                  | No confirmada de forma fiable               | `firstName` obligatorio, `lastName` opcional                        | REDISEÑADO INTENCIONALMENTE | Permite nombres de una sola palabra                |
| Documento del Owner                         | Tipo+número opcionales, unicidad parcial    | Unicidad por organización, tipo y número normalizado                | PRESERVADO                  | Null no entra en conflicto                         |
| Owner → Patients                            | Uno a muchos                                | Un Owner principal por Patient                                      | PRESERVADO                  | Responsables adicionales POSTERGADO                |
| Paciente duplicado por Owner+nombre         | Servicio legacy lo impedía                  | Se permiten nombres descriptivos repetidos; `Patient.id` identifica | REDISEÑADO INTENCIONALMENTE | Dos Patients del mismo Owner pueden llamarse igual |
| Especie/raza                                | Texto extensible                            | Texto validado, sin catálogo global                                 | PRESERVADO                  | Soporta aves, conejos y exóticos                   |
| Sexo                                        | Valores legacy no formalizados              | `MALE`, `FEMALE`, `UNKNOWN`                                         | REDISEÑADO INTENCIONALMENTE | No se mezcla con esterilización                    |
| Fecha de nacimiento                         | Fecha/edad y aproximación                   | Fecha civil nullable, no futura, `birthDateEstimated`               | REDISEÑADO INTENCIONALMENTE | Sin conversiones de timezone                       |
| Peso actual                                 | Positivo y derivado de historial clínico    | Snapshot decimal positivo sin límite veterinario                    | REDISEÑADO INTENCIONALMENTE | Historial queda para clínica                       |
| Microchip                                   | Buscable, unicidad no confirmada            | Normalizado para búsqueda, sin unicidad impuesta                    | PRESERVADO                  | No se inventa regla global                         |
| Borrado                                     | Cascada destructiva                         | Archive lógico sin cascada ni DELETE                                | REDISEÑADO INTENCIONALMENTE | Protege historial futuro                           |
| Owner con Patients activos                  | No hay regla archive equivalente confirmada | Archive bloqueado con `OWNER_HAS_ACTIVE_PATIENTS`                   | REDISEÑADO INTENCIONALMENTE | Evita estado incoherente                           |
| Restore/reactivación                        | Eventos legacy no formalizados              | No implementado                                                     | POSTERGADO                  | Requiere política de dominio                       |
| Historia, fotos y preventivos               | Presentes en legacy                         | Fuera de Fase 4C                                                    | POSTERGADO                  | No ampliar el primer dominio                       |

## Decisiones finales e invariantes

### Owner

- `organizationId` siempre proviene del contexto autenticado.
- Tipo y número de documento deben llegar juntos; ambos vacíos se guardan como
  `NULL`. El valor de presentación se conserva y la columna normalizada se usa
  para unicidad tenant-scoped.
- Email se normaliza a minúsculas; identificadores se recortan, colapsan y
  normalizan a mayúsculas. No se fija un formato de documento o teléfono por
  país.
- Un Owner archivado sigue siendo legible con permisos, pero no se edita ni se
  archiva de nuevo con cambios. No se puede archivar si conserva Patients
  `ACTIVE`.

### Patient

- `species` y `breed` permanecen como texto extensible; no se limita el
  producto a DOG/CAT.
- `microchipNumber` se recorta y normaliza a mayúsculas. No se impone
  unicidad porque la auditoría legacy no aporta evidencia suficiente.
- `currentWeightKg` es un snapshot operativo positivo, almacenado como
  `NUMERIC(20,6)` para conservar precisión. No impone un límite veterinario
  específico de especie ni representa historial clínico.
- `name` y `nameNormalized` son información descriptiva para búsqueda y orden.
  No existe unicidad por nombre: dos Patients del mismo Owner pueden llamarse
  igual y `Patient.id` es la identidad real.
- `birthDate` es nullable, estrictamente `YYYY-MM-DD`, no puede ser futura y no
  se convierte con la zona horaria local.
- Un Patient tiene un Owner principal. Cambio de Owner y múltiples
  responsables quedan postergados.
- Patients archivados siguen disponibles por detalle/listado archivado, quedan
  fuera del listado activo, no se editan y no se eliminan físicamente.

### Estado y base de datos

`status` es la fuente de estado visible y `archivedAt` su evidencia temporal.
Una migración nueva agrega checks para que `ACTIVE` implique `archivedAt IS
NULL` y `ARCHIVED` implique `archivedAt IS NOT NULL`. El peso solo exige ser
positivo cuando existe y no hay índice único de nombres: `nameNormalized` queda
para búsqueda/ordenamiento.

## Seguridad y tenant safety

- Todas las rutas Owners/Patients pasan por autenticación, `TenantContextGuard`
  y `PermissionGuard`; no hay endpoints `@Public()` nuevos ni bypass de
  PlatformAdmin.
- List, detail, update y archive usan organización activa. Las mutaciones
  finales incluyen la organización y Patient conserva FK compuesta
  `(ownerId, organizationId)`.
- Payloads con `organizationId`, `tenantId`, lifecycle fields, ids o timestamps
  son rechazados por `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) y
  DTOs estrictos.
- Foreign IDs devuelven el mismo 404 que un recurso inexistente.
- Se revisó la matriz actual: OWNER/ADMIN tienen CRUD completo; VETERINARIAN,
  ASSISTANT y RECEPTION no archivan; GROOMER y CASHIER tienen lectura.
  La decisión de redacción de PII para roles de lectura requiere confirmación
  humana antes de cambiar contratos.
- Archive/create de Owner/Patient usa transacción y bloqueo de fila del Owner
  para serializar la carrera entre crear un Patient y archivar su Owner.
- La eliminación de la unicidad por nombre se realizó en una migración nueva;
  `nameNormalized` conserva únicamente su utilidad de consulta.

## Cache, UX y accesibilidad

Los hooks manuales incluyen el `organizationId` activo como dependencia,
cancelan cargas anteriores, limpian `data` inmediatamente al cambiar de
tenant y vuelven a consultar. En el formulario de Patient, el Owner elegido se
resetea al cambiar de organización y se valida otra vez contra el tenant nuevo.
No hay cache persistente ni TanStack Query.

Se verificaron labels, asociación de errores, modal con foco inicial/Escape,
botones de paginación, estados de archive y doble submit. Las tablas usan
overflow horizontal; formularios, selector de Owner, detalle y modal se
revisaron a 390 px, tablet y desktop.

## Pending Domain Decisions

Se mantienen `NEEDS REVIEW` porque la evidencia no permite resolverlos sin una
decisión de producto:

1. Partición definitiva de nombres legacy y reglas de importación por país.
2. Normalización y validación internacional de teléfonos y documentos.
3. Formato/checksum y eventual unicidad de microchips.
4. Estados clínicos de fallecimiento/reactivación y política de restore.
5. Múltiples responsables o contactos adicionales por Patient.
6. Redacción de documento, dirección, notas, microchip y peso para
   GROOMER/CASHIER.
7. Separación futura entre Owner clínico y cliente de facturación.

## Limitaciones conocidas

- Las búsquedas usan `contains` y paginación `OFFSET`; no se añade full-text ni
  rate limiting en esta fase.
- El estado de archive no tiene restore; un archive accidental requiere una
  futura decisión y operación explícita.
- La cobertura DB se ejecuta con `RUN_DB_TESTS=1` contra PostgreSQL local.
- Los registros manuales `QA Owner Manual` y `QA Pet` solo existen en la base
  local y no requieren migración de limpieza.
