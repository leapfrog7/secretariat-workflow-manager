import { useState } from 'react';
import { CheckCircle2, FileText, LoaderCircle, MessageSquarePlus, Pencil, Save, Trash2, X } from 'lucide-react';
import { COMMUNICATION_TYPES, normalizeCommunication, validateCommunication } from '../../utils/communicationUtils';
import { formatDisplayDate } from '../../utils/dateUtils';

export default function CommunicationTab({ issueId, communications, onSave, onDelete }) {
  const [form, setForm] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#17333b]">Record of Communication</h2>
          <p className="mt-1 text-sm text-slate-600">Maintain the dated communication chain for this Issue.</p>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm({ id: null })} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Add communication
          </button>
        )}
      </div>

      {form && (
        <CommunicationForm
          issueId={issueId}
          initialCommunication={form.id ? communications.find((item) => item.id === form.id) : null}
          onSave={onSave}
          onComplete={() => setForm(null)}
          onCancel={() => setForm(null)}
        />
      )}

      <div className="surface overflow-hidden rounded-md">
        {communications.length ? (
          <ol className="divide-y divide-[#e3ebe9]">
            {communications.map((communication) => (
              <li key={communication.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[130px_minmax(0,1fr)_auto]">
                <div>
                  <div className="text-sm font-semibold tabular-nums text-[#174f5b]">{formatDisplayDate(communication.communicationDate)}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{communication.communicationType}</div>
                  {communication.correspondent && <div className="mt-1 text-xs text-slate-500">{communication.correspondent}</div>}
                </div>
                <div className="min-w-0">
                  {communication.draftId && <div className="mb-2 flex flex-wrap gap-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{communication.officialCommunicationType || 'Official communication'}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Draft v{communication.draftVersion || '?'}</span>{communication.signatoryName && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">Signed by {communication.signatoryName}</span>}</div>}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{communication.details}</p>
                  {hasSourceDetails(communication) && <SourceDetails communication={communication} />}
                </div>
                <div className="flex items-start gap-1">
                  <IconButton label="Edit communication" onClick={() => setForm({ id: communication.id })}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label="Delete communication" danger onClick={() => onDelete(communication)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-4 py-10 text-center">
            <MessageSquarePlus className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-700">No communication recorded</p>
            <p className="mt-1 text-xs text-slate-500">Add the first dated communication entry.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CommunicationForm({ issueId, initialCommunication, onSave, onComplete, onCancel }) {
  const [communication, setCommunication] = useState(normalizeCommunication({ ...initialCommunication, issueId }));
  const [errors, setErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const update = (field, value) => setCommunication((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateCommunication(communication);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaveStatus('saving');
    try {
      await onSave(communication);
      setSaveStatus('saved');
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      onComplete();
    } catch {
      setSaveStatus('idle');
    }
  };

  return (
    <form onSubmit={submit} className="surface rounded-md border-t-4 border-t-cyan-600 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" error={errors.communicationDate}>
          <input type="date" value={communication.communicationDate} onChange={(event) => update('communicationDate', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </Field>
        <Field label="Communication type">
          <select value={communication.communicationType} onChange={(event) => update('communicationType', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            {COMMUNICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        <Field className="sm:col-span-2" label="Organisation / person (optional)">
          <input value={communication.correspondent} onChange={(event) => update('correspondent', event.target.value)} placeholder="Example: Attached office, Department or officer" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </Field>
        <Field className="sm:col-span-2" label="Communication details" error={errors.details}>
          <textarea value={communication.details} onChange={(event) => update('details', event.target.value)} rows={4} placeholder="Example: Comments received from the subordinate organisation regarding..." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />
        </Field>
      </div>
      <details className="mt-4 rounded-md border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-slate-700">
          <FileText className="h-4 w-4 text-cyan-700" aria-hidden="true" />
          Source document details <span className="font-normal text-slate-500">(optional, no file upload)</span>
        </summary>
        <div className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2">
          <Field label="eReceipt number">
            <input value={communication.eReceiptNumber} onChange={(event) => update('eReceiptNumber', event.target.value)} placeholder="Example: 1845276/2026" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field label="Document date">
            <input type="date" value={communication.documentDate} onChange={(event) => update('documentDate', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field className="sm:col-span-2" label="Document subject">
            <input value={communication.sourceSubject} onChange={(event) => update('sourceSubject', event.target.value)} placeholder="Subject appearing on the receipt or communication" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field label="File name">
            <input value={communication.sourceFileName} onChange={(event) => update('sourceFileName', event.target.value)} placeholder="Example: Comments_15-07-2026.pdf" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field label="Relevant pages">
            <input value={communication.relevantPages} onChange={(event) => update('relevantPages', event.target.value)} placeholder="Example: 4-7, 12" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field className="sm:col-span-2" label="Document location">
            <input value={communication.sourceLocation} onChange={(event) => update('sourceLocation', event.target.value)} placeholder="eFile reference, SharePoint link or local folder path" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
          </Field>
          <Field className="sm:col-span-2" label="Short source digest">
            <textarea value={communication.sourceDigest} onChange={(event) => update('sourceDigest', event.target.value)} rows={3} placeholder="What does this document say that matters to the Issue?" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />
          </Field>
          <Field className="sm:col-span-2" label="Key facts or directions">
            <textarea value={communication.keyFacts} onChange={(event) => update('keyFacts', event.target.value)} rows={3} placeholder="Record specific facts, decisions, directions or commitments." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />
          </Field>
        </div>
      </details>
      <FormActions saveStatus={saveStatus} onCancel={onCancel} />
    </form>
  );
}

function Field({ label, error, className = '', children }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}

function FormActions({ saveStatus, onCancel }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <button type="button" onClick={onCancel} disabled={saveStatus !== 'idle'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:h-10"><X className="h-4 w-4" />Cancel</button>
      <button type="submit" disabled={saveStatus !== 'idle'} className={`inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white sm:h-10 ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
        {saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}

function IconButton({ label, danger = false, onClick, children }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-md border p-2 ${danger ? 'border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : 'border-transparent text-slate-500 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'}`}>{children}</button>;
}

function hasSourceDetails(communication) {
  return ['eReceiptNumber', 'documentDate', 'sourceSubject', 'sourceFileName', 'sourceLocation', 'relevantPages', 'sourceDigest', 'keyFacts']
    .some((field) => communication[field]?.trim());
}

function SourceDetails({ communication }) {
  const metadata = [
    ['eReceipt', communication.eReceiptNumber],
    ['Document date', communication.documentDate ? formatDisplayDate(communication.documentDate) : ''],
    ['File', communication.sourceFileName],
    ['Pages', communication.relevantPages],
  ].filter(([, value]) => value);
  return (
    <div className="mt-3 rounded-md border border-cyan-100 bg-cyan-50/60 px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-900"><FileText className="h-4 w-4" />Source document</div>
      {communication.sourceSubject && <p className="mt-2 text-sm font-medium text-slate-800">{communication.sourceSubject}</p>}
      {metadata.length > 0 && <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{metadata.map(([label, value]) => <div key={label}><dt className="inline font-semibold">{label}: </dt><dd className="inline">{value}</dd></div>)}</dl>}
      {communication.sourceLocation && <p className="mt-2 break-words text-xs text-slate-600"><span className="font-semibold">Location:</span> {communication.sourceLocation}</p>}
      {communication.sourceDigest && <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700"><span className="font-semibold">Digest:</span> {communication.sourceDigest}</p>}
      {communication.keyFacts && <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700"><span className="font-semibold">Key facts / directions:</span> {communication.keyFacts}</p>}
    </div>
  );
}
