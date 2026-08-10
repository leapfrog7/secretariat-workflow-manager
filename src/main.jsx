import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { ToastProvider } from './components/common/ToastProvider';
import { AuthProvider } from './features/auth/AuthContext';
import { initializeTextSize } from './utils/appearanceUtils';
import AppErrorBoundary from './components/common/AppErrorBoundary';

initializeTextSize();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // Installation and offline support remain optional if registration is blocked.
    });
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
