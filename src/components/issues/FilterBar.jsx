import { ISSUE_STATUSES } from '../../constants/issueConstants';
import AdaptiveSelect from '../common/AdaptiveSelect';

const FOCUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'awaiting', label: 'Awaiting response' },
  { value: 'high-priority', label: 'High priority' },
  { value: 'stale', label: 'Needs an update' },
];

export default function FilterBar({ filters, divisions = [], onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-2 sm:grid-cols-2 sm:items-end lg:grid-cols-[160px_160px_minmax(190px,1fr)_180px]">
        <Select label="Focus" value={filters.focus} onChange={(value) => update('focus', value)} options={FOCUS_OPTIONS} />
        <Select label="Status" value={filters.status} onChange={(value) => update('status', value)} options={ISSUE_STATUSES} />
        <AdaptiveSelect label="Division" value={filters.divisionId} onChange={(value) => update('divisionId', value)} controlClassName="h-[44px]" labelClassName="text-xs font-semibold text-slate-600" options={[
          { value: '__unassigned__', label: 'Unassigned' },
          ...divisions.map((division) => ({ value: division.id, label: division.is_active ? division.name : `${division.name} (inactive)` })),
        ]} placeholder="All divisions" />
        <Select label="Sort" value={filters.sort} onChange={(value) => update('sort', value)} options={['Recently updated', 'Next appearance', 'Date opened', 'Title']} includeAll={false} />
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
        {options.map((option) => {
          const normalized = typeof option === 'string' ? { value: option, label: option } : option;
          return (
          <option key={normalized.value} value={normalized.value}>
            {normalized.label}
          </option>
          );
        })}
      </select>
    </label>
  );
}
