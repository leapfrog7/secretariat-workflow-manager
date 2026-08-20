import { useState } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="rounded-[var(--swm-radius-lg)] border border-red-200 bg-red-50/70 p-4 text-sm text-red-900 shadow-[var(--swm-shadow-xs)] sm:p-5" role="alert">
      <div className="flex items-start gap-3"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-700 shadow-[var(--swm-shadow-xs)]"><AlertCircle className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">{title}</h2>
      {message ? <p className="mt-1 leading-6 text-red-800/80">{message}</p> : null}
      {onRetry ? (
        <Button
          type="button"
          onClick={retry}
          disabled={retrying}
          variant="dangerSecondary"
          size="sm"
          className="mt-3"
        >
          {retrying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {retrying ? 'Retrying...' : 'Retry'}
        </Button>
      ) : null}</div></div>
    </div>
  );
}
