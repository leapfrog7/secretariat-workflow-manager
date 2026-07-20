import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import { RECORD_DIRECTIONS, RECORD_TYPES } from '../../constants/issueConstants';
import { createBlankRecord, normalizeRecord, validateRecord } from '../../utils/recordUtils';
import DisclosureSection from '../common/DisclosureSection';

export default function RecordForm({ issueId, initialRecord, onSubmit, onCancel, isSaving = false }) {
  const startingRecord = useMemo(() => normalizeRecord(initialRecord || createBlankRecord(issueId)), [initialRecord, issueId]);
  const [record, setRecord] = useState(startingRecord);
  const [errors, setErrors] = useState({});

  const update = (field, value) => setRecord((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const prepared = { ...record, issueId };
    const nextErrors = validateRecord(prepared);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit(prepared);
  };

  return (
    <form onSubmit={submit} className="surface rounded-md p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Record number" value={record.recordNumber} onChange={(value) => update('recordNumber', value)} />
        <Select label="Record type" value={record.recordType} onChange={(value) => update('recordType', value)} options={RECORD_TYPES} error={errors.recordType} required />
        <Select label="Direction" value={record.direction} onChange={(value) => update('direction', value)} options={RECORD_DIRECTIONS} error={errors.direction} required />
        <Input label="Sender / recipient" value={record.senderReceiver} onChange={(value) => update('senderReceiver', value)} />
        <Input label="Record date" type="date" value={record.recordDate} onChange={(value) => update('recordDate', value)} error={errors.recordDate} required />
        <Input className="sm:col-span-2" label="Subject" value={record.subject} onChange={(value) => update('subject', value)} error={errors.subject} required />
      </div>
      <div className="mt-4">
        <DisclosureSection title="Advanced Record details" description="Organisation, received date, summary and notes.">
          <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Organisation" value={record.organisation} onChange={(value) => update('organisation', value)} />
        <Input label="Received date" type="date" value={record.receivedDate} onChange={(value) => update('receivedDate', value)} />
        <Textarea className="sm:col-span-2" label="Summary" value={record.summary} onChange={(value) => update('summary', value)} />
        <Textarea className="sm:col-span-2" label="Notes" value={record.notes} onChange={(value) => update('notes', value)} />
          </div>
        </DisclosureSection>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-blue-300">
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? 'Saving...' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, error, required, type = 'text', className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function Textarea({ label, value, onChange, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
    </label>
  );
}

function Select({ label, value, onChange, options, error, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
