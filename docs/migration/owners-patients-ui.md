# UI de Owners y Patients (Fase 4B)

## Alcance

Fase 4B convierte `/propietarios` y `/pacientes` en módulos React conectados a
la API de Fase 4A. No se inició Fase 4C ni se agregaron agenda, historia
clínica, consultas, vacunas, hospitalización, inventario, ventas, caja,
facturación o grooming.

## Rutas y componentes

| Área     | Rutas                                                                                             | Componentes principales                                   |
| -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Owners   | `/propietarios`, `/propietarios/nuevo`, `/propietarios/:ownerId`, `/propietarios/:ownerId/editar` | `OwnerListPage`, `OwnerDetailPage`, `OwnerFormPage`       |
| Patients | `/pacientes`, `/pacientes/nuevo`, `/pacientes/:patientId`, `/pacientes/:patientId/editar`         | `PatientListPage`, `PatientDetailPage`, `PatientFormPage` |

Las tablas reutilizan `DataTable`, `SearchInput`, `PageHeader`, `Card`,
`Button`, `Modal`, `LoadingState`, `EmptyState` y `Alert` existentes.

## Servicios y estado remoto

`ownersApi` y `patientsApi` son las únicas capas que conocen las URLs y validan
respuestas con los contratos Zod compartidos. Los componentes consumen
`useOwners`, `useOwner`, `usePatients` y `usePatient` mediante
`useTenantResource`.

No se incorporó TanStack Query. El estado manual es deliberado y acotado: cada
consulta cancela su actualización al desmontar, soporta retry y resetea `data`
cuando cambia el `organizationId` activo. La búsqueda remota espera 320 ms.

## Tenant switch y permisos

Las keys lógicas de los hooks dependen de la organización activa. Al cambiarla,
el estado se limpia antes del refetch, por lo que no se conserva una fila ni un
detalle de la organización anterior. Las rutas comprueban `owners.*` y
`patients.*`; ocultar botones es solo UX, mientras que NestJS continúa
validando permisos y tenant.

## Formularios y errores

Los formularios reutilizan los schemas de contratos y solo envían campos
editables. `organizationId`, `tenantId`, identificadores y timestamps nunca se
envían. Patient create usa un selector de Owner consultado con búsqueda; el
`ownerId` de la URL de preselección se valida de nuevo contra el endpoint del
tenant activo. Patient edit mantiene el Owner inmutable porque así lo define
Fase 4A.

Los estados 401, 403, 404, 409, 422 y 500 se traducen a mensajes de usuario.
Un 404 cross-tenant se muestra como “Recurso no encontrado”, sin revelar otra
veterinaria. Archive exige confirmación, conserva el registro y no elimina
dependencias.

## Diferencias relevantes frente a Lativet

- Se mantiene la densidad de tablas, formularios compactos y jerarquía de
  ficha, pero se eliminan manipulaciones DOM y JavaScript legacy.
- Archive sustituye el borrado destructivo legacy.
- No se muestran citas, historia clínica, vacunas, facturas, saldo ni última
  consulta porque todavía no existen esos módulos.
- Campos `NEEDS REVIEW` de la referencia legacy no se resuelven en la UI; se
  conserva el contrato aprobado de Fase 4A.
