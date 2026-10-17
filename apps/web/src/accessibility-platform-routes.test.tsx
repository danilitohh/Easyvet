import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';
import { AuthContext, defaultContext } from './contexts/auth-context';
import { PrivacyConsentProvider } from './contexts/PrivacyConsentContext';

const platformRoutes = [
  ['/plataforma', /una vista clara de toda la plataforma/i],
  ['/plataforma/clinicas', /organizaciones/i],
  ['/plataforma/actividad', /auditoría de plataforma/i],
  ['/plataforma/suscripciones', /planes y suscripciones/i],
  ['/plataforma/cuentas', /cuentas de plataforma/i],
] as const;

function renderPlatformRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={defaultContext}>
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

describe('platform route accessibility smoke', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(platformRoutes)(
    'keeps %s accessible for an authenticated platform administrator',
    async (path, heading) => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('isolated accessibility test')));
      renderPlatformRoute(path);

      const main = await screen.findByRole('main', undefined, { timeout: 15_000 });
      await within(main).findByRole('heading', { level: 1, name: heading }, { timeout: 15_000 });
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

      expect(levelOneHeadings).toHaveLength(1);
      expect(missingControlLabels).toEqual([]);
      expect(missingFieldLabels).toEqual([]);
      expect(missingImageAlt).toEqual([]);
    },
    15_000,
  );
});
