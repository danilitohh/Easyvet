# Easyvet — sistema local de seguimiento de auditoría

Este archivo es el registro operativo del objetivo de requisitos globales cuando
no hay un issue tracker externo conectado a este checkout. La matriz de
requisitos es la fuente de verdad de los estados; este registro mantiene el
orden de trabajo, las dependencias, la evidencia y los bloqueos sin inventar
decisiones del propietario ni del proveedor.

## Reglas de trabajo

1. Cada fase debe tener un alcance cerrado, una evidencia reproducible y un
   criterio de salida explícito.
2. Una fase no puede marcar un requisito como verificado solo porque exista
   código: debe pasar las pruebas o comprobaciones que cubren su alcance.
3. Las decisiones legales, comerciales, de proveedor y de producción se
   mantienen como bloqueos hasta recibir el dato o autorización correspondiente.
4. Cada fase aprobada ejecuta las pruebas y builds disponibles y publica un
   commit en `main`; los artefactos generados de Graphify no se incluyen.
5. Las tareas de riesgo alto no se ejecutan en producción sin una ventana,
   alcance, rollback y autorización explícitos.

## Backlog priorizado

| ID      | Prioridad | Área                                            | Estado                              | Dependencia o bloqueo                                                                                                                 | Evidencia de salida                                                     |
| ------- | --------- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| AUD-01  | Alta      | Datos legales, identidad y soporte              | Bloqueado por datos del propietario | Razón social, NIT, dirección, correo formal y revisión profesional pendientes                                                         | LegalPage actualizado, textos revisados y pruebas de las cuatro rutas   |
| SEC-01  | Alta      | Prueba negativa multi-tenant en producción      | Bloqueado por ventana operativa     | Requiere dos usuarios/tenants sintéticos y rol runtime aprobado; no usar datos reales                                                 | Resultado reproducible sin lecturas cruzadas, sin cambios de políticas  |
| OPS-01  | Alta      | Backups y recuperación                          | Bloqueado por proveedor/decisión    | Faltan plan contratado, retención, RPO/RTO, copia de Storage y entorno de restauración                                                | Registro de configuración y restauración controlada en entorno separado |
| PERF-01 | Alta      | Rendimiento de producción                       | Bloqueado por autorización          | Requiere tráfico/benchmark aprobado y plan reversible para índices                                                                    | Planes de consulta, benchmark 10/100/1.000 y decisión documentada       |
| OBS-01  | Media     | Métricas y alertas del proveedor                | Bloqueado por configuración externa | Vercel/Supabase y retención operativa aún no confirmados                                                                              | Alertas probadas, sin secretos en eventos y runbook actualizado         |
| A11Y-01 | Media     | Revisión visual por viewport                    | En curso                            | Las ocho rutas públicas ya tienen evidencia responsive móvil; falta recorrido manual completo de rutas autenticadas, contraste y foco | Checklist por ruta/viewport, contraste y foco documentados              |
| EXT-01  | Media     | Revisión contractual de servicios externos      | Recurrente                          | Cambia con proveedores, subprocesadores, regiones y licencias                                                                         | Inventario actualizado y revisión fechada antes de cada release         |
| CI-01   | Baja      | Confirmar evidencia del run remoto más reciente | Cerrado en `2d709cf`                | Reabrir después de cada cambio publicado si el run más reciente no termina correctamente                                              | Run #156 exitoso sobre `main` y matriz actualizada                      |

## Fases cerradas recientes

- Revisión de dependencias 2026-10-17 — producción sin vulnerabilidades reportadas; el tooling mantiene 19 entradas moderadas transitivas y npm solo propone un downgrade mayor de Jest, por lo que no se aplicó un cambio inseguro.
- Composición de controles 2026-10-17 — `accessibility-controls.test.ts` protege el centrado de botones e iconos compartidos; lint, typecheck, 779 pruebas y build pasaron localmente. CI #151 y el deployment `c481ed3` quedaron exitosos/READY.
- Smoke público ampliado 2026-10-17 — `production-smoke.mjs` verifica diez rutas públicas, headers de seguridad, health/readiness y disponibilidad de base de datos mediante solicitudes GET sin mutaciones.
- Semántica de recursos visuales 2026-10-17 — `accessibility-assets.test.ts` protege `alt` explícito en imágenes JSX y mantiene la marca/iconos SVG decorativos ocultos para tecnología asistiva; el gate local pasó con 780 pruebas ejecutadas/omitidas contabilizadas y build correcto.
- Navegación visual 2026-10-17 — la barra lateral y el dock operativo dejaron de usar glifos Unicode y ahora renderizan la familia SVG propia de Easyvet (`EasyvetIcon`), con una regresión que impide volver a introducir glifos; los iconos permanecen centrados y sin fondos decorativos individuales. CI #156 y el deployment `2d709cf` quedaron exitosos/READY.
- Iconografía transversal 2026-10-17 — menú móvil, cierre de modales, colapsado de la barra lateral, calendario, accesos rápidos, navegación de detalle y filas operativas ahora usan `EasyvetIcon` en lugar de glifos Unicode; los contenedores mantienen alineación flex/grid centrada y sin cajas individuales. Lint, typecheck, 781 pruebas activas, build con 10 marcadores de secretos, smoke de 10 rutas y `git diff --check` pasaron localmente. La revisión visual manual completa de todas las rutas autenticadas sigue siendo el límite de A11Y-01.
- Hardening de observabilidad — `RequestTelemetryMiddleware` solo registra IDs de solicitud validados y tiene regresión contra headers arbitrarios.
- CI-01 — el run remoto #156 pasó los tres jobs sobre `2d709cf` después de actualizar la evidencia de deployment.
- Revisión responsive pública 2026-10-17 — ocho rutas móviles auditadas; el orbe decorativo overflow quedó identificado y marcado como `aria-hidden`.
- `f661fc8` — evidencia visual de producción y trazabilidad del deployment final.
- `3cf573a` — corrección del solapamiento entre acceso y consentimiento de privacidad.
- `d1fbc70` — pruebas de teclado, foco, modales y preferencias de privacidad.
- `bd61915` — estados de carga/error accesibles en rutas clínicas y de detalle.
- `6c3d8c7` — límites de cobertura de accesibilidad documentados.

Cada commit anterior conserva su evidencia en la matriz global y no sustituye
los controles externos que siguen bloqueados.

## Cómo cerrar una tarea

Antes de cambiar un estado, actualizar la evidencia de la matriz y ejecutar,
como mínimo, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` y
`git diff --check`, ajustando el alcance cuando una tarea no afecte todos los
workspaces. Registrar el commit y el resultado; si una prueba depende de una
base o proveedor no disponible, conservarla como parcial o bloqueada.
