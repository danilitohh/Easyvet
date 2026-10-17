# Easyvet — cobertura de accesibilidad de rutas (2026-10-17)

## Evidencia ejecutada

`npm test --workspace @veterinary-saas/web -- src/accessibility-clinic-routes.test.tsx`

Resultado: **40/40 escenarios aprobados**. La prueba verifica, cuando el
backend remoto no está disponible, que exista un `main`, una sola jerarquía
`h1`, nombres accesibles para enlaces y botones, etiquetas para campos y
`alt` explícito para imágenes.

El conjunto incluye 13 rutas clínicas principales, 2 estados de carga y 25
rutas secundarias. Sumado a los smoke público y de plataforma, la cobertura
de `alt` documentada alcanza 56 rutas representativas.

## Límites de la evidencia

Los 40 escenarios del conjunto alcanzaron un estado estable y no hay rutas
omitidas dentro de esa lista. Esto no significa que todas las combinaciones
dinámicas de módulos clínicos tengan un smoke dedicado: las demás rutas se
cubren mediante sus pruebas específicas de módulo y todavía requieren una
revisión manual completa de navegación por teclado, foco, contraste y
composición en cada viewport.

La cobertura no constituye una certificación WCAG 2.2 AA ni sustituye una
revisión manual de teclado, foco, contraste y composición en cada viewport.
