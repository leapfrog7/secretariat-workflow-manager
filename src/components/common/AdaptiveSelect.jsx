import { useEffect, useId, useMemo, useState } from 'react';

function normalizeOptions(options) {
  return options.map((option) => (
    typeof option === 'string'
      ? { label: option, value: option }
      : { label: String(option.label ?? option.value ?? ''), value: String(option.value ?? '') }
  ));
}

export default function AdaptiveSelect({
  label,
  ariaLabel,
  value = '',
  options = [],
  onChange,
  placeholder = 'Select',
  includeBlank = true,
  disabled = false,
  required = false,
  error = '',
  hint = '',
  searchThreshold = 8,
  className = '',
  labelClassName = 'text-sm font-medium text-slate-700',
  controlClassName = 'h-10',
}) {
  const listId = useId();
  const items = useMemo(() => normalizeOptions(options), [options]);
  const selected = items.find((item) => item.value === String(value || ''));
  const [query, setQuery] = useState(selected?.label || '');
  const searchable = items.length > searchThreshold;

  useEffect(() => {
    setQuery(selected?.label || '');
  }, [selected?.label, value]);

  const labelContent = label ? (
    <span className={`mb-1 block ${labelClassName}`}>
      {label}
      {required && <span className="text-red-700"> *</span>}
    </span>
  ) : null;

  if (!searchable) {
    return (
      <label className={`block ${className}`}>
        {labelContent}
        <select
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required={required}
          aria-label={ariaLabel || (!label ? placeholder : undefined)}
          className={`${controlClassName} w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100`}
        >
          {includeBlank && <option value="">{placeholder}</option>}
          {items.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
        {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
      </label>
    );
  }

  return (
    <label className={`block ${className}`}>
      {labelContent}
      <input
        type="text"
        list={listId}
        value={query}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel || (!label ? placeholder : undefined)}
        placeholder={`Search ${label ? label.toLowerCase() : 'options'}...`}
        autoComplete="off"
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          const match = items.find((item) => item.label.toLocaleLowerCase() === nextQuery.trim().toLocaleLowerCase());
          if (match) onChange(match.value);
          else if (!nextQuery) onChange('');
        }}
        onBlur={() => setQuery(items.find((item) => item.value === String(value || ''))?.label || '')}
        className={`${controlClassName} w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100`}
      />
      <datalist id={listId}>
        {items.map((option) => <option key={option.value} value={option.label} />)}
      </datalist>
      <span className="mt-1 block text-xs text-slate-500">{hint || `${items.length} options. Start typing to search.`}</span>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
