import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

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

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:bottom-auto sm:top-3" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' ? XCircle : CheckCircle2;
          return (
            <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={`toast-enter pointer-events-auto relative overflow-hidden rounded-md border bg-white p-3 pr-10 text-sm text-slate-800 shadow-lg ${toast.type === 'error' ? 'border-red-200' : 'border-emerald-200'}`}>
              <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`} aria-hidden="true" />
                <span className="leading-5">{toast.message}</span>
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
              <span className={`toast-timer absolute inset-x-0 bottom-0 h-0.5 origin-left ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden="true" />
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
