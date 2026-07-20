import { AlertCircle, CalendarClock, CheckCircle2, MinusCircle } from 'lucide-react';
import { formatDisplayDate, getDeadlineDaysRemaining, getDeadlineState } from '../../utils/dateUtils';

const config = {
  overdue: { className: 'border-red-300 bg-red-50 text-red-800', Icon: AlertCircle },
  today: { className: 'border-amber-300 bg-amber-50 text-amber-800', Icon: AlertCircle },
  upcoming: { className: 'border-cyan-200 bg-cyan-50 text-cyan-800', Icon: CalendarClock },
  future: { className: 'border-slate-300 bg-slate-50 text-slate-700', Icon: CalendarClock },
  closed: { className: 'border-green-300 bg-green-50 text-green-800', Icon: CheckCircle2 },
  none: { className: 'border-slate-200 bg-white text-slate-500', Icon: MinusCircle },
};

export default function DeadlineIndicator({ issue }) {
  const state = getDeadlineState(issue);
  const item = config[state] || config.none;
  const Icon = item.Icon;
  const remaining = getDeadlineDaysRemaining(issue);
  const overdueDays = remaining === null ? 0 : Math.abs(remaining);
  const label = state === 'overdue'
    ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
    : state === 'today'
      ? 'Due today'
      : ['upcoming', 'future'].includes(state)
        ? `Due ${formatDisplayDate(issue?.nextDeadline)}`
        : state === 'closed'
          ? issue?.status || 'Completed'
          : 'No deadline';
  return (
    <span
      aria-label={label}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${item.className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {label}
      </span>
    </span>
  );
}
