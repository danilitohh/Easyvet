# Easyvet — runbook de backups y recuperación

Este runbook define cómo preparar, verificar y ejecutar una recuperación de
Easyvet sin confundir capacidades del proveedor con garantías ya comprobadas
en la cuenta. No contiene credenciales ni exportaciones de datos clínicos.

## Estado actual

- La base de datos de producción está en Supabase y el runtime de la API usa
  el rol dedicado `veterinary`.
- El bucket `easyvet-clinical-documents` es privado y sus objetos se sirven
  únicamente desde el backend.
- La verificación de solo lectura del proyecto `iykzaqtcewnxgrmlbinz` del
  2026-10-18 confirma estado `ACTIVE_HEALTHY`, región `us-east-1` y plan Free
  en la cuenta Supabase conectada. El proyecto no tiene ramas de desarrollo.
  La documentación oficial indica que los respaldos diarios y PITR pertenecen
  a los planes pagos; para Free recomienda exportaciones periódicas mediante
  la CLI. Esto es evidencia de la cuenta y documentación consultadas, no una
  garantía comercial permanente del proveedor.
- La retención efectiva, el rango PITR y el RPO/RTO contratado no están
  expuestos por la metadata conectada y no deben inferirse. No se ha ejecutado
  una restauración real ni se ha creado un entorno separado.
- El bucket `easyvet-clinical-documents` existe, es privado, limita cada objeto
  a 10 MiB y acepta PDF, PNG y JPEG. Esto confirma configuración, no una copia
  externa ni una restauración de bytes.
- Las copias de la base de datos de Supabase no contienen los bytes de los
  objetos de Storage; solo conservan metadatos. La recuperación de la base no
  recupera por sí sola archivos borrados.

Por tanto, el estado correcto es **plan verificado como Free, procedimiento
documentado y recuperación real pendiente de prueba controlada**.

## Alcance de una copia recuperable

La copia operativa debe cubrir cuatro grupos separados:

1. **Base de datos:** esquema Prisma, migraciones aplicadas, datos y estado de
   permisos/RLS.
2. **Archivos:** objetos del bucket privado, rutas, tipo MIME, tamaño, hash y
   relación con el registro documental. Storage necesita un procedimiento
   propio de copia y restauración.
3. **Configuración:** variables de entorno de Vercel y Supabase, dominios,
   proyecto objetivo, configuración de Realtime y proveedor de correo. Los
   valores secretos deben conservarse únicamente en el gestor de secretos.
4. **Código y despliegue:** commit de producción, imagen/build, migraciones y
   configuración de servicios. Git no sustituye una copia de los datos.

## Verificación periódica sin modificar producción

El responsable de la cuenta debe registrar, sin compartir secretos:

- plan de Supabase y si están habilitados backups diarios y PITR;
- fecha/hora del punto de recuperación más antiguo y más reciente;
- retención configurada y región del proyecto;
- lista de buckets, privacidad, límites y procedimiento externo para copiar
  objetos;
- variables de Vercel presentes por entorno, sin sus valores;
- último commit desplegado y última migración aplicada;
- objetivo acordado de RPO y RTO. Si no existe una decisión comercial, dejar
  ambos como **pendiente**, no inferirlos.

En la verificación del 2026-10-18 no había ramas separadas y la metadata
disponible no permitía confirmar retención, RPO/RTO ni copias de Storage. Crear
una rama o ejecutar una restauración requiere confirmar el coste y el entorno
objetivo antes de modificar infraestructura.

Supabase cotiza una rama a **USD 0,01344 por hora** para esta organización
(aproximadamente USD 9,68 por 30 días si permaneciera encendida). La rama no se
creó porque requiere confirmación explícita del coste y del entorno de prueba.

## Decisión operativa vigente

Por decisión del propietario, Easyvet continuará en el plan **Free** hasta que
la aplicación genere ingresos suficientes para evaluar un upgrade. No se crearán
ramas con coste, no se habilitará PITR de pago y no se tratará la ausencia de
backups administrados como una garantía de recuperación.

Mientras se mantenga esta decisión, la alternativa aprobada es preparar una
copia manual fuera del repositorio: exportación de la base de datos con la CLI
de Supabase, copia separada de los objetos privados de Storage y restauración en
un destino seguro de prueba. La ejecución sigue pendiente porque requiere
credenciales de servicio y un destino aprobado; no se deben descargar datos
clínicos reales al equipo local ni almacenar secretos en Git.

Esta revisión debe hacerse al menos antes de cada lanzamiento importante y
después de cambiar el plan o la infraestructura.

## Smoke test remoto de Storage

El repositorio incluye un smoke test sintético, **desactivado por defecto**, en
`apps/api/src/storage/supabase-storage.remote.spec.ts`. No forma parte de CI y
no se ejecutó contra la cuenta de producción durante esta fase. Solo se activa
cuando el operador define las dos variables de confirmación siguientes, además
de las credenciales del entorno objetivo:

```sh
RUN_REMOTE_STORAGE_TESTS=1 \
REMOTE_STORAGE_TEST_CONFIRM=EASYVET_REMOTE_STORAGE_SYNTHETIC_OK \
SUPABASE_URL=<url-del-entorno> \
SUPABASE_SERVICE_ROLE_KEY=<secreto-del-entorno> \
SUPABASE_STORAGE_BUCKET=easyvet-clinical-documents \
npm run test:storage:remote --workspace @veterinary-saas/api
```

El test genera una clave UUID bajo el prefijo de una organización sintética,
sube un PDF de prueba, verifica existencia y bytes, y elimina únicamente esa
clave. No usa datos clínicos ni sustituye la prueba de autorización tenant del
API. Debe ejecutarse primero en un proyecto temporal o entorno aprobado y su
resultado debe registrarse sin compartir credenciales.

## Preparación antes de una recuperación

1. Declarar el incidente, responsable y hora de inicio. No borrar, truncar ni
   sobrescribir datos para “probar” la recuperación.
2. Pausar cambios de esquema y despliegues automáticos. Si la integridad está
   comprometida, restringir temporalmente las escrituras mediante un cambio
   reversible y aprobado.
3. Guardar el commit desplegado, la lista de migraciones aplicadas, el estado
   de Vercel y el identificador del proyecto Supabase afectado.
4. Elegir un punto de recuperación dentro del rango disponible. PITR puede
   causar indisponibilidad durante la restauración y puede producir pérdida de
   transacciones posteriores al punto elegido.
5. Crear o seleccionar un proyecto de recuperación separado cuando sea
   posible. Nunca probar primero sobre producción.

## Procedimiento de recuperación controlada

1. Restaurar la base de datos en el proyecto temporal siguiendo el flujo de
   Supabase y registrar el punto elegido.
2. Recuperar los objetos del bucket desde la copia externa aprobada. Validar
   ruta, MIME, tamaño y hash antes de asociarlos a registros clínicos.
3. Aplicar únicamente las migraciones que falten, usando la conexión de
   migraciones `POSTGRES_URL_NON_POOLING`; nunca usar la conexión runtime para
   ejecutar migraciones.
4. Configurar el runtime con el rol `veterinary` y comprobar que no es
   superusuario ni tiene `BYPASSRLS`.
5. Ejecutar las comprobaciones de aceptación:
   - `GET /api/v1/health/ready` devuelve estado de base de datos correcto;
   - un usuario autenticado solo ve su organización;
   - un usuario sin permisos recibe denegación;
   - un documento privado no es accesible por URL directa;
   - Realtime no entrega eventos de otra organización;
   - no aparecen secretos, tokens ni datos clínicos en logs.
6. Comparar conteos, hashes y relaciones de datos con el inventario del
   incidente. Registrar diferencias y falsos positivos antes de cortar tráfico.
7. Con aprobación explícita, actualizar las variables de Vercel para apuntar
   al proyecto recuperado, desplegar el commit validado y observar errores,
   latencia y eventos de autorización.
8. Mantener el proyecto anterior congelado para investigación hasta cerrar el
   incidente y confirmar la retención requerida.

## Cierre posterior

- Confirmar login, operaciones de agenda, pacientes, documentos, inventario,
  cobros y auditoría con datos sintéticos o cuentas autorizadas.
- Verificar que las migraciones, políticas RLS, triggers de Realtime y bucket
  privado siguen presentes.
- Documentar hora de recuperación, punto elegido, pérdida estimada, duración,
  diferencias encontradas y acciones correctivas.
- Revisar y actualizar el RPO/RTO, la frecuencia de copias de Storage y la
  fecha de la siguiente prueba.

## Límites y referencias

- La restauración es una operación de infraestructura con posible downtime;
  requiere confirmar previamente el alcance y el plan contratado en el panel
  de Supabase.
- Una copia de base de datos no es una copia de los objetos de Storage.
- No se deben descargar datos clínicos reales al repositorio, al equipo local
  ni a tickets. Las pruebas deben usar datos sintéticos o un entorno aprobado.
- Referencia oficial: [Backups y Point-in-Time Recovery de
  Supabase](https://supabase.com/docs/guides/platform/backups).
- Referencia oficial: [Migración y recuperación de objetos de Storage de
  Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
