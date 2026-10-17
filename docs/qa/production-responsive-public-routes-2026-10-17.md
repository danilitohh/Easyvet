# Easyvet — revisión responsive de rutas públicas (2026-10-17)

## Alcance

Se validó el deployment de producción en un viewport móvil de 390 × 844 px
contra estas rutas:

`/`, `/login`, `/registro`, `/recuperar-contrasena`, `/privacidad`,
`/terminos`, `/cookies` y `/reembolsos`.

## Resultado

Las ocho rutas cumplieron los siguientes checks automatizados en el navegador:

- landmark `main` presente;
- encabezado `h1` presente;
- sin overflow horizontal del documento;
- sin controles interactivos sin nombre o etiqueta;
- sin imágenes sin atributo `alt`.

La landing contiene un orbe visual decorativo que excede el ancho del viewport
por diseño (`.landing-visual-orb--one`). Está marcado `aria-hidden="true"` y
no aumenta `document.documentElement.scrollWidth`; por tanto no intercepta la
navegación ni expone contenido al lector de pantalla.

## Límites

Esta comprobación cubre las rutas públicas en un tamaño móvil y complementa
la validación de `/login` en escritorio documentada en
[`production-visual-accessibility-2026-10-17.md`](production-visual-accessibility-2026-10-17.md).
No sustituye una revisión manual de todas las rutas autenticadas, zoom,
contraste, lectores de pantalla ni una certificación WCAG 2.2 AA.
