# Revisión final de Administración e Informes: Lativet → Easyvet

## Alcance de la inspección

Se inspeccionó en modo lectura la copia local de Lativet en
`C:\Users\danil\Downloads\Lativet`, enfocándose en usuarios/permisos,
configuración, informes financieros y resumen clínico. Lativet no se ejecutó ni
se modificó durante esta fase.

## Hallazgos del sistema legado

| Área                    | Evidencia observada                                                                                                                                                                                                                                                                          | Decisión para Easyvet                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usuarios                | `Backend/ADMINISTRACION/Usuarios/persistencia.py` combina `staff_users` autenticables con `staff_directory` operativo; `save_user` convierte entre ambos, acepta una contraseña explícita y `delete_user` elimina la fila.                                                                   | `User` permanece identidad global; la gestión del tenant modifica solamente su `Membership`, no elimina ni suspende la cuenta global. El onboarding genera contraseña temporal aleatoria y no incluye borrado.                  |
| Permisos                | `Backend/ADMINISTRACION/Usuarios/permisos.py` define un catálogo de acciones explícitas y un formato versionado; el perfil detallado requiere permiso de vista y, para submódulos clínicos, vista del perfil Patient. También conserva perfiles antiguos con compatibilidad por rol/permiso. | Easyvet usa permisos de código derivados por `MembershipRole` y `ClinicalRole` ortogonal; el backend vuelve a comprobar cada solicitud y protege gestión de OWNER. No se importan perfiles históricos ni permisos libres en V1. |
| Rutas de administración | `Backend/ADMINISTRACION/Usuarios/rutas.py` protege guardar/borrar usuarios con `require_admin_response`. `Backend/ADMINISTRACION/Configuracion/rutas.py` expone `POST /api/settings` mediante el contexto compartido.                                                                        | Easyvet separa permisos de lectura y escritura por endpoint, obtiene tenant de la sesión y limita los DTOs a campos existentes del modelo.                                                                                      |
| Informes financieros    | `Backend/INFORMES/Financieros/rutas.py` expone reporte, PDF y consultas de cierre; la creación de cierre comprueba admin en la ruta. El servicio financiero delega agregación/persistencia a la base y conserva exportación PDF/cierre mensual.                                              | Easyvet V1 entrega únicamente agregados visibles en pantalla, permisos dedicados y totales comerciales agrupados por moneda. Exportaciones y cierres contables no se copian a este bloque.                                      |
| Resumen clínico         | `Backend/INFORMES/Clinicos/persistencia.py` puede cargar Owners, Patients, appointments, records, consultas, grooming, documentos de facturación, catálogo, compras, caja y disponibilidad; devuelve además listas de consulta, Patients, Owners, actividad y auditoría reciente.            | Easyvet devuelve conteos finalizados sin narrativa ni filas personales; aplica rango/tenant en consultas SQL/Prisma para evitar hidratar tablas completas en Node.                                                              |
| Estructura              | Los módulos de administración e informes tienen carpetas separadas en `Backend/` y `Frontend/`; sus README describen el uso de servicios/contexto y persistencia compartidos.                                                                                                                | Se mantienen módulos Easyvet independientes, contratos explícitos y rutas propias (`/usuarios`, `/configuracion`, `/informes`) sobre el shell visual actual.                                                                    |

Los hallazgos describen la copia inspeccionada, no afirman que el comportamiento
legado sea inseguro en todos los despliegues. Se reutilizaron necesidades
operativas —directorio, configuración, informes— sin transportar su modelo de
identidad combinado, exportación o respuestas con filas clínicas.

## Cierre Easyvet

La implementación completa se describe en
[`user-management.md`](../architecture/user-management.md),
[`organization-settings.md`](../architecture/organization-settings.md),
[`reports.md`](../architecture/reports.md),
[`reports-api.md`](../architecture/reports-api.md) y
[`admin-frontend.md`](../architecture/admin-frontend.md). Se verificaron las
migraciones únicamente contra `easyvet_dev` y `easyvet_test`; no se usaron datos
reales ni se ejecutó Lativet.

Las validaciones automatizadas, auditoría de dependencias, QA manual,
limitaciones y commit de cierre se registran en la sección Fase 10 de
[`MIGRATION_STATUS.md`](../../MIGRATION_STATUS.md) una vez finalizados.
