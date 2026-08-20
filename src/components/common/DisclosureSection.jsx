import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

export default function DisclosureSection({ title, description, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className={`surface overflow-hidden rounded-[var(--swm-radius-lg)] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--swm-surface-subtle)]"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" /></span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[var(--swm-ink)]">{title}</span>
          {description ? <span className="mt-0.5 block text-xs leading-5 text-[var(--swm-muted)]">{description}</span> : null}
        </span>
      </button>
      {open ? <div id={contentId} className="disclosure-enter border-t border-[var(--swm-border)] bg-[var(--swm-surface-subtle)] p-4 sm:p-5">{children}</div> : null}
    </section>
  );
}
