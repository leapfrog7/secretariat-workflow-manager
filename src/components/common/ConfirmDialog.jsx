import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, X } from 'lucide-react';
import ModalFrame from './ModalFrame';
import Button from '../ui/Button';

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
    <ModalFrame open labelledBy="confirm-title" describedBy={message ? 'confirm-description' : undefined} busy={busy} onClose={onCancel} maxWidth="max-w-md">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${destructive ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-700'}`}>
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-bold tracking-tight text-[var(--swm-ink)]">
              {title}
            </h2>
            {message ? <p id="confirm-description" className="mt-1.5 text-sm leading-6 text-[var(--swm-muted)]">{message}</p> : null}
          </div>
          <Button type="button" onClick={onCancel} disabled={busy} variant="ghost" size="icon" className="-mr-2 -mt-2 h-9 w-9">
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button type="button" data-autofocus onClick={onCancel} disabled={busy} variant="secondary" size="lg" className="sm:min-h-10">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={busy}
            variant={destructive ? 'danger' : 'primary'}
            size="lg"
            className="min-w-28 sm:min-h-10"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
}
