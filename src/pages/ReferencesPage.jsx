import { useEffect, useMemo, useState } from 'react';
import { Archive, BookOpen, FileUp, LoaderCircle, Plus, Save, Search, X } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import PdfContextDialog from '../features/noting/pdf/PdfContextDialog';
import { extractSourceDocument, MAX_SOURCE_DOCUMENT_BYTES } from '../features/noting/document/documentTextExtraction';
import { archiveWorkspaceReference, getWorkspaceReferences, saveWorkspaceReference } from '../db/referenceRepository';
import { normalizeReferenceExtract, normalizeWorkspaceReference, validateWorkspaceReference } from '../utils/referenceUtils';
import { useAuth } from '../features/auth/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';
import Button from '../components/ui/Button';

export default function ReferencesPage() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState('');
  const load = async () => setItems(await getWorkspaceReferences());
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return !needle ? items : items.filter((item) => [item.title, item.citation, item.authority, item.tags.join(' '), item.retainedText].join(' ').toLowerCase().includes(needle));
  }, [items, query]);
  const save = async (value) => {
    await saveWorkspaceReference(value, auth.user?.id || '');
    setEditing(null); setError(''); await load();
  };
  const archive = async (item) => {
    if (!window.confirm(`Archive “${item.title}”? Existing Issue links will remain available.`)) return;
    await archiveWorkspaceReference(item.id); await load();
  };
  return <div className="space-y-4">
    <PageHeader eyebrow="Shared knowledge" title="Reference Library" description="Maintain rules, orders and authorities once, then attach the relevant extracts to any Issue." />
    <div className="surface flex flex-col gap-3 rounded-[var(--swm-radius-lg)] p-3 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">Search references</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, authority, citation, tag or retained text" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm" /></label>
      {auth.canEdit && <Button onClick={() => setEditing(normalizeWorkspaceReference({ ownerUserId: auth.user?.id || '' }))} size="lg"><Plus className="h-4 w-4" />Create reference</Button>}
    </div>
    {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {editing && <ReferenceLibraryForm value={editing} onCancel={() => setEditing(null)} onSave={save} onPdf={setPdfFile} setError={setError} />}
    <div className="grid gap-3 lg:grid-cols-2">
      {visible.map((item) => <article key={item.id} className="surface rounded-md border-l-4 border-l-amber-500 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-sm font-semibold text-[#17333b]">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{[item.referenceType, item.authority, item.referenceDate && formatDisplayDate(item.referenceDate)].filter(Boolean).join(' · ') || 'Workspace reference'}</p></div>{auth.canEdit && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => setEditing(item)} className="min-h-10 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700">Edit</button><button type="button" onClick={() => archive(item)} title="Archive reference" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-amber-50"><Archive className="h-4 w-4" /></button></div>}</div>
        {item.citation && item.citation !== item.title && <p className="mt-2 text-xs font-medium text-amber-800">{item.citation}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600"><span>{item.retainedText ? `${item.retainedText.length.toLocaleString()} retained characters` : 'Metadata only'}</span><span>·</span><span>{item.extracts.length} saved extract{item.extracts.length === 1 ? '' : 's'}</span>{item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5">{tag}</span>)}</div>
      </article>)}
    </div>
    {!visible.length && <div className="surface rounded-md px-4 py-12 text-center"><BookOpen className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700">{query ? 'No matching references' : 'No shared references yet'}</p></div>}
    {pdfFile && <PdfContextDialog file={pdfFile} maxBytes={2 * 1024 * 1024} modeLabel="Reference Library" selectionActions onClose={() => setPdfFile(null)} onAttach={(source) => { setEditing((current) => ({ ...current, sourceName: source.originalName, sourceType: source.sourceType, retainedText: source.content })); setPdfFile(null); }} />}
  </div>;
}

function ReferenceLibraryForm({ value, onCancel, onSave, onPdf, setError }) {
  const [form, setForm] = useState(normalizeWorkspaceReference(value));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(normalizeWorkspaceReference(value));
  }, [value]);
  const update = (field, next) => setForm((current) => ({ ...current, [field]: next }));
  const readFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (/\.pdf$/i.test(file.name)) { onPdf(file); return; }
    setBusy(true); setError('');
    try { const source = await extractSourceDocument(file); setForm((current) => ({ ...current, sourceName: source.originalName, sourceType: source.sourceType, retainedText: source.content })); }
    catch (readError) { setError(readError.message); } finally { setBusy(false); }
  };
  const addExtract = () => {
    const content = window.getSelection()?.toString().trim() || '';
    if (!content) { setError('Select a relevant passage in the retained text first.'); return; }
    update('extracts', [...form.extracts, normalizeReferenceExtract({ title: `Extract ${form.extracts.length + 1}`, content })]); setError('');
  };
  const submit = async (event) => { event.preventDefault(); const errors = validateWorkspaceReference(form); if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; } setBusy(true); try { await onSave(form); } catch (saveError) { setError(saveError.message); setBusy(false); } };
  return <form onSubmit={submit} className="surface rounded-md border-t-4 border-t-amber-500 p-4">
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#17333b]">{value.id && value.createdAt ? 'Edit library reference' : 'Create library reference'}</h2><p className="mt-1 text-xs text-slate-500">Files are converted to reviewed text; the bulky original is not stored.</p></div><button type="button" onClick={onCancel} aria-label="Close reference form" className="h-10 w-10"><X className="mx-auto h-4 w-4" /></button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="Title"><input value={form.title} onChange={(e) => update('title', e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
      <Field label="Citation / number"><input value={form.citation} onChange={(e) => update('citation', e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
      <Field label="Authority"><input value={form.authority} onChange={(e) => update('authority', e.target.value)} placeholder="Department, court or issuing authority" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
      <Field label="Reference date"><input type="date" value={form.referenceDate} onChange={(e) => update('referenceDate', e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
      <Field label="Type"><select value={form.referenceType} onChange={(e) => update('referenceType', e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"><option>Other</option><option>Act or Rules</option><option>Office Memorandum</option><option>Order</option><option>Circular</option><option>Judgment</option><option>Manual or Instructions</option></select></Field>
      <Field label="Tags"><input value={form.tags.join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} placeholder="procurement, service matters" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
      <div className="sm:col-span-2"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900"><FileUp className="h-4 w-4" />{busy ? 'Reading…' : 'Import PDF/OCR, Word or text'}<input type="file" accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={readFile} className="sr-only" /></label><span className="ml-2 text-xs text-slate-500">Maximum source file {Math.round(MAX_SOURCE_DOCUMENT_BYTES / 1024 / 1024)} MB</span></div>
      <Field className="sm:col-span-2" label="Retained relevant text"><textarea value={form.retainedText} onChange={(e) => update('retainedText', e.target.value)} rows={10} placeholder="Paste text, import a document, or retain selected PDF/OCR pages." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" /><div className="mt-2 flex items-center justify-between"><span className="text-[11px] text-slate-500">{form.retainedText.length.toLocaleString()} characters retained</span><button type="button" onClick={addExtract} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Save selected passage as extract</button></div></Field>
      {form.extracts.length > 0 && <div className="space-y-2 sm:col-span-2"><p className="text-xs font-semibold text-slate-700">Saved extracts</p>{form.extracts.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-2"><input value={item.title} onChange={(e) => update('extracts', form.extracts.map((x) => x.id === item.id ? { ...x, title: e.target.value } : x))} className="h-9 w-full border-0 text-xs font-semibold" /><p className="line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{item.content}</p></div>)}</div>}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end"><button type="button" onClick={onCancel} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm">Cancel</button><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save reference</button></div>
  </form>;
}

function Field({ label, className = '', children }) { return <label className={`block ${className}`}><span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>{children}</label>; }
