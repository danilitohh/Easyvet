# Estado de migración

| Área             | Estado                                            |
| ---------------- | ------------------------------------------------- |
| Auditoría legacy | Completada                                        |
| Monorepo         | Completado                                        |
| React/Vite       | App shell y base visual de Fase 2 completados     |
| NestJS           | Infraestructura                                   |
| PostgreSQL       | PENDIENTE DE VERIFICACIÓN LOCAL                   |
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

Docker Desktop no está disponible en el entorno actual; PostgreSQL no se ha iniciado ni verificado localmente.
