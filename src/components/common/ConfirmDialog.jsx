import { AlertTriangle, X } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-md border border-slate-200 bg-white p-4 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${destructive ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-950">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
              destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
