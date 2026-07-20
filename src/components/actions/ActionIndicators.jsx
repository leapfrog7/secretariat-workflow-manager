import { AlertCircle, Bell, CheckCircle2, Clock, Megaphone, MinusCircle } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import { getActionDueState, isEscalationDue, isReminderDue } from '../../utils/actionUtils';

const dueConfig = {
  overdue: { label: 'Overdue', className: 'border-red-300 bg-red-50 text-red-800', Icon: AlertCircle },
  today: { label: 'Due today', className: 'border-amber-300 bg-amber-50 text-amber-800', Icon: Clock },
  upcoming: { label: 'Upcoming', className: 'border-blue-300 bg-blue-50 text-blue-800', Icon: Clock },
  future: { label: 'Due', className: 'border-slate-300 bg-slate-50 text-slate-700', Icon: Clock },
  closed: { label: 'Closed', className: 'border-green-300 bg-green-50 text-green-800', Icon: CheckCircle2 },
  none: { label: 'No due date', className: 'border-slate-200 bg-white text-slate-500', Icon: MinusCircle },
};

export function ActionDueIndicator({ action, compact = false }) {
  const state = getActionDueState(action);
  const item = dueConfig[state] || dueConfig.none;
  const Icon = item.Icon;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${item.className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{compact ? item.label : `${item.label}: ${formatDisplayDate(action?.dueDate, 'Not set')}`}</span>
    </span>
  );
}

export function FollowUpIndicators({ action }) {
  return (
    <div className="flex flex-wrap gap-1">
      {action.reminderDate && (
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${isReminderDue(action) ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          Reminder: {formatDisplayDate(action.reminderDate)}
        </span>
      )}
      {action.escalationDate && (
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${isEscalationDue(action) ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-500'}`}>
          <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
          Escalation: {formatDisplayDate(action.escalationDate)}
        </span>
      )}
    </div>
  );
}
