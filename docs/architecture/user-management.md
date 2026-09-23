# Gestión de usuarios y Memberships (Fase 10)

`User` es una identidad global de Easyvet. `Membership` es su relación de acceso a
una sola `Organization`; una persona puede tener varias Memberships sin duplicar
la cuenta. El administrador del tenant solo gestiona Memberships de su propia
organización. No puede suspender la identidad global, modificar `PlatformRole`,
cambiar una contraseña ajena ni consultar afiliaciones de otros tenants.

## Onboarding

`POST /api/v1/organization/members` normaliza el email y crea una Membership
activa. Para una identidad nueva genera una contraseña aleatoria de 22 caracteres
con `crypto.randomInt`, almacena únicamente su hash Argon2id y devuelve el texto
temporal una sola vez. No se registra en auditoría ni logs. La identidad inicia
con `mustChangePassword=true`. La pantalla la mantiene solo en memoria y permite
copiarla; no usa almacenamiento persistente del navegador.

Si el email ya existe, no se cambia su contraseña, estado ni rol de plataforma.
Se crea únicamente la Membership y la respuesta contiene
`accountAlreadyExisted=true` y `temporaryPassword=null`. La creación usa una
inserción única tolerante a carreras para evitar duplicar el User; con dos
organizaciones concurrentes solo una solicitud puede devolver la contraseña
temporal de la identidad ganadora.

No hay invitaciones por email, recuperación por correo ni restablecimiento
administrativo de contraseña en V1.

## Contraseña inicial y sesiones

`GET /api/v1/auth/me` expone `mustChangePassword`. Mientras esté activo, la
sesión solo puede usar `GET /auth/me`, `POST /auth/change-password`,
`POST /auth/logout` y rutas públicas. Cambiarla exige la contraseña actual y
una frase de 12 a 128 caracteres; el hash vuelve a generarse con Argon2id.
La transacción conserva la sesión que hace el cambio y revoca las demás sesiones
del mismo User. El contexto de Membership no se usa para cambiar credenciales
globales.

## Directorio y reglas de OWNER

- `GET /api/v1/organization/members`: listado paginado, con filtros tenant-locales
  por estado, rol, ClinicalRole y texto de email/nombre profesional.
- `GET/PATCH /api/v1/organization/members/:membershipId`: detalle mínimo y
  actualización independiente de `MembershipRole` y `ClinicalRole`.
- `POST .../:membershipId/suspend|reactivate`: suspensión reversible. Suspender
  revoca solo sesiones cuyo contexto activo es esa Membership; reactivar exige
  `User.status=ACTIVE` y no restaura sesiones anteriores.

Las respuestas no incluyen `User.id`, `User.status`, `PlatformRole`, hash ni otras
organizaciones. Email y nombre profesional son la proyección visible. Los IDs se
buscan junto con el tenant y un cruce se responde como no encontrado.

OWNER y ADMIN reciben la administración habitual; solo OWNER puede crear,
promover, degradar o suspender una Membership OWNER. Antes de degradar o suspender
se bloquea la fila Organization y se comprueba que quede al menos un OWNER activo.
Ese lock serializa cambios concurrentes de propietarios. Un OWNER puede editarse
a sí mismo mientras el invariante siga satisfecho. ADMIN nunca puede editar un
OWNER.

El cambio de rol se consulta desde la Membership activa en cada petición, sin
cache de permisos por sesión. Retirar `ClinicalRole` no reescribe borradores ni
responsables históricos; finalizar un borrador puede requerir reasignación.

`OrganizationAuditEvent` registra actor, tenant, entidad, acción y metadatos
mínimos; no contiene credenciales ni payloads personales completos. La tabla es
append-only en PostgreSQL.
