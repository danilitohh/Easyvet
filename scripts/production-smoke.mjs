const defaultOrigin = 'https://easyvet.vercel.app';
const origin = new URL(process.env.EASYVET_SMOKE_ORIGIN ?? defaultOrigin);

if (!['http:', 'https:'].includes(origin.protocol)) {
  throw new Error('EASYVET_SMOKE_ORIGIN debe usar http o https.');
}

const checks = [
  { path: '/', kind: 'page' },
  { path: '/login', kind: 'page' },
  { path: '/api/v1/health', kind: 'health' },
  { path: '/api/v1/health/ready', kind: 'ready' },
];

const requiredHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': '',
};

const failures = [];

for (const check of checks) {
  const url = new URL(check.path, origin);

  try {
    const response = await fetch(url, {
      headers: { accept: check.kind === 'page' ? 'text/html' : 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status !== 200) {
      failures.push(`${check.path}: esperaba HTTP 200 y recibió ${response.status}`);
      continue;
    }

    for (const [name, expected] of Object.entries(requiredHeaders)) {
      const value = response.headers.get(name) ?? '';
      if (!value || (expected && !value.toLowerCase().includes(expected.toLowerCase()))) {
        failures.push(`${check.path}: falta o no coincide el header ${name}`);
      }
    }

    if (check.kind === 'page') {
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        failures.push(`${check.path}: content-type no es HTML`);
      }
      continue;
    }

    const payload = await response.json();
    if (payload.status !== 'ok') {
      failures.push(`${check.path}: la respuesta no reporta status=ok`);
    }

    if (check.kind === 'health') {
      if (response.headers.get('cache-control')?.toLowerCase().includes('no-store') !== true) {
        failures.push(`${check.path}: debe responder con cache-control no-store`);
      }
      if (!response.headers.get('x-request-id')) {
        failures.push(`${check.path}: falta x-request-id`);
      }
    }

    if (check.kind === 'ready' && payload.dependencies?.database !== 'ok') {
      failures.push(`${check.path}: la dependencia database no está disponible`);
    }
  } catch (error) {
    failures.push(`${check.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error(`Production smoke falló para ${origin.origin}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Production smoke OK: ${origin.origin}`);
  console.log(`- ${checks.length} rutas GET verificadas`);
  console.log(
    '- headers de seguridad, cache-control, request-id y health de base de datos verificados',
  );
}
