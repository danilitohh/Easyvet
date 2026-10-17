import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrivacyConsentProvider } from '../../contexts/PrivacyConsentContext';
import { PrivacyConsent } from './PrivacyConsent';

function renderConsent() {
  return render(
    <MemoryRouter>
      <PrivacyConsentProvider>
        <PrivacyConsent />
      </PrivacyConsentProvider>
    </MemoryRouter>,
  );
}

describe('PrivacyConsent', () => {
  beforeEach(() => window.localStorage.clear());

  it('requires an explicit choice before enabling analytics', () => {
    renderConsent();
    expect(screen.getByRole('region', { name: 'Tú decides qué medimos' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));
    expect(screen.getByRole('button', { name: 'Privacidad' })).toBeInTheDocument();
    expect(window.localStorage.getItem('easyvet.analytics-consent')).toBe('denied');
  });

  it('stores an explicit opt-in and allows reopening preferences', () => {
    renderConsent();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));
    expect(window.localStorage.getItem('easyvet.analytics-consent')).toBe('granted');
    fireEvent.click(screen.getByRole('button', { name: 'Privacidad' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into preferences and restores it when closed with Escape', async () => {
    renderConsent();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));

    const preferencesButton = screen.getByRole('button', { name: 'Privacidad' });
    preferencesButton.focus();
    fireEvent.click(preferencesButton);
    expect(screen.getByRole('link', { name: 'Leer la política de cookies' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Privacidad' })).toHaveFocus());
  });

  it('keeps keyboard focus inside the preferences dialog', () => {
    renderConsent();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }));
    const preferencesButton = screen.getByRole('button', { name: 'Privacidad' });
    fireEvent.click(preferencesButton);

    const dialog = screen.getByRole('dialog');
    const first = screen.getByRole('link', { name: 'Leer la política de cookies' });
    const last = screen.getByRole('button', { name: 'Guardar preferencias' });
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(first).toHaveFocus();
  });
});
