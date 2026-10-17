# Easyvet — comprobación visual de producción (2026-10-17)

## Evidencia ejecutada

Se recargó directamente `https://easyvet.vercel.app/login` después de que el
deployment `dpl_2qMDmUWY1QgrewqQTEnLe8yUhjg2`, asociado al commit `3cf573a`,
quedara en estado `READY` en Vercel. Después del commit de documentación,
el deployment final `dpl_9hczBJ4DEQoLRF3VLvaknAVhsz1V` (`f661fc8`) también
quedó `READY` y se repitió la comprobación sobre el alias de producción.

En un viewport de aproximadamente 1035 × 954 px se inspeccionaron la tarjeta
de acceso y el aviso de consentimiento de privacidad:

| Elemento | Límite superior | Límite inferior |
| --- | ---: | ---: |
| Tarjeta de acceso | 118,47 px | 642,94 px |
| Aviso de privacidad | 722,33 px | 930,00 px |

Resultado: **no hay solapamiento** y queda un espacio vertical aproximado de
79 px entre ambos elementos. La recarga también mostró el árbol accesible de
la pantalla, con encabezados, campos etiquetados, enlace de recuperación,
botón de ingreso y controles de consentimiento con nombres accesibles.

El consentimiento se presenta inicialmente como una sección visible de la
página, no como un modal que capture el teclado. La ventana de preferencias sí
mantiene su propio recorrido de foco y está cubierta por
`apps/web/src/components/privacy/PrivacyConsent.test.tsx`.

En el deployment `dpl_GnWSMfDMotRb4XBF6un8yepm5XEn` (`fb50075`), el banner
mostró las acciones independientes `Rechazar`, `Aceptar analítica` y
`Guardar preferencias`. La aceptación explícita quedó cubierta además por la
prueba de componente `PrivacyConsent.test.tsx`.

## Alcance y límites

Esta evidencia valida la composición de `/login` en un viewport de escritorio
y el deployment concreto indicado. No sustituye una revisión manual completa
de todas las rutas, tamaños de pantalla, contraste, zoom, lectores de pantalla
ni una certificación WCAG 2.2 AA. La cobertura automatizada de rutas está
documentada en [`accessibility-coverage-2026-10-17.md`](accessibility-coverage-2026-10-17.md).
