import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FilePenLine, MessageSquareText } from 'lucide-react';
import NotingPanel from '../noting/NotingPanel';
import DraftingWorkspace from '../drafting/DraftingWorkspace';
import { useToast } from '../../components/common/ToastProvider';
import { handleTabListKeyDown } from '../../utils/tabKeyboardUtils';

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

  return (
    <div className="space-y-4">
      <section className={`surface overflow-hidden rounded-md border-t-4 ${view === 'notes' ? 'border-t-indigo-600' : 'border-t-teal-600'}`}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[#17333b]">Casework</h2>
            <p className="mt-1 text-sm text-slate-600">Examine the matter, record the internal view and prepare the communication.</p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400" aria-label={`Casework progress: ${issued ? 'communication issued' : view === 'drafting' ? 'preparing communication' : 'examination'}`}>
            <span className={view === 'notes' ? 'text-indigo-700' : 'text-slate-500'}>Examination</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={view === 'drafting' ? 'text-teal-700' : 'text-slate-500'}>Communication</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={issued ? 'text-emerald-700' : 'text-slate-400'}>Issued</span>
          </div>
        </div>
        <div className={`grid grid-cols-2 gap-1 p-1.5 ${view === 'notes' ? 'bg-indigo-50/60' : 'bg-teal-50/60'}`} role="tablist" aria-label="Casework" onKeyDown={handleTabListKeyDown}>
          <button type="button" role="tab" aria-selected={view === 'notes'} tabIndex={view === 'notes' ? 0 : -1} onClick={() => changeView('notes')} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold sm:text-sm ${view === 'notes' ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-indigo-200' : 'text-slate-500 hover:bg-white/70 hover:text-indigo-800'}`}>
            <MessageSquareText className="h-4 w-4" />Examine and Note
            {notes.length > 0 && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] tabular-nums text-indigo-700">{notes.length}</span>}
          </button>
          <button type="button" role="tab" aria-selected={view === 'drafting'} tabIndex={view === 'drafting' ? 0 : -1} onClick={() => changeView('drafting')} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold sm:text-sm ${view === 'drafting' ? 'bg-white text-teal-800 shadow-sm ring-1 ring-teal-200' : 'text-slate-500 hover:bg-white/70 hover:text-teal-800'}`}>
            <FilePenLine className="h-4 w-4" />Prepare Communication
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
