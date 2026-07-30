import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { EMPTY_NOTE_RICH_TEXT, normalizeNote, plainTextToNoteRichText, validateNote } from './noteUtils';
import { normalizeDraftRichText, richTextPlainText } from '../drafting/domain/draftRichText';
import { formatDateTime } from '../../utils/dateUtils';
import { getSettings } from '../../db/database';
import { DEFAULT_AI_PREFERENCES } from '../../constants/issueConstants';
import { normalizeLocalAISettings } from '../../services/lmStudioClient';
import { useAuth } from '../auth/AuthContext';
import AIModeControl from '../../components/ai/AIModeControl';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { createDraftAIProvider } from '../drafting/ai/draftAIProviders';
import { buildAIContext } from '../../utils/aiContextUtils';
import { generateOrRefineNote } from './noteAI';

const NoteEditor = lazy(() => import('./NoteEditor'));

function materialLabel(item, type) {
  if (type === 'communication') {
    return `${item.communicationDate || 'Undated'} - ${item.communicationType || item.correspondent || 'Communication'}`;
  }
  return item.citation || 'Reference';
}

function LinkedMaterial({ title, items, selectedIds, type, onChange }) {
  if (!items.length) return null;
  return (
    <details className="rounded-md border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">{title} ({selectedIds.length})</summary>
      <div className="max-h-44 space-y-1 overflow-y-auto border-t border-slate-200 bg-white p-2">
        {items.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-xs text-slate-700 hover:bg-teal-50">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(event) => onChange(event.target.checked
                ? [...selectedIds, item.id]
                : selectedIds.filter((id) => id !== item.id))}
              className="mt-0.5 accent-teal-700"
            />
            <span>{materialLabel(item, type)}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function NoteForm({ issueId, issue, summary, note, communications, references, author, onSave, onCancel }) {
  const auth = useAuth();
  const [form, setForm] = useState(normalizeNote(note || {
    issueId,
    richText: EMPTY_NOTE_RICH_TEXT,
    authorUserId: author.userId,
    authorName: author.name,
  }));
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const [aiConfig, setAIConfig] = useState(null);
  const [aiInstruction, setAIInstruction] = useState('');
  const [aiStatus, setAIStatus] = useState({ status: 'idle', model: '' });
  const [cloudConsent, setCloudConsent] = useState(false);
  const aiController = useRef(null);

  useEffect(() => {
    let active = true;
    getSettings().then((settings) => {
      if (!active) return;
      setAIConfig({
        local: normalizeLocalAISettings(settings.localAI),
        preferences: { ...DEFAULT_AI_PREFERENCES, ...(settings.aiPreferences || {}) },
      });
    }).catch((settingsError) => {
      if (active) setError(settingsError.message || 'Unable to load AI settings.');
    });
    return () => {
      active = false;
      aiController.current?.abort();
    };
  }, []);
  const updateRichText = (richText) => setForm((current) => ({
    ...current,
    richText,
    content: richTextPlainText(richText),
  }));
  const submit = async (event) => {
    event.preventDefault();
    const errors = validateNote(form);
    if (errors.content) {
      setError(errors.content);
      return;
    }
    setSaveStatus('saving');
    setError('');
    try {
      await onSave({
        ...form,
        authorUserId: author.userId || form.authorUserId,
        authorName: author.name || form.authorName,
      });
      setSaveStatus('saved');
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      onCancel();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save note.');
      setSaveStatus('idle');
    }
  };

  const changeAIMode = (mode) => {
    aiController.current?.abort();
    setAIConfig((current) => current ? {
      ...current,
      preferences: { ...current.preferences, mode },
    } : current);
    setAIStatus({ status: 'idle', model: '' });
  };

  const runAI = async (confirmed = false) => {
    if (!aiConfig) {
      setError('AI settings are still loading.');
      return;
    }
    const operation = form.content.trim() ? 'refine' : 'generate';
    if (aiConfig.preferences.mode === 'cloud' && !confirmed) {
      if (!auth.workspace?.id) {
        setError('Sign in to an active workspace before using Cloud AI.');
        return;
      }
      setCloudConsent(true);
      return;
    }
    const selectedCommunications = communications.filter((item) => form.linkedCommunicationIds.includes(item.id));
    const selectedReferences = references.filter((item) => form.linkedReferenceIds.includes(item.id));
    const context = buildAIContext({
      issue,
      summary,
      communications: selectedCommunications,
      references: selectedReferences,
      includeIssueDetails: true,
      includeCurrentPosition: true,
      includeSummary: true,
    });
    const controller = new AbortController();
    aiController.current = controller;
    setError('');
    setAIStatus({ status: operation === 'refine' ? 'refining' : 'generating', model: '' });
    try {
      const provider = createDraftAIProvider(aiConfig.preferences.mode === 'cloud'
        ? {
          mode: 'cloud',
          workspaceId: auth.workspace.id,
          issueId,
          provider: aiConfig.preferences.cloudProvider,
          taskLevel: aiConfig.preferences.geminiTaskLevel,
        }
        : { mode: 'local', settings: aiConfig.local });
      const result = await generateOrRefineNote({
        provider,
        operation,
        issueContext: context.text,
        currentNote: form.content,
        instruction: aiInstruction,
        signal: controller.signal,
      });
      const richText = plainTextToNoteRichText(result.text);
      setForm((current) => ({ ...current, richText, content: richTextPlainText(richText) }));
      setAIStatus({ status: 'complete', model: result.model });
    } catch (aiError) {
      if (aiError.name === 'AbortError') setAIStatus({ status: 'idle', model: '' });
      else {
        setError(aiError.message || 'AI could not prepare the note.');
        setAIStatus({ status: 'idle', model: '' });
      }
    } finally {
      aiController.current = null;
    }
  };

  const aiBusy = ['generating', 'refining'].includes(aiStatus.status);
  return (
    <>
    <form onSubmit={submit} className="surface overflow-hidden rounded-md border-t-4 border-t-indigo-600">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-[#17333b]">{note ? `Edit Note ${note.sequence}` : 'New note'}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">Record concise facts, examination and the proposed course of action. Saving an edit retains the earlier version.</p>
      </div>
      <div className="space-y-3 p-4">
        <Suspense fallback={<div className="min-h-52 animate-pulse rounded-md bg-slate-100" />}>
          <NoteEditor value={form.richText} onChange={updateRichText} />
        </Suspense>
        {error && <p className="text-xs font-medium text-red-700">{error}</p>}
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-cyan-950">AI assistance</span>
              <AIModeControl value={aiConfig?.preferences.mode || 'local'} onChange={changeAIMode} cloudDisabled={!auth.workspace?.id} disabled={!aiConfig || aiBusy} compact />
            </div>
            {aiBusy ? (
              <div className="flex gap-2">
                <button type="button" disabled className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"><LoaderCircle className="h-4 w-4 animate-spin" />{aiStatus.status === 'refining' ? 'Refining...' : 'Generating...'}</button>
                <button type="button" title="Stop AI" onClick={() => aiController.current?.abort()} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"><Square className="h-4 w-4" /><span className="sr-only">Stop AI</span></button>
              </div>
            ) : (
              <button type="button" onClick={() => runAI()} disabled={!aiConfig || saveStatus !== 'idle'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-400 sm:w-auto"><Sparkles className="h-4 w-4" />{form.content.trim() ? 'Refine with AI' : 'Generate with AI'}</button>
            )}
          </div>
          <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-cyan-950">Additional instruction <span className="font-normal text-cyan-800">(optional)</span></span><input value={aiInstruction} onChange={(event) => setAIInstruction(event.target.value)} disabled={aiBusy} placeholder="Example: focus on the applicable rule and proposed action" className="h-10 w-full rounded-md border border-cyan-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-100" /></label>
          {aiStatus.status === 'complete' && <p className="mt-2 text-xs font-medium text-emerald-700">AI text inserted for review{aiStatus.model ? ` using ${aiStatus.model}` : ''}. It has not been saved yet.</p>}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Appendix material (optional)</span>
          <textarea value={form.appendix} onChange={(event) => setForm((current) => ({ ...current, appendix: event.target.value }))} rows={3} placeholder="Place supporting detail here when it would interrupt the main note." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <LinkedMaterial title="Link communications" items={communications} type="communication" selectedIds={form.linkedCommunicationIds} onChange={(ids) => setForm((current) => ({ ...current, linkedCommunicationIds: ids }))} />
          <LinkedMaterial title="Link references" items={references} type="reference" selectedIds={form.linkedReferenceIds} onChange={(ids) => setForm((current) => ({ ...current, linkedReferenceIds: ids }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <button type="button" onClick={onCancel} disabled={saveStatus !== 'idle'} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><X className="h-4 w-4" />Cancel</button>
        <button type="submit" disabled={saveStatus !== 'idle'} className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
          {saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save note'}
        </button>
      </div>
    </form>
    <ConfirmDialog
      open={cloudConsent}
      title="Send Issue context to Cloud AI?"
      message="The current note and recorded Issue context, including linked communications and references, will be sent to the selected Cloud AI provider. Review the returned note before saving."
      confirmLabel={form.content.trim() ? 'Send and refine' : 'Send and generate'}
      onCancel={() => setCloudConsent(false)}
      onConfirm={() => {
        setCloudConsent(false);
        runAI(true);
      }}
    />
    </>
  );
}

function InlineContent({ content = [] }) {
  return content.map((node, index) => {
    if (node.type === 'hardBreak') return <br key={`break-${index}`} />;
    let value = node.text || '';
    (node.marks || []).forEach((mark) => {
      if (mark.type === 'bold') value = <strong>{value}</strong>;
      if (mark.type === 'italic') value = <em>{value}</em>;
      if (mark.type === 'underline') value = <u>{value}</u>;
    });
    return <span key={`text-${index}`}>{value}</span>;
  });
}

function RichNoteContent({ value }) {
  const richText = normalizeDraftRichText(value);
  return (
    <div className="space-y-2 text-sm leading-7 text-slate-800">
      {richText.content.map((node, index) => {
        if (node.type === 'paragraph') return <p key={`p-${index}`}><InlineContent content={node.content} /></p>;
        if (node.type === 'bulletList' || node.type === 'orderedList') {
          const ListTag = node.type === 'bulletList' ? 'ul' : 'ol';
          return <ListTag key={`list-${index}`} className={`${node.type === 'bulletList' ? 'list-disc' : 'list-decimal'} space-y-1 pl-7`}>{node.content.map((item, itemIndex) => <li key={itemIndex}>{item.content.map((paragraph, paragraphIndex) => <p key={paragraphIndex}><InlineContent content={paragraph.content} /></p>)}</li>)}</ListTag>;
        }
        if (node.type === 'table') {
          return (
            <div key={`table-${index}`} className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <tbody>{node.content.map((row, rowIndex) => <tr key={rowIndex}>{row.content.map((cell, cellIndex) => {
                  const Cell = cell.type === 'tableHeader' ? 'th' : 'td';
                  return <Cell key={cellIndex} colSpan={cell.attrs?.colspan || 1} rowSpan={cell.attrs?.rowspan || 1} className={`border border-slate-300 px-2 py-1.5 align-top ${Cell === 'th' ? 'bg-slate-100 font-semibold' : ''}`}>{cell.content.map((paragraph, paragraphIndex) => <p key={paragraphIndex}><InlineContent content={paragraph.content} /></p>)}</Cell>;
                })}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function NoteCard({ note, readOnly, onEdit, onCreateDraft }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const linkedCount = note.linkedCommunicationIds.length + note.linkedReferenceIds.length;
  return (
    <article className="surface overflow-hidden rounded-md border-l-4 border-l-indigo-500">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#17333b]">Note {note.sequence}</p>
          <p className="mt-1 text-xs text-slate-500">{note.authorName || 'Officer'} · {formatDateTime(note.updatedAt || note.createdAt)} · Version {note.version}</p>
        </div>
        <div className="flex gap-1">
          {!readOnly && <button type="button" title="Edit note" onClick={onEdit} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-teal-50 hover:text-teal-800"><Pencil className="h-4 w-4" /></button>}
          <button type="button" title="Create draft using this note" onClick={onCreateDraft} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50"><FilePenLine className="h-4 w-4" />Draft</button>
        </div>
      </div>
      <div className="px-4 py-4"><RichNoteContent value={note.richText} /></div>
      {note.appendix && <div className="mx-4 mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-xs font-semibold uppercase text-slate-500">Appendix</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.appendix}</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xs text-slate-500">{linkedCount ? `${linkedCount} linked source${linkedCount === 1 ? '' : 's'}` : 'No linked sources'}</span>
        {note.revisions.length > 0 && <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700"><History className="h-4 w-4" />Earlier versions {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>}
      </div>
      {historyOpen && (
        <div className="divide-y divide-slate-100 border-t border-slate-200">
          {[...note.revisions].reverse().map((revision) => (
            <details key={`${revision.version}-${revision.editedAt}`} className="px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">Version {revision.version} · {revision.editedByName || note.authorName || 'Officer'} · {formatDateTime(revision.editedAt)}</summary>
              <p className="mt-3 whitespace-pre-wrap border-l-2 border-indigo-200 pl-3 text-sm leading-6 text-slate-700">{revision.content}</p>
            </details>
          ))}
        </div>
      )}
    </article>
  );
}

export default function NotingPanel({
  issueId,
  issue,
  summary,
  notes,
  communications,
  references,
  author,
  readOnly = false,
  onSave,
  onCreateDraft,
}) {
  const [editingId, setEditingId] = useState('');
  const editingNote = useMemo(() => notes.find((note) => note.id === editingId), [editingId, notes]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#17333b]">Noting</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Maintain the chronological examination of the case. Notes may be edited after discussion; every saved edit keeps the previous wording in version history.</p>
        </div>
        {!readOnly && !editingId && <button type="button" onClick={() => setEditingId('new')} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"><Plus className="h-4 w-4" />Add note</button>}
      </div>
      {editingId && (
        <NoteForm
          issueId={issueId}
          issue={issue}
          summary={summary}
          note={editingNote}
          communications={communications}
          references={references}
          author={author}
          onSave={onSave}
          onCancel={() => setEditingId('')}
        />
      )}
      <div className="space-y-3">
        {notes.map((note) => <NoteCard key={note.id} note={note} readOnly={readOnly} onEdit={() => setEditingId(note.id)} onCreateDraft={() => onCreateDraft(note)} />)}
      </div>
      {!notes.length && !editingId && <div className="surface rounded-md px-4 py-12 text-center"><FilePenLine className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No notes recorded</p><p className="mt-1 text-xs text-slate-500">Add the first concise examination of the matter.</p></div>}
    </div>
  );
}
