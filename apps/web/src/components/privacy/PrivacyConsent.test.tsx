import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
  });
});
