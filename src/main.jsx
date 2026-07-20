import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import { ToastProvider } from './components/common/ToastProvider';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AppRoutes />
    </ToastProvider>
  </StrictMode>,
);
