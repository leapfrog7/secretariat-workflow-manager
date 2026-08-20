const VARIANTS = {
  primary: 'border-transparent bg-[var(--swm-primary)] text-white shadow-[var(--swm-shadow-button)] hover:bg-[var(--swm-primary-hover)]',
  secondary: 'border-[var(--swm-border-strong)] bg-white text-[var(--swm-ink)] shadow-[var(--swm-shadow-xs)] hover:border-teal-300 hover:bg-teal-50/70 hover:text-teal-900',
  quiet: 'border-transparent bg-[var(--swm-surface-muted)] text-slate-700 hover:bg-slate-200/70 hover:text-slate-950',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  danger: 'border-transparent bg-red-700 text-white shadow-[var(--swm-shadow-xs)] hover:bg-red-800',
  dangerSecondary: 'border-red-200 bg-white text-red-700 shadow-[var(--swm-shadow-xs)] hover:bg-red-50',
};

const SIZES = {
  sm: 'min-h-9 rounded-[var(--swm-radius-sm)] px-3 text-xs',
  md: 'min-h-10 rounded-[var(--swm-radius-md)] px-3.5 text-sm',
  lg: 'min-h-11 rounded-[var(--swm-radius-md)] px-4 text-sm',
  icon: 'h-10 w-10 rounded-[var(--swm-radius-md)]',
};

export function buttonClassName({ variant = 'primary', size = 'md', className = '' } = {}) {
  return `inline-flex shrink-0 items-center justify-center gap-2 border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`;
}

export default function Button({ variant = 'primary', size = 'md', className = '', type = 'button', children, ...props }) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props}>{children}</button>;
}
