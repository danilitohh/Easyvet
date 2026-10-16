# Supabase — postura de acceso (2026-10-16)

**Alcance:** revisión de solo lectura del proyecto Easyvet `iykzaqtcewnxgrmlbinz`. No se ejecutaron `GRANT`, `REVOKE`, cambios de RLS, DDL ni escrituras de datos.

## Resultado observado

- Revalidado el 16 de octubre de 2026 mediante la conexión administrativa de Supabase y sus asesores; las consultas fueron solo `SELECT` y no devolvieron filas de negocio.
- El esquema `public` tenía 49 tablas: 48 con RLS deshabilitado y `api_rate_limit_buckets` con RLS habilitado y forzado.
- En la consulta de catálogo, los roles `anon` y `authenticated` no tenían permisos directos sobre las tablas públicas observadas. Tampoco tenían `USAGE` ni `CREATE` sobre el esquema `public`.
- `service_role` tenía permisos de tabla sobre 48 tablas y `BYPASSRLS`; no tenía `SELECT` sobre `api_rate_limit_buckets` en la consulta revisada.
- Los privilegios predeterminados de `supabase_admin` incluyen permisos amplios a `anon` y `authenticated` para tablas, secuencias y funciones creadas por ese rol. Hoy esos dos roles no tienen `USAGE` sobre `public`, por lo que el catálogo no muestra acceso efectivo al esquema. El usuario SQL `postgres` no es miembro de `supabase_admin` ni puede asumir ese rol; por tanto, no puede corregir directamente esos privilegios predeterminados.
- `realtime.messages` tenía una política `SELECT` para `authenticated`, limitada a extensiones `broadcast` y al topic `easyvet:org:` más el `organization_id` del JWT.
- El asesor de seguridad reportó RLS habilitado sin políticas en `api_rate_limit_buckets`. Esa tabla es operativa del servidor; no se encontró acceso directo de los roles cliente en el catálogo, por lo que el estado observado es de denegación por defecto para esos roles.
- El asesor de rendimiento reportó 137 claves foráneas sin índice de cobertura y 95 índices sin uso observado. Son candidatos para investigar, no evidencia de que todas sean cuellos de botella o índices descartables; deben priorizarse con estadísticas de uso, consultas y planes reales tras obtener tráfico representativo.
- La vista `extensions.pg_stat_statements` acumulaba, desde el reinicio global de estadísticas del 2 de octubre de 2026, 8.475 llamadas, ~26,9 s de ejecución total y un máximo individual observado de ~762 ms. La proporción de bloques compartidos encontrados en caché era ~99,86% (896.018 hits / 897.282 hits+lecturas). Estas cifras agregan roles de Supabase, `postgres` y gestión; no son una medición atribuible solo a Easyvet ni sustituyen latencias por endpoint, percentiles o planes de ejecución.

## Límite de lo que esta consulta prueba

La consulta SQL administrativa se ejecutó como `postgres`: `rolsuper = false`, `rolbypassrls = true`. Una inspección de `pg_stat_activity` no encontró conexiones de Prisma/API en ese instante; solo mostró servicios internos de Supabase y la conexión de gestión. `pg_stat_statements` sí contiene actividad histórica bajo `postgres`, pero ese rol también lo usan procesos de gestión y no permite atribuirla al API. Esto **no identifica ni descarta el rol que utiliza el runtime de Vercel cuando hay tráfico**. No se inspeccionaron cadenas de conexión ni secretos.

El panel de superadmin incluye la ruta autenticada `GET /api/platform/database-posture`, que devuelve únicamente el nombre del rol runtime y los booleanos de `BYPASSRLS` y superusuario. La tarjeta aparece en `/plataforma`, bajo “Seguridad de infraestructura”. La sesión de navegador consultada durante esta auditoría no estaba autenticada, así que no se pudo leer ese dato.

El pipeline de CI sí ejecutó la suite PostgreSQL en una instancia efímera y aislada con resultado exitoso para el commit `d0d1c3e`. Sin embargo, `.github/workflows/ci.yml` crea allí `veterinary` como `LOGIN SUPERUSER` y `package.json` usa ese rol para `test:db`. La suite demuestra reglas de negocio e aislamiento explícito de Prisma en escenarios de integración, pero ese rol omite RLS; no es una prueba de políticas RLS ni representa el privilegio mínimo del runtime de Vercel. No cambiar ese rol hasta separar permisos de migración, propiedad de tablas y operaciones especiales que hoy requieren privilegios elevados.

## Decisión pendiente

No habilitar RLS en las tablas restantes hasta confirmar el rol runtime y verificar el efecto en una base efímera usando exactamente los roles de aplicación. No conceder acceso a `anon` ni `authenticated` por conveniencia: el backend NestJS es quien aplica sesión, permisos y aislamiento multi-tenant. Después de cualquier cambio aprobado, volver a ejecutar la auditoría de roles cliente y las pruebas de autorización por tenant.

Revisar además la ruta de creación futura de objetos. Los privilegios predeterminados permisivos pertenecen a `supabase_admin`; el `postgres` observado no puede alterarlos. No convertirlos en un cambio de seguridad automatizado hasta verificar con Supabase el mecanismo soportado para administrarlos y confirmar qué rol ejecuta cada tipo de migración.

No crear los 137 índices ni eliminar los 95 índices reportados sin uso en bloque. Revisar primero estadísticas de uso durante una ventana representativa, consultas lentas y `EXPLAIN` de los recorridos más usados; aplicar únicamente índices que atiendan filtros/joins observados y verificar que no dupliquen índices compuestos existentes. La ausencia de uso puede deberse a poco tráfico o a estadísticas reiniciadas.

## Nota de consulta

La vista `information_schema.schema_privileges` no existe en la instancia consultada. El acceso al esquema se verificó con `has_schema_privilege` sobre `pg_roles`; el resto de resultados de catálogo se obtuvo con `pg_class`, `pg_namespace`, `pg_roles`, `pg_policies` e `information_schema`.

## Referencias legales para preparar los avisos (no son concepto jurídico)

- La [Ley Estatutaria 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php/norma.php?i=49981) regula el tratamiento de datos personales y los derechos de conocer, actualizar y rectificar la información. El aviso final requiere confirmar responsable, finalidades, canales de atención, encargados y retención real.
- La [Ley 1480 de 2011](https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306), modificada para comercio electrónico por la [Ley 2439 de 2024](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=257116), contempla información precontractual y reglas de retracto/devolución que dependen del contrato y del momento de inicio del servicio. La regla comercial indicada por el propietario (“sin reembolsos, sujeto a ley”) no debe convertirse en una exclusión absoluta: condiciones y excepciones requieren revisión jurídica colombiana.

La publicación de política de privacidad, términos, cookies y condiciones de cancelación/reembolso sigue pendiente de los datos del responsable y revisión profesional; estas referencias no constituyen una determinación de cumplimiento.
