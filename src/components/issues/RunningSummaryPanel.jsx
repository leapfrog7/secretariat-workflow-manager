import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileClock, LoaderCircle, Pencil, Plus, Save, X } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import { normalizeIssueSummary, summariesMatch, validateIssueSummary } from '../../utils/summaryUtils';

const sections = [
  { field: 'overview', label: 'What this Issue is about', placeholder: 'Briefly state the purpose and scope of the Issue.' },
  { field: 'keyFacts', label: 'Important facts and background', placeholder: 'Record the facts, dates and background needed to understand the matter.' },
  { field: 'presentPosition', label: 'Present position', placeholder: 'Summarise where the Issue stands now.' },
  { field: 'outstandingDecisions', label: 'Decisions or questions outstanding', placeholder: 'What still needs a decision, clarification or response?' },
  { field: 'nextStep', label: 'Immediate next step', placeholder: 'State the next action and, where useful, who should take it.' },
];

export default function RunningSummaryPanel({ latestSummary, versionCount, versions, expanded, loading, currentPosition, onSave, onLoadAll, onCollapse }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(normalizeIssueSummary());
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    if (!editing) setDraft(normalizeIssueSummary(latestSummary || { presentPosition: currentPosition }));
  }, [latestSummary, currentPosition, editing]);

  const startEditing = () => {
    setDraft(normalizeIssueSummary(latestSummary || { presentPosition: currentPosition }));
    setError('');
    setSaveStatus('idle');
    setEditing(true);
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

  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce6e4] px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <FileClock className="h-5 w-5 text-cyan-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#17333b]">Running summary</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">A concise, versioned brief of the Issue as it develops.</p>
        </div>
        {!editing && (
          <button type="button" onClick={startEditing} className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100">
            {latestSummary ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {latestSummary ? 'Update summary' : 'Create summary'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={submit} className="px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section, index) => (
              <label key={section.field} className={`block ${index === 0 ? 'lg:col-span-2' : ''}`}>
                <span className="mb-1 block text-sm font-medium text-slate-700">{section.label}</span>
                <textarea value={draft[section.field]} onChange={(event) => { setDraft((current) => ({ ...current, [section.field]: event.target.value })); setError(''); }} rows={index === 0 ? 3 : 4} placeholder={section.placeholder} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" />
              </label>
            ))}
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" onClick={() => setEditing(false)} disabled={saveStatus !== 'idle'} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:h-10"><X className="h-4 w-4" />Cancel</button>
            <button type="submit" disabled={saveStatus !== 'idle'} className={`inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white sm:h-10 ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400'}`}>
              {saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save new version'}
            </button>
          </div>
        </form>
      ) : latestSummary ? (
        <>
          <SummaryContent summary={latestSummary} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3ebe9] bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-5">
            <span>Version {latestSummary.version} saved {formatDateTime(latestSummary.createdAt)}</span>
            {versionCount > 1 && (
              <button type="button" onClick={expanded ? onCollapse : onLoadAll} disabled={loading} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 disabled:text-slate-400">
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {loading ? 'Loading...' : expanded ? 'Hide earlier versions' : `View earlier versions (${versionCount - 1})`}
              </button>
            )}
          </div>
          {expanded && (
            <div className="border-t border-[#dce6e4] bg-white px-4 py-4 sm:px-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Earlier versions</h3>
              <div className="space-y-2">
                {versions.filter((summary) => summary.id !== latestSummary.id).map((summary) => (
                  <details key={summary.id} className="rounded-md border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-slate-700">Version {summary.version} <span className="ml-2 font-normal text-slate-500">{formatDateTime(summary.createdAt)}</span></summary>
                    <SummaryContent summary={summary} compact />
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-8 text-center sm:px-5">
          <p className="text-sm font-medium text-slate-700">No running summary yet</p>
          <p className="mt-1 text-xs text-slate-500">Create a short brief when the Issue has enough context to preserve.</p>
        </div>
      )}
    </section>
  );
}

function SummaryContent({ summary, compact = false }) {
  const populated = sections.filter((section) => summary[section.field]?.trim());
  return (
    <dl className={`${compact ? 'border-t border-slate-200 px-3 py-3' : 'px-4 py-1 sm:px-5'} divide-y divide-[#e3ebe9]`}>
      {populated.map((section) => (
        <div key={section.field} className={compact ? 'py-2' : 'grid gap-1 py-3 sm:grid-cols-[210px_minmax(0,1fr)] sm:gap-5'}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</dt>
          <dd className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{summary[section.field]}</dd>
        </div>
      ))}
    </dl>
  );
}
