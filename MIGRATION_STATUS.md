# Estado de migración

| Área             | Estado                                            |
| ---------------- | ------------------------------------------------- |
| Auditoría legacy | Completada                                        |
| Monorepo         | Completado                                        |
| React/Vite       | App shell y base visual de Fase 2 completados     |
| NestJS           | Infraestructura                                   |
| PostgreSQL       | VERIFICADO LOCALMENTE                             |
| Prisma           | Schema base sin entidades; migraciones pendientes |
| Multi-tenancy    | Pendiente                                         |
| UI Lativet       | Referencia analizada; adaptación React completada |
| Pacientes        | Pendiente                                         |
| Agenda           | Pendiente                                         |
| Clínica          | Pendiente                                         |
| Inventario       | Pendiente                                         |
| Facturación      | Pendiente                                         |
| SaaS             | Pendiente                                         |

La base visual de Fase 2 no significa que una funcionalidad de negocio esté migrada.

La Fase 2 queda detenida después del AppShell, navegación, dashboard demo y componentes UI compartidos. No se han creado entidades Prisma, autenticación real, multi-tenancy ni módulos funcionales.

Checkpoint 2.5 verificado localmente:

- Docker Engine 29.8.0 y Docker Compose v5.5.1 disponibles.
- PostgreSQL 16.15 mediante `postgres:16-alpine` en Docker Compose.
- Puerto local: `localhost:5432`.
- Conexión Prisma mediante `DATABASE_URL` del `.env` local, usando `prisma db execute` con `SELECT 1` y un `$queryRawUnsafe('SELECT 1')` técnico.
- El esquema Prisma sigue sin modelos de dominio y la base pública contiene cero tablas.
- NestJS respondió `HTTP 200` en `GET /api/v1/health`.

Para detener el entorno local:

```bash
docker compose down
```

No se documentan contraseñas locales reales.
