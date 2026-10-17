import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'easyvet.analytics-consent';

export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';

type PrivacyConsentContextValue = {
  analyticsConsent: AnalyticsConsent;
  preferencesOpen: boolean;
  saveAnalyticsConsent: (consent: Exclude<AnalyticsConsent, 'unknown'>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
};

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null);

function readConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function PrivacyConsentProvider({ children }: { children: ReactNode }) {
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>(readConsent);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const saveAnalyticsConsent = useCallback((consent: Exclude<AnalyticsConsent, 'unknown'>) => {
    setAnalyticsConsent(consent);
    setPreferencesOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, consent);
    } catch {
      // A privacy preference still applies for this session when storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({
      analyticsConsent,
      preferencesOpen,
      saveAnalyticsConsent,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
    }),
    [analyticsConsent, preferencesOpen, saveAnalyticsConsent],
  );

  return <PrivacyConsentContext.Provider value={value}>{children}</PrivacyConsentContext.Provider>;
}

// The hook intentionally lives next to its provider so consumers import one privacy boundary.
// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacyConsent(): PrivacyConsentContextValue {
  const context = useContext(PrivacyConsentContext);
  if (!context) throw new Error('usePrivacyConsent must be used inside PrivacyConsentProvider');
  return context;
}
