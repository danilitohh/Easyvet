import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { PrivacyConsentProvider } from './contexts/PrivacyConsentContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import { PrivacyConsent } from './components/privacy/PrivacyConsent';
import { appConfig } from './config/app';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import './styles/index.css';
import './styles/privacy.css';
import './components/reactbits/reactbits.css';
import './components/kokonutui/kokonutui.css';

// The entry point wires the router and global styles only; feature modules arrive later.
document.title = appConfig.name;
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <PrivacyConsentProvider>
            <App />
            <PrivacyConsent />
          </PrivacyConsentProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
