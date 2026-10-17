# Storage clínico privado

## Contrato

`StorageService` es la abstracción interna para guardar, leer, comprobar existencia y
compensar una escritura técnica incompleta. No emite URLs públicas ni proporciona
borrado clínico. `deleteForRollback` solo se usa para revertir archivos cuando la
transacción de metadatos fracasa; anular un documento nunca elimina sus bytes.

Las claves son opacas, generadas por Easyvet con UUID de organización y artefacto,
y extensión permitida (`pdf`, `png`, `jpg`). No se usan nombres de archivo enviados
por el cliente como rutas. El adaptador local normaliza la ruta bajo el root y
rechaza traversal; los archivos nuevos usan modo privado `0600`. Respuestas HTTP
no exponen `storageKey` ni paths locales.

## Drivers y configuración

- **Local:** `STORAGE_DRIVER=local` selecciona `LocalStorageAdapter`, con root en
  `STORAGE_LOCAL_ROOT`. Es el valor por defecto fuera de Vercel y se recomienda
  solo para desarrollo o QA local. La configuración rechaza este driver en Vercel.
- **Supabase Storage:** `STORAGE_DRIVER=supabase` selecciona
  `SupabaseStorageAdapter`. En Vercel se infiere `supabase` si no se establece
  `STORAGE_DRIVER`; fuera de Vercel, `local` sigue siendo el default. Requiere
  `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el servidor. El bucket se define
  con `SUPABASE_STORAGE_BUCKET` y su valor predeterminado es
  `easyvet-clinical-documents`. El adaptador usa la clave de servicio solo desde
  backend; el bucket de producción debe permanecer privado.
- **S3 compatible:** `STORAGE_DRIVER=s3` selecciona
  `S3CompatibleStorageAdapter`, que requiere endpoint, bucket y credenciales; la
  región y `forcePathStyle` se configuran mediante variables de entorno.

La selección y validación se implementan en `apps/api/src/config/env.ts` y
`apps/api/src/storage/storage.module.ts`. Esto describe el comportamiento del
código; no demuestra qué overrides o credenciales están configurados actualmente
en Production de Vercel. La interfaz S3 está implementada, pero no se verificó una
cuenta ni QA contra un servicio S3 remoto. En cualquier proveedor de producción se
requieren bucket privado, TLS, credenciales de mínimo privilegio,
cifrado/retención según política del producto y observabilidad del proveedor. No
configurar el root local en una ruta servida estáticamente por el frontend.

## Consistencia y fallos

La base y el object store no comparten transacción distribuida. La escritura del
objeto ocurre dentro del flujo transaccional; ante fallo se intenta compensar
borrando únicamente el objeto recién creado. Un fallo del adaptador de storage
devuelve error controlado y no debe registrar metadatos clínicos incompletos.
Descargas autenticadas verifican longitud y SHA-256 antes de devolver los bytes;
un objeto faltante o corrupto falla cerrado como storage no disponible.

Las descargas requieren permisos y tenant actual, usan `private, no-store`,
`X-Content-Type-Options: nosniff` y `Content-Disposition: attachment`. No existen
URLs de descarga públicas o prefirmadas en V1.

## Límite operativo

La compensación es best-effort: un outage simultáneo del proveedor durante la
compensación puede dejar un objeto huérfano que requerirá reconciliación operativa.
Malware scanning, retención automática, lifecycle de bucket, cifrado gestionado,
reconciliación y signed URLs quedan como decisiones de infraestructura posteriores.

## Verificación de producción (2026-10-17)

La consola de Supabase mostró el bucket `easyvet-clinical-documents` existente,
privado, con límite de 10 MB y tipos permitidos `application/pdf`, `image/png` y
`image/jpeg`. El panel de políticas mostró cero políticas para ese bucket y cero
políticas generales en `storage.objects`/`storage.buckets`, consistente con el
modelo de acceso exclusivo del adaptador server-side mediante service role.

Esta comprobación fue de solo lectura: no se subió, descargó ni eliminó ningún
objeto. La prueba end-to-end con un archivo sintético sigue pendiente de una
autorización explícita para escribir y limpiar un objeto temporal en Production.
