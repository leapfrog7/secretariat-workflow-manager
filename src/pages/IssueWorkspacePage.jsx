import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, CalendarClock, CheckCircle2, LoaderCircle, Pencil, RotateCcw, Save } from 'lucide-react';
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
import AIContextPreview from '../components/issues/AIContextPreview';
import { archiveIssue, bringBackIssue, getIssueById, restoreIssue, updateIssuePosition } from '../db/issueRepository';
import { deleteCommunication, getCommunicationsByIssue, saveCommunication } from '../db/communicationRepository';
import { deleteReference, getReferencesByIssue, saveReference } from '../db/referenceRepository';
import { getAllOfficers } from '../db/officerRepository';
import { countMilestonesByIssue, getMilestonesByIssue } from '../db/milestoneRepository';
import { countSummaryVersions, getLatestSummary, getSummaryVersions, saveSummaryVersion } from '../db/summaryRepository';
import { useToast } from '../components/common/ToastProvider';
import { formatDateTime, formatDisplayDate, todayISO, tomorrowISO } from '../utils/dateUtils';
import { ISSUE_RECURRENCE_TYPES, ISSUE_STATUSES } from '../constants/issueConstants';

const tabs = ['Current Position', 'Record of Communication', 'References', 'AI Context'];

export default function IssueWorkspacePage() {
  const { issueId } = useParams();
  const { showToast } = useToast();
  const [state, setState] = useState({
    loading: true,
    saveStatus: 'idle',
    error: '',
    issue: null,
    officers: [],
    communications: [],
    references: [],
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
    activeTab: 'Current Position',
    operation: '',
    confirmArchive: false,
    deleteTarget: null,
  });

  const load = async () => {
    try {
      const [issue, officers, communications, references, milestones, milestoneCount, latestSummary, summaryVersionCount] = await Promise.all([
        getIssueById(issueId),
        getAllOfficers(),
        getCommunicationsByIssue(issueId),
        getReferencesByIssue(issueId),
        getMilestonesByIssue(issueId, { limit: 5 }),
        countMilestonesByIssue(issueId),
        getLatestSummary(issueId),
        countSummaryVersions(issueId),
      ]);
      if (!issue) throw new Error('Issue not found.');
      setState((current) => ({
        ...current,
        loading: false,
        error: '',
        issue,
        officers,
        communications,
        references,
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
          currentPosition: issue.currentPosition || '',
          recurrenceType: issue.recurrenceType || '',
          nextAppearanceDate: issue.nextAppearanceDate || '',
          recurrenceAnchorDay: issue.recurrenceAnchorDay || null,
        },
        dirty: false,
      }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('swm:workspace-synced', load);
    return () => window.removeEventListener('swm:workspace-synced', load);
  }, [issueId]);

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
          currentPosition: saved.currentPosition || '',
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

  const saveCommunicationEntry = async (communication) => {
    try {
      await saveCommunication({ ...communication, issueId });
      showToast(communication.id ? 'Communication updated.' : 'Communication added.');
      await load();
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
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to save reference.', 'error');
      throw error;
    }
  };

  const confirmDelete = async () => {
    const target = state.deleteTarget;
    if (!target) return;
    try {
      if (target.kind === 'communication') await deleteCommunication(target.item.id);
      else await deleteReference(target.item.id);
      showToast(target.kind === 'communication' ? 'Communication deleted.' : 'Reference deleted.');
      setState((current) => ({ ...current, deleteTarget: null }));
      await load();
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
      await load();
    } catch (error) {
      showToast(error.message || `Unable to ${state.issue.isArchived ? 'restore' : 'archive'} Issue.`, 'error');
    }
  };

  const bringBack = async () => {
    try {
      setState((current) => ({ ...current, operation: 'bring-back' }));
      await bringBackIssue(issueId);
      showToast('Issue returned to the current register.');
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to return Issue.', 'error');
    } finally {
      setState((current) => ({ ...current, operation: '' }));
    }
  };

  if (state.loading) return <LoadingState message="Loading Issue..." />;
  if (state.error) return <ErrorState message={state.error} />;

  const { issue, officers, draft } = state;
  const assignedOfficer = officers.find((officer) => officer.id === issue.assignedOfficerId);

  return (
    <>
      <PageHeader
        title={issue.shortTitle}
        actions={
          <>
            <Link to="/issues" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><ArrowLeft className="h-4 w-4" />Issues</Link>
            <Link to={`/issues/${issue.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"><Pencil className="h-4 w-4" />Edit details</Link>
          </>
        }
      />

      <div className="mb-5 overflow-x-auto border-b border-[#d7e3e1]">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Issue workspace">
          {tabs.map((tab) => {
            const count = tab === 'Record of Communication' ? state.communications.length : tab === 'References' ? state.references.length : null;
            return (
              <button key={tab} type="button" role="tab" aria-selected={state.activeTab === tab} onClick={() => setState((current) => ({ ...current, activeTab: tab }))} className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${state.activeTab === tab ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {tab}{count !== null && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">{count}</span>}
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
          latestSummary={state.latestSummary}
          summaryVersions={state.summaryVersions}
          summaryVersionCount={state.summaryVersionCount}
          summariesExpanded={state.summariesExpanded}
          loadingSummaries={state.loadingSummaries}
          onUpdate={updateDraft}
          onUpdateSchedule={updateScheduleDraft}
          onSave={saveWorkflow}
          operation={state.operation}
          onArchive={() => setState((current) => ({ ...current, confirmArchive: true }))}
          onLoadAllMilestones={loadAllMilestones}
          onCollapseMilestones={() => setState((current) => ({ ...current, milestones: current.milestones.slice(0, 5), milestonesExpanded: false }))}
          onSaveSummary={saveRunningSummary}
          onLoadAllSummaries={loadAllSummaries}
          onCollapseSummaries={() => setState((current) => ({ ...current, summaryVersions: current.latestSummary ? [current.latestSummary] : [], summariesExpanded: false }))}
          onBringBack={bringBack}
        />
      )}
      {state.activeTab === 'Record of Communication' && <CommunicationTab issueId={issueId} communications={state.communications} onSave={saveCommunicationEntry} onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'communication', item } }))} />}
      {state.activeTab === 'References' && <ReferenceTab issueId={issueId} references={state.references} onSave={saveReferenceEntry} onDelete={(item) => setState((current) => ({ ...current, deleteTarget: { kind: 'reference', item } }))} />}
      {state.activeTab === 'AI Context' && <AIContextPreview issue={issue} assignedOfficer={assignedOfficer} officers={officers} summary={state.latestSummary} communications={state.communications} references={state.references} onSaveCommunication={saveCommunicationEntry} />}

      <ConfirmDialog open={state.confirmArchive} title={issue.isArchived ? 'Restore Issue?' : 'Archive Issue?'} message={issue.isArchived ? 'The Issue will return to the current register.' : 'The Issue will be hidden from the current register but retained in the database.'} confirmLabel={issue.isArchived ? 'Restore' : 'Archive'} onCancel={() => setState((current) => ({ ...current, confirmArchive: false }))} onConfirm={toggleArchiveIssue} />
      <ConfirmDialog open={Boolean(state.deleteTarget)} title={state.deleteTarget?.kind === 'communication' ? 'Delete communication?' : 'Delete reference?'} message="This entry will be permanently removed from the Issue." confirmLabel="Delete" destructive onCancel={() => setState((current) => ({ ...current, deleteTarget: null }))} onConfirm={confirmDelete} />
    </>
  );
}

function CurrentPositionTab({ issue, officers, draft, dirty, saveStatus, operation, milestones, milestoneCount, milestonesExpanded, loadingMilestones, latestSummary, summaryVersions, summaryVersionCount, summariesExpanded, loadingSummaries, onUpdate, onUpdateSchedule, onSave, onArchive, onLoadAllMilestones, onCollapseMilestones, onSaveSummary, onLoadAllSummaries, onCollapseSummaries, onBringBack }) {
  const assignedOfficer = officers.find((officer) => officer.id === issue.assignedOfficerId);
  return (
    <div className="space-y-4">
      <form onSubmit={onSave} className="surface overflow-hidden rounded-md border-t-4 border-t-teal-600 p-4 sm:p-5">
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
          <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Assigned officer</span><select value={draft.assignedOfficerId} onChange={(event) => onUpdate('assignedOfficerId', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">Not assigned</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}</select>{!officers.length && <Link to="/settings" className="mt-1 block text-xs font-semibold text-teal-700 hover:underline">Add officers in Settings</Link>}</label>
        </div>
        <label className="mt-4 block"><span className="mb-1 block text-sm font-medium text-slate-700">Notes / current position</span><textarea value={draft.currentPosition} onChange={(event) => onUpdate('currentPosition', event.target.value)} rows={6} placeholder="Record the latest position, internal sub-stage or anything the next person needs to know." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900" /></label>
        <details className="mt-4 rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-slate-700"><CalendarClock className="h-4 w-4 text-cyan-700" />Schedule return <span className="font-normal text-slate-500">(optional)</span></summary>
          <div className="grid gap-3 border-t border-slate-200 px-3 py-3 sm:grid-cols-2">
            <Select label="Return pattern" value={draft.recurrenceType} options={ISSUE_RECURRENCE_TYPES} includeBlank blankLabel="Does not repeat" onChange={(value) => onUpdateSchedule({ recurrenceType: value, nextAppearanceDate: value ? draft.nextAppearanceDate : '', recurrenceAnchorDay: null })} />
            {draft.recurrenceType && <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Next appearance date</span><input type="date" min={tomorrowISO()} value={draft.nextAppearanceDate} onChange={(event) => onUpdateSchedule({ nextAppearanceDate: event.target.value, recurrenceAnchorDay: null })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>}
            {draft.recurrenceType && <p className="text-xs leading-5 text-slate-500 sm:col-span-2">When this cycle is saved as Completed, the Issue will move to Scheduled and return as Pending on this date.</p>}
          </div>
        </details>
        <div className="mt-4 flex justify-end"><SaveButton dirty={dirty} saveStatus={saveStatus} /></div>
      </form>
      <RunningSummaryPanel latestSummary={latestSummary} versionCount={summaryVersionCount} versions={summaryVersions} expanded={summariesExpanded} loading={loadingSummaries} currentPosition={draft.currentPosition} onSave={onSaveSummary} onLoadAll={onLoadAllSummaries} onCollapse={onCollapseSummaries} />
      <MilestoneStack milestones={milestones} total={milestoneCount} expanded={milestonesExpanded} loading={loadingMilestones} onLoadAll={onLoadAllMilestones} onCollapse={onCollapseMilestones} />
      <DisclosureSection title="Issue details" description="Dates and optional administrative information.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="eFile number" value={issue.eFileNumber || 'Not set'} /><Item label="Subject type" value={issue.subjectType || 'Not specified'} /><Item label="Assigned to" value={assignedOfficer?.name || 'Not assigned'} /><Item label="Opened" value={formatDisplayDate(issue.dateOpened)} /><Item label="Last updated" value={formatDateTime(issue.updatedAt)} /><Item label="Organisation" value={issue.organisation || 'Not set'} /><Item label="Category" value={issue.category || 'Miscellaneous'} /><Item label="Deadline" value={formatDisplayDate(issue.nextDeadline)} />{issue.recurrenceType && <Item label="Return pattern" value={issue.recurrenceType} />}{issue.nextAppearanceDate && <Item label="Next appearance" value={formatDisplayDate(issue.nextAppearanceDate)} />}
        </dl>
        <div className="mt-5 border-t border-[#dce6e4] pt-4"><button type="button" onClick={onArchive} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900">{issue.isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{issue.isArchived ? 'Restore Issue' : 'Archive Issue'}</button></div>
      </DisclosureSection>
    </div>
  );
}

function SaveButton({ dirty, saveStatus }) {
  return <button type="submit" disabled={!dirty || saveStatus !== 'idle'} className={`inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:shadow-none ${saveStatus === 'saved' ? 'bg-emerald-700' : 'bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300'}`}>{saveStatus === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save update'}</button>;
}

function Select({ label, value, options, onChange, includeBlank = false, blankLabel = 'Select' }) { return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">{includeBlank && <option value="">{blankLabel}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Item({ label, value }) { return <div><dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="text-slate-800">{value}</dd></div>; }
