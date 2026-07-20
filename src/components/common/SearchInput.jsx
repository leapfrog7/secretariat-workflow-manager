import { Search } from 'lucide-react';

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
        className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
      />
      </span>
    </label>
  );
}
