import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Circle, FilePenLine, FolderOpen, MessageSquareText } from 'lucide-react';
import NotingPanel from '../noting/NotingPanel';
import DraftingWorkspace from '../drafting/DraftingWorkspace';
import { useToast } from '../../components/common/ToastProvider';
import { handleTabListKeyDown } from '../../utils/tabKeyboardUtils';
import StatusBadge from '../../components/common/StatusBadge';

export default function CaseworkModule({
  issue,
  officers,
  summary,
  notes,
  communications,
  references,
  author,
  readOnly = false,
  onSaveNote,
  onDeleteNote,
  onSaveCommunication,
  onDirtyChange,
  initialView = 'notes',
  initialNoteId = '',
  initialDraftId = '',
}) {
  const { showToast } = useToast();
  const [view, setView] = useState(initialView);
  const [draftingVisited, setDraftingVisited] = useState(initialView === 'drafting');
  const [draftSeed, setDraftSeed] = useState({
    noteIds: [],
    communicationIds: [],
    referenceIds: [],
    sourceNoteId: '',
    revision: 0,
  });
  const reportNotesDirty = useCallback((dirty) => onDirtyChange?.('notes', dirty), [onDirtyChange]);
  const reportDraftingDirty = useCallback((dirty) => onDirtyChange?.('drafting', dirty), [onDirtyChange]);

  useEffect(() => {
    setView(initialView);
    setDraftingVisited(initialView === 'drafting');
    setDraftSeed({ noteIds: [], communicationIds: [], referenceIds: [], sourceNoteId: '', revision: 0 });
  }, [initialView, issue.id]);

  const changeView = (nextView) => {
    setView(nextView);
    if (nextView === 'drafting') setDraftingVisited(true);
  };

  const createDraftFromNote = (note) => {
    setView('drafting');
    setDraftingVisited(true);
    setDraftSeed((current) => ({
      noteIds: [note.id],
      communicationIds: [...(note.linkedCommunicationIds || [])],
      referenceIds: [...(note.linkedReferenceIds || [])],
      sourceNoteId: note.id,
      revision: current.revision + 1,
    }));
    showToast(`Preparing a communication from Note ${note.sequence}.`);
  };

  const assignedOfficer = officers.find((officer) => officer.id === issue.assignedOfficerId);
  const issued = communications.some((item) => item.draftId);
  const workflowSteps = [
    { label: 'Examine', complete: view === 'drafting' || issued, active: view === 'notes' && !issued },
    { label: 'Prepare', complete: issued, active: view === 'drafting' && !issued },
    { label: 'Issued', complete: issued, active: issued },
  ];

  return (
    <div className="casework-workflow space-y-4">
      <section className="surface overflow-hidden rounded-xl border-slate-200">
        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm"><FolderOpen className="h-4.5 w-4.5" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Active matter</p>
                <h2 className="mt-1 truncate text-base font-semibold text-slate-950 sm:text-lg" title={issue.shortTitle}>{issue.shortTitle}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={issue.status} />
                  {issue.eFileNumber ? <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600">eFile {issue.eFileNumber}</span> : null}
                  {issue.stage ? <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">{issue.stage}</span> : null}
                </div>
              </div>
            </div>
            <p className={`mt-3 line-clamp-2 border-l-2 border-teal-200 pl-3 text-xs leading-5 ${issue.currentPosition ? 'text-slate-600' : 'italic text-slate-400'}`}>{issue.currentPosition || 'No current position has been recorded.'}</p>
          </div>

          <ol className="flex min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-2" aria-label={`Casework progress: ${issued ? 'communication issued' : view === 'drafting' ? 'preparing communication' : 'examination'}`}>
            {workflowSteps.map((step, index) => (
              <li key={step.label} className="flex min-w-0 flex-1 items-center lg:flex-none">
                <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold sm:text-[11px] ${step.active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : step.complete ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${step.complete ? 'bg-emerald-100' : step.active ? 'bg-teal-100 text-teal-800' : 'bg-slate-200'}`}>{step.complete ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}</span>
                  <span className="truncate">{step.label}</span>
                </span>
                {index < workflowSteps.length - 1 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" /> : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50/80 p-2" role="tablist" aria-label="Casework" onKeyDown={handleTabListKeyDown}>
          <button type="button" role="tab" aria-selected={view === 'notes'} tabIndex={view === 'notes' ? 0 : -1} onClick={() => changeView('notes')} className={`group flex min-h-14 min-w-0 items-center gap-2.5 rounded-lg px-3 text-left transition-colors sm:min-h-16 sm:px-4 ${view === 'notes' ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'}`}>
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${view === 'notes' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-700'}`}><MessageSquareText className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">Examine and Note</span><span className="mt-0.5 hidden truncate text-[11px] font-normal text-slate-500 sm:block">Record analysis and proposed action</span></span>
            {notes.length > 0 ? <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-indigo-700">{notes.length}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={view === 'drafting'} tabIndex={view === 'drafting' ? 0 : -1} onClick={() => changeView('drafting')} className={`group flex min-h-14 min-w-0 items-center gap-2.5 rounded-lg px-3 text-left transition-colors sm:min-h-16 sm:px-4 ${view === 'drafting' ? 'bg-white text-teal-950 shadow-sm ring-1 ring-teal-200' : 'text-slate-500 hover:bg-white/80 hover:text-slate-800'}`}>
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${view === 'drafting' ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500 group-hover:bg-teal-50 group-hover:text-teal-700'}`}><FilePenLine className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block truncate text-xs font-semibold sm:hidden">Prepare</span><span className="hidden truncate text-sm font-semibold sm:block">Prepare Communication</span><span className="mt-0.5 hidden truncate text-[11px] font-normal text-slate-500 sm:block">Draft, review and record issue</span></span>
          </button>
        </div>
      </section>

      <div hidden={view !== 'notes'}>
        <NotingPanel
          issueId={issue.id}
          issue={issue}
          summary={summary}
          notes={notes}
          communications={communications}
          references={references}
          author={author}
          readOnly={readOnly}
          onSave={onSaveNote}
          onDelete={onDeleteNote}
          onCreateDraft={createDraftFromNote}
          onDirtyChange={reportNotesDirty}
          initialEditNoteId={initialNoteId}
        />
      </div>

      {draftingVisited && (
        <div hidden={view !== 'drafting'}>
          <DraftingWorkspace
            issue={issue}
            assignedOfficer={assignedOfficer}
            officers={officers}
            summary={summary}
            communications={communications}
            references={references}
            notes={notes}
            initialNoteIds={draftSeed.noteIds}
            initialCommunicationIds={draftSeed.communicationIds}
            initialReferenceIds={draftSeed.referenceIds}
            sourceNoteId={draftSeed.sourceNoteId}
            noteSelectionRevision={draftSeed.revision}
            readOnly={readOnly}
            onSaveCommunication={onSaveCommunication}
            onDirtyChange={reportDraftingDirty}
            initialDraftId={initialDraftId}
          />
        </div>
      )}
    </div>
  );
}
