import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouteError } from 'react-router-dom';

export default function RouteErrorPage() {
  const error = useRouteError();
  const message = error?.status === 404
    ? 'This page could not be found.'
    : error?.message || 'The page could not be opened.';
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f6f5] px-4 py-10">
      <section className="w-full max-w-lg rounded-md border border-red-200 bg-white p-5 shadow-lg" role="alert">
        <AlertTriangle className="h-7 w-7 text-red-700" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-semibold text-slate-950">Unable to open this page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Locally saved workspace records remain on this device.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a href="#/issues" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4" />Return to Issues</a>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" />Reload</button>
        </div>
      </section>
    </main>
  );
}
