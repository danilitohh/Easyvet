# Autenticación y sesiones (Fase 3B)

Fase 3B implementa autenticación real para la API y el shell web. El dominio de
permisos, invitaciones, recuperación de contraseña y MFA queda fuera de alcance.

## Passwords

- `User.passwordHash` almacena únicamente hashes Argon2id.
- La configuración explícita es `memoryCost=65536`, `timeCost=3`,
  `parallelism=4` y `hashLength=32`; la sal aleatoria la genera `argon2`.
- Errores de hash malformado y credenciales incorrectas tienen la misma respuesta
  genérica (`Invalid credentials`).

## Sesiones

`Session` guarda un token opaco generado con `randomBytes(32)`, pero solo persiste
su SHA-256 hexadecimal (`tokenHash`). El token nunca se registra ni se incluye en
respuestas JSON. La cookie configurable (`SESSION_COOKIE_NAME`, por defecto
`easyvet_session`) es `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` únicamente
en producción. El TTL configurable (`SESSION_TTL_HOURS`) es de 168 horas por
defecto.

El guard verifica hash, expiración, revocación, estado activo del usuario y el
contexto tenant. Una membresía u organización suspendida elimina el contexto
activo de la sesión sin conceder acceso a otro tenant. No se implementan
permisos en el guard; eso corresponde a Fase 3C.

## Endpoints

- `POST /api/v1/auth/login`: verifica credenciales y selecciona automáticamente
  la única membresía activa. Varias membresías requieren selección explícita.
- `GET /api/v1/auth/me`: restaura la sesión actual.
- `POST /api/v1/auth/switch-organization`: cambia por `membershipId` y valida
  pertenencia, estado y organización activa; un id ajeno responde 404.
- `POST /api/v1/auth/logout`: revoca la sesión y limpia la cookie.

`PLATFORM_ADMIN` puede iniciar sesión sin memberships, pero no obtiene bypass de
tenant ni acceso a datos de una organización.

## CSRF y navegador

Las mutaciones aceptan JSON, CORS exige credenciales explícitas y el middleware
valida `Origin` contra `APP_ORIGIN` cuando el navegador lo envía. `apiClient`
usa `credentials: include`; no se guardan tokens en localStorage, sessionStorage
ni IndexedDB. Rate limiting específico de login queda documentado como pendiente
para la siguiente iteración de seguridad operacional.

## Frontend

`AuthProvider` restaura `/auth/me`, protege las rutas del shell, muestra `/login`
y `/seleccionar-organizacion`, y expone logout desde el encabezado. El modo mock
se conserva para las pruebas del shell visual.

## Seed local

El seed usa una contraseña ficticia (`EASYVET_DEMO_PASSWORD`) y persiste solo su
hash. Nunca reutilizarla en producción.
