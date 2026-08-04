import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, CalendarClock, CheckCircle2, FilePenLine, LoaderCircle, MessageSquareText, Pencil, RotateCcw, Save } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import DisclosureSection from '../components/common/DisclosureSection';
import StatusBadge from '../components/common/StatusBadge';
import CommunicationTab from '../components/issues/CommunicationTab';
import ReferenceTab from '../components/issues/ReferenceTab';
import MilestoneStack from '../components/issues/MilestoneStack';
import RunningSummaryPanel from '../components/issues/RunningSummaryPanel';
import DraftingWorkspace from '../features/drafting/DraftingWorkspace';
import NotingPanel from '../features/noting/NotingPanel';
import IssueAccessPanel from '../components/collaboration/IssueAccessPanel';
import { archiveIssue, bringBackIssue, getIssueById, restoreIssue, updateIssue, updateIssuePosition } from '../db/issueRepository';
import { countCommunicationsByIssue, deleteCommunication, getCommunicationsByIssue, saveCommunication } from '../db/communicationRepository';
import { countReferencesByIssue, deleteReference, getReferencesByIssue, saveReference } from '../db/referenceRepository';
import { getAllOfficers } from '../db/officerRepository';
import { countMilestonesByIssue, getMilestonesByIssue } from '../db/milestoneRepository';
import { countSummaryVersions, deleteSummaryVersion, getLatestSummary, getSummaryVersions, saveSummaryVersion } from '../db/summaryRepository';
import { countNotesByIssue, deleteNote, getNotesByIssue, saveNote } from '../db/noteRepository';
import { useToast } from '../components/common/ToastProvider';
import { formatDateTime, formatDisplayDate, todayISO, tomorrowISO } from '../utils/dateUtils';
import { ISSUE_RECURRENCE_TYPES, ISSUE_STATUSES } from '../constants/issueConstants';
import { useAuth } from '../features/auth/AuthContext';
import AdaptiveSelect from '../components/common/AdaptiveSelect';
import { getIssueAccessLevel } from '../features/collaboration/accessApi';
import UnsavedChangesGuard from '../components/common/UnsavedChangesGuard';
import { dataSectionForIssueTab, loadedSectionsToRefresh, recordCountForIssueTab } from '../utils/issueWorkspaceLoading';
import { handleTabListKeyDown } from '../utils/tabKeyboardUtils';

const tabs = [
  { label: 'Current Position', mobileLabel: 'Position' },
  { label: 'Running Summary', mobileLabel: 'Summary' },
  { label: 'Casework', mobileLabel: 'Casework' },
  { label: 'References', mobileLabel: 'References' },
  { label: 'Record of Communication', mobileLabel: 'Comms' },
  { label: 'Share & Access', mobileLabel: 'Access' },
];

export default function IssueWorkspacePage() {
  const { issueId } = useParams();
  const auth = useAuth();
  const { showToast } = useToast();
  const loadedSectionsRef = useRef(new Set());
  const [state, setState] = useState({
    loading: true,
    saveStatus: 'idle',
    error: '',
    issue: null,
    officers: [],
    communications: [],
    references: [],
    notes: [],
    recordCounts: { communications: 0, references: 0, notes: 0 },
    sectionStatus: { casework: 'idle', references: 'idle', communications: 'idle' },
    sectionErrors: {},
    milestones: [],
    milestoneCount: 0,
    milestonesExpanded: false,
    loadingMilestones: false,
    latestSummary: null,
    summaryVersions: [],
    summaryVersionCount: 0,
    summariesExpanded: false,
    loadingSummaries: false,
    draft: null,
    dirty: false,
    dirtySections: {},
    pendingTab: '',
    activeTab: 'Current Position',
    caseworkView: 'notes',
    draftingVisited: false,
    draftSeedNoteIds: [],
    draftSeedCommunicationIds: [],
    draftSeedReferenceIds: [],
    draftSeedRevision: 0,
    draftSourceNoteId: '',
    operation: '',
    confirmArchive: false,
    deleteTarget: null,
    accessLevel: 'editor',
  });

  const setSectionDirty = useCallback((section, dirty) => {
    setState((current) => {
      if (Boolean(current.dirtySections[section]) === Boolean(dirty)) return current;
      const dirtySections = { ...current.dirtySections };
      if (dirty) dirtySections[section] = true;
      else delete dirtySections[section];
      return { ...current, dirtySections };
    });
  }, []);
  const setSummaryDirty = useCallback((dirty) => setSectionDirty('summary', dirty), [setSectionDirty]);
  const setNotesDirty = useCallback((dirty) => setSectionDirty('notes', dirty), [setSectionDirty]);
  const setDraftingDirty = useCallback((dirty) => setSectionDirty('drafting', dirty), [setSectionDirty]);
  const setReferencesDirty = useCallback((dirty) => setSectionDirty('references', dirty), [setSectionDirty]);
  const setCommunicationsDirty = useCallback((dirty) => setSectionDirty('communications', dirty), [setSectionDirty]);

  const loadCore = useCallback(async () => {
    try {
      const [issue, officers, communicationCount, referenceCount, noteCount, milestones, milestoneCount, latestSummary, summaryVersionCount, accessLevel] = await Promise.all([
        getIssueById(issueId),
        getAllOfficers(),
        countCommunicationsByIssue(issueId),
        countReferencesByIssue(issueId),
        countNotesByIssue(issueId),
        getMilestonesByIssue(issueId, { limit: 5 }),
        countMilestonesByIssue(issueId),
        getLatestSummary(issueId),
        countSummaryVersions(issueId),
        auth.workspace?.id && auth.workspace.division_access_enabled
          ? getIssueAccessLevel(auth.workspace.id, issueId)
          : Promise.resolve(auth.canEdit ? 'editor' : 'viewer'),
      ]);
      if (!issue) throw new Error('Issue not found.');
      setState((current) => ({
        ...current,
        loading: false,
        error: '',
        issue,
        officers,
        recordCounts: { communications: communicationCount, references: referenceCount, notes: noteCount },
        milestones,
        milestoneCount,
        milestonesExpanded: false,
        latestSummary,
        summaryVersions: latestSummary ? [latestSummary] : [],
        summaryVersionCount,
        summariesExpanded: false,
        draft: {
          status: issue.status,
          assignedOfficerId: issue.assignedOfficerId || '',
          currentPosition: '',
          recurrenceType: issue.recurrenceType || '',
          nextAppearanceDate: issue.nextAppearanceDate || '',
          recurrenceAnchorDay: issue.recurrenceAnchorDay || null,
        },
        dirty: current.dirty,
        draftingVisited:
          current.draftingVisited ||
          (current.activeTab === 'Casework' &&
            current.caseworkView === 'drafting'),
        accessLevel,
      }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [auth.canEdit, auth.workspace?.division_access_enabled, auth.workspace?.id, issueId]);

  const loadSection = useCallback(async (section, { force = false } = {}) => {
    if (!force && loadedSectionsRef.current.has(section)) return;
    setState((current) => ({
      ...current,
      sectionStatus: { ...current.sectionStatus, [section]: 'loading' },
      sectionErrors: { ...current.sectionErrors, [section]: '' },
    }));
    try {
      if (section === 'casework') {
        const [notes, communications, references] = await Promise.all([
          getNotesByIssue(issueId),
          getCommunicationsByIssue(issueId),
          getReferencesByIssue(issueId),
        ]);
        loadedSectionsRef.current.add('casework');
        loadedSectionsRef.current.add('communications');
        loadedSectionsRef.current.add('references');
        setState((current) => ({
          ...current,
          notes,
          communications,
          references,
          recordCounts: { communications: communications.length, references: references.length, notes: notes.length },
          sectionStatus: { ...current.sectionStatus, casework: 'loaded', communications: 'loaded', references: 'loaded' },
        }));
      } else if (section === 'communications') {
        const communications = await getCommunicationsByIssue(issueId);
        loadedSectionsRef.current.add(section);
        setState((current) => ({
          ...current,
          communications,
          recordCounts: { ...current.recordCounts, communications: communications.length },
          sectionStatus: { ...current.sectionStatus, communications: 'loaded' },
        }));
      } else {
        const references = await getReferencesByIssue(issueId);
        loadedSectionsRef.current.add(section);
        setState((current) => ({
          ...current,
          references,
          recordCounts: { ...current.recordCounts, references: references.length },
          sectionStatus: { ...current.sectionStatus, references: 'loaded' },
        }));
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        sectionStatus: { ...current.sectionStatus, [section]: 'error' },
        sectionErrors: { ...current.sectionErrors, [section]: error.message || 'Unable to load this section.' },
      }));
    }
  }, [issueId]);

  useEffect(() => {
    loadedSectionsRef.current = new Set();
    setState((current) => ({
      ...current,
      loading: true,
      communications: [],
      references: [],
      notes: [],
      sectionStatus: { casework: 'idle', references: 'idle', communications: 'idle' },
      sectionErrors: {},
      dirty: false,
      dirtySections: {},
    }));
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    const section = dataSectionForIssueTab(state.activeTab);
    if (section) loadSection(section);
  }, [loadSection, state.activeTab]);

  useEffect(() => {
    const handleSync = async () => {
      await loadCore();
      await Promise.all(loadedSectionsToRefresh(loadedSectionsRef.current).map((section) => loadSection(section, { force: true })));
    };
    window.addEventListener('swm:workspace-synced', handleSync);
    return () => window.removeEventListener('swm:workspace-synced', handleSync);
  }, [loadCore, loadSection]);

  const selectTab = (tab) => {
    if (tab !== state.activeTab && Object.keys(state.dirtySections).length) {
      setState((current) => ({ ...current, pendingTab: tab }));
      return;
    }
    setState((current) => ({
      ...current,
      activeTab: tab,
      draftingVisited: current.draftingVisited,
    }));
  };

  const discardSectionChangesAndSwitch = () => {
    setState((current) => ({
      ...current,
      activeTab: current.pendingTab || current.activeTab,
      pendingTab: '',
      dirtySections: {},
    }));
  };

  const selectCaseworkView = (view) => {
    setState((current) => ({
      ...current,
      caseworkView: view,
      draftingVisited: current.draftingVisited || view === 'drafting',
    }));
  };

  const updateDraft = (field, value) => {
    setState((current) => ({ ...current, dirty: true, draft: { ...current.draft, [field]: value } }));
  };

  const updateScheduleDraft = (updates) => {
    setState((current) => ({ ...current, dirty: true, draft: { ...current.draft, ...updates } }));
  };

  const saveWorkflow = async (event) => {
    event.preventDefault();
    try {
      setState((current) => ({ ...current, saveStatus: 'saving' }));
      const assignmentChanged = state.draft.assignedOfficerId !== state.issue.assignedOfficerId;
      const saved = await updateIssuePosition(issueId, {
        ...state.issue,
        ...state.draft,
        positionNote: state.draft.currentPosition,
        assignedOn: assignmentChanged ? (state.draft.assignedOfficerId ? todayISO() : '') : state.issue.assignedOn,
      });
      const [milestones, milestoneCount] = await Promise.all([
        getMilestonesByIssue(issueId, { limit: 5 }),
        countMilestonesByIssue(issueId),
      ]);
      setState((current) => ({
        ...current,
        issue: saved,
        draft: {
          status: saved.status,
          assignedOfficerId: saved.assignedOfficerId || '',
          currentPosition: '',
          recurrenceType: saved.recurrenceType || '',
          nextAppearanceDate: saved.nextAppearanceDate || '',
          recurrenceAnchorDay: saved.recurrenceAnchorDay || null,
        },
        dirty: false,
        saveStatus: 'saved',
        milestones,
        milestoneCount,
        milestonesExpanded: false,
      }));
      showToast(saved.isScheduled ? `Issue scheduled to return on ${formatDisplayDate(saved.nextAppearanceDate)}.` : 'Issue updated.');
      window.setTimeout(() => setState((current) => ({ ...current, saveStatus: 'idle' })), 1200);
    } catch (error) {
      setState((current) => ({ ...current, saveStatus: 'idle' }));
      showToast(error.validationErrors?.nextAppearanceDate || error.message || 'Unable to update Issue.', 'error');
    }
  };

  const loadAllMilestones = async () => {
    setState((current) => ({ ...current, loadingMilestones: true }));
    try {
      const milestones = await getMilestonesByIssue(issueId);
      setState((current) => ({ ...current, milestones, milestonesExpanded: true, loadingMilestones: false }));
    } catch (error) {
      setState((current) => ({ ...current, loadingMilestones: false }));
      showToast(error.message || 'Unable to load position history.', 'error');
    }
  };

  const refreshRecordSection = async (section) => {
    const target = loadedSectionsRef.current.has('casework') ? 'casework' : section;
    await loadSection(target, { force: true });
  };

  const saveCommunicationEntry = async (communication) => {
    try {
      await saveCommunication({ ...communication, issueId });
      showToast(communication.id ? 'Communication updated.' : 'Communication added.');
      await refreshRecordSection('communications');
    } catch (error) {
      showToast(error.message || 'Unable to save communication.', 'error');
      throw error;
    }
  };

  const saveRunningSummary = async (summary) => {
    try {
      const saved = await saveSummaryVersion({ ...summary, issueId });
      const summaryVersionCount = await countSummaryVersions(issueId);
      setState((current) => ({
        ...current,
        latestSummary: saved,
        summaryVersions: [saved],
        summaryVersionCount,
        summariesExpanded: false,
      }));
      showToast('Running summary saved as a new version.');
      return saved;
    } catch (error) {
      showToast(error.message || 'Unable to save running summary.', 'error');
      throw error;
    }
  };

  const loadAllSummaries = async () => {
    setState((current) => ({ ...current, loadingSummaries: true }));
    try {
      const summaryVersions = await getSummaryVersions(issueId);
      setState((current) => ({ ...current, summaryVersions, summariesExpanded: true, loadingSummaries: false }));
    } catch (error) {
      setState((current) => ({ ...current, loadingSummaries: false }));
      showToast(error.message || 'Unable to load summary history.', 'error');
    }
  };

  const saveReferenceEntry = async (reference) => {
    try {
      await saveReference({ ...reference, issueId });
      showToast(reference.id ? 'Reference updated.' : 'Reference added.');
      await refreshRecordSection('references');
    } catch (error) {
      showToast(error.message || 'Unable to save reference.', 'error');
      throw error;
    }
  };

  const saveNoteEntry = async (note) => {
    try {
      await saveNote(note);
      const notes = await getNotesByIssue(issueId);
      setState((current) => ({
        ...current,
        notes,
        recordCounts: { ...current.recordCounts, notes: notes.length },
      }));
      showToast(note.id ? 'Note updated; the earlier version remains in history.' : 'Note added.');
    } catch (error) {
      showToast(error.message || 'Unable to save note.', 'error');
      throw error;
    }
  };

  const createDraftFromNote = (note) => {
    setState((current) => ({
      ...current,
      activeTab: 'Casework',
      caseworkView: 'drafting',
      draftingVisited: true,
      draftSeedNoteIds: [note.id],
      draftSeedCommunicationIds: [...note.linkedCommunicationIds],
      draftSeedReferenceIds: [...note.linkedReferenceIds],
      draftSeedRevision: current.draftSeedRevision + 1,
      draftSourceNoteId: note.id,
    }));
    showToast(`Preparing a communication from Note ${note.sequence}.`);
  };

  const confirmDelete = async () => {
    const target = state.deleteTarget;
    if (!target) return;
    try {
      if (target.kind === 'communication') await deleteCommunication(target.item.id);
      else if (target.kind === 'reference') await deleteReference(target.item.id);
      else if (target.kind === 'note') await deleteNote(target.item.id);
      else await deleteSummaryVersion(target.item.id);
      showToast(target.kind === 'communication' ? 'Communication deleted.' : target.kind === 'reference' ? 'Reference deleted.' : target.kind === 'note' ? `Note ${target.item.sequence} deleted.` : `Summary version ${target.item.version} deleted.`);
      setState((current) => ({ ...current, deleteTarget: null }));
      if (target.kind === 'summary') {
        await loadCore();
      } else {
        await refreshRecordSection(target.kind === 'communication' ? 'communications' : target.kind === 'reference' ? 'references' : 'casework');
      }
    } catch (error) {
      showToast(error.message || 'Unable to delete entry.', 'error');
    }
  };

  const toggleArchiveIssue = async () => {
    try {
      if (state.issue.isArchived) {
        await restoreIssue(issueId);
        showToast('Issue restored.');
      } else {
        await archiveIssue(issueId);
        showToast('Issue archived.');
      }
      setState((current) => ({ ...current, confirmArchive: false }));
      await loadCore();
    } catch (error) {
      showToast(error.message || `Unable to ${state.issue.isArchived ? 'restore' : 'archive'} Issue.`, 'error');
    }
  };

  const bringBack = async () => {
    try {
      setState((current) => ({ ...current, operation: 'bring-back' }));
      await bringBackIssue(issueId);
      showToast('Issue returned to the current register.');
      await loadCore();
    } catch (error) {
      showToast(error.message || 'Unable to return Issue.', 'error');
    } finally {
      setState((current) => ({ ...current, operation: '' }));
    }
  };

  const saveAccessPolicy = async (changes) => {
    const saved = await updateIssue(issueId, { ...state.issue, ...changes });
    setState((current) => ({ ...current, issue: saved }));
    showToast('Issue access updated.');
    return saved;
  };

  if (state.loading) return <LoadingState message="Loading Issue..." />;
  if (state.error) return <ErrorState message={state.error} />;

  const { issue, officers, draft } = state;
  const assignedOfficer = officers.find((officer) => officer.id === issue.assignedOfficerId);
  const canEditIssue = auth.canEdit && state.accessLevel === 'editor';

  return (
    <>
      <PageHeader
        title={issue.shortTitle}
        actions={
          <>
            <Link to="/issues" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><ArrowLeft className="h-4 w-4" />Issues</Link>
            {canEditIssue && <Link to={`/issues/${issue.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><Pencil className="h-4 w-4" />Edit details</Link>}
          </>
        }
      />
      {!canEditIssue && <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-950">Viewing access only. You can inspect the complete Issue record, but changes are disabled.</div>}

      <div className="mb-4 border-b border-[#d7e3e1] pb-3">
        <div className="issue-tabs-mobile grid grid-cols-3 gap-1.5" role="tablist" aria-label="Issue workspace" onKeyDown={handleTabListKeyDown}>
          {tabs.map((tab) => {
            const count = recordCountForIssueTab(tab.label, state.recordCounts, state.summaryVersionCount);
            const active = state.activeTab === tab.label;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(tab.label)}
                className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-xs font-semibold leading-4 transition-colors ${
                  active
                    ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{tab.mobileLabel}</span>
                {count !== null && <span className={`shrink-0 rounded px-1 py-0.5 text-xs tabular-nums ${active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="issue-tabs-desktop min-w-max gap-1" role="tablist" aria-label="Issue workspace" onKeyDown={handleTabListKeyDown}>
          {tabs.map((tab) => {
            const count = recordCountForIssueTab(tab.label, state.recordCounts, state.summaryVersionCount);
            return (
              <button key={tab.label} type="button" role="tab" aria-selected={state.activeTab === tab.label} tabIndex={state.activeTab === tab.label ? 0 : -1} onClick={() => selectTab(tab.label)} className={`border-b-2 px-3 py-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${state.activeTab === tab.label ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {tab.label}{count !== null && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {state.activeTab === 'Current Position' && (
        <CurrentPositionTab
          issue={issue}
          officers={officers}
          draft={draft}
          dirty={state.dirty}
          saveStatus={state.saveStatus}
          milestones={state.milestones}
          milestoneCount={state.milestoneCount}
          milestonesExpanded={state.milestonesExpanded}
          loadingMilestones={state.loadingMilestones}
          readOnly={!canEditIssue}
          onUpdate={updateDraft}
          onUpdateSchedule={updateScheduleDraft}
          onSave={saveWorkflow}
          operation={state.operation}
          onArchive={() => setState((current) => ({ ...current, confirmArchive: true }))}
          onLoadAllMilestones={loadAllMilestones}
          onCollapseMilestones={() => setState((current) => ({ ...current, milestones: current.milestones.slice(0, 5), milestonesExpanded: false }))}
          onBringBack={bringBack}
        />
      )}
      {state.activeTab === 'Running Summary' && (
        <RunningSummaryPanel
          issueId={issueId}
          issueTitle={issue.shortTitle}
          latestSummary={state.latestSummary}
          versionCount={state.summaryVersionCount}
          versions={state.summaryVersions}
          expanded={state.summariesExpanded}
          loading={state.loadingSummaries}
          currentPosition={issue.currentPosition}
          readOnly={!canEditIssue}
          onSave={saveRunningSummary}
          onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'summary', item } }))}
          onLoadAll={loadAllSummaries}
          onCollapse={() => setState((current) => ({ ...current, summaryVersions: current.latestSummary ? [current.latestSummary] : [], summariesExpanded: false }))}
          onDirtyChange={setSummaryDirty}
        />
      )}
      {state.activeTab === 'Record of Communication' && (
        <SectionGate status={state.sectionStatus.communications} error={state.sectionErrors.communications} label="communications" onRetry={() => loadSection('communications', { force: true })}>
          <CommunicationTab issueId={issueId} communications={state.communications} readOnly={!canEditIssue} onSave={saveCommunicationEntry} onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'communication', item } }))} onDirtyChange={setCommunicationsDirty} />
        </SectionGate>
      )}
      {state.activeTab === 'References' && (
        <SectionGate status={state.sectionStatus.references} error={state.sectionErrors.references} label="references" onRetry={() => loadSection('references', { force: true })}>
          <ReferenceTab issueId={issueId} references={state.references} readOnly={!canEditIssue} onSave={saveReferenceEntry} onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'reference', item } }))} onDirtyChange={setReferencesDirty} />
        </SectionGate>
      )}
      {state.activeTab === 'Casework' && (
        <SectionGate status={state.sectionStatus.casework} error={state.sectionErrors.casework} label="casework records" onRetry={() => loadSection('casework', { force: true })}>
          <CaseworkWorkspace view={state.caseworkView} notes={state.notes} communications={state.communications} onChangeView={selectCaseworkView}>
          <div hidden={state.caseworkView !== 'notes'}>
            <NotingPanel
              issueId={issueId}
              issue={issue}
              summary={state.latestSummary}
              notes={state.notes}
              communications={state.communications}
              references={state.references}
              author={{
                userId: auth.user?.id || '',
                name: auth.profile?.display_name || auth.user?.email || 'Local officer',
              }}
              readOnly={!canEditIssue}
              onSave={saveNoteEntry}
              onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'note', item } }))}
              onCreateDraft={createDraftFromNote}
              onDirtyChange={setNotesDirty}
            />
          </div>
          {state.draftingVisited && (
            <div hidden={state.caseworkView !== 'drafting'}>
              <DraftingWorkspace
                issue={issue}
                assignedOfficer={assignedOfficer}
                officers={officers}
                summary={state.latestSummary}
                communications={state.communications}
                references={state.references}
                notes={state.notes}
                initialNoteIds={state.draftSeedNoteIds}
                initialCommunicationIds={state.draftSeedCommunicationIds}
                initialReferenceIds={state.draftSeedReferenceIds}
                sourceNoteId={state.draftSourceNoteId}
                noteSelectionRevision={state.draftSeedRevision}
                readOnly={!canEditIssue}
                onSaveCommunication={saveCommunicationEntry}
                onDirtyChange={setDraftingDirty}
              />
            </div>
          )}
          </CaseworkWorkspace>
        </SectionGate>
      )}
      {state.activeTab === 'Share & Access' && <IssueAccessPanel auth={auth} issue={issue} canEdit={canEditIssue} onUpdateIssue={saveAccessPolicy} />}

      <UnsavedChangesGuard
        when={state.dirty || Object.keys(state.dirtySections).length > 0}
        message="The current Issue contains changes that have not been saved. Leaving now will discard them."
      />

      <ConfirmDialog
        open={Boolean(state.pendingTab)}
        title="Switch sections without saving?"
        message="Changes in the current section have not been saved. Switching sections will discard them."
        confirmLabel="Discard and switch"
        destructive
        onCancel={() => setState((current) => ({ ...current, pendingTab: '' }))}
        onConfirm={discardSectionChangesAndSwitch}
      />

      <ConfirmDialog open={state.confirmArchive} title={issue.isArchived ? 'Restore Issue?' : 'Archive Issue?'} message={issue.isArchived ? 'The Issue will return to the current register.' : 'The Issue will be hidden from the current register but retained in the database.'} confirmLabel={issue.isArchived ? 'Restore' : 'Archive'} onCancel={() => setState((current) => ({ ...current, confirmArchive: false }))} onConfirm={toggleArchiveIssue} />
      <ConfirmDialog
        open={Boolean(state.deleteTarget)}
        title={state.deleteTarget?.kind === 'communication' ? 'Delete communication?' : state.deleteTarget?.kind === 'reference' ? 'Delete reference?' : state.deleteTarget?.kind === 'note' ? `Delete Note ${state.deleteTarget?.item?.sequence || ''}?` : `Delete summary version ${state.deleteTarget?.item?.version || ''}?`}
        message={state.deleteTarget?.kind === 'summary' ? 'This saved version will be permanently removed. If it is the latest version, the preceding version will become the current running summary.' : state.deleteTarget?.kind === 'note' ? 'This note and its saved revision history will be permanently removed from the Issue. Other note numbers will remain unchanged.' : 'This entry will be permanently removed from the Issue.'}
        confirmLabel="Delete"
        destructive
        onCancel={() => setState((current) => ({ ...current, deleteTarget: null }))}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SectionGate({ status, error, label, onRetry, children }) {
  if (status === 'error') {
    return (
      <div className="surface flex min-h-44 flex-col items-center justify-center px-4 py-8 text-center" role="alert">
        <p className="text-sm font-semibold text-red-800">Could not load {label}.</p>
        <p className="mt-1 max-w-lg text-xs leading-5 text-slate-600">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Try again</button>
      </div>
    );
  }
  if (status !== 'loaded') {
    return (
      <div className="surface flex min-h-44 items-center justify-center px-4 py-8" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin text-teal-700" />Loading {label}...</div>
      </div>
    );
  }
  return children;
}

function CaseworkWorkspace({
  view,
  notes,
  communications,
  onChangeView,
  children,
}) {
  const issued = communications.some((item) => item.draftId);
  return (
    <div className="space-y-4">
      <section className={`surface overflow-hidden rounded-md border-t-4 ${view === 'notes' ? 'border-t-indigo-600' : 'border-t-teal-600'}`}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-[#17333b]">Casework</h2>
            <p className="mt-1 text-sm text-slate-600">
              Examine the matter, record the internal view and prepare the
              communication.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <span className={view === 'notes' ? 'text-indigo-700' : 'text-slate-500'}>
              Examination
            </span>
            <span aria-hidden="true">→</span>
            <span className={view === 'drafting' ? 'text-teal-700' : 'text-slate-500'}>
              Communication
            </span>
            <span aria-hidden="true">→</span>
            <span className={issued ? 'text-emerald-700' : 'text-slate-400'}>
              Issued
            </span>
          </div>
        </div>
        <div
          className={`grid grid-cols-2 gap-1 p-1.5 ${view === 'notes' ? 'bg-indigo-50/60' : 'bg-teal-50/60'}`}
          role="tablist"
          aria-label="Casework"
          onKeyDown={handleTabListKeyDown}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'notes'}
            tabIndex={view === 'notes' ? 0 : -1}
            onClick={() => onChangeView('notes')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold sm:text-sm ${
              view === 'notes'
                ? 'bg-white text-indigo-800 shadow-sm ring-1 ring-indigo-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-indigo-800'
            }`}
          >
            <MessageSquareText className="h-4 w-4" />
            Examine and Note
            {notes.length > 0 && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] tabular-nums text-indigo-700">
                {notes.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'drafting'}
            tabIndex={view === 'drafting' ? 0 : -1}
            onClick={() => onChangeView('drafting')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold sm:text-sm ${
              view === 'drafting'
                ? 'bg-white text-teal-800 shadow-sm ring-1 ring-teal-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-teal-800'
            }`}
          >
            <FilePenLine className="h-4 w-4" />
            Prepare Communication
          </button>
        </div>
      </section>
      {children}
    </div>
  );
}

function CurrentPositionTab({ issue, officers, draft, dirty, saveStatus, operation, milestones, milestoneCount, milestonesExpanded, loadingMilestones, readOnly, onUpdate, onUpdateSchedule, onSave, onArchive, onLoadAllMilestones, onCollapseMilestones, onBringBack }) {
  const assignedOfficer = officers.find((officer) => officer.id === issue.assignedOfficerId);
  return (
    <div className="space-y-4">
      <form onSubmit={onSave}>
        <fieldset disabled={readOnly} className="surface overflow-hidden rounded-md border-t-4 border-t-teal-600 p-4 disabled:opacity-85 sm:p-5">
        {issue.isScheduled && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-900"><CalendarClock className="h-4 w-4" />Scheduled to return {formatDisplayDate(issue.nextAppearanceDate)}</div>
            <button type="button" onClick={onBringBack} disabled={operation === 'bring-back'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-300 bg-white px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-70 sm:h-9 sm:w-auto">{operation === 'bring-back' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}{operation === 'bring-back' ? 'Returning Issue...' : 'Bring back now'}</button>
          </div>
        )}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#dce6e4] pb-4">
          <div><h2 className="text-base font-semibold text-[#17333b]">Current position</h2><p className="mt-1 text-sm text-slate-600">Keep the allocation, stage and latest position up to date.</p></div>
          <StatusBadge status={draft.status} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Stage" value={draft.status} options={ISSUE_STATUSES} onChange={(value) => onUpdate('status', value)} />
          <div><AdaptiveSelect label="Assigned officer" value={draft.assignedOfficerId} onChange={(value) => onUpdate('assignedOfficerId', value)} options={officers.map((officer) => ({ value: officer.id, label: officer.designation ? `${officer.name} - ${officer.designation}` : officer.name }))} placeholder="Not assigned" />{!officers.length && <Link to="/settings" className="mt-1 block text-xs font-semibold text-teal-700 hover:underline">Add officers in Settings</Link>}</div>
        </div>
        <label className="mt-4 block"><span className="mb-1 block text-sm font-medium text-slate-700">Add position note</span><textarea value={draft.currentPosition} onChange={(event) => onUpdate('currentPosition', event.target.value)} rows={6} placeholder="Record the next update, internal sub-stage or anything the next person needs to know." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" /></label>
        <details className="mt-4 rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-slate-700"><CalendarClock className="h-4 w-4 text-cyan-700" />Schedule return <span className="font-normal text-slate-500">(optional)</span></summary>
          <div className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2">
            <Select label="Return pattern" value={draft.recurrenceType} options={ISSUE_RECURRENCE_TYPES} includeBlank blankLabel="Does not repeat" onChange={(value) => onUpdateSchedule({ recurrenceType: value, nextAppearanceDate: value ? draft.nextAppearanceDate : '', recurrenceAnchorDay: null })} />
            {draft.recurrenceType && <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Next appearance date</span><input type="date" min={tomorrowISO()} value={draft.nextAppearanceDate} onChange={(event) => onUpdateSchedule({ nextAppearanceDate: event.target.value, recurrenceAnchorDay: null })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>}
            {draft.recurrenceType && <p className="text-xs leading-5 text-slate-500 sm:col-span-2">When this cycle is saved as Completed, the Issue will move to Scheduled and return as Pending on this date.</p>}
          </div>
        </details>
        {!readOnly && <div className="mt-4 flex justify-end"><SaveButton dirty={dirty} saveStatus={saveStatus} /></div>}
        </fieldset>
      </form>
      <MilestoneStack milestones={milestones} total={milestoneCount} expanded={milestonesExpanded} loading={loadingMilestones} onLoadAll={onLoadAllMilestones} onCollapse={onCollapseMilestones} />
      <DisclosureSection title="Issue details" description="Dates and optional administrative information.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="eFile number" value={issue.eFileNumber || 'Not set'} /><Item label="Subject type" value={issue.subjectType || 'Not specified'} /><Item label="Assigned to" value={assignedOfficer?.name || 'Not assigned'} /><Item label="Opened" value={formatDisplayDate(issue.dateOpened)} /><Item label="Last updated" value={formatDateTime(issue.updatedAt)} /><Item label="Organisation" value={issue.organisation || 'Not set'} /><Item label="Category" value={issue.category || 'Miscellaneous'} /><Item label="Deadline" value={formatDisplayDate(issue.nextDeadline)} />{issue.recurrenceType && <Item label="Return pattern" value={issue.recurrenceType} />}{issue.nextAppearanceDate && <Item label="Next appearance" value={formatDisplayDate(issue.nextAppearanceDate)} />}
        </dl>
        {!readOnly && <div className="mt-5 border-t border-[#dce6e4] pt-4"><button type="button" onClick={onArchive} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900">{issue.isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{issue.isArchived ? 'Restore Issue' : 'Archive Issue'}</button></div>}
      </DisclosureSection>
    </div>
  );
}

function SaveButton({ dirty, saveStatus }) {
  return <button type="submit" disabled={!dirty || saveStatus !== 'idle'} className={`inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:shadow-none ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300'}`}>{saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save update'}</button>;
}

function Select({ label, value, options, onChange, includeBlank = false, blankLabel = 'Select' }) { return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">{includeBlank && <option value="">{blankLabel}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Item({ label, value }) { return <div><dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="text-slate-800">{value}</dd></div>; }
