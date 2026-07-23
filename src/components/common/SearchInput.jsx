import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">Search</span>
      <span className="relative block">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-teal-700" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 sm:h-10"
      />
      {value && <button type="button" onClick={() => onChange('')} title="Clear search" aria-label="Clear search" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:h-8 sm:w-8"><X className="h-4 w-4" /></button>}
      </span>
    </label>
  );
}
