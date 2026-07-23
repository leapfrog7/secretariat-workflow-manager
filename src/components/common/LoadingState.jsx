import { LoaderCircle } from 'lucide-react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="surface min-h-40 overflow-hidden rounded-md p-5" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
        <span>{message}</span>
      </div>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="loading-shimmer h-3 w-3/5 rounded bg-slate-100" />
        <div className="loading-shimmer h-3 w-full rounded bg-slate-100 [animation-delay:100ms]" />
        <div className="loading-shimmer h-3 w-4/5 rounded bg-slate-100 [animation-delay:200ms]" />
      </div>
    </div>
  );
}
