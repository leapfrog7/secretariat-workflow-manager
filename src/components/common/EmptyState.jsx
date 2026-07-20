import { FileText } from 'lucide-react';

export default function EmptyState({ title, message, action }) {
  return (
    <div className="surface rounded-md p-6 text-center">
      <FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-slate-900">{title}</h2>
      {message && <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
