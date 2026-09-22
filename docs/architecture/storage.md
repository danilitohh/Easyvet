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

- `STORAGE_DRIVER=local` (default): `LocalStorageAdapter`, root configurado por
  `STORAGE_LOCAL_ROOT`; recomendado solo para desarrollo/local QA.
- `STORAGE_DRIVER=s3`: `S3CompatibleStorageAdapter` usa el SDK S3, endpoint,
  región, bucket, credenciales y `forcePathStyle` desde variables de entorno. La
  configuración valida que endpoint, bucket y credenciales estén presentes al
  seleccionar el driver.

La interfaz de driver S3 está implementada, pero esta fase no configuró una cuenta
ni ejecutó QA contra un servicio remoto. Para producción se debe usar un bucket
privado, TLS, credenciales de mínimo privilegio, cifrado/retención según política
del producto y observabilidad del proveedor. No configurar el root local en una
ruta servida estáticamente por el frontend.

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
