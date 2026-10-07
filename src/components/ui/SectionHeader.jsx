import { cx } from './utils';

export default function SectionHeader({ icon: Icon, title, description, action, className = '', titleId }) {
  return (
    <header className={cx('flex items-center justify-between gap-3 border-b border-[var(--swm-border)] px-3 py-3 sm:items-start sm:gap-4 sm:px-5 sm:py-3.5', className)}>
      <div className="flex min-w-0 items-center gap-2.5 sm:items-start sm:gap-3">
        {Icon ? <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 sm:h-9 sm:w-9 sm:rounded-xl"><Icon className="h-4 w-4" aria-hidden="true" /></span> : null}
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-sm font-bold text-[var(--swm-ink)]">{title}</h2>
          {description ? <p className="mt-0.5 hidden text-xs leading-5 text-[var(--swm-muted)] sm:block">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pt-1">{action}</div> : null}
    </header>
  );
}
