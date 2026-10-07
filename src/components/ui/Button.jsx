import { LoaderCircle } from 'lucide-react';
import { cx } from './utils';

const VARIANTS = {
  primary: 'border-transparent bg-[var(--swm-primary)] text-white shadow-[var(--swm-shadow-button)] hover:bg-[var(--swm-primary-hover)]',
  secondary: 'border-[var(--swm-border-strong)] bg-white text-[var(--swm-ink)] shadow-[var(--swm-shadow-xs)] hover:border-teal-300 hover:bg-teal-50/70 hover:text-teal-900',
  quiet: 'border-transparent bg-[var(--swm-surface-muted)] text-slate-700 hover:bg-slate-200/70 hover:text-slate-950',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  danger: 'border-transparent bg-red-700 text-white shadow-[var(--swm-shadow-xs)] hover:bg-red-800',
  dangerSecondary: 'border-red-200 bg-white text-red-700 shadow-[var(--swm-shadow-xs)] hover:bg-red-50',
  success: 'border-transparent bg-emerald-700 text-white shadow-[var(--swm-shadow-xs)] hover:bg-emerald-800',
  warning: 'border-transparent bg-amber-700 text-white shadow-[var(--swm-shadow-xs)] hover:bg-amber-800',
  accent: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  note: 'border-transparent bg-indigo-700 text-white shadow-[var(--swm-shadow-button)] hover:bg-indigo-800',
};

const SIZES = {
  sm: 'min-h-9 rounded-[var(--swm-radius-sm)] px-3 text-xs',
  md: 'min-h-10 rounded-[var(--swm-radius-md)] px-3.5 text-sm',
  lg: 'min-h-11 rounded-[var(--swm-radius-md)] px-4 text-sm',
  icon: 'h-10 w-10 rounded-[var(--swm-radius-md)]',
  iconSm: 'h-9 w-9 rounded-[var(--swm-radius-sm)]',
};

export function buttonClassName({ variant = 'primary', size = 'md', className = '' } = {}) {
  return cx(
    'inline-flex shrink-0 items-center justify-center gap-2 border font-semibold transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/25 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    className,
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  loading = false,
  loadingLabel = 'Working...',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {loading ? loadingLabel : children}
    </button>
  );
}
