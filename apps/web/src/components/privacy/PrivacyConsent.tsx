import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setAnalyticsEnabled(analyticsConsent === 'granted');
  }, [analyticsConsent, preferencesOpen]);

  const isVisible = analyticsConsent === 'unknown' || preferencesOpen;
  if (!isVisible) {
    return (
      <button className="privacy-preferences-trigger" type="button" onClick={openPreferences}>
        Privacidad
      </button>
    );
  }

  return (
    <aside className="privacy-consent" aria-labelledby="privacy-consent-title" role="dialog">
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
            <small>Registra rutas agregadas y rendimiento básico. No usa cookies de terceros.</small>
          </span>
        </label>
        <div className="privacy-consent__actions">
          {analyticsConsent === 'unknown' && (
            <Button variant="ghost" type="button" onClick={() => saveAnalyticsConsent('denied')}>
              Rechazar
            </Button>
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
