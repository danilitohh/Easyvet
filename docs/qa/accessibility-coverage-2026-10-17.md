# Easyvet — cobertura de accesibilidad de rutas (2026-10-17)

## Evidencia ejecutada

`npm test --workspace @veterinary-saas/web -- src/accessibility-clinic-routes.test.tsx`

Resultado: **30/30 escenarios aprobados**. La prueba verifica, cuando el
backend remoto no está disponible, que exista un `main`, una sola jerarquía
`h1`, nombres accesibles para enlaces y botones, etiquetas para campos y
`alt` explícito para imágenes.

El conjunto incluye 13 rutas clínicas principales, 2 estados de carga y 15
rutas secundarias. Sumado a los smoke público y de plataforma, la cobertura
de `alt` documentada alcanza 46 rutas representativas.

## Límites no marcados como verificados

Durante la ampliación se intentaron rutas dinámicas que no alcanzaron un
estado estable dentro del límite del smoke cuando el backend fue rechazado.
No se cuentan como fallos funcionales ni como cobertura aprobada; requieren
fixtures o mocks específicos antes de poder verificarse:

- `/inventario/:itemId`
- `/peluqueria/:groomingVisitId`
- `/seguimientos/:followUpId`
- `/agenda/nueva`
- `/propietarios/:ownerId`
- `/pacientes/:patientId`
- `/pacientes/:patientId/historia`
- `/pacientes/:patientId/historia/preventivos`
- `/pacientes/:patientId/historia/nueva`
- `/pacientes/:patientId/historia/evoluciones/nueva`

La cobertura no constituye una certificación WCAG 2.2 AA ni sustituye una
revisión manual de teclado, foco, contraste y composición en cada viewport.
