import { useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';

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
    <div className="surface rounded-md border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <h2 className="font-semibold">{title}</h2>
      {message && <p className="mt-1">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 text-sm font-medium hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
        >
          {retrying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      )}
    </div>
  );
}
