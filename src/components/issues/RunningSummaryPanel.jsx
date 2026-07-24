import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileClock, LoaderCircle, Pencil, Plus, Save, Sparkles, Table2, Trash2, Undo2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDateTime } from '../../utils/dateUtils';
import { normalizeIssueSummary, summariesMatch, validateIssueSummary } from '../../utils/summaryUtils';
import { getSettings } from '../../db/database';
import { DEFAULT_AI_PREFERENCES } from '../../constants/issueConstants';
import { normalizeLocalAISettings, summarizeLocalNotes } from '../../services/lmStudioClient';
import { summarizeCloudNotes } from '../../services/cloudAIClient';
import { useAuth } from '../../features/auth/AuthContext';
import ConfirmDialog from '../common/ConfirmDialog';

const TABLE_TEMPLATE = '\n| Item | Details | Status |\n| --- | --- | --- |\n|  |  |  |\n';

export default function RunningSummaryPanel({ issueId, issueTitle, latestSummary, versionCount, versions, expanded, loading, currentPosition, readOnly = false, onSave, onDelete, onLoadAll, onCollapse }) {
  const auth = useAuth();
  const [editing, setEditing] = useState(!readOnly && !latestSummary);
  const [mode, setMode] = useState('write');
  const [draft, setDraft] = useState(normalizeIssueSummary(latestSummary || { content: currentPosition }));
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [aiConfig, setAIConfig] = useState(null);
  const [aiStatus, setAIStatus] = useState({ status: 'idle', model: '' });
  const [cloudConsent, setCloudConsent] = useState(false);
  const [beforeAI, setBeforeAI] = useState('');
  const textareaRef = useRef(null);
  const aiController = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(normalizeIssueSummary(latestSummary || { content: currentPosition }));
  }, [latestSummary, currentPosition, editing]);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) {
          setAIConfig({
            settings: normalizeLocalAISettings(settings.localAI),
            preferences: { ...DEFAULT_AI_PREFERENCES, ...(settings.aiPreferences || {}) },
          });
        }
      })
      .catch(() => {
        if (active) setAIConfig(null);
      });
    return () => {
      active = false;
      aiController.current?.abort();
    };
  }, []);

  const startEditing = () => {
    setDraft(normalizeIssueSummary(latestSummary || { content: currentPosition }));
    setError('');
    setSaveStatus('idle');
    setAIStatus({ status: 'idle', model: '' });
    setBeforeAI('');
    setMode('write');
    setEditing(true);
  };

  const updateContent = (content) => {
    setDraft((current) => ({ ...current, content }));
    setError('');
    setSaveStatus('idle');
  };

  const insertTable = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.content.length;
    const end = textarea?.selectionEnd ?? start;
    const content = `${draft.content.slice(0, start)}${TABLE_TEMPLATE}${draft.content.slice(end)}`;
    updateContent(content);
    setMode('write');
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + 3, start + 7);
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = validateIssueSummary(draft);
    if (errors.summary) {
      setError(errors.summary);
      return;
    }
    if (latestSummary && summariesMatch(latestSummary, draft)) {
      setError('Make a change before saving a new version.');
      return;
    }
    setSaveStatus('saving');
    try {
      await onSave(draft);
      setSaveStatus('saved');
      window.setTimeout(() => setEditing(false), 650);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the summary.');
      setSaveStatus('idle');
    }
  };

  const summarize = async (cloudConfirmed = false) => {
    if (!draft.content.trim()) {
      setError('Add or paste notes before asking AI to summarize them.');
      return;
    }
    if (!aiConfig) {
      setError('AI settings are still loading. Please try again.');
      return;
    }
    if (aiConfig.preferences.mode === 'cloud' && !cloudConfirmed) {
      if (!auth.workspace?.id) {
        setError('Sign in to an active workspace before using Cloud AI.');
        return;
      }
      setCloudConsent(true);
      return;
    }

    const controller = new AbortController();
    aiController.current = controller;
    setError('');
    setAIStatus({ status: 'summarizing', model: '' });
    try {
      const generator = aiConfig.preferences.mode === 'cloud' ? summarizeCloudNotes : summarizeLocalNotes;
      const result = await generator({
        ...(aiConfig.preferences.mode === 'cloud'
          ? {
              workspaceId: auth.workspace.id,
              issueId,
              provider: aiConfig.preferences.cloudProvider,
              taskLevel: aiConfig.preferences.geminiTaskLevel,
            }
          : { settings: aiConfig.settings }),
        notes: draft.content,
        issueTitle,
        signal: controller.signal,
      });
      setBeforeAI(draft.content);
      updateContent(result.text);
      setAIStatus({ status: 'complete', model: result.model });
      setMode('preview');
    } catch (summaryError) {
      if (summaryError.name !== 'AbortError') {
        setError(summaryError.message || 'AI could not summarize these notes.');
        setAIStatus({ status: 'idle', model: '' });
      }
    }
  };

  const restoreBeforeAI = () => {
    updateContent(beforeAI);
    setBeforeAI('');
    setAIStatus({ status: 'idle', model: '' });
    setMode('write');
  };

  return (
    <>
      <section className="surface overflow-hidden rounded-md">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce6e4] px-4 py-4 sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <FileClock className="h-5 w-5 text-cyan-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[#17333b]">Running summary</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Keep the facts, decisions and pending work in one living note.</p>
          </div>
          {!readOnly && !editing && (
            <button type="button" onClick={startEditing} className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100">
              {latestSummary ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {latestSummary ? 'Update summary' : 'Create summary'}
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={submit}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-5">
              <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" aria-label="Summary editor mode">
                {['write', 'preview'].map((item) => (
                  <button key={item} type="button" onClick={() => setMode(item)} className={`h-9 rounded px-3 text-xs font-semibold capitalize ${mode === item ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {beforeAI && <button type="button" onClick={restoreBeforeAI} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Undo2 className="h-4 w-4" />Undo AI</button>}
                <button type="button" title="Insert editable table" onClick={insertTable} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"><Table2 className="h-4 w-4" /><span className="sr-only">Insert editable table</span></button>
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {mode === 'write' ? (
                <label className="block">
                  <span className="sr-only">Running summary text</span>
                  <textarea ref={textareaRef} value={draft.content} onChange={(event) => updateContent(event.target.value)} rows={16} placeholder="Paste notes or record the important facts, decisions, deadlines and pending action..." className="min-h-72 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900" />
                </label>
              ) : (
                <div className="min-h-72 overflow-x-auto rounded-md border border-slate-200 bg-white px-4 py-3">
                  {draft.content.trim() ? <MarkdownContent content={draft.content} /> : <p className="text-sm text-slate-500">Nothing to preview yet.</p>}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => summarize()} disabled={aiStatus.status === 'summarizing' || saveStatus !== 'idle'} className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60">
                  {aiStatus.status === 'summarizing' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiStatus.status === 'summarizing' ? 'Summarizing...' : 'Summarize with AI'}
                </button>
                {aiStatus.status === 'complete' && <span className="text-xs text-emerald-700">AI summary ready. Review it before saving.</span>}
              </div>
              {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <button type="button" onClick={() => setEditing(false)} disabled={saveStatus !== 'idle' || aiStatus.status === 'summarizing'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:h-10"><X className="h-4 w-4" />Cancel</button>
                <button type="submit" disabled={saveStatus !== 'idle' || aiStatus.status === 'summarizing'} className={`inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white sm:h-10 ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
                  {saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save new version'}
                </button>
              </div>
            </div>
          </form>
        ) : latestSummary ? (
          <>
            <div className="overflow-x-auto px-4 py-4 sm:px-5"><MarkdownContent content={latestSummary.content} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3ebe9] bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-5">
              <span>Version {latestSummary.version} saved {formatDateTime(latestSummary.createdAt)}</span>
              <div className="flex flex-wrap items-center gap-2">
                {versionCount > 1 && (
                  <button type="button" onClick={expanded ? onCollapse : onLoadAll} disabled={loading} className="inline-flex min-h-10 items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 disabled:text-slate-400">
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {loading ? 'Loading...' : expanded ? 'Hide earlier versions' : `View earlier versions (${versionCount - 1})`}
                  </button>
                )}
                {!readOnly && <button type="button" title={`Delete summary version ${latestSummary.version}`} onClick={() => onDelete(latestSummary)} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete summary version {latestSummary.version}</span></button>}
              </div>
            </div>
            {expanded && (
              <div className="border-t border-[#dce6e4] bg-white px-4 py-4 sm:px-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Earlier versions</h3>
                <div className="space-y-2">
                  {versions.filter((summary) => summary.id !== latestSummary.id).map((summary) => (
                    <details key={summary.id} className="rounded-md border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-slate-700">Version {summary.version} <span className="ml-2 font-normal text-slate-500">{formatDateTime(summary.createdAt)}</span></summary>
                      <div className="border-t border-slate-200 bg-white px-3 py-3">
                        <div className="overflow-x-auto"><MarkdownContent content={summary.content} compact /></div>
                        {!readOnly && <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
                          <button type="button" onClick={() => onDelete(summary)} className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" />Delete version</button>
                        </div>}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-8 text-center sm:px-5">
            <p className="text-sm font-medium text-slate-700">No running summary yet</p>
            <p className="mt-1 text-xs text-slate-500">Create a brief when the Issue has enough context to preserve.</p>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={cloudConsent}
        title="Send notes to Cloud AI?"
        message="The text in this editor will be sent to the selected Cloud AI provider for summarization. Usage and status are logged, but the prompt and summary text are not stored in the AI log."
        confirmLabel="Send and summarize"
        onCancel={() => setCloudConsent(false)}
        onConfirm={() => {
          setCloudConsent(false);
          summarize(true);
        }}
      />
    </>
  );
}

function MarkdownContent({ content, compact = false }) {
  return (
    <div className={`summary-markdown text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
