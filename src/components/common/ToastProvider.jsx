import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-3 top-3 z-50 flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' ? XCircle : CheckCircle2;
          return (
            <div key={toast.id} className="surface flex items-start gap-2 rounded-md p-3 text-sm text-slate-800">
              <Icon className={`mt-0.5 h-4 w-4 ${toast.type === 'error' ? 'text-red-700' : 'text-green-700'}`} aria-hidden="true" />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider.');
  return context;
}
