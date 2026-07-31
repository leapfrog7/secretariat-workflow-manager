import { useEffect, useMemo, useState } from "react";
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
  SlidersHorizontal,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import SearchInput from "../components/common/SearchInput";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import ConfirmDialog from "../components/common/ConfirmDialog";
import FilterBar from "../components/issues/FilterBar";
import IssueTable from "../components/issues/IssueTable";
import IssueCard from "../components/issues/IssueCard";
import QuickPositionDialog from "../components/issues/QuickPositionDialog";
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
import { getDeadlineState } from "../utils/dateUtils";
import { useToast } from "../components/common/ToastProvider";
import { isScheduledIssue } from "../utils/scheduleUtils";
import { getAllCommunications } from "../db/communicationRepository";
import { getCommunicationSearchContext } from "../utils/communicationUtils";
import { useAuth } from "../features/auth/AuthContext";
import { listDivisions } from "../features/collaboration/accessApi";
import { findCurrentPositionMilestone } from "../utils/positionUpdateUtils";

const defaultFilters = {
  query: "",
  status: "",
  divisionId: "",
  archiveMode: "Current",
  sort: "Recently updated",
};

const ARCHIVED_PAGE_SIZES = [25, 50, 100];

export default function IssueRegisterPage() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState({
    loading: true,
    error: "",
    issues: [],
    officers: [],
    communications: [],
    divisions: [],
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [quickPosition, setQuickPosition] = useState(null);
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
    filters.status || filters.divisionId || filters.sort !== expectedSort,
  );

  if (data.loading) return <LoadingState message="Loading Issue register..." />;
  if (data.error) return <ErrorState message={data.error} onRetry={load} />;

  return (
    <>
      <PageHeader
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
          className="surface grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-md sm:grid-cols-5 sm:divide-y-0"
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

        <section className="surface rounded-md p-3 sm:p-4">
          <div className="border-b border-slate-200 pb-2.5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:pb-3">
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
            <FilterButton
              className="hidden sm:flex"
              open={showFilters}
              active={advancedFiltersActive}
              onClick={() => setShowFilters((current) => !current)}
            />
          </div>
          <div className="mt-3">
            <div className="flex w-full items-end gap-2">
              <div className="min-w-0 flex-1">
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
                className="flex h-10 w-10 shrink-0 items-center justify-center sm:hidden"
                open={showFilters}
                active={advancedFiltersActive}
                onClick={() => setShowFilters((current) => !current)}
              />
            </div>
            {showFilters && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <FilterBar
                  filters={filters}
                  divisions={data.divisions}
                  onChange={setFilters}
                  onClear={() =>
                    setFilters((current) => ({
                      ...defaultFilters,
                      archiveMode: current.archiveMode,
                      sort:
                        current.archiveMode === "Scheduled"
                          ? "Next appearance"
                          : defaultFilters.sort,
                    }))
                  }
                />
              </div>
            )}
          </div>
        </section>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {filters.archiveMode === "Archived" && filtered.length
              ? `Showing ${archivedRangeStart}-${archivedRangeEnd} of `
              : ""}
            {filtered.length} Issue{filtered.length === 1 ? "" : "s"}
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
  teal: "border-t-teal-600 bg-teal-50 text-teal-800",
  slate: "border-t-slate-500 bg-slate-50 text-slate-700",
  red: "border-t-red-600 bg-red-50 text-red-800",
  cyan: "border-t-cyan-600 bg-cyan-50 text-cyan-800",
  violet: "border-t-violet-600 bg-violet-50 text-violet-800",
};

function Metric({ label, value, detail, icon: Icon, tone, className = "" }) {
  return (
    <div
      className={`min-h-[72px] border-t-[3px] p-2.5 sm:min-h-24 sm:border-t-4 sm:p-3.5 ${metricTones[tone]} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tabular-nums text-[#17333b] sm:text-2xl">
            {value}
          </div>
          <div className="mt-0.5 text-xs font-semibold leading-4 sm:mt-1 sm:text-sm">
            {label}
          </div>
          <div className="mt-1 hidden text-xs opacity-75 sm:block">
            {detail}
          </div>
        </div>
        <Icon
          className="h-4 w-4 shrink-0 opacity-80 sm:h-5 sm:w-5"
          aria-hidden="true"
        />
      </div>
    </div>
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
      className="inline-flex max-w-full overflow-x-auto rounded-md bg-slate-100 p-1"
      role="group"
      aria-label="Register view"
    >
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.label)}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded px-3 text-sm font-semibold transition-colors ${value === option.label ? "bg-[#17333b] text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {option.icon && <option.icon className="h-3.5 w-3.5" />}
          {option.label}
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${value === option.label ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}
          >
            {option.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function FilterButton({ className = "", open, active, onClick }) {
  return (
    <button
      type="button"
      title="Filter and sort"
      aria-label="Filter and sort"
      aria-expanded={open}
      onClick={onClick}
      className={`relative h-11 w-11 items-center justify-center rounded-md border sm:h-10 sm:w-10 ${open || active ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"} ${className}`}
    >
      <SlidersHorizontal className="h-4 w-4" />
      {active && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-700" />
      )}
    </button>
  );
}
