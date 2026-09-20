# Referencia visual de Lativet

## Archivos consultados

- `Frontend/COMPARTIDO/Vistas/vistas.html`: estructura global, app switcher, header, paneles y modales.
- `Frontend/COMPARTIDO/Estilos/estilos.css`: tokens, layout, sidebar/app switcher, tarjetas, tablas, responsive y estados.
- `Frontend/COMPARTIDO/Inicio/Vistas/vistas.html`: dashboard, métricas y accesos rápidos.
- `Frontend/COMPARTIDO/Inicio/Estilos/estilos.css`: composición del dashboard, KPI y tarjetas de acceso.
- `Frontend/COMPARTIDO/Autenticacion/Vistas/vistas.html`: referencia de login visual.
- `Frontend/COMPARTIDO/Autenticacion/Estilos/estilos.css`: tratamiento de acceso, overlays y estados.

## Patrones visuales detectados

- Navegación persistente lateral con marca, grupos funcionales y estado activo.
- Header de workspace con contexto de la sección, acciones y tarjeta de usuario.
- Superficies blancas sobre fondos claros azulados, bordes suaves, radios amplios y sombras sutiles.
- Dashboard con hero de contexto, métricas resumidas, paneles operativos, tarjetas y tablas.
- Eyebrows en mayúsculas, títulos de sección compactos y textos auxiliares muted.
- Botones primarios, secundarios y ghost; badges para estados; paneles con encabezado y acciones.
- Modales con overlay, cierre explícito, `aria-modal`, formularios y estados vacíos/carga.
- Responsive por colapso de grid, stacking de paneles y controles de ancho completo en móvil.

## Inconsistencias relevantes

- La navegación legacy alterna tabs globales, dropdowns y secciones ocultas con JavaScript.
- Los tokens aparecen redefinidos varias veces en el CSS acumulado, con variaciones de azul, radios y sombras.
- El login mezcla marca específica de Lativet, fotografías y una experiencia de acceso que no puede reutilizarse como seguridad.
- Parte de la iconografía son imágenes o SVG inline específicos del producto anterior.

## Decisiones de adaptación a React

- Se conserva la intención de sidebar, header, dashboard, paneles, tablas, badges, estados y modales.
- Cada sección tiene una URL propia mediante React Router; no se ocultan bloques globales del DOM.
- Easyvet usa una marca monograma temporal y tokens propios teal/neutral; no se copian logo, fotos ni assets de Lativet.
- El dashboard usa mocks explícitamente ficticios y no llama al backend.
- Los módulos futuros usan `ModulePlaceholder` para evitar inventar formularios o reglas clínicas.
- El modal implementado cubre Escape, foco de retorno, overlay y bloqueo de scroll sin construir una infraestructura de autenticación.
- Se usan glifos tipográficos accesibles y estables como iconografía provisional; no se agrega una segunda librería mientras no exista una necesidad funcional de iconos.
- No se crea login demo en esta fase: la pantalla legacy sirve como referencia visual, pero reutilizarla añadiría una falsa frontera de autenticación antes del diseño de seguridad.
