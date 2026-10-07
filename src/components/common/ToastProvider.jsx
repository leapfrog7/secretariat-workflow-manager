import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getFeedbackTone, normalizeFeedbackTone } from '../ui/feedback';
import { cx } from '../ui/utils';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((messageOrOptions, type = 'success') => {
    const options = typeof messageOrOptions === 'string'
      ? { message: messageOrOptions, tone: type }
      : messageOrOptions;
    const tone = normalizeFeedbackTone(options?.tone || options?.type || type);
    const message = options?.message || '';
    if (!message) return;
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-2), { id, message, title: options?.title, tone }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((toast) => toast.id !== id));
    }, tone === 'danger' ? 6000 : tone === 'warning' ? 5000 : 3500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:bottom-auto sm:top-4 sm:right-4">
        {toasts.map((toast) => {
          const style = getFeedbackTone(toast.tone);
          const Icon = style.Icon;
          const timerDuration = toast.tone === 'danger' ? '[animation-duration:6s]' : toast.tone === 'warning' ? '[animation-duration:5s]' : '[animation-duration:3.5s]';
          return (
            <div key={toast.id} role={toast.tone === 'danger' ? 'alert' : 'status'} className={cx('toast-enter pointer-events-auto relative overflow-hidden rounded-[var(--swm-radius-lg)] border bg-white p-3.5 pr-11 text-sm text-slate-800 shadow-[var(--swm-shadow-float)]', style.shell)}>
              <div className="flex items-start gap-2.5">
                <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', style.icon, style.spin && 'animate-spin')} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-current">{toast.title || style.label}</p>
                  <p className="mt-0.5 leading-5 text-slate-700">{toast.message}</p>
                </div>
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification" className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
              <span className={cx('toast-timer absolute inset-x-0 bottom-0 h-0.5 origin-left', style.timer, timerDuration)} aria-hidden="true" />
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
