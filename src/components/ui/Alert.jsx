import { cx } from './utils';
import { getFeedbackTone, normalizeFeedbackTone } from './feedback';

export default function Alert({ tone = 'info', title, children, icon = true, action, compact = false, className = '', role }) {
  const normalizedTone = normalizeFeedbackTone(tone);
  const style = getFeedbackTone(normalizedTone);
  const Icon = icon === true || icon === false ? style.Icon : icon;
  return (
    <div role={role || (normalizedTone === 'danger' ? 'alert' : 'status')} aria-live={normalizedTone === 'danger' ? 'assertive' : 'polite'} className={cx('flex flex-wrap items-start gap-2.5 rounded-[var(--swm-radius-md)] border text-sm sm:flex-nowrap', compact ? 'px-3 py-2' : 'px-3 py-2.5', style.shell, className)}>
      {icon ? <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', style.icon, style.spin && 'animate-spin')} aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cx('text-xs leading-5', title && 'mt-0.5')}>{children}</div>
      </div>
      {action ? <div className="ml-6 shrink-0 self-center sm:ml-0">{action}</div> : null}
    </div>
  );
}
