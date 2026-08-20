import { FileText } from 'lucide-react';
import Surface from '../ui/Surface';

export default function EmptyState({ title, message, action, icon: Icon = FileText }) {
  return (
    <Surface as="div" variant="subtle" className="rounded-[var(--swm-radius-lg)] border-dashed px-5 py-10 text-center sm:px-8 sm:py-12">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-100 bg-white text-teal-700 shadow-[var(--swm-shadow-xs)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <h2 className="mt-4 text-base font-bold tracking-tight text-[var(--swm-ink)]">{title}</h2>
      {message ? <p className="mx-auto mt-1.5 max-w-xl text-sm leading-6 text-[var(--swm-muted)]">{message}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Surface>
  );
}
