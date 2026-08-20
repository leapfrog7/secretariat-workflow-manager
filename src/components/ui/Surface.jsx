const VARIANTS = {
  default: 'border-[var(--swm-border)] bg-[var(--swm-surface)] shadow-[var(--swm-shadow-card)]',
  subtle: 'border-[var(--swm-border)] bg-[var(--swm-surface-subtle)]',
  inset: 'border-[var(--swm-border)] bg-[var(--swm-surface-muted)]',
};

export default function Surface({ as: Component = 'section', variant = 'default', className = '', children, ...props }) {
  return <Component className={`border ${VARIANTS[variant] || VARIANTS.default} ${className}`} {...props}>{children}</Component>;
}
