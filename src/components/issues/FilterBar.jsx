import { ISSUE_STATUSES } from '../../constants/issueConstants';

export default function FilterBar({ filters, onChange, onClear }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid gap-2 sm:grid-cols-[170px_170px_auto] sm:items-end">
        <Select label="Status" value={filters.status} onChange={(value) => update('status', value)} options={ISSUE_STATUSES} />
        <Select label="Sort" value={filters.sort} onChange={(value) => update('sort', value)} options={['Recently updated', 'Next appearance', 'Date opened', 'Title']} includeAll={false} />
          <button type="button" onClick={onClear} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800">
            Clear
          </button>
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
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
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
