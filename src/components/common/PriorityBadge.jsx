const styles = {
  Unset: 'border-slate-300 bg-slate-50 text-slate-600',
  Low: 'border-slate-300 bg-slate-50 text-slate-700',
  Normal: 'border-blue-200 bg-blue-50 text-blue-800',
  High: 'border-amber-300 bg-amber-50 text-amber-800',
  Critical: 'border-red-300 bg-red-50 text-red-800',
};

export default function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[priority] || styles.Unset}`}>
      {priority || 'Not prioritised'}
    </span>
  );
}
