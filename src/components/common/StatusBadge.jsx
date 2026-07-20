const styles = {
  Pending: 'border-slate-300 bg-slate-100 text-slate-700',
  'In Progress': 'border-cyan-200 bg-cyan-50 text-cyan-800',
  'Awaiting Input': 'border-amber-200 bg-amber-50 text-amber-800',
  'Awaiting Discussion': 'border-violet-200 bg-violet-50 text-violet-800',
  Deferred: 'border-violet-200 bg-violet-50 text-violet-800',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Cancelled: 'border-rose-200 bg-rose-50 text-rose-800',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.Pending}`}>
      <span className="truncate">{status || 'Not set'}</span>
    </span>
  );
}
