import { LoaderCircle } from 'lucide-react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="min-h-52 overflow-hidden border-y border-slate-200 bg-white px-4 py-5 sm:rounded-md sm:border" role="status" aria-live="polite" aria-busy="true">
      <div className="mb-5 h-1 overflow-hidden rounded-full bg-cyan-100" aria-hidden="true">
        <span className="route-progress block h-full bg-teal-600" />
      </div>
      <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
        <span>{message}</span>
      </div>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="loading-shimmer h-8 w-2/5 rounded bg-slate-100" />
        <div className="loading-shimmer h-12 w-full rounded bg-slate-100 [animation-delay:80ms]" />
        <div className="loading-shimmer h-12 w-full rounded bg-slate-100 [animation-delay:160ms]" />
        <div className="loading-shimmer h-12 w-4/5 rounded bg-slate-100 [animation-delay:240ms]" />
      </div>
    </div>
  );
}
