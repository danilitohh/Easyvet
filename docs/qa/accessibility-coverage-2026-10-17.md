# Easyvet — cobertura de accesibilidad de rutas (2026-10-17)

## Evidencia ejecutada

`npm test --workspace @veterinary-saas/web -- src/accessibility-clinic-routes.test.tsx`

`npm test --workspace @veterinary-saas/web -- src/accessibility-remaining-routes.test.tsx`

Resultado: **40/40 escenarios clínicos aprobados** y **46/46 escenarios de
rutas restantes aprobados**. En conjunto con los smoke público y de plataforma,
la suite cubre 102 escenarios de rutas. Cada prueba verifica, cuando el backend
remoto no está disponible, que exista un `main`, un encabezado de nivel 1 o un
estado de error/carga accesible, nombres accesibles para enlaces y botones,
etiquetas para campos y `alt` explícito para imágenes.

El conjunto clínico incluye 13 rutas principales, 2 estados de carga y 25
rutas secundarias. El conjunto adicional cubre la ruta pública de firma, el
detalle de clínica de plataforma, las rutas autenticadas de acceso, edición,
reprogramación y los formularios y detalles clínicos restantes. Sumado a los
smoke público y de plataforma existentes, la cobertura automatizada documentada
alcanza 102 escenarios de rutas.

## Límites de la evidencia

Los 86 escenarios clínicos y de rutas restantes alcanzaron un estado estable y
no hay rutas omitidas dentro de sus listas explícitas. Las rutas públicas y de
plataforma se cubren además con sus smoke dedicados. Esto no significa que
todas las combinaciones de datos dinámicos tengan un smoke dedicado: las
variantes no enumeradas se cubren mediante sus pruebas específicas de módulo y
todavía requieren una revisión manual completa de navegación por teclado, foco,
contraste y composición en cada viewport.

La cobertura no constituye una certificación WCAG 2.2 AA ni sustituye una
revisión manual de teclado, foco, contraste y composición en cada viewport.
