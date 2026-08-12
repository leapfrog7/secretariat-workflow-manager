import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FilePenLine, MessageSquareText } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import UnsavedChangesGuard from '../components/common/UnsavedChangesGuard';
import StatusBadge from '../components/common/StatusBadge';
import CaseworkModule from '../features/casework/CaseworkModule';
import CaseworkIssuePicker from '../features/casework/CaseworkIssuePicker';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import { getAllIssues, getIssueById } from '../db/issueRepository';
import { getAllOfficers } from '../db/officerRepository';
import { getCommunicationsByIssue, saveCommunication } from '../db/communicationRepository';
import { getReferencesByIssue } from '../db/referenceRepository';
import { deleteNote, getNotesByIssue, saveNote } from '../db/noteRepository';
import { getLatestSummary } from '../db/summaryRepository';
import { getIssueAccessLevel } from '../features/collaboration/accessApi';
import { getRecentCaseworkActivity } from '../features/casework/caseworkActivityRepository';
import { formatDateTime } from '../utils/dateUtils';
import { recordCaseworkOperationalEvent } from '../features/casework/caseworkApi';

const emptyBundle = {
  issue: null,
  officers: [],
  notes: [],
  communications: [],
  references: [],
  summary: null,
  accessLevel: 'viewer',
};

export default function CaseworkPage() {
  const { issueId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const { showToast } = useToast();
  const loadRequestRef = useRef(0);
  const [issues, setIssues] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [bundle, setBundle] = useState(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirtySections, setDirtySections] = useState({});
  const [noteToDelete, setNoteToDelete] = useState(null);

  const loadIssues = useCallback(async () => {
    const records = await getAllIssues({ includeArchived: false, includeScheduled: false });
    const activity = await getRecentCaseworkActivity(records);
    setIssues(records);
    setRecentActivity(activity);
    return records;
  }, []);

  const loadCasework = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const records = await loadIssues();
      if (requestId !== loadRequestRef.current) return;
      if (!issueId) {
        setBundle(emptyBundle);
        setLoading(false);
        return;
      }

      const [issue, officers, notes, communications, references, summary, accessLevel] = await Promise.all([
        getIssueById(issueId),
        getAllOfficers(),
        getNotesByIssue(issueId),
        getCommunicationsByIssue(issueId),
        getReferencesByIssue(issueId),
        getLatestSummary(issueId),
        auth.workspace?.id && auth.workspace.division_access_enabled
          ? getIssueAccessLevel(auth.workspace.id, issueId)
          : Promise.resolve(auth.canEdit ? 'editor' : 'viewer'),
      ]);
      if (requestId !== loadRequestRef.current) return;
      if (!issue) throw new Error('This Issue is no longer available to you.');
      setBundle({ issue, officers, notes, communications, references, summary, accessLevel });
      if (!records.some((item) => item.id === issue.id) && !issue.isArchived && !issue.isScheduled) {
        setIssues((current) => [issue, ...current]);
      }
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) return;
      setBundle(emptyBundle);
      setError(loadError.message || 'Unable to load Casework.');
      recordCaseworkOperationalEvent({
        workspaceId: auth.workspace?.id,
        issueId: issueId || null,
        eventType: 'casework.load_failed',
        operation: issueId ? 'open_issue_casework' : 'load_casework_home',
        error: loadError,
      });
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [auth.canEdit, auth.workspace?.division_access_enabled, auth.workspace?.id, issueId, loadIssues]);

  useEffect(() => {
    setDirtySections({});
    loadCasework();
  }, [loadCasework]);

  useEffect(() => {
    const handleSync = () => {
      if (!Object.keys(dirtySections).length) loadCasework();
      else loadIssues().catch(() => {});
    };
    window.addEventListener('swm:workspace-synced', handleSync);
    return () => window.removeEventListener('swm:workspace-synced', handleSync);
  }, [dirtySections, loadCasework, loadIssues]);

  const setSectionDirty = useCallback((section, dirty) => {
    setDirtySections((current) => {
      if (Boolean(current[section]) === Boolean(dirty)) return current;
      const next = { ...current };
      if (dirty) next[section] = true;
      else delete next[section];
      return next;
    });
  }, []);

  const refreshNotes = async () => {
    const notes = await getNotesByIssue(issueId);
    setBundle((current) => ({ ...current, notes }));
  };

  const refreshCommunications = async () => {
    const communications = await getCommunicationsByIssue(issueId);
    setBundle((current) => ({ ...current, communications }));
  };

  const saveNoteEntry = async (note) => {
    try {
      await saveNote(note);
      await refreshNotes();
      showToast(note.id ? 'Note updated; the earlier version remains in history.' : 'Note added.');
    } catch (saveError) {
      showToast(saveError.message || 'Unable to save note.', 'error');
      throw saveError;
    }
  };

  const saveCommunicationEntry = async (communication) => {
    try {
      await saveCommunication({ ...communication, issueId });
      await refreshCommunications();
      showToast(communication.id ? 'Communication updated.' : 'Communication added.');
    } catch (saveError) {
      showToast(saveError.message || 'Unable to save communication.', 'error');
      throw saveError;
    }
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.id);
      await refreshNotes();
      showToast(`Note ${noteToDelete.sequence} deleted.`);
      setNoteToDelete(null);
    } catch (deleteError) {
      showToast(deleteError.message || 'Unable to delete note.', 'error');
    }
  };

  if (loading) return <LoadingState message={issueId ? 'Opening Casework...' : 'Loading Issues...'} />;
  if (error) return <ErrorState message={error} />;

  const canEditIssue = auth.canEdit && bundle.accessLevel === 'editor';
  const initialView = searchParams.get('mode') === 'drafting' ? 'drafting' : 'notes';
  const initialNoteId = initialView === 'notes' ? searchParams.get('note') || '' : '';
  const initialDraftId = initialView === 'drafting' ? searchParams.get('draft') || '' : '';

  return (
    <>
      <PageHeader
        title="Casework"
        description="Examine an Issue, record the internal note and prepare the resulting communication in one place."
        actions={bundle.issue ? (
          <Link to={`/issues/${bundle.issue.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800">
            <ExternalLink className="h-4 w-4" />Open full Issue
          </Link>
        ) : null}
      />

      <section className="surface mb-3 border-l-4 border-l-indigo-600 p-3 sm:mb-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <CaseworkIssuePicker issues={issues} selectedId={issueId} auth={auth} onSelect={(value) => navigate(`/casework/${value}`)} />
          {auth.canEdit && (
            <Link to="/issues/new" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 sm:mt-6 sm:h-10 sm:w-auto">
              <FilePenLine className="h-4 w-4" />Create Issue
            </Link>
          )}
        </div>
      </section>

      {!bundle.issue ? (
        recentActivity.length || issues.some((issue) => ['Awaiting Input', 'Awaiting Discussion'].includes(issue.status)) ? (
          <CaseworkQueues activity={recentActivity} awaitingIssues={issues.filter((issue) => ['Awaiting Input', 'Awaiting Discussion'].includes(issue.status)).slice(0, 10)} />
        ) : (
          <EmptyState
            title={issues.length ? 'No saved Casework yet' : 'No current Issues'}
            message={issues.length ? 'Choose an Issue above to add its first Note or prepare a communication.' : 'Create an Issue first, then return here to examine it and prepare a communication.'}
            action={issues.length ? null : auth.canEdit ? <Link to="/issues/new" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 sm:h-10 sm:w-auto">Create Issue</Link> : <Link to="/issues" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 sm:h-10 sm:w-auto"><ArrowLeft className="h-4 w-4" />View Issues</Link>}
          />
        )
      ) : (
        <>
          {!canEditIssue && <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-950">Viewing access only. You can read this Casework, but changes are disabled.</div>}
          <CaseworkModule
            issue={bundle.issue}
            officers={bundle.officers}
            summary={bundle.summary}
            notes={bundle.notes}
            communications={bundle.communications}
            references={bundle.references}
            author={{ userId: auth.user?.id || '', name: auth.profile?.display_name || auth.user?.email || 'Local officer' }}
            readOnly={!canEditIssue}
            onSaveNote={saveNoteEntry}
            onDeleteNote={setNoteToDelete}
            onSaveCommunication={saveCommunicationEntry}
            onDirtyChange={setSectionDirty}
            initialView={initialView}
            initialNoteId={initialNoteId}
            initialDraftId={initialDraftId}
          />
        </>
      )}

      <UnsavedChangesGuard when={Object.keys(dirtySections).length > 0} message="Casework contains changes that have not been saved. Leaving now will discard them." />
      <ConfirmDialog
        open={Boolean(noteToDelete)}
        title={`Delete Note ${noteToDelete?.sequence || ''}?`}
        message="This note and its saved revision history will be permanently removed from the Issue. Other note numbers will remain unchanged."
        confirmLabel="Delete"
        destructive
        onCancel={() => setNoteToDelete(null)}
        onConfirm={confirmDeleteNote}
      />
    </>
  );
}

function CaseworkQueues({ activity, awaitingIssues }) {
  const [queue, setQueue] = useState(activity.length ? 'recent' : 'awaiting');
  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div><h2 className="text-base font-semibold text-[#17333b]">Casework queues</h2><p className="mt-1 text-sm text-slate-600">Return to recent work or matters waiting for follow-up.</p></div>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1" role="tablist" aria-label="Casework queues">
          <button type="button" role="tab" aria-selected={queue === 'recent'} onClick={() => setQueue('recent')} className={`min-h-9 rounded px-3 text-xs font-semibold ${queue === 'recent' ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Recent ({activity.length})</button>
          <button type="button" role="tab" aria-selected={queue === 'awaiting'} onClick={() => setQueue('awaiting')} className={`min-h-9 rounded px-3 text-xs font-semibold ${queue === 'awaiting' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Awaiting ({awaitingIssues.length})</button>
        </div>
      </div>
      {queue === 'recent' && <div className="divide-y divide-slate-200">
        {activity.map((item) => (
          <article key={item.issue.id} className="grid gap-2.5 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-4">
            <div className="min-w-0">
              <Link to={`/casework/${item.issue.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-800 hover:underline">{item.issue.shortTitle}</Link>
              <p className="mt-1 text-xs text-slate-500">Last worked {formatDateTime(item.activityAt)} · {item.activityKind === 'draft' ? 'Draft updated' : 'Note updated'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.latestNote && (
                <Link to={`/casework/${item.issue.id}?mode=notes&note=${encodeURIComponent(item.latestNote.id)}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 sm:flex-none">
                  <MessageSquareText className="h-4 w-4" />Open Note {item.latestNote.sequence}
                </Link>
              )}
              {item.latestDraft && (
                <Link to={`/casework/${item.issue.id}?mode=drafting&draft=${encodeURIComponent(item.latestDraft.id)}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-800 hover:bg-teal-100 sm:flex-none">
                  <FilePenLine className="h-4 w-4" />Open draft
                </Link>
              )}
            </div>
          </article>
        ))}
        {!activity.length && <p className="px-4 py-10 text-center text-sm text-slate-500">No saved Notes or Drafts yet.</p>}
      </div>}
      {queue === 'awaiting' && <div className="divide-y divide-slate-200">
        {awaitingIssues.map((issue) => (
          <article key={issue.id} className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <div className="min-w-0"><Link to={`/casework/${issue.id}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-800 hover:underline">{issue.shortTitle}</Link><div className="mt-1.5"><StatusBadge status={issue.status} /></div></div>
            <Link to={`/casework/${issue.id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800">Open Casework</Link>
          </article>
        ))}
        {!awaitingIssues.length && <p className="px-4 py-10 text-center text-sm text-slate-500">No Issues are awaiting input or discussion.</p>}
      </div>}
    </section>
  );
}
