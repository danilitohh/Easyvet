# Easyvet V1 — cierre QA (2026-09-23)

## Alcance y entorno

Este cierre valida la plantilla V1 ya implementada; no agrega módulos ni crea una release externa. El trabajo comenzó en `master`, limpio y ocho commits locales por delante de `origin/master`, con `2e45f48 feat(admin): complete users settings and reports` como commit funcional más reciente. Las únicas bases autorizadas fueron `easyvet_dev` y `easyvet_test`. No se reinició ni limpió `easyvet_dev`; la recreación completa descrita abajo fue únicamente en `easyvet_test`. No se conectó una base compartida o productiva.

La base local contiene datos ficticios de demo/QA, incluida la organización Norte y la cuenta de Recepción cuya contraseña el usuario cambió manualmente en el navegador. No se registra contraseña, token, hash ni dato clínico real aquí. Los registros ficticios existentes se conservan.

## Arranque, rutas y build

- El inventario de rutas SPA y sus límites está en [readiness V1](../release/v1-readiness.md); se contrastó con el router implementado. Incluye login/cambio de contraseña/selección de organización, dashboard, Owners/Patients e historia contextual, Agenda, dominios clínicos, seguimientos, peluquería, inventario, ventas/facturación/caja, administración, perfil profesional, health, 404 y firma pública.
- Se retiró el catch-all de `ModulePage` y los componentes `ModulePlaceholder`/mocks obsoletos que fingían módulos disponibles. Rutas desconocidas muestran Not Found. Los fixtures mock remanentes son solo de desarrollo; el build de producción fuerza el modo API.
- Sidebar filtra por permiso; las pruebas cubren deep links anidados, estado activo en Agenda/Inventario y elementos sin permiso. Los guards del frontend son UX; la API conserva la autorización efectiva.
- El límite del chunk principal Vite pasó de 872.03 kB min / 247.76 kB gzip a 548.60 kB / 160.65 kB gzip (-323.43 kB min, -87.11 kB gzip). Sigue por encima del umbral informativo de 500 kB; Agenda, que contiene FullCalendar, quedó en chunk lazy de 270.29 kB / 74.73 kB gzip. No se hizo particionado artificial adicional.
- Build web/API completado. Vite sigue informando el tamaño del entry y anotaciones PURE de Zod en `node_modules`; estas últimas provienen del paquete upstream, no del código/configuración Easyvet, y no se parcheó `node_modules`.

## PostgreSQL, migraciones y seed

- Docker Desktop/Compose local y PostgreSQL se verificaron disponibles; el contenedor PostgreSQL quedó healthy durante las pruebas.
- `easyvet_dev` tiene las 27 migraciones versionadas aplicadas. `easyvet_test` se recreó desde cero usando únicamente las migraciones versionadas; las 27 aplicaron correctamente. No se creó ni editó una migración durante el cierre.
- Comparación de esquema PostgreSQL entre dev y test limpio: sin diferencias estructurales en tablas, índices, enums, restricciones o triggers; la única diferencia textual del dump fue el comentario vacío por defecto de `public`.
- Seed se ejecutó dos veces contra `easyvet_test` con una contraseña aleatoria temporal mantenida solo en memoria/proceso. Ambas ejecuciones fueron idempotentes: los conteos agregados de organizaciones, usuarios, membresías, propietarios y pacientes no crecieron en la segunda corrida. El seed falla cerrado si no recibe `EASYVET_DEMO_PASSWORD` y se niega antes de abrir Prisma cuando `NODE_ENV=production`.
- `prisma:generate` y `prisma:validate` pasan. Las suites DB apuntan explícitamente a `easyvet_test`; su comando fija `DATABASE_URL` y `DATABASE_URL_TEST` a esa base local.

## Auth, tenant, API y datos

- El usuario de QA informó haber completado el cambio de contraseña desde el navegador. Una consulta DB limitada a metadatos confirmó `mustChangePassword=false`, una sesión activa (la sesión actual) y ninguna sesión revocada previa para esa cuenta; no había otra sesión de esa cuenta que revocar. El AppShell autenticado y los datos del dashboard cargaron en Norte, confirmando login y restauración `/auth/me`. Las pruebas de auth cubren revocación de sesiones anteriores cuando existen. El modelo persiste `password_hash`, no un campo plaintext; no se seleccionó el hash ni se leyó/incluyó el secreto nuevo.
- Revisión de sesión: cookie HttpOnly/SameSite, Secure en producción; token aleatorio, solo hash persistido, expiración, logout y revocación de otras sesiones al cambiar contraseña.
- CORS usa origen configurado exacto con credenciales; mutaciones autenticadas tienen validación CSRF/origin. El smoke previo de origen hostil produjo `403 CSRF_ORIGIN_REJECTED`.
- Aislamiento y permisos se cubren transversalmente por tests de API/PostgreSQL, incluidos roles OWNER, ADMIN, PRACTITIONER, CLINICAL_ASSISTANT, RECEPTION, GROOMER y CASHIER, recursos cross-tenant, carreras y último OWNER. PlatformAdmin no hereda por sí solo acceso de organización. Los tests de cambio de tenant limpian contexto/cache según el diseño. En navegador se mantuvo la sesión ficticia de Recepción de Norte; un recurso sembrado de Sur se probó por deep link para comprobar respuesta segura y luego se volvió al dashboard de Norte.
- La revisión de borrados no encontró endpoints de borrado físico para evidencia clínica/histórica, documentos, seguimientos, grooming ni ledgers; los ciclos comerciales usan reversión compensatoria. InventoryMovement y CashMovement son append-only. La suite PostgreSQL mantiene pruebas de concurrencia.
- CAS/versionado está probado por las suites de agenda, clínica, seguimientos, grooming, inventario, ventas/caja y administración cuando aplica. Fechas civiles permanecen como fechas civiles; timestamps se presentan usando la zona horaria de la organización. Cálculos monetarios/stock conservan Decimal/BigInt; conversiones a Number/toFixed encontradas son formato/presentación, no aritmética crítica.
- Notas clínicas, nombres y descripciones se renderizan como texto; no se encontró `innerHTML` ni `dangerouslySetInnerHTML` en el frontend revisado. Respuestas de error normalizan stack/SQL; se agregó regresión para omitir query values y redactar tokens de firma del campo `path`.
- Descarga documental local se probó autenticada y tenant-scoped; PDF generado abrió con `%PDF-`, 2728 bytes, `Content-Type`, `Content-Disposition`, `nosniff` y `private/no-store`. El adaptador remoto S3 no se conectó a servicio real.
- Firma pública inválida responde de forma genérica, sin AppShell/sidebar ni restauración de `/auth/me`; tokens no se guardan en browser storage. El flujo de firma exitosa no se repitió con un fixture nuevo en este cierre.
- Los informes agregan datos por tenant/permisos y acotan rangos; no exportan listas/narrativas clínicas. Restricciones de membresía/OWNER, aislamiento global de User y guards de Location continúan cubiertos por suites de Fase 10/DB.

## Navegador y UX

- En navegador se verificó login con el usuario ficticio de Recepción luego de que el usuario completara el cambio manual, AppShell/dashboard, menú filtrado y deep link cross-tenant de paciente; la página volvió a `/dashboard` y la pestaña queda abierta.
- Owner/Admin y varios módulos también tuvieron smoke manual de fases anteriores (incluido PDF e impresión). No se hizo en este cierre un recorrido manual exhaustivo por cada acción de cada rol: Practitioner, Groomer y Cashier se validan principalmente mediante suites de permisos/API; no se compartieron credenciales para iniciar sesión manualmente con esas cuentas.
- Matriz de tamaño visual previamente ejecutada: 390 px en 18 rutas representativas; 768 y 1280 px en 9 categorías de página. No se observó overflow horizontal de página; la navegación, formularios, tablas, cards y diálogos principales conservaron su layout. No se añadió una herramienta pesada de accesibilidad; nombres/roles/labels y navegación teclado se cubren por tests representativos y revisión manual, no por certificación WCAG automatizada.
- Smoke de red en navegador: sesión restaurada/AppShell, resumen real del dashboard, API health 200 y respuestas seguras para el deep link cross-tenant y firma inválida. No se exportó un HAR ni se hizo una inspección exhaustiva de consola de DevTools; no se afirma ausencia total de warnings de navegador.
- Error boundary global muestra recuperación/reload en lugar de pantalla blanca. Carga/empty/error se cubren por suites de componentes y páginas representativas. La impresión de factura se inspeccionó en media `print`: conserva total/contenido y oculta navegación, botones y decoración de pantalla.

## Incidente `dist/main`, comandos y limpieza

- El build Nest genera `apps/api/dist/src/main.js`, no `apps/api/dist/main.js`. El script de producción apunta al artefacto real (`npm run start:api:prod` → `apps/api` → `node dist/src/main.js`). `npm run dev` levantó web en 5173 y API en 3000 con health 200. El arranque compilado final también inició correctamente y `GET /api/v1/health` respondió HTTP 200 (`{"status":"ok"}`). Al terminar se dejó el API compilado y Vite web de desarrollo activos para que el usuario conserve el local abierto.
- No se encontró un hook que arranque producción al salir del watcher; `Ctrl+C` terminó ambos procesos de `npm run dev`. En Windows, generar Prisma mientras el watcher API retiene el engine nativo puede producir `EPERM` al reemplazarlo; recuperación: parar API/watchers y luego volver a ejecutar `npm run prisma:generate`. Tras detenerlos, generación pasó.
- `GET /api/v1/health` es una señal de liveness/proceso, no una comprobación de dependencias externas; no se añadió chequeo que amplíe el alcance.

## Comandos y resultados

| Comando                                         | Resultado final                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                          | HISTÓRICO: PASS en el cierre V1; en el checkout actual el gate global aún reporta archivos heredados/artefactos sin formatear. El CI vigente verifica los archivos modificados con `npm run format:check:changed`. |
| `npm run lint`                                  | PASS                                                                                                                                                                                                               |
| `npm run typecheck`                             | PASS                                                                                                                                                                                                               |
| `npm test` / etapa sin DB de `test:all`         | 381 frontend PASS; 36 API PASS; 194 pruebas DB-gated omitidas en esta etapa                                                                                                                                        |
| `npm run test:db` / `test:all` etapa PostgreSQL | 230 DB/API PostgreSQL PASS; suites de concurrencia habilitadas                                                                                                                                                     |
| `npm run test:all`                              | PASS; 611 resultados distintos (381 frontend + 230 API/DB), sin sumar de nuevo sus invocaciones                                                                                                                    |
| `npm run build`                                 | PASS; entry actual 548.60 kB min / 160.65 kB gzip                                                                                                                                                                  |
| `npm run prisma:generate`                       | PASS con watcher/API detenido                                                                                                                                                                                      |
| `npm run prisma:validate`                       | PASS                                                                                                                                                                                                               |
| `npx prisma migrate status`                     | PASS: dev y test al día, 27 migraciones                                                                                                                                                                            |
| `npm audit`                                     | 5 hallazgos (3 HIGH, 2 MODERATE); sin fix compatible seguro                                                                                                                                                        |
| `npm audit --omit=dev`                          | 3 HIGH, 0 MODERATE; Prisma/config/deepmerge reportados en el árbol omit-dev; reachability de request HTTP no encontrada                                                                                            |
| `git diff --check`                              | PASS; solo avisos de conversión de finales LF/CRLF de Git en Windows                                                                                                                                               |

No hubo una prueba que fallara y luego pasara sin investigar. La primera suite DB señaló que el test de seed no heredaba el password temporal requerido; se corrigió el fixture usando secreto efímero en el entorno del proceso y la suite completa pasó. Una ejecución inicial de Prisma generate coincidió con watcher activo (EPERM); se repitió después de detenerlo y pasó. No se hicieron upgrades ni cambios de lockfile.

## Cambios del cierre y limitaciones

Cambios funcionales mínimos con regresión: lazy loading de Owners/Patients/Agenda, retiro de rutas-placeholder, fallback Not Found/error boundary, navegación con permisos y estado activo, restauración de sesión omitida en login/firma pública, modo mock solo en dev, saneamiento de `path` en errores, test DB de seed aislado y seed sin password fijo/con guard de producción. No se tocó Prisma schema ni se creó migración.

Persisten avisos de dependencias detallados en [revisión de seguridad](../security/v1-security-review.md): Prisma/config/deepmerge HIGH y Vitest/mocker MODERATE; npm solo ofrece en este árbol downgrades/upgrades major. No se ejecutó `npm audit fix --force` ni upgrade. El helper automatizado de revisión profunda no pudo iniciar por runtime Python local ausente; no hubo pentest externo. No se probaron S3 remoto, entrega email/SMS, proxy TLS productivo, despliegue, carga, integraciones externas ni impresión en impresora física. Estos puntos están excluidos o marcados como limitaciones, no presentados como aprobados.

No hubo migraciones nuevas. La matriz final de módulos/rutas está en [readiness V1](../release/v1-readiness.md), las limitaciones en [known limitations](../release/v1-known-limitations.md), y el resumen arquitectónico en [arquitectura V1](../architecture/v1-overview.md). El cierre no incluye push, tag ni deploy.
