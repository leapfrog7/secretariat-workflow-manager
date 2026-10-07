import { AlertCircle, Check, CloudOff, LoaderCircle, Save } from 'lucide-react';
import { cx } from './utils';

const STATES = {
  idle: { label: '', classes: 'text-slate-500', Icon: Save },
  dirty: { label: 'Unsaved changes', classes: 'text-amber-700', Icon: Save },
  loading: { label: 'Loading…', classes: 'text-teal-700', Icon: LoaderCircle, spin: true },
  syncing: { label: 'Synchronizing…', classes: 'text-teal-700', Icon: LoaderCircle, spin: true },
  saving: { label: 'Saving…', classes: 'text-teal-700', Icon: LoaderCircle, spin: true },
  saved: { label: 'Saved', classes: 'text-emerald-700', Icon: Check },
  offline: { label: 'Waiting to sync', classes: 'text-amber-700', Icon: CloudOff },
  error: { label: 'Save failed', classes: 'text-red-700', Icon: AlertCircle },
};

export default function OperationStatus({ state = 'idle', label, className = '', live = 'polite' }) {
  const config = STATES[state] || STATES.idle;
  const Icon = config.Icon;
  const text = label ?? config.label;
  if (!text) return null;
  return (
    <span aria-live={live} role={state === 'error' ? 'alert' : 'status'} className={cx('inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold', config.classes, className)}>
      <Icon className={cx('h-3.5 w-3.5 shrink-0', config.spin && 'animate-spin')} aria-hidden="true" />
      {text}
    </span>
  );
}
