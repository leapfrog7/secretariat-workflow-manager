import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  ClipboardList,
  MessageCircleQuestion,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import SearchInput from "../components/common/SearchInput";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ModalFrame from "../components/common/ModalFrame";
import FilterBar from "../components/issues/FilterBar";
import IssueTable from "../components/issues/IssueTable";
import IssueCard from "../components/issues/IssueCard";
import QuickPositionDialog from "../components/issues/QuickPositionDialog";
import QuickStageDialog from "../components/issues/QuickStageDialog";
import {
  archiveIssue,
  bringBackIssue,
  correctCurrentIssuePosition,
  getAllIssues,
  permanentlyDeleteIssue,
  restoreIssue,
  updateIssuePosition,
} from "../db/issueRepository";
import { getMilestonesByIssue } from "../db/milestoneRepository";
import { getAllOfficers } from "../db/officerRepository";
import { issueMatchesSearch } from "../utils/issueUtils";
import { getDeadlineState, isStaleIssue } from "../utils/dateUtils";
import { useToast } from "../components/common/ToastProvider";
import { isScheduledIssue } from "../utils/scheduleUtils";
import { getAllCommunications } from "../db/communicationRepository";
import { getCommunicationSearchContext } from "../utils/communicationUtils";
import { useAuth } from "../features/auth/AuthContext";
import { listDivisions } from "../features/collaboration/accessApi";
import { findCurrentPositionMilestone } from "../utils/positionUpdateUtils";

const defaultFilters = {
  query: "",
  focus: "",
  status: "",
  divisionId: "",
  archiveMode: "Current",
  sort: "Recently updated",
};

const ARCHIVED_PAGE_SIZES = [25, 50, 100];

const FOCUS_VIEWS = {
  pending: "Pending",
  overdue: "Overdue",
  "due-soon": "Due soon",
  awaiting: "Awaiting response",
  "high-priority": "High priority",
  stale: "Needs an update",
};

function matchesFocusView(issue, focus) {
  if (focus === "pending") return issue.status === "Pending";
  if (focus === "overdue") return getDeadlineState(issue) === "overdue";
  if (focus === "due-soon") return ["today", "upcoming"].includes(getDeadlineState(issue));
  if (focus === "awaiting") return ["Awaiting Input", "Awaiting Discussion"].includes(issue.status);
  if (focus === "high-priority") return ["High", "Critical"].includes(issue.priority);
  if (focus === "stale") return isStaleIssue(issue);
  return true;
}

function useMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = (event) => setMobile(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mobile;
}

function resetAdvancedFilterValues(current) {
  return {
    ...defaultFilters,
    query: current.query,
    archiveMode: current.archiveMode,
    sort: current.archiveMode === "Scheduled" ? "Next appearance" : defaultFilters.sort,
  };
}

export default function IssueRegisterPage() {
  const auth = useAuth();
  const mobileLayout = useMobileLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFocus = searchParams.get("focus") || "";
  const focusView = FOCUS_VIEWS[requestedFocus] ? requestedFocus : "";
  const { showToast } = useToast();
  const [data, setData] = useState({
    loading: true,
    error: "",
    issues: [],
    officers: [],
    communications: [],
    divisions: [],
  });
  const [filters, setFilters] = useState(() => ({ ...defaultFilters, focus: focusView }));
  const [filterDraft, setFilterDraft] = useState(() => ({ ...defaultFilters, focus: focusView }));
  const [showFilters, setShowFilters] = useState(() => Boolean(focusView && !window.matchMedia("(max-width: 639px)").matches));
  const [workingId, setWorkingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [quickPosition, setQuickPosition] = useState(null);
  const [quickStage, setQuickStage] = useState(null);

  useEffect(() => {
    setFilters((current) => current.focus === focusView ? current : { ...current, focus: focusView });
    if (focusView && !mobileLayout) setShowFilters(true);
  }, [focusView, mobileLayout]);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedPageSize, setArchivedPageSize] = useState(
    ARCHIVED_PAGE_SIZES[0],
  );

  const load = async () => {
    try {
      const [issues, officers, communications, divisions] = await Promise.all([
        getAllIssues(),
        getAllOfficers(),
        getAllCommunications(),
        auth.workspace?.id
          ? listDivisions(auth.workspace.id)
          : Promise.resolve([]),
      ]);
      setData({
        loading: false,
        error: "",
        issues,
        officers,
        communications,
        divisions,
      });
    } catch (error) {
      setData({
        loading: false,
        error: error.message,
        issues: [],
        officers: [],
        communications: [],
        divisions: [],
      });
    }
  };

  useEffect(() => {
    load();
    const handleSync = () => load();
    window.addEventListener("swm:issues-synced", handleSync);
    return () => window.removeEventListener("swm:issues-synced", handleSync);
  }, [auth.workspace?.id]);

  const summary = useMemo(() => {
    const current = data.issues.filter(
      (issue) => !issue.isArchived && !isScheduledIssue(issue),
    );
    const scheduled = data.issues.filter(isScheduledIssue);
    return {
      total: current.length,
      pending: current.filter((issue) => issue.status === "Pending").length,
      overdue: current.filter((issue) => getDeadlineState(issue) === "overdue")
        .length,
      inProgress: current.filter((issue) => issue.status === "In Progress")
        .length,
      awaitingDiscussion: current.filter(
        (issue) => issue.status === "Awaiting Discussion",
      ).length,
      archived: data.issues.filter((issue) => issue.isArchived).length,
      scheduled: scheduled.length,
    };
  }, [data.issues]);

  const communicationsByIssue = useMemo(() => {
    const grouped = new Map();
    data.communications.forEach((communication) => {
      const entries = grouped.get(communication.issueId) || [];
      entries.push(communication);
      grouped.set(communication.issueId, entries);
    });
    return grouped;
  }, [data.communications]);

  const restore = async (issue) => {
    try {
      setWorkingId(issue.id);
      await restoreIssue(issue.id);
      showToast("Issue restored to the current register.");
      await load();
    } catch (error) {
      showToast(error.message || "Unable to restore Issue.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const bringBack = async (issue) => {
    try {
      setWorkingId(issue.id);
      await bringBackIssue(issue.id);
      showToast("Issue returned to the current register.");
      await load();
    } catch (error) {
      showToast(error.message || "Unable to return Issue.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const archive = async (issue) => {
    try {
      setWorkingId(issue.id);
      await archiveIssue(issue.id);
      showToast("Issue moved to Archive.");
      await load();
    } catch (error) {
      showToast(error.message || "Unable to archive Issue.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const deleteIssue = async () => {
    if (!deleteTarget) return;
    try {
      setWorkingId(deleteTarget.id);
      await permanentlyDeleteIssue(deleteTarget.id);
      showToast("Issue permanently deleted.");
      setDeleteTarget(null);
      await load();
    } catch (error) {
      showToast(error.message || "Unable to delete Issue.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const openQuickPosition = async (issue) => {
    setQuickPosition({
      issue,
      latestMilestone: null,
      historyLoading: true,
      saveStatus: "idle",
      error: "",
    });
    try {
      const milestones = await getMilestonesByIssue(issue.id);
      const latestMilestone = findCurrentPositionMilestone(
        milestones,
        issue.currentPosition,
      );
      setQuickPosition((current) =>
        current?.issue.id === issue.id
          ? { ...current, latestMilestone, historyLoading: false }
          : current,
      );
    } catch {
      setQuickPosition((current) =>
        current?.issue.id === issue.id
          ? { ...current, historyLoading: false }
          : current,
      );
    }
  };

  const saveQuickPosition = async ({
    mode,
    note,
    status,
    recordedDate,
  }) => {
    const target = quickPosition?.issue;
    if (!target || !note) return;
    setWorkingId(target.id);
    setQuickPosition((current) => ({
      ...current,
      saveStatus: "saving",
      error: "",
    }));
    try {
      const saved =
        mode === "correct"
          ? await correctCurrentIssuePosition(target.id, note)
          : await updateIssuePosition(target.id, {
              positionNote: note,
              status,
              positionRecordedDate: recordedDate,
            });
      setData((current) => ({
        ...current,
        issues: current.issues.map((issue) =>
          issue.id === saved.id ? { ...issue, ...saved } : issue,
        ),
      }));
      setQuickPosition((current) =>
        current?.issue.id === target.id
          ? {
              ...current,
              issue: { ...current.issue, ...saved },
              saveStatus: "saved",
            }
          : current,
      );
      showToast(
        mode === "correct"
          ? "Latest position corrected."
          : "New position recorded.",
      );
      window.setTimeout(() => {
        setQuickPosition((current) =>
          current?.issue.id === target.id ? null : current,
        );
      }, 700);
    } catch (error) {
      setQuickPosition((current) =>
        current?.issue.id === target.id
          ? {
              ...current,
              saveStatus: "idle",
              error: error.message || "Unable to save the position.",
            }
          : current,
      );
      showToast(error.message || "Unable to save the position.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const openQuickStage = (issue) => {
    setQuickStage({ issue, saveStatus: "idle", error: "" });
  };

  const saveQuickStage = async (status) => {
    const target = quickStage?.issue;
    if (!target || status === target.status) return;
    setWorkingId(target.id);
    setQuickStage((current) => ({ ...current, saveStatus: "saving", error: "" }));
    try {
      const saved = await updateIssuePosition(target.id, { status });
      setData((current) => ({
        ...current,
        issues: current.issues.map((issue) =>
          issue.id === saved.id ? { ...issue, ...saved } : issue,
        ),
      }));
      setQuickStage((current) =>
        current?.issue.id === target.id
          ? { ...current, issue: { ...current.issue, ...saved }, saveStatus: "saved" }
          : current,
      );
      showToast(`Stage updated to ${saved.status}.`);
      window.setTimeout(() => {
        setQuickStage((current) =>
          current?.issue.id === target.id ? null : current,
        );
      }, 700);
    } catch (error) {
      setQuickStage((current) =>
        current?.issue.id === target.id
          ? { ...current, saveStatus: "idle", error: error.message || "Unable to update the stage." }
          : current,
      );
      showToast(error.message || "Unable to update the stage.", "error");
    } finally {
      setWorkingId("");
    }
  };

  const filtered = useMemo(() => {
    const divisionNames = new Map(
      data.divisions.map((division) => [division.id, division.name]),
    );
    const rows = data.issues.flatMap((issue) => {
      if (filters.archiveMode === "Current" && issue.isArchived) return [];
      if (filters.archiveMode === "Current" && isScheduledIssue(issue))
        return [];
      if (filters.archiveMode === "Scheduled" && !isScheduledIssue(issue))
        return [];
      if (filters.archiveMode === "Archived" && !issue.isArchived) return [];
      if (filters.focus && !matchesFocusView(issue, filters.focus)) return [];
      if (filters.status && issue.status !== filters.status) return [];
      if (filters.divisionId === "__unassigned__" && issue.owningDivisionId)
        return [];
      if (
        filters.divisionId &&
        filters.divisionId !== "__unassigned__" &&
        issue.owningDivisionId !== filters.divisionId
      )
        return [];
      const sourceMatch = getCommunicationSearchContext(
        communicationsByIssue.get(issue.id) || [],
        filters.query,
      );
      if (
        filters.query &&
        !issueMatchesSearch(issue, filters.query) &&
        !sourceMatch
      )
        return [];
      return [
        {
          ...issue,
          divisionName: divisionNames.get(issue.owningDivisionId) || "",
          searchMatch: sourceMatch,
        },
      ];
    });
    return rows.sort((a, b) => {
      if (filters.sort === "Recently updated")
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      if (filters.sort === "Next appearance")
        return (a.nextAppearanceDate || "9999-12-31").localeCompare(
          b.nextAppearanceDate || "9999-12-31",
        );
      if (filters.sort === "Date opened")
        return (b.dateOpened || "").localeCompare(a.dateOpened || "");
      if (filters.sort === "Title")
        return a.shortTitle.localeCompare(b.shortTitle);
      return 0;
    });
  }, [data.divisions, data.issues, communicationsByIssue, filters]);

  const sourceMatchCount = useMemo(
    () =>
      filtered.reduce(
        (total, issue) => total + (issue.searchMatch?.count || 0),
        0,
      ),
    [filtered],
  );
  const archivedPageCount = Math.max(
    1,
    Math.ceil(filtered.length / archivedPageSize),
  );
  const currentArchivedPage = Math.min(archivedPage, archivedPageCount);
  const pagedIssues = useMemo(() => {
    if (filters.archiveMode !== "Archived") return filtered;
    const start = (currentArchivedPage - 1) * archivedPageSize;
    return filtered.slice(start, start + archivedPageSize);
  }, [
    archivedPageSize,
    currentArchivedPage,
    filtered,
    filters.archiveMode,
  ]);
  const archivedRangeStart = filtered.length
    ? (currentArchivedPage - 1) * archivedPageSize + 1
    : 0;
  const archivedRangeEnd = Math.min(
    currentArchivedPage * archivedPageSize,
    filtered.length,
  );

  useEffect(() => {
    setArchivedPage(1);
  }, [
    filters.archiveMode,
    filters.divisionId,
    filters.focus,
    filters.query,
    filters.sort,
    filters.status,
    archivedPageSize,
  ]);

  useEffect(() => {
    setArchivedPage((current) => Math.min(current, archivedPageCount));
  }, [archivedPageCount]);

  const expectedSort =
    filters.archiveMode === "Scheduled"
      ? "Next appearance"
      : "Recently updated";
  const advancedFiltersActive = Boolean(
    filters.focus || filters.status || filters.divisionId || filters.sort !== expectedSort,
  );
  const activeFilterCount = [filters.focus, filters.status, filters.divisionId, filters.sort !== expectedSort].filter(Boolean).length;
  const activeFilterLabels = [
    filters.focus ? `Focus: ${FOCUS_VIEWS[filters.focus]}` : "",
    filters.status ? `Status: ${filters.status}` : "",
    filters.divisionId ? `Division: ${filters.divisionId === "__unassigned__" ? "Unassigned" : data.divisions.find((division) => division.id === filters.divisionId)?.name || "Selected"}` : "",
    filters.sort !== expectedSort ? `Sort: ${filters.sort}` : "",
  ].filter(Boolean);
  const draftExpectedSort = filterDraft.archiveMode === "Scheduled" ? "Next appearance" : "Recently updated";
  const draftFilterCount = [filterDraft.focus, filterDraft.status, filterDraft.divisionId, filterDraft.sort !== draftExpectedSort].filter(Boolean).length;

  const setFocusQuery = (focus) => {
    const nextParams = new URLSearchParams(searchParams);
    if (focus) nextParams.set("focus", focus);
    else nextParams.delete("focus");
    setSearchParams(nextParams, { replace: true });
  };

  const changeAdvancedFilters = (nextFilters) => {
    if (nextFilters.focus !== filters.focus) setFocusQuery(nextFilters.focus);
    setFilters(nextFilters);
  };

  const clearAdvancedFilters = () => {
    setFocusQuery("");
    setFilters((current) => resetAdvancedFilterValues(current));
  };

  const toggleFilters = () => {
    if (showFilters) {
      setShowFilters(false);
      return;
    }
    setFilterDraft(filters);
    setShowFilters(true);
  };

  const applyMobileFilters = () => {
    changeAdvancedFilters(filterDraft);
    setShowFilters(false);
  };

  if (data.loading) return <LoadingState message="Loading Issue register..." variant="register" />;
  if (data.error) return <ErrorState message={data.error} onRetry={load} />;

  return (
    <>
      <PageHeader
        eyebrow="Work register"
        title="Issues"
        description="Search the Issue register and monitor ownership, age and deadlines."
      />
      {!auth.canEdit && (
        <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-950">
          You have viewing access. Editing, archiving and deletion are
          unavailable.
        </div>
      )}
      <div className="space-y-4">
        <section
          className="mobile-scroll-strip -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-px sm:overflow-hidden sm:rounded-xl sm:border sm:border-slate-200 sm:bg-slate-200 sm:px-0 sm:pb-0 sm:shadow-[0_1px_2px_rgb(15_49_56_/_0.04),0_5px_16px_rgb(15_49_56_/_0.025)]"
          aria-label="Issue summary"
        >
          <Metric
            label="Total Issues"
            value={summary.total}
            detail="Current register"
            icon={ClipboardList}
            tone="teal"
          />
          <Metric
            label="Pending"
            value={summary.pending}
            detail="Awaiting action"
            icon={CircleDashed}
            tone="slate"
          />
          <Metric
            label="Overdue"
            value={summary.overdue}
            detail="Past deadline"
            icon={AlertTriangle}
            tone="red"
          />
          <Metric
            label="In Progress"
            value={summary.inProgress}
            detail="Work underway"
            icon={Activity}
            tone="cyan"
          />
          <Metric
            label="Awaiting Discussion"
            value={summary.awaitingDiscussion}
            detail="Decision or consultation"
            icon={MessageCircleQuestion}
            tone="violet"
            className="col-span-2 sm:col-span-1"
          />
        </section>

        <section className="surface rounded-[var(--swm-radius-lg)] p-3 sm:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 sm:grid-cols-[auto_minmax(280px,1fr)_44px] sm:items-center sm:gap-3">
            <ArchiveViewSwitch
              value={filters.archiveMode}
              currentCount={summary.total}
              archivedCount={summary.archived}
              scheduledCount={summary.scheduled}
              onChange={(archiveMode) =>
                setFilters((current) => ({
                  ...current,
                  archiveMode,
                  sort:
                    archiveMode === "Scheduled"
                      ? "Next appearance"
                      : current.sort === "Next appearance"
                        ? "Recently updated"
                        : current.sort,
                }))
              }
            />
            <div className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                <SearchInput
                  value={filters.query}
                  onChange={(query) =>
                    setFilters((current) => ({
                      ...current,
                      query,
                    }))
                  }
                  placeholder="Search issues, eReceipts or source documents"
                />
            </div>
            <FilterButton
              className="col-start-2 row-start-2 flex sm:col-start-3 sm:row-start-1"
              open={showFilters}
              active={advancedFiltersActive}
              activeCount={activeFilterCount}
              onClick={toggleFilters}
            />
          </div>
          {!mobileLayout && showFilters ? (
            <div>
              <div className="disclosure-enter mt-3 border-t border-slate-200 pt-3">
                <FilterBar
                  filters={filters}
                  divisions={data.divisions}
                  onChange={changeAdvancedFilters}
                />
              </div>
            </div>
          ) : null}
          {advancedFiltersActive ? <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3" role="status" aria-label="Active Issue filters"><span className="shrink-0 text-xs font-bold text-slate-700">Filtered</span><div className="mobile-scroll-strip flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">{activeFilterLabels.map((label) => <span key={label} className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800">{label}</span>)}</div><button type="button" onClick={clearAdvancedFilters} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900">Clear</button></div> : null}
        </section>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-600" aria-live="polite">
            {filters.archiveMode === "Archived" && filtered.length
              ? `Showing ${archivedRangeStart}–${archivedRangeEnd} of `
              : ""}
            {filtered.length} issue{filtered.length === 1 ? "" : "s"}
            {filters.query && sourceMatchCount > 0
              ? ` - ${sourceMatchCount} source match${sourceMatchCount === 1 ? "" : "es"}`
              : ""}
          </div>
        </div>
        {!filtered.length ? (
          <EmptyState
            title={
              filters.archiveMode === "Archived"
                ? "No archived Issues"
                : filters.archiveMode === "Scheduled"
                  ? "No scheduled Issues"
                  : "No matching Issues"
            }
            message={
              filters.archiveMode === "Archived"
                ? "Archived Issues will appear here and can be restored to the current register."
                : filters.archiveMode === "Scheduled"
                  ? "Completed Issues with a return date will wait here until they are due."
                  : "Adjust the filters or create a new Issue."
            }
          />
        ) : (
          <>
            <IssueTable
              issues={pagedIssues}
              officers={data.officers}
              registerMode={filters.archiveMode}
              workingId={workingId}
              canEdit={auth.canEdit}
              showDivision={Boolean(auth.workspace?.id)}
              onQuickPosition={openQuickPosition}
              onQuickStage={openQuickStage}
              onRestore={restore}
              onBringBack={bringBack}
              onArchive={archive}
              onDelete={setDeleteTarget}
            />
            <div className="issue-register-cards space-y-2">
              {pagedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  officers={data.officers}
                  registerMode={filters.archiveMode}
                  working={workingId === issue.id}
                  canEdit={auth.canEdit && issue.accessLevel !== "viewer"}
                  showDivision={Boolean(auth.workspace?.id)}
                  onQuickPosition={openQuickPosition}
                  onQuickStage={openQuickStage}
                  onRestore={restore}
                  onBringBack={bringBack}
                  onArchive={archive}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
            {filters.archiveMode === "Archived" && (
              <ArchivedPagination
                page={currentArchivedPage}
                pageCount={archivedPageCount}
                pageSize={archivedPageSize}
                total={filtered.length}
                onPageChange={setArchivedPage}
                onPageSizeChange={setArchivedPageSize}
              />
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Issue permanently?"
        message={`"${deleteTarget?.shortTitle || "This Issue"}" and its communications, references, milestones, summaries and drafts will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete Issue"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteIssue}
      />
      {mobileLayout ? (
        <MobileFilterSheet
          open={showFilters}
          filters={filterDraft}
          divisions={data.divisions}
          activeCount={draftFilterCount}
          onChange={setFilterDraft}
          onReset={() => setFilterDraft((current) => resetAdvancedFilterValues(current))}
          onApply={applyMobileFilters}
          onClose={() => setShowFilters(false)}
        />
      ) : null}
      {quickPosition && (
        <QuickPositionDialog
          key={quickPosition.issue.id}
          issue={quickPosition.issue}
          latestMilestone={quickPosition.latestMilestone}
          historyLoading={quickPosition.historyLoading}
          saveStatus={quickPosition.saveStatus}
          error={quickPosition.error}
          onClose={() => setQuickPosition(null)}
          onSave={saveQuickPosition}
        />
      )}
      {quickStage && (
        <QuickStageDialog
          key={quickStage.issue.id}
          issue={quickStage.issue}
          saveStatus={quickStage.saveStatus}
          error={quickStage.error}
          onClose={() => setQuickStage(null)}
          onSave={saveQuickStage}
        />
      )}
    </>
  );
}

function ArchivedPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <nav
      className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Archived Issues pagination"
    >
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-medium text-slate-800"
        >
          {ARCHIVED_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span
          className="mr-1 text-sm tabular-nums text-slate-600"
          aria-live="polite"
        >
          <span className="sm:hidden">
            {page} / {pageCount}
          </span>
          <span className="hidden sm:inline">
            Page {page} of {pageCount} ({total} total)
          </span>
        </span>
        <PaginationButton
          label="First page"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          icon={ChevronsLeft}
        />
        <PaginationButton
          label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          icon={ChevronLeft}
        />
        <PaginationButton
          label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          icon={ChevronRight}
        />
        <PaginationButton
          label="Last page"
          disabled={page === pageCount}
          onClick={() => onPageChange(pageCount)}
          icon={ChevronsRight}
        />
      </div>
    </nav>
  );
}

function PaginationButton({ label, disabled, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const metricTones = {
  teal: "text-teal-700",
  slate: "text-slate-600",
  red: "text-red-600",
  cyan: "text-cyan-700",
  violet: "text-violet-700",
};

function Metric({ label, value, detail, icon: Icon, tone, className = "" }) {
  return (
    <div
      className={`relative w-[8.6rem] shrink-0 snap-start rounded-[var(--swm-radius-lg)] border border-[var(--swm-border)] bg-white px-3 py-2.5 shadow-[var(--swm-shadow-xs)] sm:w-auto sm:rounded-none sm:border-0 sm:px-4 sm:py-4 sm:shadow-none ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-xl font-semibold tabular-nums tracking-tight sm:text-2xl ${tone === "red" ? "text-red-700" : "text-[#17333b]"}`}>
            {value}
          </div>

          <div className="mt-0.5 line-clamp-2 text-xs font-semibold leading-4 text-slate-700 sm:text-sm">
            {label}
          </div>

          <div className="mt-1 hidden text-xs text-slate-500 sm:block">
            {detail}
          </div>
        </div>

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 ${metricTones[tone]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function MobileFilterSheet({ open, filters, divisions, activeCount, onChange, onReset, onApply, onClose }) {
  return (
    <ModalFrame
      open={open}
      labelledBy="mobile-filter-title"
      describedBy="mobile-filter-description"
      onClose={onClose}
      className="mobile-filter-sheet flex max-h-[82dvh] flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /></span>
            <h2 id="mobile-filter-title" className="text-base font-semibold text-slate-950">Filter and sort</h2>
          </div>
          <p id="mobile-filter-description" className="mt-2 text-xs leading-5 text-slate-500">Choose what belongs in this view, then apply the selections together.</p>
        </div>
        <button type="button" aria-label="Close filters" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" aria-hidden="true" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <FilterBar filters={filters} divisions={divisions} onChange={onChange} />
      </div>
      <footer className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" aria-hidden="true" />Reset</button>
        <button type="button" onClick={onApply} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">{activeCount ? `Apply ${activeCount} filter${activeCount === 1 ? "" : "s"}` : "Apply filters"}</button>
      </footer>
    </ModalFrame>
  );
}

function ArchiveViewSwitch({
  value,
  currentCount,
  scheduledCount,
  archivedCount,
  onChange,
}) {
  const options = [
    { label: "Current", count: currentCount },
    { label: "Scheduled", count: scheduledCount, icon: CalendarClock },
    { label: "Archived", count: archivedCount },
  ];
  return (
    <div
      className="col-span-2 grid w-full grid-cols-3 rounded-lg bg-slate-100 p-[4px] sm:col-span-1 sm:inline-flex sm:w-auto"
      role="group"
      aria-label="Register view"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.label)}
          className={`inline-flex h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-3 sm:text-sm ${value === option.label ? "bg-white text-[#17333b] shadow-sm ring-1 ring-inset ring-slate-200" : "text-slate-600 hover:bg-white/60"}`}
        >
          {option.icon && <option.icon className="h-3.5 w-3.5" />}
          {option.label}
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${value === option.label ? "bg-slate-100 text-slate-700" : "bg-slate-200/70 text-slate-600"}`}
          >
            {option.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function FilterButton({ className = "", open, active, activeCount = 0, onClick }) {
  return (
    <button
      type="button"
      title={activeCount ? `Filter and sort, ${activeCount} active` : "Filter and sort"}
      aria-label={activeCount ? `Filter and sort, ${activeCount} active` : "Filter and sort"}
      aria-expanded={open}
      onClick={onClick}
      className={`relative h-[44px] w-[44px] items-center justify-center rounded-lg border ${open || active ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"} ${className}`}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {active ? <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-[10px] font-bold text-white shadow-sm">{activeCount}</span> : null}
    </button>
  );
}
