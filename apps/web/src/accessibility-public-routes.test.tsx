import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { PrivacyConsentProvider } from './contexts/PrivacyConsentContext';

const publicRoutes = [
  ['/', /más tiempo para cuidar/i],
  ['/login', /bienvenido a easyvet/i],
  ['/registro', /empieza a cuidar con más claridad/i],
  ['/configurar-super-admin', /configura el acceso de plataforma/i],
  ['/verificar-correo', /confirma tu correo/i],
  ['/recuperar-contrasena', /volvamos a entrar juntos/i],
  ['/restablecer-contrasena', /una nueva clave, y listo/i],
  ['/privacidad', /política de privacidad/i],
  ['/terminos', /términos y condiciones/i],
  ['/cookies', /política de cookies/i],
  ['/reembolsos', /política de reembolsos/i],
] as const;

function renderPublicRoute(path: string) {
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

describe('public route accessibility smoke', () => {
  it.each(publicRoutes)(
    'keeps %s structurally accessible',
    async (path, heading) => {
      renderPublicRoute(path);

      const main = await screen.findByRole('main', undefined, { timeout: 15_000 });
      const headings = within(main).getAllByRole('heading');
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
      const headingLevels = headings.map((element) => Number(element.tagName.slice(1)));

      expect(within(main).getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
      expect(levelOneHeadings).toHaveLength(1);
      expect(missingControlLabels).toEqual([]);
      expect(missingFieldLabels).toEqual([]);
      expect(missingImageAlt).toEqual([]);

      for (let index = 1; index < headingLevels.length; index += 1) {
        expect(headingLevels[index]! - headingLevels[index - 1]!).toBeLessThanOrEqual(1);
      }
    },
    15_000,
  );
});
