import { useMemo, useState } from 'react';
import { CornerDownLeft, LoaderCircle, Pencil, Plus, Search, Trash2, UserRound, Users, X } from 'lucide-react';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import AdaptiveSelect from '../../../components/common/AdaptiveSelect';
import { COMMUNICATION_TYPES } from '../templates/templateRegistry';
import { deleteParagraphBankEntry, saveParagraphBankEntry } from './paragraphBankRepository';
import {
  canManageParagraphBankEntry,
  PARAGRAPH_BANK_CATEGORIES,
  searchParagraphBank,
} from './paragraphBankUtils';

const EMPTY_FORM = {
  id: '',
  title: '',
  content: '',
  category: 'Other',
  tags: '',
  communicationTypes: [],
  scope: 'personal',
};

export default function ParagraphBankPanel({
  entries,
  auth,
  communicationType,
  canInsert,
  onInsert,
  onUseAddress,
  onChanged,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ state: 'idle', error: '', errors: {} });
  const [pendingDelete, setPendingDelete] = useState(null);
  const userId = auth.user?.id || (auth.mode === 'local' ? 'local-user' : '');
  const canCreate = auth.canEdit !== false;
  const filtered = useMemo(() => searchParagraphBank(entries, {
    query,
    category,
    communicationType: showAllTypes ? '' : communicationType,
  }), [category, communicationType, entries, query, showAllTypes]);

  const startCreate = () => {
    setForm({ ...EMPTY_FORM, communicationTypes: communicationType ? [communicationType] : [] });
    setStatus({ state: 'idle', error: '', errors: {} });
  };

  const startEdit = (entry) => {
    setForm({
      ...entry,
      tags: entry.tags.join(', '),
      communicationTypes: [...entry.communicationTypes],
    });
    setStatus({ state: 'idle', error: '', errors: {} });
  };

  const save = async (event) => {
    event.preventDefault();
    setStatus({ state: 'saving', error: '', errors: {} });
    try {
      const saved = await saveParagraphBankEntry({
        ...form,
        ownerUserId: form.ownerUserId || userId,
      }, userId);
      await onChanged(saved);
      setForm(null);
      setStatus({ state: 'saved', error: '', errors: {} });
    } catch (error) {
      setStatus({
        state: 'error',
        error: error.message || 'Unable to save the paragraph.',
        errors: error.validationErrors || {},
      });
      await onChanged();
    }
  };

  const remove = async () => {
    const entry = pendingDelete;
    setPendingDelete(null);
    setStatus({ state: 'deleting', error: '', errors: {} });
    try {
      await deleteParagraphBankEntry(entry);
      await onChanged();
      if (form?.id === entry.id) setForm(null);
      setStatus({ state: 'idle', error: '', errors: {} });
    } catch (error) {
      setStatus({ state: 'error', error: error.message || 'Unable to delete the paragraph.', errors: {} });
      await onChanged();
    }
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleType = (type) => update(
    'communicationTypes',
    form.communicationTypes.includes(type)
      ? form.communicationTypes.filter((item) => item !== type)
      : [...form.communicationTypes, type],
  );

  return (
    <div className="border-t border-[#e3ebe9]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold text-[#17333b]">Paragraph Bank</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Reuse approved wording without asking AI to recreate it. Text in square brackets, such as [DATE], is shown as a placeholder to replace.</p>
        </div>
        {canCreate && !form && (
          <button type="button" onClick={startCreate} className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">
            <Plus className="h-4 w-4" />Add entry
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={save} className="border-y border-[#e3ebe9] bg-[#f7faf9] px-4 py-4 sm:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h4 className="text-sm font-semibold text-slate-800">{form.id ? 'Edit entry' : 'New entry'}</h4><p className="mt-0.5 text-xs text-slate-500">Save reusable wording or a frequently used addressee block.</p></div>
            <button type="button" onClick={() => setForm(null)} title="Close editor" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /><span className="sr-only">Close editor</span></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Name</span><input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Example: First reminder" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />{status.errors.title && <span className="mt-1 block text-xs text-red-700">{status.errors.title}</span>}</label>
            <AdaptiveSelect label="Category" labelClassName="text-xs font-semibold text-slate-700" value={form.category} onChange={(value) => update('category', value)} options={PARAGRAPH_BANK_CATEGORIES} includeBlank={false} />
            <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-700">{form.category === 'Address / addressee' ? 'Address block' : 'Paragraph'}</span><textarea rows={6} value={form.content} onChange={(event) => update('content', event.target.value)} placeholder={form.category === 'Address / addressee' ? 'Enter the reusable postal address, one line per address line.' : 'Enter reusable official wording. Use [DATE], [ORGANIZATION] or similar placeholders where details change.'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />{status.errors.content && <span className="mt-1 block text-xs text-red-700">{status.errors.content}</span>}</label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Search tags</span><input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="reminder, information, deadline" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Availability</span><select value={form.scope} onChange={(event) => update('scope', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="personal">Personal</option>{auth.isWorkspaceAdmin && <option value="workspace">Shared with workspace</option>}</select>{!auth.isWorkspaceAdmin && <span className="mt-1 block text-xs text-slate-500">Only workspace administrators can publish shared wording.</span>}</label>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-teal-800">Communication types</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {COMMUNICATION_TYPES.map((type) => <label key={type} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.communicationTypes.includes(type)} onChange={() => toggleType(type)} className="h-4 w-4 rounded border-slate-300 accent-teal-700" />{type}</label>)}
            </div>
            <p className="mt-2 text-xs text-slate-500">Leave all clear to make the paragraph available for every communication type.</p>
          </details>
          {status.error && <p className="mt-3 text-xs text-red-700">{status.error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={status.state === 'saving'} className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{status.state === 'saving' && <LoaderCircle className="h-4 w-4 animate-spin" />}{status.state === 'saving' ? 'Saving...' : 'Save entry'}</button>
          </div>
        </form>
      )}

      <div className="grid gap-2 border-b border-[#e3ebe9] bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:px-5">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">Search paragraph bank</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wording, name or tag" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm" /></label>
        <AdaptiveSelect ariaLabel="Filter paragraph category" value={category} onChange={setCategory} options={PARAGRAPH_BANK_CATEGORIES} placeholder="All categories" />
        <label className="flex h-10 items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={showAllTypes} onChange={(event) => setShowAllTypes(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-700" />Show all types</label>
      </div>

      {status.error && !form && <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 sm:px-5">{status.error}</p>}
      <div className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-2">
        {filtered.map((entry) => {
          const canManage = canManageParagraphBankEntry(entry, {
            mode: auth.mode,
            userId,
            isWorkspaceAdmin: auth.isWorkspaceAdmin,
          });
          const isAddress = entry.category === 'Address / addressee';
          return (
            <article key={entry.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-800">{entry.title}</h4><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${entry.scope === 'workspace' ? 'bg-cyan-50 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}>{entry.scope === 'workspace' ? <Users className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}{entry.scope === 'workspace' ? 'Shared' : 'Personal'}</span></div><p className="mt-1 text-xs font-medium text-teal-800">{entry.category}</p></div>
                {canManage && <div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(entry)} title="Edit paragraph" className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-teal-800"><Pencil className="h-3.5 w-3.5" /><span className="sr-only">Edit paragraph</span></button><button type="button" onClick={() => setPendingDelete(entry)} title="Delete paragraph" className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete paragraph</span></button></div>}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.content}</p>
              {(entry.placeholders.length > 0 || entry.tags.length > 0) && <div className="mt-3 flex flex-wrap gap-1.5">{entry.placeholders.map((item) => <span key={`placeholder-${item}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">[{item}]</span>)}{entry.tags.map((tag) => <span key={`tag-${tag}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{tag}</span>)}</div>}
              <button type="button" onClick={() => isAddress ? onUseAddress?.(entry) : onInsert(entry.content)} disabled={!canInsert} className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"><CornerDownLeft className="h-4 w-4" />{isAddress ? 'Use address' : 'Insert in draft'}</button>
            </article>
          );
        })}
        {!filtered.length && <div className="py-10 text-center lg:col-span-2"><p className="text-sm font-semibold text-slate-600">No matching paragraphs</p><p className="mt-1 text-xs text-slate-500">{entries.length ? 'Change the filters or communication type.' : 'Add the first reusable paragraph for this workspace.'}</p></div>}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete paragraph?"
        message={`"${pendingDelete?.title || 'This paragraph'}" will be removed from your Paragraph Bank. Existing drafts will not change.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </div>
  );
}
