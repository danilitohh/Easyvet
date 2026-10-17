import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';
import { PERMISSION } from './auth/permissions';
import { AuthContext, defaultContext } from './contexts/auth-context';
import { PrivacyConsentProvider } from './contexts/PrivacyConsentContext';

const clinicRoutes = [
  ['/dashboard', 'Una vista tranquila de la operación'],
  ['/usuarios', 'Usuarios'],
  ['/configuracion', 'Configuración'],
  ['/informes', 'Informes'],
  ['/inventario', 'Inventario'],
  ['/ventas', 'Ventas'],
  ['/facturacion', 'Facturación'],
  ['/caja', 'Caja'],
  ['/peluqueria', 'Peluquería'],
  ['/seguimientos', 'Seguimientos'],
  ['/agenda', 'Agenda'],
  ['/propietarios', 'Propietarios'],
  ['/pacientes', 'Pacientes'],
] as const;

const clinicLoadingRoutes = [
  ['/perfil/profesional', 'Cargando perfil profesional'],
  ['/agenda/disponibilidad', 'Cargando disponibilidad'],
] as const;

const clinicContext = {
  ...defaultContext,
  activeMembership: {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'OWNER' as const,
    clinicalRole: 'PRACTITIONER' as const,
    status: 'ACTIVE' as const,
    organization: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Clínica de prueba aislada',
      slug: 'clinica-prueba-aislada',
    },
    permissions: Object.values(PERMISSION),
  },
};

function renderClinicRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={clinicContext}>
        <PrivacyConsentProvider>
          <App />
        </PrivacyConsentProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

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

describe('clinic route accessibility smoke', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(clinicRoutes)(
    'keeps %s accessible for an authenticated clinic owner',
    async (path, heading) => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('isolated accessibility test')));
      renderClinicRoute(path);

      const main = await screen.findByRole('main', undefined, { timeout: 15_000 });
      const headings = await within(main).findAllByRole('heading', undefined, {
        timeout: 15_000,
      });
      const levelOneHeadings = headings.filter((element) => element.tagName === 'H1');
      const missingControlLabels = Array.from(main.querySelectorAll('a, button')).filter(
        (element) => !hasAccessibleLabel(element),
      );
      const missingFieldLabels = Array.from(
        main.querySelectorAll('input, select, textarea'),
      ).filter((element) => !hasAccessibleLabel(element));
      const missingImageAlt = Array.from(main.querySelectorAll('img')).filter(
        (element) => !element.hasAttribute('alt'),
      );

      expect(
        levelOneHeadings.some((element) => element.textContent?.match(new RegExp(heading, 'i'))),
      ).toBe(true);
      expect(levelOneHeadings).toHaveLength(1);
      expect(missingControlLabels).toEqual([]);
      expect(missingFieldLabels).toEqual([]);
      expect(missingImageAlt).toEqual([]);
    },
    15_000,
  );

  it.each(clinicLoadingRoutes)(
    'exposes an accessible loading state for %s while remote data is unavailable',
    async (path, label) => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('isolated accessibility test')));
      renderClinicRoute(path);

      const main = await screen.findByRole('main', undefined, { timeout: 15_000 });
      await within(main).findByRole('status', { name: label });
    },
    15_000,
  );
});
