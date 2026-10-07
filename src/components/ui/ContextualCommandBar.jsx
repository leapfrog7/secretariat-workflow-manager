import { MoreHorizontal } from 'lucide-react';
import { cx } from './utils';

export default function ContextualCommandBar({
  label,
  title,
  status,
  contextAction,
  primaryAction,
  desktopActions,
  moreActions,
  className = '',
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cx(
        'sticky bottom-[var(--app-mobile-nav-clearance)] z-20 flex min-h-14 items-center gap-2 border-y border-[var(--swm-border)] bg-white/95 px-3 py-2 shadow-[var(--swm-shadow-xs)] backdrop-blur-xl sm:static sm:min-h-0 sm:border-x-0 sm:px-4 sm:shadow-none',
        className,
      )}
    >
      <div className="hidden min-w-0 flex-1 sm:block">
        <p className="truncate text-xs font-semibold text-[var(--swm-ink)]">{title}</p>
        {status ? <div className="mt-0.5">{status}</div> : null}
      </div>

      {contextAction ? <div className="min-w-0 shrink-0">{contextAction}</div> : null}
      {desktopActions ? <div className="hidden items-center gap-2 sm:flex">{desktopActions}</div> : null}
      <div className="ml-auto min-w-0 shrink-0">{primaryAction}</div>

      {moreActions ? (
        <details
          className="group relative shrink-0"
          onClick={(event) => {
            if (event.target.closest('[data-command-menu-action]')) event.currentTarget.removeAttribute('open');
          }}
        >
          <summary className="inline-flex h-10 min-w-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-[var(--swm-radius-md)] border border-[var(--swm-border-strong)] bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-[var(--swm-shadow-xs)] transition-colors hover:border-teal-300 hover:bg-teal-50 [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">More</span>
          </summary>
          <div className="popover-enter absolute bottom-12 right-0 z-40 w-64 origin-bottom-right overflow-hidden rounded-[var(--swm-radius-md)] border border-[var(--swm-border)] bg-white p-1.5 shadow-[var(--swm-shadow-float)] sm:bottom-auto sm:top-11 sm:origin-top-right">
            <div className="grid gap-1">{moreActions}</div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
