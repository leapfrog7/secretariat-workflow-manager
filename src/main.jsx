import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { ToastProvider } from './components/common/ToastProvider';
import { AuthProvider } from './features/auth/AuthContext';
import { initializeTextSize } from './utils/appearanceUtils';
import AppErrorBoundary from './components/common/AppErrorBoundary';

initializeTextSize();

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
