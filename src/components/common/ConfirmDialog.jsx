import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, X } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-busy={busy}
        className="dialog-enter w-full max-w-md rounded-t-md border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-md"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${destructive ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-950">
              {title}
            </h2>
            {message && <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>}
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40">
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="h-11 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:opacity-50 sm:h-10">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-80 sm:h-10 ${
              destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
