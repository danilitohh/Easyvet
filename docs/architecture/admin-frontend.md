# Frontend de administración (Fase 10)

Las rutas `/usuarios`, `/usuarios/nuevo`, `/usuarios/:membershipId`,
`/configuracion`, `/informes` y `/cambiar-contrasena` son addressable y protegidas.
Usuarios, Configuración e Informes se cargan de forma lazy y extienden los tokens,
componentes y patrones visuales de Easyvet.

- Usuarios muestra solo la Membership activa: nombre profesional configurado,
  email, rol organizacional, ClinicalRole y estado. La contraseña temporal aparece
  en un modal de una sola ocasión, en memoria, con copia al portapapeles. Una
  cuenta existente recibe un mensaje neutro. No hay reset de contraseña.
- Configuración organiza General, Sedes y Comercial; conserva slugs/estado fuera
  de edición y explica el alcance de la moneda/prefijo en documentos futuros.
- Informes oculta tabs sin permiso, usa fechas civiles y selector de sede, y
  agrupa monedas. No hay gráficas/dependencias pesadas ni exportación.
- El dashboard eliminó estadísticas, citas y “pulso” de demostración. Usa el
  widget de seguimientos real y agregados operacionales si el rol los permite.

Las lecturas tenant-dependent cancelan la solicitud anterior y reinician sus
datos al cambiar de Organization. Las formas presentan errores del API con copy
específico; acciones sensibles de OWNER/ADMIN y suspensión requieren confirmación.
Los roles básicos no requieren una advertencia genérica. Las pantallas usan
etiquetas, inputs nativos, estados textuales, tabs accesibles, diálogo común y
layouts adaptables a móvil.

`useCan` controla affordances únicamente. Rutas, controladores y servicios
vuelven a comprobar permisos y tenant en backend.
