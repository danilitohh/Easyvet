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

| ID      | Prioridad | Área                                            | Estado                              | Dependencia o bloqueo                                                                  | Evidencia de salida                                                     |
| ------- | --------- | ----------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| AUD-01  | Alta      | Datos legales, identidad y soporte              | Bloqueado por datos del propietario | Razón social, NIT, dirección, correo formal y revisión profesional pendientes          | LegalPage actualizado, textos revisados y pruebas de las cuatro rutas   |
| SEC-01  | Alta      | Prueba negativa multi-tenant en producción      | Bloqueado por ventana operativa     | Requiere dos usuarios/tenants sintéticos y rol runtime aprobado; no usar datos reales  | Resultado reproducible sin lecturas cruzadas, sin cambios de políticas  |
| OPS-01  | Alta      | Backups y recuperación                          | Bloqueado por proveedor/decisión    | Faltan plan contratado, retención, RPO/RTO, copia de Storage y entorno de restauración | Registro de configuración y restauración controlada en entorno separado |
| PERF-01 | Alta      | Rendimiento de producción                       | Bloqueado por autorización          | Requiere tráfico/benchmark aprobado y plan reversible para índices                     | Planes de consulta, benchmark 10/100/1.000 y decisión documentada       |
| OBS-01  | Media     | Métricas y alertas del proveedor                | Bloqueado por configuración externa | Vercel/Supabase y retención operativa aún no confirmados                               | Alertas probadas, sin secretos en eventos y runbook actualizado         |
| A11Y-01 | Media     | Revisión visual por viewport                    | En curso                            | Automatización cubre semántica y foco; falta recorrido manual completo                 | Checklist por ruta/viewport, contraste y foco documentados              |
| EXT-01  | Media     | Revisión contractual de servicios externos      | Recurrente                          | Cambia con proveedores, subprocesadores, regiones y licencias                          | Inventario actualizado y revisión fechada antes de cada release         |
| CI-01   | Baja      | Confirmar evidencia del run remoto más reciente | Recurrente                          | El run documentado puede quedar atrás de `main`                                        | Run exitoso sobre el commit publicado y matriz actualizada              |

## Fases cerradas recientes

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
