# Consentimientos y evidencia de firma

## Alcance y lenguaje legal

Consent captura evidencia de aceptación/firma electrónica en Easyvet V1. No afirma
proporcionar una firma digital cualificada o certificada reconocida en toda
jurisdicción. Requisitos legales específicos por país y validez jurídica requieren
PRODUCT/LEGAL REVIEW antes de comercializar el flujo en cada jurisdicción.

## Datos y lifecycle

`Consent` pertenece a Organization, Patient y un ClinicalEncounter del mismo tenant;
puede vincular opcionalmente un ClinicalProcedure del mismo Patient/Encounter. Sus
estados son `DRAFT → ISSUED → SIGNED` y `ISSUED|SIGNED → VOIDED`. `version` aplica
compare-and-swap. Draft permite editar contenido solo con `expectedVersion`; emisión
valida título, declaración y responsable Practitioner activo con perfil y nombre
profesional configurados.

Al emitir se congelan Patient, Owner histórico del Encounter, documento del Owner,
profesional/licencia, timestamp/version y SHA-256 del contenido canónico. Los campos
de identificación del Owner pueden faltar y se mantienen null. Una vez emitido el
contenido es inmutable. Reissue mantiene el contenido, incrementa versión, revoca
solicitudes pendientes anteriores y emite un único request nuevo. Void conserva
consentimiento y evidencia, revocando solicitudes pendientes.

`ConsentSignatureRequest` es tenant-scoped y guarda solo SHA-256 del token bearer,
hash Argon2id del OTP, expiración, contador/límite de intentos, estado y evidencia
final. Token aleatorio de 256 bits y OTP de seis dígitos se devuelven en claro una
sola vez al actor autorizado al emitir/reemitir; no se persisten ni se devuelven al
listado/detalle. Configuración local: TTL y máximo de intentos por environment.

## Firma pública

`GET /api/v1/public/signatures/:token` devuelve solo el contexto del documento,
datos congelados y documento del Owner enmascarado. `POST .../:token/sign` recibe
OTP, nombre del firmante, aceptación explícita y método `TYPED` o `DRAWN`; `DRAWN`
acepta PNG hasta 1 MiB validado por firma mágica. La identidad provista es evidencia
de lo declarado por quien firma, no una validación oficial de identidad.

Token, estado pending, expiración, intentos, consentimiento emitido y padres
elegibles se vuelven a validar bajo locks. Error público genérico evita enumerar
tokens/consentimientos y el OTP incorrecto incrementa intentos; tras el límite o
expiración el request deja de estar disponible. La página usa `no-store` y
`no-referrer`; no necesita una sesión autenticada.

La firma tipográfica guarda el nombre y método. La manuscrita almacena PNG privado y
su SHA-256. Evidencia SHA-256 canónica combina hash del contenido emitido, request,
timestamp ISO, nombre, método y hash PNG (o null si typed). Raw IP y User-Agent se
conservan truncados en el request para trazabilidad, nunca en auditoría genérica.
La aceptación exitosa crea el PDF firmado y un ClinicalDocument en una operación
consistente con compensación de storage si falla la transacción. PDF incluye
representación dibujada cuando existe y hash de evidencia.

## Permisos y conservación

`consents.read/create/updateDraft/issue/void` separan cada acción. Practitioner puede
ejecutar lifecycle según permisos; Clinical Assistant lee/crea/edita Draft pero no
emite ni anula. Los servicios revalidan Membership clínico, profesional responsable,
tenant, Patient activo, Encounter no anulado y Procedure asociado elegible. Los
padres se bloquean para serializar firma contra reissue/void/archive. Patient
archivado bloquea emisión, firma y cambios; el historial permanece legible según
permisos. Void y archivo del Patient nunca borran registros/bytes.

Email/SMS de enlace, firma digital cualificada, constructor de plantillas y reglas
de consentimiento específicas por país quedan POST-V1. Hasta implementar entrega
de canales no se debe describir emisión como envío automático.
