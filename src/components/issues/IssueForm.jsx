import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LoaderCircle, Save, X } from 'lucide-react';
import { ISSUE_STATUSES, PRIORITIES, SUBJECT_TYPES } from '../../constants/issueConstants';
import { createBlankIssue, normalizeIssue, normalizeTags, validateIssue } from '../../utils/issueUtils';
import { todayISO } from '../../utils/dateUtils';
import DisclosureSection from '../common/DisclosureSection';
import AdaptiveSelect from '../common/AdaptiveSelect';

export default function IssueForm({
  initialIssue,
  settings,
  officers = [],
  divisions = [],
  divisionAccessEnabled = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save Issue',
  saveError,
  saveStatus = 'idle',
}) {
  const startingIssue = useMemo(() => normalizeIssue(initialIssue || {
    ...createBlankIssue(settings),
    visibility: divisionAccessEnabled ? 'division' : 'workspace',
  }), [divisionAccessEnabled, initialIssue, settings]);
  const isSaving = saveStatus === 'saving';
  const isSaved = saveStatus === 'saved';
  const isEditing = Boolean(initialIssue?.id);
  const categoryOptions = useMemo(() => {
    const options = ['Miscellaneous', ...(settings?.categories || [])];
    return [...new Set(options.filter(Boolean))];
  }, [settings]);
  const [issue, setIssue] = useState(startingIssue);
  const [tagText, setTagText] = useState((startingIssue.tags || []).join(', '));
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const update = (field, value) => {
    setDirty(true);
    setIssue((current) => ({ ...current, [field]: value }));
  };

  const updateTitle = (value) => {
    setDirty(true);
    setIssue((current) => ({ ...current, shortTitle: value, subject: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const prepared = {
      ...issue,
      tags: normalizeTags(tagText),
      assignedOn: issue.assignedOfficerId && !issue.assignedOn ? todayISO() : issue.assignedOn,
    };
    const nextErrors = validateIssue(prepared);
    if (divisionAccessEnabled && !prepared.owningDivisionId) nextErrors.owningDivisionId = 'Choose the division responsible for this Issue.';
    if (prepared.visibility === 'division' && !prepared.owningDivisionId) nextErrors.owningDivisionId = 'Choose an owning division for division-only visibility.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit(prepared);
    setDirty(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {saveError && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</div>}
      <Section title={isEditing ? 'Issue details' : 'Create Issue'}>
        <Input className="sm:col-span-2" label="Title" value={issue.shortTitle} onChange={updateTitle} error={errors.shortTitle} required />
        <Input label="eFile number" value={issue.eFileNumber} onChange={(value) => update('eFileNumber', value)} />
        <Select label="Subject type" value={issue.subjectType} onChange={(value) => update('subjectType', value)} options={SUBJECT_TYPES} />
        <Input label="Deadline date" type="date" value={issue.nextDeadline} onChange={(value) => update('nextDeadline', value)} />
        {!isEditing && <OfficerSelect label="Assigned to" value={issue.assignedOfficerId} officers={officers} onChange={(value) => update('assignedOfficerId', value)} />}
        {!isEditing && <Select label="Current stage" value={issue.status} onChange={(value) => update('status', value)} options={ISSUE_STATUSES} required />}
        {divisions.length > 0 && <AdaptiveSelect label="Owning division" value={issue.owningDivisionId} onChange={(value) => update('owningDivisionId', value)} options={divisions.map((division) => ({ value: division.id, label: `${division.name} (${division.code})` }))} placeholder="Select division" required={divisionAccessEnabled} error={errors.owningDivisionId} />}
        {divisions.length > 0 && <AdaptiveSelect label="Visibility" value={issue.visibility} onChange={(value) => update('visibility', value)} options={[
          { value: 'workspace', label: 'Entire workspace' },
          { value: 'division', label: 'Owning division' },
          { value: 'restricted', label: 'Restricted' },
        ]} includeBlank={false} />}
        {divisions.length > 0 && <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{issue.visibility === 'workspace' ? 'Every active workspace member can access this Issue.' : issue.visibility === 'division' ? 'Administrators, the creator, members of the owning division and explicit grants can access it once division rules are active.' : 'Only administrators, the creator and explicitly shared colleagues or divisions can access it once division rules are active.'}</p>}
      </Section>

      <DisclosureSection title="Notes" description="Optional context can be added now or later." defaultOpen={isEditing}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Textarea className="sm:col-span-2" label="Notes / current position" value={issue.currentPosition} onChange={(value) => update('currentPosition', value)} rows={5} />
        </div>
      </DisclosureSection>

      {isEditing && (
        <DisclosureSection title="Additional details" description="Optional administrative information.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Organisation" value={issue.organisation} onChange={(value) => update('organisation', value)} />
            <Select label="Category" value={issue.category} onChange={(value) => update('category', value)} options={categoryOptions} />
            <Select label="Priority" value={issue.priority} onChange={(value) => update('priority', value)} options={PRIORITIES} />
            <Input label="Date opened" type="date" value={issue.dateOpened} onChange={(value) => update('dateOpened', value)} error={errors.dateOpened} required />
            <Input label="Completion date" type="date" value={issue.dateClosed} onChange={(value) => update('dateClosed', value)} error={errors.dateClosed} />
            <Input className="sm:col-span-2" label="Tags" value={tagText} onChange={(value) => { setDirty(true); setTagText(value); }} hint="Separate tags with commas." />
          </div>
        </DisclosureSection>
      )}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSaving || isSaved} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50 sm:h-10">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving || isSaved} className={`inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed sm:h-10 ${isSaved ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : isSaved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {isSaving ? 'Saving...' : isSaved ? 'Saved' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }) {
  return (
    <section className="surface rounded-md border-t-4 border-t-teal-600 p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#17333b]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, error, hint, required, type = 'text', className = '', disabled = false }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      <input
        type={type}
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function Textarea({ label, value, onChange, error, required, rows = 3, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options, error, required }) {
  return <AdaptiveSelect label={label} value={value} onChange={onChange} options={options} error={error} required={required} controlClassName="h-9" />;
}

function OfficerSelect({ label, value, officers, onChange }) {
  return <AdaptiveSelect label={label} value={value} onChange={onChange} options={officers.map((officer) => ({ value: officer.id, label: officer.designation ? `${officer.name} - ${officer.designation}` : officer.name }))} placeholder="Not assigned" hint={!officers.length ? 'Add officers in Settings to allocate this Issue.' : ''} controlClassName="h-9" />;
}
