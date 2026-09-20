# Decisiones de Agenda

Este registro separa las decisiones ya fijadas de las recomendaciones técnicas
y de las preguntas que requieren decisión de producto. Fase 5A solo documenta;
no implementa ninguna de estas decisiones.

## DECIDIDO

1. **Fase 5A es análisis y diseño.** No crea modelos Prisma, migraciones,
   tablas, endpoints, UI funcional, integraciones ni dependencias nuevas.
2. **Organization es el tenant.** `TenantContext` es la única fuente de
   `organizationId`; no se acepta un tenant enviado por el cliente.
3. **Appointment y ClinicalConsultation son conceptos distintos.** Una reserva
   no es automáticamente una atención clínica.
4. **Membership representa al actor profesional.** No se crea una entidad
   `Professional` por pantalla.
5. **Los tiempos nuevos siguen la convención Easyvet:** instantes UTC en base de
   datos y zona de la organización para presentación/conversión.
6. **La agenda debe ser tenant-aware.** Las relaciones a Patient, Owner,
   ClinicLocation, Membership y catálogos deben comprobar organización con
   claves o validaciones compuestas.
7. **No se copian secretos ni tokens del legado.** `credentials.json`,
   `token.json`, SMTP, cookies, sesiones y enlaces bearer se excluyen de la
   migración.
8. **No se replica el borrado físico en cascada de Lativet.** Las citas
   históricas se conservan y las fichas de Owner/Patient se archivan según las
   reglas ya adoptadas por Easyvet.
9. **Google Calendar, SMTP, recordatorios, seguimientos, consultas clínicas,
   reservas públicas y grooming no pertenecen al alcance de 5B.**
10. **La máquina propuesta tiene seis estados canónicos:** `SCHEDULED`,
    `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` y `NO_SHOW`.
11. **No se copiarán estados o endpoints legacy que no estén demostrados.** La
    ausencia del árbol `Backend/AGENDA` en este checkout queda registrada como
    una limitación de evidencia y no se rellena con suposiciones.

## RECOMENDADO

### Modelo 5B

Implementar, después de cerrar las decisiones de producto, únicamente:

- `Appointment`;
- `AppointmentType` como catálogo por organización;
- `AvailabilityRule` para reglas civiles de sede/profesional;
- `ScheduleBlock` para excepciones puntuales.

La propuesta completa de campos, relaciones, índices, constraints, tiempos,
conflictos y eliminación está en `agenda-proposal.md`.

### Identidad de la reserva

Para el primer corte interno se recomienda exigir Patient y Owner registrados,
activos y del mismo tenant, y validar que el propietario coincida con el
paciente. Esto evita importar la creación silenciosa de placeholders de
`Reservas`. Un flujo de “cliente aún no registrado” debe ser una decisión y
contrato separados, no campos anónimos añadidos por conveniencia.

Se recomienda exigir `ClinicLocation` en citas internas. Una llamada o
teleconsulta puede requerir una excepción explícita si el producto lo decide.

### Conflictos y disponibilidad

- Bloquear solapamientos por Patient y por Membership asignada.
- No tratar toda la sede como recurso único sin una capacidad o consultorio
  definido.
- Mantener disponibilidad y conflictos como validaciones diferentes.
- Proteger la creación/reprogramación con transacción y bloqueo o una exclusión
  PostgreSQL sobre rangos `tstzrange`; el `check-then-insert` sin bloqueo no es
  suficiente.
- Si la organización no tiene reglas, no generar slots automáticamente; una
  creación interna autorizada puede validarse por conflicto hasta que producto
  cierre la política.

### Estados y retención

Usar la máquina documentada en `appointment-state-machine.md`, conservar
cancelaciones y no borrar citas por una operación normal. El cierre operativo
no crea una consulta clínica automáticamente.

### Frontend futuro

Para Fase 5C se recomienda evaluar primero FullCalendar con vistas día/semana/
mes y el adaptador oficial React, manteniendo contratos y permisos propios de
Easyvet. La documentación oficial indica integración React y licencia MIT para
el paquete estándar: [FullCalendar React docs](https://fullcalendar.io/docs/react).
No se instala en Fase 5A; antes de usarlo se debe revisar la versión, plugins,
accesibilidad, bundle y licencia de cualquier vista premium. No usar el
calendario para resolver conflictos: el backend sigue siendo la autoridad.

### Integraciones futuras

Google debe diseñarse como OAuth web por organización, sede, profesional o
recurso solo después de la decisión de producto, con redirect canónico,
state/PKCE cuando aplique, tokens cifrados, scopes mínimos, revocación e
idempotencia. La frontera de código futura debe ser un contrato
`CalendarProvider` detrás de Agenda, de modo que la cita funcione 100% sin
Google y la sincronización externa no contamine el modelo core. No se debe
importar el modelo de archivos global del legado.

## PRODUCT DECISION REQUIRED

Estas decisiones deben responderse antes de cerrar contratos y migraciones de
Fase 5B:

1. **Reserva sin Patient/Owner:** ¿se rechaza hasta crear fichas, se permite un
   provisional con datos mínimos, o se usa otro flujo? La recomendación técnica
   es rechazarla en el MVP y no crear placeholders silenciosos.
2. **Relación Owner:** ¿se almacena `ownerId` en Appointment para congelar el
   contexto de reserva o se deriva siempre de Patient? No duplicar sin una
   política de cambios de propietario.
3. **Sede:** ¿ClinicLocation es obligatoria para llamadas/teleconsulta y para
   reservas públicas, o solo para atención presencial?
4. **Profesional:** ¿puede crearse una cita sin membership asignada? ¿Quién
   puede reasignarla y quién puede ver todas las citas de una sede?
5. **Conflicto:** ¿se bloquea por profesional, paciente, sede, consultorio,
   equipo, capacidad o combinación? ¿Puede haber dos profesionales en la misma
   sede al mismo tiempo?
6. **Disponibilidad:** ¿qué significa “sin reglas”? ¿Se requieren turnos
   partidos, intervalos nocturnos, festivos, vacaciones y excepciones DST?
7. **Tipos:** ¿qué categorías son obligatorias y cuáles puede configurar cada
   organización? ¿Se permite cambiar el nombre/categoría después de usarlo?
8. **Estados:** ¿confirmación obligatoria, atajo directo a `IN_PROGRESS`,
   tolerancia de no-show, cancelación tardía y motivo obligatorio?
9. **Correcciones:** ¿un administrador puede reabrir un estado terminal? ¿Qué
   historial de reprogramación y auditoría exige la clínica?
10. **Permisos:** ¿qué roles actuales reciben read/create/update/cancel/
    complete/manage-availability? ¿Se separa iniciar de confirmar?
11. **Google:** ¿conexión por organización, sede, membership o calendario?
    ¿Sincronización unidireccional o bidireccional? ¿Qué ocurre ante borrado o
    conflicto externo?
12. **Notificaciones:** ¿correo desde plataforma o credenciales de cada
    clínica? ¿Qué eventos y preferencias se permitirán?
13. **Reserva pública:** ¿se habilita en una fase posterior con token tenant,
    rate limits, anti-abuso, consentimiento y disponibilidad publicada?
14. **PII:** ¿qué datos mínimos se muestran a recepción, veterinaria, groomer y
    cashier? La matriz actual de Owners/Patients no se amplía implícitamente.
15. **Recurrencia:** ¿se requieren citas recurrentes o solo reglas de
    disponibilidad? No generar series en 5B sin límites e idempotencia.

## POSTERGADO

- Modelos y endpoints de `ClinicalConsultation`, `ClinicalFollowup` y
  `ControlReminder`.
- Envío de SMTP, plantillas, preferencias, rebotes, reintentos y jobs.
- Google OAuth, sincronización, webhooks, busy slots y resolución de conflictos.
- Reservas públicas, links anónimos, captcha/rate limit y consentimiento.
- Calendario visual React, drag-and-drop, filtros avanzados y sala de espera
  funcional; la ruta `/agenda` actual sigue siendo un placeholder.
- Consultorios, equipos, recursos con capacidad y calendarios de terceros.
- Recurrencia de citas y generación masiva de instancias.
- Audit log inmutable y versionado legal de reprogramaciones.
- Integración con grooming, facturación, caja, inventario y documentos.
- Política final de retención, anonimización, exportación y borrado legal.
- Decisión final de PII por rol y permisos clínicos/financieros adicionales.

## Criterio de salida de Fase 5A

Fase 5A queda lista cuando este registro, la referencia legacy, la propuesta y
la máquina de estados estén revisados; cuando PRODUCT DECISION REQUIRED tenga
respuestas; y cuando Fase 5B pueda implementarse sin inventar estados, recursos,
placeholders, contratos ni integraciones.
