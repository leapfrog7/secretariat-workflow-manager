import { forwardRef, useId } from 'react';
import { cx } from './utils';

export const controlClassName = 'w-full rounded-[var(--swm-radius-md)] border border-[var(--swm-border-strong)] bg-white px-3 text-sm text-slate-900 shadow-[var(--swm-shadow-xs)] transition-[border-color,box-shadow] placeholder:text-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export function Field({ label, hint, error, required = false, htmlFor, hintId, errorId, className = '', children }) {
  return (
    <div className={cx('min-w-0', className)}>
      {label ? <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required ? <span className="text-red-700"> *</span> : null}</label> : null}
      {children}
      {error ? <p id={errorId} className="mt-1.5 text-xs leading-5 text-red-700" role="alert">{error}</p> : hint ? <p id={hintId} className="mt-1.5 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', invalid = false, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cx('h-10', controlClassName, invalid && 'border-red-400 focus:border-red-600 focus:ring-red-600/15', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid = false, ...props }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cx('min-h-24 resize-y py-2.5 leading-6', controlClassName, invalid && 'border-red-400 focus:border-red-600 focus:ring-red-600/15', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className = '', invalid = false, children, ...props }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={cx('h-10', controlClassName, invalid && 'border-red-400 focus:border-red-600 focus:ring-red-600/15', className)} {...props}>{children}</select>;
});

export function FormField({ id: providedId, label, hint, error, required = false, className = '', control: Control = Input, controlProps = {}, children }) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} hintId={hintId} errorId={errorId} className={className}>
      {children || <Control id={id} required={required} invalid={Boolean(error)} aria-describedby={errorId || hintId} {...controlProps} />}
    </Field>
  );
}
