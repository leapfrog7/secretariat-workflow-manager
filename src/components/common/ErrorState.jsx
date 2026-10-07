import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Alert from '../ui/Alert';
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
    <Alert
      tone="danger"
      title={title}
      className="p-4 shadow-[var(--swm-shadow-xs)] sm:p-5"
      action={onRetry ? (
        <Button
          type="button"
          onClick={retry}
          loading={retrying}
          loadingLabel="Retrying…"
          variant="dangerSecondary"
          size="sm"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      ) : null}
    >
      {message || 'The requested information could not be loaded.'}
    </Alert>
  );
}
