import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePrivacyConsent } from '../../contexts/PrivacyConsentContext';
import { Button } from '../ui/Button';

export function PrivacyConsent() {
  const {
    analyticsConsent,
    preferencesOpen,
    saveAnalyticsConsent,
    openPreferences,
    closePreferences,
  } = usePrivacyConsent();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(analyticsConsent === 'granted');
  const preferencesDialogRef = useRef<HTMLElement>(null);
  const preferencesTriggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusOnTriggerRef = useRef(false);
  const closePreferencesRef = useRef(closePreferences);

  closePreferencesRef.current = closePreferences;

  function setPreferencesTriggerRef(element: HTMLButtonElement | null) {
    preferencesTriggerRef.current = element;
    if (element && restoreFocusOnTriggerRef.current) {
      element.focus();
      restoreFocusOnTriggerRef.current = false;
    }
  }

  useEffect(() => {
    setAnalyticsEnabled(analyticsConsent === 'granted');
  }, [analyticsConsent, preferencesOpen]);

  useEffect(() => {
    if (!preferencesOpen || !preferencesDialogRef.current) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () =>
      Array.from(
        preferencesDialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    focusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreferencesRef.current();
        return;
      }

      if (event.key !== 'Tab' || !preferencesDialogRef.current) return;

      const elements = focusableElements();
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const focusTarget = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : preferencesTriggerRef.current;
      if (focusTarget) {
        focusTarget.focus();
      } else {
        queueMicrotask(() => preferencesTriggerRef.current?.focus());
      }
    };
  }, [preferencesOpen]);

  useEffect(() => {
    if (preferencesOpen || !previousFocusRef.current) return;

    const focusTarget = previousFocusRef.current.isConnected
      ? previousFocusRef.current
      : preferencesTriggerRef.current;
    focusTarget?.focus();
    previousFocusRef.current = null;
  }, [preferencesOpen]);

  const isVisible = analyticsConsent === 'unknown' || preferencesOpen;
  if (!isVisible) {
    return (
      <button
        ref={setPreferencesTriggerRef}
        className="privacy-preferences-trigger"
        type="button"
        onClick={(event) => {
          previousFocusRef.current = event.currentTarget;
          restoreFocusOnTriggerRef.current = true;
          openPreferences();
        }}
      >
        Privacidad
      </button>
    );
  }

  return (
    <aside
      ref={preferencesDialogRef}
      className="privacy-consent"
      aria-labelledby="privacy-consent-title"
      role={preferencesOpen ? 'dialog' : 'region'}
      aria-modal={preferencesOpen ? 'true' : undefined}
    >
      <div className="privacy-consent__copy">
        <p className="privacy-consent__eyebrow">Privacidad y analítica</p>
        <h2 id="privacy-consent-title">Tú decides qué medimos</h2>
        <p>
          Easyvet puede medir visitas y navegación para mejorar la plataforma. No enviamos datos
          clínicos, identificadores de pacientes, tokens ni parámetros de URL.
        </p>
        <Link to="/cookies">Leer la política de cookies</Link>
      </div>
      <div className="privacy-consent__options">
        <label className="privacy-consent__option">
          <input
            type="checkbox"
            checked={analyticsEnabled}
            onChange={(event) => setAnalyticsEnabled(event.target.checked)}
          />
          <span>
            <strong>Analítica de uso</strong>
            <small>
              Registra rutas agregadas y rendimiento básico. No usa cookies de terceros.
            </small>
          </span>
        </label>
        <div className="privacy-consent__actions">
          {analyticsConsent === 'unknown' && (
            <>
              <Button variant="ghost" type="button" onClick={() => saveAnalyticsConsent('denied')}>
                Rechazar
              </Button>
              <Button type="button" onClick={() => saveAnalyticsConsent('granted')}>
                Aceptar analítica
              </Button>
            </>
          )}
          {preferencesOpen && (
            <Button variant="ghost" type="button" onClick={closePreferences}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => saveAnalyticsConsent(analyticsEnabled ? 'granted' : 'denied')}
          >
            Guardar preferencias
          </Button>
        </div>
      </div>
    </aside>
  );
}
