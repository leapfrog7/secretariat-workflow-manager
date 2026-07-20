import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export default function DisclosureSection({ title, description, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <section className={`surface overflow-hidden rounded-md ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-[#f7faf9]"
        aria-expanded={open}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
        </span>
      </button>
      {open && <div className="border-t border-[#dce6e4] bg-[#fbfcfc] p-4">{children}</div>}
    </section>
  );
}
