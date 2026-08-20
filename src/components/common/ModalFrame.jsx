import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalFrame({
  open = true,
  labelledBy,
  describedBy,
  busy = false,
  onClose,
  closeOnBackdrop = true,
  mobilePlacement = 'bottom',
  maxWidth = 'max-w-xl',
  className = '',
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      (dialog?.querySelector('[data-autofocus]') || dialog?.querySelector(FOCUSABLE))?.focus();
    });
    const handleKeyDown = (event) => {
      const dialog = dialogRef.current;
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 ${mobilePlacement === 'top' ? 'items-start pt-[max(0.75rem,env(safe-area-inset-top))]' : 'items-end'}`}
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && !busy && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={`mobile-sheet-safe dialog-enter max-h-[96dvh] w-full overflow-y-auto border border-[var(--swm-border)] bg-white shadow-[var(--swm-shadow-float)] sm:max-h-[92dvh] ${maxWidth} sm:rounded-[var(--swm-radius-xl)] ${mobilePlacement === 'top' ? 'mx-2 rounded-[var(--swm-radius-xl)] sm:mx-0' : 'rounded-t-[1.35rem]'} ${className}`}
      >
        {children}
      </section>
    </div>
  );
}
