# Baseline de rendimiento

## Alcance

Este benchmark mide únicamente la lista paginada de pacientes en una base de
datos PostgreSQL efímera. Usa tres organizaciones aisladas con 10, 100 y 1.000
pacientes respectivamente. No se conecta a Supabase ni a una base de datos de
producción y no establece un SLA.

La prueba verifica:

- que `total` representa el número real de filas de la organización;
- que la respuesta nunca supera `pageSize = 20`;
- que una consulta de lista ejecuta entre dos y tres operaciones constantes de
  base de datos: página, total y, según el plan de Prisma/PostgreSQL, la
  relación agrupada de propietarios, sin consultas N+1;
- el tiempo transcurrido local como evidencia de referencia, sin convertirlo
  en una métrica de producción.

## Ejecución local

Requiere una base PostgreSQL desechable ya migrada y un `DATABASE_URL_TEST`
apuntando a ella. El rol utilizado debe ser el mismo rol de runtime sin
`BYPASSRLS`, con el contexto `app.easyvet_context=system` para crear los
fixtures de prueba.

```bash
DATABASE_URL_TEST='postgresql://veterinary:veterinary_dev_only@localhost:5432/easyvet_test?options=-c%20app.easyvet_context%3Dsystem' \
  npm run test:perf
```

La suite elimina sus organizaciones, propietarios y pacientes al finalizar.
No debe apuntarse a una base con datos reales.

## CI

El workflow `CI` ejecuta este benchmark en un job separado con PostgreSQL
efímero después de aplicar las migraciones y crear el rol de runtime. Los
resultados se muestran en los logs de GitHub Actions para comparar cambios
posteriores bajo las mismas condiciones de CI.

## Limitaciones

Esto no valida latencia de Supabase, Vercel, red, conexiones serverless,
concurrencia, p95/p99 ni comportamiento con 1.000 usuarios simultáneos. Antes
de afirmar capacidad de producción todavía hace falta una prueba de carga
autorizada con datos sintéticos y un entorno representativo.
