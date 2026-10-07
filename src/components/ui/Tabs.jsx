import { cx } from './utils';

export function TabList({ className = '', children, ...props }) {
  return <div role="tablist" className={cx('flex min-w-0', className)} {...props}>{children}</div>;
}

const VARIANTS = {
  underline: {
    base: 'border-b-2 border-transparent px-3 py-3 text-slate-500 hover:text-slate-800 sm:px-4',
    active: 'border-teal-700 text-teal-800',
  },
  segmented: {
    base: 'min-h-11 rounded-[var(--swm-radius-md)] border border-slate-200 bg-white px-2 py-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
    active: 'border-teal-600 bg-teal-50 text-teal-900 shadow-[var(--swm-shadow-xs)]',
  },
};

export function Tab({ active = false, variant = 'underline', className = '', children, ...props }) {
  const styles = VARIANTS[variant] || VARIANTS.underline;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={cx('min-w-0 text-xs font-semibold leading-4 transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/25 sm:text-sm', styles.base, active && styles.active, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabCount({ active = false, className = '', children }) {
  return <span className={cx('ml-1.5 shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums', active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500', className)}>{children}</span>;
}
