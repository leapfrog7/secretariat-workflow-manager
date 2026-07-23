import { useMemo, useState } from 'react';
import { LoaderCircle, Save, X } from 'lucide-react';
import { ACTION_STATUSES, PRIORITIES, REVIEW_STATUSES } from '../../constants/issueConstants';
import { createBlankAction, normalizeAction, validateAction } from '../../utils/actionUtils';
import DisclosureSection from '../common/DisclosureSection';

export default function ActionForm({ issueId, initialAction, officers = [], onSubmit, onCancel, isSaving = false }) {
  const startingAction = useMemo(() => normalizeAction(initialAction || createBlankAction(issueId)), [initialAction, issueId]);
  const [action, setAction] = useState(startingAction);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});

  const update = (field, value) => setAction((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const prepared = {
      ...action,
      issueId,
      completedAt: action.status === 'Completed' ? action.completedAt || new Date().toISOString() : action.completedAt,
    };
    const result = validateAction(prepared);
    setErrors(result.errors);
    setWarnings(result.warnings);
    if (Object.keys(result.errors).length) return;
    await onSubmit(prepared, result.warnings);
  };

  return (
    <form onSubmit={submit} className="surface rounded-md p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="sm:col-span-2" label="Action title" value={action.title} onChange={(value) => update('title', value)} error={errors.title} required />
      </div>
      <div className="mt-4">
        <DisclosureSection title="Assignment and due date" description="Optional ownership, priority and follow-up details.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Status" value={action.status} onChange={(value) => update('status', value)} options={ACTION_STATUSES} />
            <Select label="Priority" value={action.priority} onChange={(value) => update('priority', value)} options={PRIORITIES} />
            <OfficerSelect label="Assigned officer" value={action.assignedOfficerId} officers={officers} onChange={(value) => update('assignedOfficerId', value)} />
            <OfficerSelect label="Assigned by" value={action.assignedByOfficerId} officers={officers} onChange={(value) => update('assignedByOfficerId', value)} />
            <Input label="Assigned to" value={action.assignedTo} onChange={(value) => update('assignedTo', value)} />
            <Input label="Pending with" value={action.pendingWith} onChange={(value) => update('pendingWith', value)} />
            <Input label="Due date" type="date" value={action.dueDate} onChange={(value) => update('dueDate', value)} />
            <Input label="Reminder date" type="date" value={action.reminderDate} onChange={(value) => update('reminderDate', value)} warning={warnings.reminderDate} />
            <Input label="Assigned on" type="date" value={action.assignedOn?.slice(0, 10)} onChange={(value) => update('assignedOn', value)} />
            <Input label="Linked Record" value={action.recordId} onChange={(value) => update('recordId', value)} />
            <Textarea className="sm:col-span-2" label="Description" value={action.description} onChange={(value) => update('description', value)} />
            <Textarea className="sm:col-span-2" label="Assignment instructions" value={action.assignmentInstructions} onChange={(value) => update('assignmentInstructions', value)} />
          </div>
        </DisclosureSection>
      </div>
      <div className="mt-4">
        <DisclosureSection title="Advanced Action details" description="Progress, review, escalation, dependency and outcome fields.">
          <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Escalation date" type="date" value={action.escalationDate} onChange={(value) => update('escalationDate', value)} warning={warnings.escalationDate} />
        <Input label="Progress percent" type="number" value={action.progressPercent} onChange={(value) => update('progressPercent', value)} />
        <Select label="Review status" value={action.reviewStatus} onChange={(value) => update('reviewStatus', value)} options={REVIEW_STATUSES} />
        <Input label="Completed at" type="datetime-local" value={toDateTimeLocal(action.completedAt)} onChange={(value) => update('completedAt', value ? new Date(value).toISOString() : '')} />
        <Textarea className="sm:col-span-2" label="Expected output" value={action.expectedOutput} onChange={(value) => update('expectedOutput', value)} />
        <Textarea className="sm:col-span-2" label="Progress note" value={action.progressNote} onChange={(value) => update('progressNote', value)} />
        <Textarea className="sm:col-span-2" label="Submission note" value={action.submissionNote} onChange={(value) => update('submissionNote', value)} />
        <Textarea className="sm:col-span-2" label="Review remarks" value={action.reviewRemarks} onChange={(value) => update('reviewRemarks', value)} />
        <Textarea className="sm:col-span-2" label="Dependency" value={action.dependency} onChange={(value) => update('dependency', value)} />
        <Textarea className="sm:col-span-2" label="Outcome" value={action.outcome} onChange={(value) => update('outcome', value)} />
          </div>
        </DisclosureSection>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 sm:h-10">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-400 sm:h-10">
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {isSaving ? 'Saving...' : 'Save Action'}
        </button>
      </div>
    </form>
  );
}

function OfficerSelect({ label, value, officers, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
        <option value="">Select officer</option>
        {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}{officer.isActive ? '' : ' (inactive)'}</option>)}
      </select>
    </label>
  );
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function Input({ label, value, onChange, error, warning, hint, required, type = 'text', className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {warning && <span className="mt-1 block text-xs text-amber-700">{warning}</span>}
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

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
