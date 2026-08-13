import { ISSUE_STATUSES } from '../../constants/issueConstants';
import { X } from 'lucide-react';
import AdaptiveSelect from '../common/AdaptiveSelect';

export default function FilterBar({ filters, divisions = [], onChange, onClear }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-2 sm:grid-cols-[170px_minmax(190px,240px)_170px_44px] sm:items-end">
        <Select label="Status" value={filters.status} onChange={(value) => update('status', value)} options={ISSUE_STATUSES} />
        <AdaptiveSelect label="Division" value={filters.divisionId} onChange={(value) => update('divisionId', value)} controlClassName="h-[44px]" labelClassName="text-xs font-semibold text-slate-600" options={[
          { value: '__unassigned__', label: 'Unassigned' },
          ...divisions.map((division) => ({ value: division.id, label: division.is_active ? division.name : `${division.name} (inactive)` })),
        ]} placeholder="All divisions" />
        <Select label="Sort" value={filters.sort} onChange={(value) => update('sort', value)} options={['Recently updated', 'Next appearance', 'Date opened', 'Title']} includeAll={false} />
          <button type="button" title="Clear filters" aria-label="Clear filters" onClick={onClear} className="flex h-[44px] w-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><X className="h-4 w-4" /></button>
    </div>
  );
}

function Select({ label, value, onChange, options, includeAll = true }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[44px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
      >
        {includeAll && <option value="">All</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
