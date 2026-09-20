# Estrategia de autenticación futura

La autenticación pertenece a la Fase 3B y no se implementa en Fase 3A. No
existen `POST /login`, `POST /logout`, `GET /me`, JWT, sesiones, cookies de
autenticación ni refresh tokens.

## Passwords

- Nunca se guarda una contraseña en texto plano.
- `User.passwordHash` almacena únicamente el resultado de un hash Argon2id.
- La librería seleccionada para Fase 3B es `argon2@0.44.0`, mantenida y
  compatible con el runtime actual.
- La verificación y el cambio de contraseña se diseñarán junto con login,
  sesiones y política de recuperación en Fase 3B.

## Seed local

El seed usa una contraseña ficticia exclusivamente local (`EASYVET_DEMO_PASSWORD`
o el valor por defecto documentado en el README) y guarda solo su hash Argon2id.
Nunca reutilizar esa credencial en producción.

## Separación de roles

`PlatformRole` se reserva para operaciones propias de Easyvet. El acceso dentro
de una veterinaria proviene de `Membership.role` y no de un campo como
`User.isClinicAdmin`. El motor completo de permisos queda para Fase 3C.
