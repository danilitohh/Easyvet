import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';
import { PERMISSION } from './auth/permissions';
import { AuthContext, defaultContext } from './contexts/auth-context';
import { AuthProvider } from './contexts/AuthContext';
import { PrivacyConsentProvider } from './contexts/PrivacyConsentContext';

const ids = {
  appointment: '99999999-9999-4999-8999-999999999999',
  anesthesia: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  consent: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  diagnostic: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  encounter: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  grooming: '77777777-7777-4777-8777-777777777777',
  hospitalization: '12121212-1212-4121-8121-121212121212',
  item: '55555555-5555-4555-8555-555555555555',
  membership: '44444444-4444-4444-8444-444444444444',
  organization: '22222222-2222-4222-8222-222222222222',
  owner: '33333333-3333-4333-8333-333333333333',
  patient: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  prescription: '13131313-1313-4131-8131-131313131313',
  procedure: '14141414-1414-4141-8141-141414141414',
  rule: '15151515-1515-4151-8151-151515151515',
  sale: '66666666-6666-4666-8666-666666666666',
  vaccination: '16161616-1616-4161-8161-161616161616',
  deworming: '17171717-1717-4171-8171-171717171717',
  followUp: '88888888-8888-4888-8888-888888888888',
  groomingVisit: '77777777-7777-4777-8777-777777777777',
};

const clinicContext = {
  ...defaultContext,
  activeMembership: {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'OWNER' as const,
    clinicalRole: 'PRACTITIONER' as const,
    status: 'ACTIVE' as const,
    organization: {
      id: ids.organization,
      name: 'Clínica de prueba aislada',
      slug: 'clinica-prueba-aislada',
    },
    permissions: Object.values(PERMISSION),
  },
};

const platformRoutes = [`/plataforma/clinicas/${ids.organization}`] as const;

const authenticatedRoutes = [
  '/cambiar-contrasena',
  '/seleccionar-organizacion',
  '/acceso-denegado',
  '/health',
  `/inventario/${ids.item}/editar`,
  `/ventas/${ids.sale}/editar`,
  `/facturacion/${ids.sale}`,
  `/peluqueria/${ids.groomingVisit}/editar`,
  `/seguimientos/${ids.followUp}/editar`,
  `/pacientes/${ids.patient}/seguimientos/nuevo`,
  `/agenda/citas/${ids.appointment}/editar`,
  `/agenda/citas/${ids.appointment}/reprogramar`,
  '/agenda/disponibilidad/nueva',
  `/agenda/disponibilidad/${ids.rule}/editar`,
  `/propietarios/${ids.owner}/editar`,
  `/pacientes/${ids.patient}/editar`,
  `/pacientes/${ids.patient}/historia/seguimientos`,
  `/pacientes/${ids.patient}/historia/consentimientos/${ids.consent}`,
  `/pacientes/${ids.patient}/historia/consentimientos/${ids.consent}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/consentimientos/nuevo`,
  `/pacientes/${ids.patient}/historia/diagnosticos/${ids.diagnostic}`,
  `/pacientes/${ids.patient}/historia/diagnosticos/${ids.diagnostic}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/diagnosticos/nuevo`,
  `/pacientes/${ids.patient}/historia/hospitalizaciones/${ids.hospitalization}`,
  `/pacientes/${ids.patient}/historia/hospitalizaciones/${ids.hospitalization}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/hospitalizacion/nueva`,
  `/pacientes/${ids.patient}/historia/procedimientos/${ids.procedure}`,
  `/pacientes/${ids.patient}/historia/procedimientos/${ids.procedure}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/procedimientos/nuevo`,
  `/pacientes/${ids.patient}/historia/anestesias/${ids.anesthesia}`,
  `/pacientes/${ids.patient}/historia/anestesias/${ids.anesthesia}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/anestesias/nueva`,
  `/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}`,
  `/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/prescripciones/nueva`,
  `/pacientes/${ids.patient}/historia/preventivos/vacunas/${ids.vaccination}`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/vacunas/nueva`,
  `/pacientes/${ids.patient}/historia/preventivos/vacunas/${ids.vaccination}/editar`,
  `/pacientes/${ids.patient}/historia/preventivos/desparasitaciones/${ids.deworming}`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/desparasitaciones/nueva`,
  `/pacientes/${ids.patient}/historia/preventivos/desparasitaciones/${ids.deworming}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/editar`,
  `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/evoluciones/nueva`,
] as const;

const publicRoutes = ['/firmar/prueba-token'] as const;

function hasAccessibleLabel(element: Element): boolean {
  if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) return true;
  if (element.textContent?.replace(/\s+/g, ' ').trim()) return true;
  if (element.closest('label')) return true;

  const id = element.getAttribute('id');
  if (!id) return false;
  return Array.from(element.ownerDocument.querySelectorAll('label')).some(
    (label) => label.htmlFor === id,
  );
}

function renderRoute(path: string, kind: 'clinic' | 'platform' | 'public') {
  if (kind === 'public') {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <PrivacyConsentProvider>
            <App />
          </PrivacyConsentProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={kind === 'clinic' ? clinicContext : defaultContext}>
        <PrivacyConsentProvider>
          <App />
        </PrivacyConsentProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function assertAccessibleRoute(path: string, kind: 'clinic' | 'platform' | 'public') {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('isolated accessibility test')));
  renderRoute(path, kind);

  const main = await screen.findByRole('main', undefined, { timeout: 15_000 });
  await waitFor(
    () => {
      const levelOneHeadings = within(main).queryAllByRole('heading', { level: 1 });
      const feedback = main.querySelector('[role="status"], [role="alert"]');
      expect(levelOneHeadings.length > 0 || feedback).toBeTruthy();
    },
    { timeout: 15_000 },
  );

  const missingControlLabels = Array.from(main.querySelectorAll('a, button')).filter(
    (element) => !hasAccessibleLabel(element),
  );
  const missingFieldLabels = Array.from(main.querySelectorAll('input, select, textarea')).filter(
    (element) => !hasAccessibleLabel(element),
  );
  const missingImageAlt = Array.from(main.querySelectorAll('img')).filter(
    (element) => !element.hasAttribute('alt'),
  );

  expect(missingControlLabels).toEqual([]);
  expect(missingFieldLabels).toEqual([]);
  expect(missingImageAlt).toEqual([]);
}

describe('remaining route accessibility smoke', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(publicRoutes)(
    'keeps public route %s accessible',
    async (path) => {
      await assertAccessibleRoute(path, 'public');
    },
    15_000,
  );

  it.each(platformRoutes)(
    'keeps platform route %s accessible',
    async (path) => {
      await assertAccessibleRoute(path, 'platform');
    },
    15_000,
  );

  it.each(authenticatedRoutes)(
    'keeps authenticated route %s accessible',
    async (path) => {
      await assertAccessibleRoute(path, 'clinic');
    },
    15_000,
  );
});
