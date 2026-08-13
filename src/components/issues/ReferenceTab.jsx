import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Link2, Plus, Search, Unlink, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import { attachReferenceToIssue, getWorkspaceReferences, saveWorkspaceReference, updateIssueReferenceLink } from '../../db/referenceRepository';
import { useAuth } from '../../features/auth/AuthContext';
import useDirtyStateReporter from '../../hooks/useDirtyStateReporter';

export default function ReferenceTab({ issueId, references, readOnly = false, onDelete, onDirtyChange, onChanged }) {
  const auth = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [library, setLibrary] = useState([]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadLibrary = async () => setLibrary(await getWorkspaceReferences());
  useEffect(() => { if (pickerOpen) loadLibrary(); }, [pickerOpen]);
  const attachedIds = new Set(references.map((item) => item.libraryReferenceId));
  const available = useMemo(() => library.filter((item) => !attachedIds.has(item.id) && [item.title, item.citation, item.authority, item.tags.join(' ')].join(' ').toLowerCase().includes(query.trim().toLowerCase())), [library, query, references]);
  const attach = async (referenceId) => {
    setBusy(true);
    try {
      await attachReferenceToIssue({ issueId, referenceId });
      setPickerOpen(false);
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-[#17333b]">References</h2><p className="mt-1 text-sm text-slate-600">Attach reusable authorities from the workspace library and record why they matter to this Issue.</p></div>{!readOnly && <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white"><Link2 className="h-4 w-4" />Attach reference</button>}</div>
    {pickerOpen && <div className="surface rounded-md border-t-4 border-t-amber-500 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Attach from Reference Library</h3><button type="button" onClick={() => setPickerOpen(false)} aria-label="Close reference picker" className="h-10 w-10"><X className="mx-auto h-4 w-4" /></button></div>{creating ? <QuickReferenceForm ownerUserId={auth.user?.id || ''} onCancel={() => setCreating(false)} onCreated={async (item) => { await loadLibrary(); await attach(item.id); }} /> : <><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">Search Reference Library</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the shared library" className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" /></label><button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-800"><Plus className="h-4 w-4" />Create new</button></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{available.map((item) => <button key={item.id} type="button" disabled={busy} onClick={() => attach(item.id)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-amber-50"><span><span className="block text-sm font-semibold text-slate-800">{item.title}</span><span className="mt-0.5 block text-xs text-slate-500">{[item.citation, item.authority, `${item.extracts.length} extracts`].filter(Boolean).join(' · ')}</span></span><span className="text-xs font-semibold text-teal-700">Attach</span></button>)}{!available.length && <p className="py-6 text-center text-xs text-slate-500">No unattached matching references.</p>}</div></>}</div>}
    <div className="grid gap-3 lg:grid-cols-2">{references.map((item) => <IssueReferenceCard key={item.id} item={item} readOnly={readOnly} onDelete={onDelete} onDirtyChange={onDirtyChange} onChanged={onChanged} />)}</div>
    {!references.length && <div className="surface rounded-md px-4 py-10 text-center"><BookOpen className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">No references attached</p><p className="mt-1 text-xs text-slate-500">Attach an existing workspace reference or create one here.</p></div>}
  </div>;
}

function IssueReferenceCard({ item, readOnly, onDelete, onDirtyChange, onChanged }) {
  const [editing, setEditing] = useState(false); const [note, setNote] = useState(item.link?.relevanceNote || ''); const [extractIds, setExtractIds] = useState(item.link?.extractIds || []); const [includeFullText, setIncludeFullText] = useState(Boolean(item.link?.includeFullText)); const [dirty, setDirty] = useState(false);
  useDirtyStateReporter(dirty, onDirtyChange);
  const save = async () => { await updateIssueReferenceLink({ ...item.link, relevanceNote: note, extractIds, includeFullText }); setDirty(false); setEditing(false); await onChanged?.(); };
  const change = (setter, value) => { setter(value); setDirty(true); };
  return <article className="surface rounded-md border-l-4 border-l-amber-500 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-[#17333b]">{item.reference?.title || item.citation}</h3><p className="mt-1 text-xs text-slate-500">{[item.citation, item.referenceDate && formatDisplayDate(item.referenceDate)].filter(Boolean).join(' · ')}</p></div>{!readOnly && <div className="flex gap-1"><button type="button" onClick={() => setEditing((x) => !x)} className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold">{editing ? 'Close' : 'Relevance'}</button><button type="button" aria-label="Detach reference" title="Detach from Issue" onClick={() => onDelete(item)} className="inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:text-red-700"><Unlink className="h-4 w-4" /></button></div>}</div>
    {!editing && item.notes && <p className="mt-3 line-clamp-6 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm leading-6 text-slate-700">{item.notes}</p>}
    {editing && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3"><label className="block"><span className="text-xs font-semibold text-slate-700">Why this reference matters to this Issue</span><textarea value={note} onChange={(e) => change(setNote, e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>{item.reference?.retainedText && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={includeFullText} onChange={(e) => change(setIncludeFullText, e.target.checked)} />Use the full retained text in AI context</label>}{item.reference?.extracts.map((extract) => <label key={extract.id} className="flex items-start gap-2 rounded-md border border-slate-200 p-2 text-xs"><input type="checkbox" checked={extractIds.includes(extract.id)} onChange={(e) => change(setExtractIds, e.target.checked ? [...extractIds, extract.id] : extractIds.filter((id) => id !== extract.id))} /><span><span className="font-semibold">{extract.title}</span><span className="mt-1 block line-clamp-2 text-slate-500">{extract.content}</span></span></label>)}<button type="button" onClick={save} className="min-h-10 w-full rounded-md bg-teal-700 px-3 text-sm font-semibold text-white sm:w-auto">Save relevance</button></div>}
  </article>;
}

function QuickReferenceForm({ ownerUserId, onCancel, onCreated }) { const [title, setTitle] = useState(''); const [citation, setCitation] = useState(''); const submit = async (e) => { e.preventDefault(); const item = await saveWorkspaceReference({ title, citation, scope: 'workspace' }, ownerUserId); await onCreated(item); }; return <form onSubmit={submit} className="mt-3 grid gap-3"><label><span className="text-xs font-semibold">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label><label><span className="text-xs font-semibold">Citation / number</span><input value={citation} onChange={(e) => setCitation(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="min-h-11 rounded-md border">Cancel</button><button className="min-h-11 rounded-md bg-teal-700 text-sm font-semibold text-white">Create and attach</button></div></form>; }
