import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { ToastProvider } from './components/common/ToastProvider';
import { AuthProvider } from './features/auth/AuthContext';
import { initializeTextSize } from './utils/appearanceUtils';
import AppErrorBoundary from './components/common/AppErrorBoundary';

initializeTextSize();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Installation and offline support remain optional if registration is blocked.
    });
  });
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  Promise.all([
    navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
      registrations
        .filter((registration) => registration.active?.scriptURL.endsWith('/sw.js'))
        .map((registration) => registration.unregister()),
    )),
    'caches' in window
      ? caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('swm-shell-')).map((key) => caches.delete(key))))
      : Promise.resolve(),
  ]).then(() => {
    if (navigator.serviceWorker.controller) window.location.reload();
  }).catch(() => {
    // Local development remains usable if stale PWA cleanup is blocked.
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
