import { useState } from 'react';
import { BookOpen, CheckCircle2, LoaderCircle, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import { normalizeReference, validateReference } from '../../utils/referenceUtils';

export default function ReferenceTab({ issueId, references, onSave, onDelete }) {
  const [form, setForm] = useState(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#17333b]">References</h2>
          <p className="mt-1 text-sm text-slate-600">Capture the rules, orders and authorities relevant to this Issue.</p>
        </div>
        {!form && <button type="button" onClick={() => setForm({ id: null })} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><Plus className="h-4 w-4" />Add reference</button>}
      </div>

      {form && <ReferenceForm issueId={issueId} initialReference={form.id ? references.find((item) => item.id === form.id) : null} onSave={onSave} onComplete={() => setForm(null)} onCancel={() => setForm(null)} />}

      <div className="grid gap-3 lg:grid-cols-2">
        {references.map((reference) => (
          <article key={reference.id} className="surface rounded-md border-l-4 border-l-amber-500 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-[#17333b]">{reference.citation}</h3>
                {reference.referenceDate && <p className="mt-1 text-xs font-medium text-slate-500">Dated {formatDisplayDate(reference.referenceDate)}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton label="Edit reference" onClick={() => setForm({ id: reference.id })}><Pencil className="h-4 w-4" /></IconButton>
                <IconButton label="Delete reference" danger onClick={() => onDelete(reference)}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
            </div>
            {reference.notes && <p className="mt-3 whitespace-pre-wrap border-t border-[#e3ebe9] pt-3 text-sm leading-6 text-slate-700">{reference.notes}</p>}
          </article>
        ))}
      </div>
      {!references.length && <div className="surface rounded-md px-4 py-10 text-center"><BookOpen className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">No references recorded</p><p className="mt-1 text-xs text-slate-500">Add the first rule, order or authoritative reference.</p></div>}
    </div>
  );
}

function ReferenceForm({ issueId, initialReference, onSave, onComplete, onCancel }) {
  const [reference, setReference] = useState(normalizeReference({ ...initialReference, issueId }));
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const update = (field, value) => setReference((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateReference(reference);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaveStatus('saving');
    try {
      await onSave(reference);
      setSaveStatus('saved');
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      onComplete();
    } catch {
      setSaveStatus('idle');
    }
  };
  return (
    <form onSubmit={submit} className="surface rounded-md border-t-4 border-t-amber-500 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Reference" error={errors.citation}><input value={reference.citation} onChange={(event) => update('citation', event.target.value)} placeholder="Example: GFR Rule 157 or DoPT OM No..." className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></Field>
        <Field label="Reference date (optional)"><input type="date" value={reference.referenceDate} onChange={(event) => update('referenceDate', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></Field>
        <Field className="sm:col-span-2" label="Relevant provision / notes"><textarea value={reference.notes} onChange={(event) => update('notes', event.target.value)} rows={4} placeholder="Record the relevant rule position, extract or interpretation." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" />Cancel</button>
        <button type="submit" disabled={saveStatus !== 'idle'} className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
          {saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, className = '', children }) { return <label className={`block ${className}`}><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>; }
function IconButton({ label, danger = false, onClick, children }) { return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-md border p-2 ${danger ? 'border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : 'border-transparent text-slate-500 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'}`}>{children}</button>; }
