import { cx } from './utils';

const VARIANTS = {
  default: 'border-[var(--swm-border)] bg-[var(--swm-surface)] shadow-[var(--swm-shadow-card)]',
  subtle: 'border-[var(--swm-border)] bg-[var(--swm-surface-subtle)]',
  inset: 'border-[var(--swm-border)] bg-[var(--swm-surface-muted)]',
  interactive: 'border-[var(--swm-border)] bg-white shadow-[var(--swm-shadow-xs)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[var(--swm-shadow-sm)]',
};

export default function Card({ as: Component = 'section', variant = 'default', className = '', children, ...props }) {
  return <Component className={cx('rounded-[var(--swm-radius-lg)] border', VARIANTS[variant] || VARIANTS.default, className)} {...props}>{children}</Component>;
}

export function CardHeader({ className = '', children, ...props }) {
  return <header className={cx('flex items-start justify-between gap-4 border-b border-[var(--swm-border)] px-4 py-3.5 sm:px-5', className)} {...props}>{children}</header>;
}

export function CardTitle({ as: Component = 'h2', className = '', children, ...props }) {
  return <Component className={cx('text-sm font-bold text-[var(--swm-ink)]', className)} {...props}>{children}</Component>;
}

export function CardDescription({ className = '', children, ...props }) {
  return <p className={cx('mt-0.5 text-xs leading-5 text-[var(--swm-muted)]', className)} {...props}>{children}</p>;
}

export function CardContent({ className = '', children, ...props }) {
  return <div className={cx('p-4 sm:p-5', className)} {...props}>{children}</div>;
}

export function CardFooter({ className = '', children, ...props }) {
  return <footer className={cx('flex items-center gap-2 border-t border-[var(--swm-border)] bg-[var(--swm-surface-subtle)] px-4 py-3 sm:px-5', className)} {...props}>{children}</footer>;
}
