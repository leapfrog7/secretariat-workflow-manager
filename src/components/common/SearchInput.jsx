import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">Search</span>
      <span className="relative block">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-[44px] w-full rounded-[var(--swm-radius-md)] border border-[var(--swm-border-strong)] bg-white pl-9 pr-10 text-sm text-slate-900 shadow-[var(--swm-shadow-xs)] placeholder:text-slate-400"
      />
      {value ? <button type="button" onClick={() => onChange('')} title="Clear search" aria-label="Clear search" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button> : null}
      </span>
    </label>
  );
}
