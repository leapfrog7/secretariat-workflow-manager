import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, ChevronRight, Circle, FilePenLine, FolderOpen, MessageSquareText } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { handleTabListKeyDown } from '../../utils/tabKeyboardUtils';
import StatusBadge from '../../components/common/StatusBadge';
import ErrorState from '../../components/common/ErrorState';
import Card from '../../components/ui/Card';
import OperationStatus from '../../components/ui/OperationStatus';
import Skeleton from '../../components/ui/Skeleton';
import { Tab, TabCount, TabList } from '../../components/ui/Tabs';
import { formatDisplayDate } from '../../utils/dateUtils';

const loadNotingPanel = () => import('../noting/NotingPanel');
const loadDraftingWorkspace = () => import('../drafting/DraftingWorkspace');
const preloadNotingPanel = () => { loadNotingPanel().catch(() => {}); };
const preloadDraftingWorkspace = () => { loadDraftingWorkspace().catch(() => {}); };
const NotingPanel = lazy(loadNotingPanel);
const DraftingWorkspace = lazy(loadDraftingWorkspace);

function CaseworkPanelFallback({ label }) {
  return (
    <div className="rounded-[var(--swm-radius-lg)] border border-[var(--swm-border)] bg-white p-4 shadow-[var(--swm-shadow-xs)]" role="status" aria-live="polite" aria-busy="true">
      <OperationStatus state="loading" label={label} />
      <div className="mt-3 space-y-3" aria-hidden="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-11 w-3/5" />
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}

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
  dirtySections = {},
  workspaceLoading = false,
  workspaceError = '',
  onRetryWorkspace,
}) {
  const { showToast } = useToast();
  const [view, setView] = useState(initialView);
  const [visitedViews, setVisitedViews] = useState(() => new Set([initialView]));
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
    setVisitedViews(new Set([initialView]));
    setDraftSeed({ noteIds: [], communicationIds: [], referenceIds: [], sourceNoteId: '', revision: 0 });
  }, [initialView, issue.id]);

  useEffect(() => {
    if (view === 'drafting') preloadDraftingWorkspace();
    else preloadNotingPanel();
  }, [view]);

  const changeView = (nextView) => {
    setView(nextView);
    setVisitedViews((current) => current.has(nextView) ? current : new Set([...current, nextView]));
  };

  const createDraftFromNote = (note) => {
    setView('drafting');
    setVisitedViews((current) => current.has('drafting') ? current : new Set([...current, 'drafting']));
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
  const activeDirty = Boolean(dirtySections[view === 'notes' ? 'notes' : 'drafting']);

  return (
    <div className="casework-workflow space-y-3 sm:space-y-4">
      <Card className="sticky top-14 z-20 overflow-visible rounded-[var(--swm-radius-lg)] border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="grid gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm"><FolderOpen className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950 sm:text-base" title={issue.shortTitle}>{issue.shortTitle}</p>
                  {activeDirty ? <OperationStatus state="dirty" className="hidden shrink-0 sm:inline-flex" /> : null}
                </div>
                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
                  <StatusBadge status={issue.status} />
                  {issue.eFileNumber ? <span className="truncate text-xs font-medium tabular-nums text-slate-500">eFile {issue.eFileNumber}</span> : null}
                  {issue.stage ? <span className="hidden truncate border-l border-slate-200 pl-1.5 text-xs font-medium text-slate-500 sm:inline">{issue.stage}</span> : null}
                  {issue.nextDeadline ? <span className="hidden shrink-0 items-center gap-1 border-l border-slate-200 pl-1.5 text-xs font-medium text-slate-500 md:inline-flex"><CalendarClock className="h-3.5 w-3.5" />{formatDisplayDate(issue.nextDeadline)}</span> : null}
                </div>
              </div>
            </div>
            <p className={`mt-2 hidden truncate border-l-2 border-teal-200 pl-2.5 text-xs leading-5 sm:block ${issue.currentPosition ? 'text-slate-600' : 'italic text-slate-400'}`}>{issue.currentPosition || 'No current position has been recorded.'}</p>
          </div>

          <ol className="hidden min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 md:flex" aria-label={`Casework progress: ${issued ? 'communication issued' : view === 'drafting' ? 'preparing communication' : 'examination'}`}>
            {workflowSteps.map((step, index) => (
              <li key={step.label} className="flex min-w-0 flex-1 items-center lg:flex-none">
                <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${step.active ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : step.complete ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${step.complete ? 'bg-emerald-100' : step.active ? 'bg-teal-100 text-teal-800' : 'bg-slate-200'}`}>{step.complete ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}</span>
                  <span className="truncate">{step.label}</span>
                </span>
                {index < workflowSteps.length - 1 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" /> : null}
              </li>
            ))}
          </ol>
        </div>

        <TabList className="grid grid-cols-2 gap-1 border-t border-slate-200 bg-slate-50/80 p-1.5" aria-label="Casework" onKeyDown={handleTabListKeyDown}>
          <Tab active={view === 'notes'} variant="segmented" onPointerEnter={preloadNotingPanel} onFocus={preloadNotingPanel} onClick={() => changeView('notes')} className="group flex items-center justify-center gap-2 text-left">
            <MessageSquareText className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="truncate">Examine and Note</span>
            {notes.length > 0 ? <TabCount active={view === 'notes'}>{notes.length}</TabCount> : null}
          </Tab>
          <Tab active={view === 'drafting'} variant="segmented" onPointerEnter={preloadDraftingWorkspace} onFocus={preloadDraftingWorkspace} onClick={() => changeView('drafting')} className="group flex items-center justify-center gap-2 text-left">
            <FilePenLine className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="truncate"><span className="sm:hidden">Prepare</span><span className="hidden sm:inline">Prepare Communication</span></span>
          </Tab>
        </TabList>
      </Card>

      {workspaceLoading ? <CaseworkPanelFallback label={view === 'drafting' ? 'Loading communication workspace…' : 'Loading noting workspace…'} /> : workspaceError ? <ErrorState title="Casework details unavailable" message={workspaceError} onRetry={onRetryWorkspace} /> : null}

      {!workspaceLoading && !workspaceError && visitedViews.has('notes') ? <div hidden={view !== 'notes'}>
        <Suspense fallback={<CaseworkPanelFallback label="Opening noting workspace…" />}>
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
        </Suspense>
      </div> : null}

      {!workspaceLoading && !workspaceError && visitedViews.has('drafting') && (
        <div hidden={view !== 'drafting'}>
          <Suspense fallback={<CaseworkPanelFallback label="Opening communication workspace…" />}>
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
          </Suspense>
        </div>
      )}
    </div>
  );
}
