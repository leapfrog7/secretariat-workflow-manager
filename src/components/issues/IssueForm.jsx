import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, LoaderCircle, LockKeyhole, Save, Users, X } from 'lucide-react';
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
  defaultOwningDivisionId = '',
  divisionAccessEnabled = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save Issue',
  saveError,
  saveStatus = 'idle',
}) {
  const startingIssue = useMemo(() => normalizeIssue(initialIssue || {
    ...createBlankIssue(settings),
    owningDivisionId: defaultOwningDivisionId,
    visibility: divisionAccessEnabled ? 'division' : 'workspace',
  }), [defaultOwningDivisionId, divisionAccessEnabled, initialIssue, settings]);
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
        {divisions.length > 0 && <AccessPolicyFields issue={issue} divisions={divisions} divisionAccessEnabled={divisionAccessEnabled} error={errors.owningDivisionId} onUpdate={update} />}
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

function AccessPolicyFields({ issue, divisions, divisionAccessEnabled, error, onUpdate }) {
  const owningDivision = divisions.find((division) => division.id === issue.owningDivisionId);
  const options = [
    { value: 'division', label: 'Owning division', Icon: Building2 },
    { value: 'workspace', label: 'Entire workspace', Icon: Users },
    { value: 'restricted', label: 'Restricted', Icon: LockKeyhole },
  ];
  const explanation = !divisionAccessEnabled
    ? 'Division access is not active yet. All active workspace members retain access until an administrator enables it.'
    : issue.visibility === 'workspace'
      ? 'Every active workspace member can access this Issue according to their workspace role.'
      : issue.visibility === 'division'
        ? owningDivision
          ? `Members of ${owningDivision.name} receive access according to their division role.`
          : 'Choose the division responsible for this Issue.'
        : 'Only workspace managers, the creator and explicit grants receive access. The owning division does not receive access automatically.';

  return (
    <div className="mt-1 border-t border-slate-200 pt-4 sm:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#17333b]">Responsibility and access</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Set the responsible team and decide who may open the complete Issue workspace.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdaptiveSelect
          label="Owning division"
          value={issue.owningDivisionId}
          onChange={(value) => onUpdate('owningDivisionId', value)}
          options={divisions.map((division) => ({ value: division.id, label: `${division.name} (${division.code})` }))}
          placeholder="Select responsible division"
          required={divisionAccessEnabled}
          error={error}
          controlClassName="h-10"
        />
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-slate-700">Who can access this Issue?</legend>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Issue visibility">
            {options.map(({ value, label, Icon }) => {
              const selected = issue.visibility === value;
              return (
                <button key={value} type="button" aria-pressed={selected} onClick={() => onUpdate('visibility', value)} className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-xs font-semibold leading-4 transition-colors ${selected ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="line-clamp-2">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
      <p className={`mt-3 flex items-start gap-2 text-xs leading-5 ${issue.visibility === 'restricted' && divisionAccessEnabled ? 'font-medium text-amber-900' : 'text-slate-500'}`}>
        {issue.visibility === 'restricted' && <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span>{explanation}</span>
      </p>
    </div>
  );
}
