import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, FileSpreadsheet, FileText, Lightbulb, MessageSquareText, Printer, Sparkles, UserRoundX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import ReportAIRefinement from '../components/reports/ReportAIRefinement';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import { getAllIssues } from '../db/issueRepository';
import { getAllOfficers } from '../db/officerRepository';
import { getAllCommunications } from '../db/communicationRepository';
import { getAllMilestones } from '../db/milestoneRepository';
import { getAllSummaryVersions } from '../db/summaryRepository';
import { listDivisions } from '../features/collaboration/accessApi';
import { formatDisplayDate, formatDateTime, todayISO } from '../utils/dateUtils';
import { buildActivityReport, buildIssueReport, DEFAULT_ACTIVITY_CONTENT_OPTIONS, getReportPeriod, REPORT_PERIOD_PRESETS, REPORT_TYPES } from '../utils/reportUtils';
import { downloadActivityReportAsCsv } from '../utils/reportCsvUtils';
import Button from '../components/ui/Button';

const initialPeriod = getReportPeriod({ preset: 'weekly' });

export default function ReportsPage() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState({
    loading: true,
    error: '',
    issues: [],
    officers: [],
    divisions: [],
    milestones: [],
    communications: [],
    summaries: [],
  });
  const [mode, setMode] = useState('snapshot');
  const [reportType, setReportType] = useState('current');
  const [divisionId, setDivisionId] = useState('');
  const [includeCurrentPosition, setIncludeCurrentPosition] = useState(true);
  const [periodPreset, setPeriodPreset] = useState('weekly');
  const [customStart, setCustomStart] = useState(initialPeriod.startDate);
  const [customEnd, setCustomEnd] = useState(initialPeriod.endDate);
  const [coveringNote, setCoveringNote] = useState('');
  const [activityContent, setActivityContent] = useState(DEFAULT_ACTIVITY_CONTENT_OPTIONS);
  const [excludedIssueIds, setExcludedIssueIds] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [refinement, setRefinement] = useState(null);
  const [previewVersion, setPreviewVersion] = useState('source');
  const [exportingWord, setExportingWord] = useState(false);

  const load = async () => {
    try {
      setData((current) => ({ ...current, loading: true, error: '' }));
      const [issues, officers, divisions, milestones, communications, summaries] = await Promise.all([
        getAllIssues(),
        getAllOfficers(),
        auth.workspace?.id ? listDivisions(auth.workspace.id) : Promise.resolve([]),
        getAllMilestones(),
        getAllCommunications(),
        getAllSummaryVersions(),
      ]);
      setData({ loading: false, error: '', issues, officers, divisions, milestones, communications, summaries });
      setGeneratedAt(new Date());
    } catch (error) {
      setData((current) => ({ ...current, loading: false, error: error.message || 'Unable to prepare reports.' }));
    }
  };

  useEffect(() => {
    load();
    const handleSync = () => load();
    window.addEventListener('swm:issues-synced', handleSync);
    return () => window.removeEventListener('swm:issues-synced', handleSync);
  }, [auth.workspace?.id]);

  const snapshotReport = useMemo(() => buildIssueReport({
    issues: data.issues,
    officers: data.officers,
    divisions: data.divisions,
    reportType,
    divisionId,
    includeCurrentPosition,
  }), [data.divisions, data.issues, data.officers, divisionId, includeCurrentPosition, reportType]);

  const periodState = useMemo(() => {
    try {
      return {
        error: '',
        period: getReportPeriod({
          preset: periodPreset,
          customStart,
          customEnd,
        }),
      };
    } catch (error) {
      return { error: error.message, period: null };
    }
  }, [customEnd, customStart, periodPreset]);

  const activitySource = useMemo(() => {
    if (!periodState.period) return null;
    return buildActivityReport({
      issues: data.issues,
      officers: data.officers,
      divisions: data.divisions,
      milestones: data.milestones,
      communications: data.communications,
      summaries: data.summaries,
      periodStart: periodState.period.startDate,
      periodEnd: periodState.period.endDate,
      periodPreset,
      divisionId,
      coveringNote,
      contentOptions: activityContent,
    });
  }, [activityContent, coveringNote, data, divisionId, periodPreset, periodState.period]);

  const activityReport = useMemo(() => {
    if (!activitySource || !periodState.period) return null;
    const excluded = new Set(excludedIssueIds);
    return buildActivityReport({
      issues: data.issues,
      officers: data.officers,
      divisions: data.divisions,
      milestones: data.milestones,
      communications: data.communications,
      summaries: data.summaries,
      periodStart: periodState.period.startDate,
      periodEnd: periodState.period.endDate,
      periodPreset,
      divisionId,
      coveringNote,
      contentOptions: activityContent,
      selectedIssueIds: activitySource.candidateIssueIds.filter((id) => !excluded.has(id)),
    });
  }, [activityContent, activitySource, coveringNote, data, divisionId, excludedIssueIds, periodPreset, periodState.period]);

  useEffect(() => {
    if (!activitySource) return;
    const candidates = new Set(activitySource.candidateIssueIds);
    setExcludedIssueIds((current) => current.filter((id) => candidates.has(id)));
  }, [activitySource?.candidateIssueIds.join('|')]);

  const activeReport = mode === 'activity' ? activityReport : snapshotReport;
  const reportSignature = useMemo(() => {
    if (!activeReport) return '';
    const reportIssues = activeReport.kind === 'activity'
      ? activeReport.issues.map((issue) => [issue.id, issue.updatedAt, issue.runningSummaryVersion, issue.events.map((event) => event.id)])
      : activeReport.rows.map((issue) => [issue.id, issue.updatedAt]);
    return JSON.stringify({
      kind: activeReport.kind || 'snapshot',
      title: activeReport.title,
      scope: activeReport.scopeLabel,
      start: activeReport.periodStart || '',
      end: activeReport.periodEnd || activeReport.asOfDate,
      note: activeReport.coveringNote || '',
      contentOptions: activeReport.contentOptions || null,
      issues: reportIssues,
    });
  }, [activeReport]);

  useEffect(() => {
    setRefinement(null);
    setPreviewVersion('source');
  }, [reportSignature]);

  const activeDateLine = activeReport?.kind === 'activity'
    ? `${formatDisplayDate(activeReport.periodStart)} to ${formatDisplayDate(activeReport.periodEnd)}`
    : `As on ${formatDisplayDate(activeReport?.asOfDate)}`;
  const exportWord = async () => {
    if (exportingWord) return;
    setExportingWord(true);
    try {
      if (!activeReport) throw new Error(periodState.error || 'The report period is incomplete.');
      const { downloadIssueReportAsDocx, downloadRefinedReportAsDocx } = await import('../utils/reportExportUtils');
      if (previewVersion === 'ai' && refinement) {
        await downloadRefinedReportAsDocx({
          title: activeReport.title,
          scopeLabel: activeReport.scopeLabel,
          dateLine: activeDateLine,
          text: refinement.text,
          filenameDate: activeReport.periodEnd || activeReport.asOfDate,
        });
        showToast('AI-refined Word document downloaded.');
      } else {
        await downloadIssueReportAsDocx(activeReport);
        showToast('Editable Word document downloaded.');
      }
    } catch (error) {
      showToast(error.message || 'Unable to export report.', 'error');
    } finally {
      setExportingWord(false);
    }
  };
  const exportCsv = () => {
    try {
      if (!activityReport) throw new Error(periodState.error || 'The report period is incomplete.');
      downloadActivityReportAsCsv(activityReport);
      showToast('Activity register downloaded as CSV.');
    } catch (error) {
      showToast(error.message || 'Unable to export CSV.', 'error');
    }
  };
  const toggleIssue = (issueId) => {
    setExcludedIssueIds((current) => current.includes(issueId)
      ? current.filter((id) => id !== issueId)
      : [...current, issueId]);
  };

  if (data.loading) return <LoadingState message="Preparing report data..." />;
  if (data.error) return <ErrorState message={data.error} onRetry={load} />;

  return (
    <div className="report-page">
      <PageHeader
        eyebrow="Operational intelligence"
        title="Reports"
        description="Prepare a current snapshot or a dated progress report from the Issues and history you are permitted to see."
        actions={<>
          <Button onClick={() => window.print()} disabled={!activeReport} variant="secondary"><Printer className="h-4 w-4" />Print</Button>
          {mode === 'activity' ? <Button onClick={exportCsv} disabled={!activityReport} variant="secondary"><FileSpreadsheet className="h-4 w-4" />CSV</Button> : null}
          <Button onClick={exportWord} disabled={!activeReport || exportingWord} className="min-w-32"><Download className={`h-4 w-4 ${exportingWord ? 'animate-pulse' : ''}`} />{exportingWord ? 'Preparing...' : 'Word (.docx)'}</Button>
        </>}
      />

      <div className="report-controls mb-4">
        <div className="inline-flex w-full rounded-md border border-slate-300 bg-white p-1 sm:w-auto" role="tablist" aria-label="Report form">
          <ModeButton active={mode === 'snapshot'} onClick={() => setMode('snapshot')}>Current snapshot</ModeButton>
          <ModeButton active={mode === 'activity'} onClick={() => setMode('activity')}>Period progress</ModeButton>
        </div>

        {mode === 'snapshot' ? (
          <SnapshotControls
            reportType={reportType}
            setReportType={setReportType}
            divisionId={divisionId}
            setDivisionId={setDivisionId}
            divisions={data.divisions}
            includeCurrentPosition={includeCurrentPosition}
            setIncludeCurrentPosition={setIncludeCurrentPosition}
          />
        ) : (
          <ActivityControls
            periodPreset={periodPreset}
            setPeriodPreset={setPeriodPreset}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            divisionId={divisionId}
            setDivisionId={setDivisionId}
            divisions={data.divisions}
            coveringNote={coveringNote}
            setCoveringNote={setCoveringNote}
            contentOptions={activityContent}
            setContentOptions={setActivityContent}
            error={periodState.error}
          />
        )}
      </div>

      {activeReport && <ReportAIRefinement
        key={reportSignature}
        report={activeReport}
        refinement={refinement}
        onComplete={(result) => {
          setRefinement(result);
          setPreviewVersion('ai');
        }}
        onDiscard={() => {
          setRefinement(null);
          setPreviewVersion('source');
        }}
      />}

      {refinement && (
        <div className="report-controls mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-1" role="tablist" aria-label="Report version">
            <ModeButton active={previewVersion === 'source'} onClick={() => setPreviewVersion('source')}>Source report</ModeButton>
            <ModeButton active={previewVersion === 'ai'} onClick={() => setPreviewVersion('ai')}>AI refinement</ModeButton>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Word and Print use the version currently displayed.</span>
        </div>
      )}

      {previewVersion === 'ai' && refinement && activeReport
        ? <RefinedReportPreview report={activeReport} refinement={refinement} generatedAt={generatedAt} dateLine={activeDateLine} />
        : mode === 'snapshot'
          ? <SnapshotPreview report={snapshotReport} generatedAt={generatedAt} />
          : periodState.error
            ? <div className="surface rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">{periodState.error}</div>
            : <ActivityPreview
              report={activityReport}
              source={activitySource}
              excludedIssueIds={excludedIssueIds}
              onToggleIssue={toggleIssue}
              onSelectAll={() => setExcludedIssueIds([])}
              onClearAll={() => setExcludedIssueIds(activitySource?.candidateIssueIds || [])}
              generatedAt={generatedAt}
              />}
    </div>
  );
}

function RefinedReportPreview({ report, refinement, generatedAt, dateLine }) {
  return (
    <article className="report-preview surface overflow-hidden rounded-md" aria-label={`AI refinement of ${report.title}`}>
      <ReportHeader title={`${report.title} - AI refinement`} scope={report.scopeLabel} dateLine={dateLine} generatedAt={generatedAt} />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 sm:px-6">
        <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>This wording was generated by {refinement.model}. Verify every statement against the Source report before official use.</span></div>
      </div>
      <div className="summary-markdown px-4 py-5 text-sm leading-6 text-slate-700 sm:px-6 sm:py-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{refinement.text}</ReactMarkdown>
      </div>
    </article>
  );
}

function ModeButton({ active, onClick, children }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`h-9 flex-1 rounded px-3 text-sm font-semibold sm:flex-none ${active ? 'bg-[#17333b] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{children}</button>;
}

function DivisionSelect({ value, onChange, divisions }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">Division</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100">
        <option value="">All accessible divisions</option>
        <option value="__unassigned__">Without an owning division</option>
        {divisions.filter((division) => division.is_active !== false).map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
      </select>
    </label>
  );
}

function SnapshotControls({ reportType, setReportType, divisionId, setDivisionId, divisions, includeCurrentPosition, setIncludeCurrentPosition }) {
  return (
    <section className="surface mt-3 rounded-md p-3 sm:p-4" aria-label="Snapshot report options">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(220px,auto)] md:items-start">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Report view</span>
          <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100">
            {REPORT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <span className="mt-1 block text-xs leading-4 text-slate-500">{REPORT_TYPES.find((type) => type.value === reportType)?.description}</span>
        </label>
        <DivisionSelect value={divisionId} onChange={setDivisionId} divisions={divisions} />
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Report content</span>
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={includeCurrentPosition} onChange={(event) => setIncludeCurrentPosition(event.target.checked)} className="h-4 w-4 accent-teal-700" />
            Include current position
          </label>
        </div>
      </div>
    </section>
  );
}

function ActivityControls({ periodPreset, setPeriodPreset, customStart, setCustomStart, customEnd, setCustomEnd, divisionId, setDivisionId, divisions, coveringNote, setCoveringNote, contentOptions, setContentOptions, error }) {
  return (
    <section className="surface mt-3 rounded-md p-3 sm:p-4" aria-label="Period report options">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Reporting period</span>
          <div className="grid grid-cols-3 rounded-md border border-slate-300 bg-white p-1">
            {REPORT_PERIOD_PRESETS.map((preset) => <button key={preset.value} type="button" onClick={() => setPeriodPreset(preset.value)} className={`h-9 rounded px-2 text-sm font-semibold ${periodPreset === preset.value ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200' : 'text-slate-600 hover:bg-slate-50'}`}>{preset.label}</button>)}
          </div>
          {periodPreset === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label><span className="mb-1 block text-xs text-slate-600">From</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
              <label><span className="mb-1 block text-xs text-slate-600">To</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            </div>
          )}
          {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
        </div>
        <DivisionSelect value={divisionId} onChange={setDivisionId} divisions={divisions} />
      </div>
      <fieldset className="mt-4 border-t border-slate-200 pt-3">
        <legend className="text-xs font-semibold text-slate-700">Report content</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ContentOption label="Opening position" detail="Position before the period" checked={contentOptions.openingPosition} onChange={(checked) => setContentOptions((current) => ({ ...current, openingPosition: checked }))} />
          <ContentOption label="Developments" detail="Position updates from milestones" checked={contentOptions.developments} onChange={(checked) => setContentOptions((current) => ({ ...current, developments: checked }))} />
          <ContentOption label="Running summary" detail="Latest version by period end" checked={contentOptions.runningSummary} onChange={(checked) => setContentOptions((current) => ({ ...current, runningSummary: checked }))} />
          <ContentOption label="Next priorities" detail="Pending action after the period" checked={contentOptions.nextPriorities} onChange={(checked) => setContentOptions((current) => ({ ...current, nextPriorities: checked }))} />
        </div>
      </fieldset>
      <label className="mt-4 block border-t border-slate-200 pt-3">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Covering note <span className="font-normal text-slate-500">(optional)</span></span>
        <textarea value={coveringNote} onChange={(event) => setCoveringNote(event.target.value)} rows={2} maxLength={1200} placeholder="Add a short context or submission note for this report." className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
      </label>
    </section>
  );
}

function ContentOption({ label, detail, checked, onChange }) {
  return (
    <label className={`flex min-h-14 items-start gap-2.5 rounded-md border px-3 py-2.5 ${checked ? 'border-teal-300 bg-teal-50/60' : 'border-slate-200 bg-white'}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700" />
      <span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-0.5 block text-xs leading-4 text-slate-500">{detail}</span></span>
    </label>
  );
}

function ReportHeader({ title, scope, dateLine, generatedAt }) {
  return (
    <header className="border-b border-slate-200 bg-[#17333b] px-4 py-5 text-white sm:px-6">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-200">{scope} | {dateLine}</p>
          <p className="mt-1 text-xs text-slate-300">Prepared from accessible workspace data at {formatDateTime(generatedAt)}</p>
        </div>
      </div>
    </header>
  );
}

function SnapshotPreview({ report, generatedAt }) {
  return (
    <article className="report-preview surface overflow-hidden rounded-md" aria-label={report.title}>
      <ReportHeader title={report.title} scope={report.scopeLabel} dateLine={`As on ${formatDisplayDate(report.asOfDate)}`} generatedAt={generatedAt} />
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <ReportMetric label="Issues in report" value={report.statistics.total} icon={FileText} />
        <ReportMetric label="Overdue" value={report.statistics.overdue} icon={AlertTriangle} tone="red" />
        <ReportMetric label="Due within 7 days" value={report.statistics.dueSoon} icon={CalendarClock} tone="cyan" />
        <ReportMetric label="Unassigned" value={report.statistics.unassigned} icon={UserRoundX} tone="amber" />
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-[#17333b]">Issue-wise position</h3>
          {report.rows.length ? <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{report.rows.map((row, index) => <SnapshotIssue key={row.id} row={row} index={index} />)}</div> : <EmptyReport />}
        </section>
        <ReportInsights report={report} />
      </div>
    </article>
  );
}

function ActivityPreview({ report, source, excludedIssueIds, onToggleIssue, onSelectAll, onClearAll, generatedAt }) {
  const excluded = new Set(excludedIssueIds);
  return (
    <article className="report-preview surface overflow-hidden rounded-md" aria-label={report.title}>
      <ReportHeader title={report.title} scope={report.scopeLabel} dateLine={`${formatDisplayDate(report.periodStart)} to ${formatDisplayDate(report.periodEnd)}`} generatedAt={generatedAt} />
      {report.coveringNote && <div className="border-b border-slate-200 bg-teal-50/50 px-4 py-3 text-sm leading-6 text-slate-700 sm:px-6"><strong className="mr-2 text-[#17333b]">Covering note:</strong>{report.coveringNote}</div>}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <ReportMetric label="Issues included" value={report.statistics.issueCount} icon={FileText} />
        <ReportMetric label="Developments" value={report.statistics.developments} icon={MessageSquareText} tone="cyan" />
        <ReportMetric label="Completed" value={report.statistics.completed} icon={CheckCircle2} tone="teal" />
        <ReportMetric label="Slippages" value={report.statistics.slippages} icon={AlertTriangle} tone="red" />
      </div>

      <div className="report-selection-controls flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 sm:px-6">
        <span><strong className="text-slate-800">{report.statistics.issueCount}</strong> of <strong className="text-slate-800">{source.candidateIssueIds.length}</strong> eligible Issues included</span>
        <div className="flex gap-2">
          <button type="button" onClick={onSelectAll} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50">Select all</button>
          <button type="button" onClick={onClearAll} className="h-8 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50">Clear</button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-[#17333b]">Issue-wise progress</h3>
          {source.issues.length ? (
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {source.issues.map((issue, index) => <ActivityIssue key={issue.id} issue={issue} options={report.contentOptions} index={index} selected={!excluded.has(issue.id)} onToggle={() => onToggleIssue(issue.id)} />)}
            </div>
          ) : <EmptyReport message="No recorded activity or reportable slippage falls within this period." />}
        </section>
        <aside className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17333b]"><Lightbulb className="h-4 w-4 text-amber-600" />Period observations</div>
          <ul className="mt-3 space-y-2.5">{report.observations.map((item) => <li key={item} className="text-sm leading-5 text-slate-700">{item}</li>)}</ul>
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
            <ActivitySectionList title="Work completed" issues={report.sections.completed} empty="No completion recorded." />
            <ActivitySectionList title="Slippages" issues={report.sections.slippages} empty="No slippage identified." />
            {report.contentOptions.nextPriorities && <ActivitySectionList title="Next-period priorities" issues={report.sections.nextPriorities} empty="No priority identified." />}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 text-xs">
            <div><dt className="text-slate-500">Communications</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-800">{report.statistics.communications}</dd></div>
            <div><dt className="text-slate-500">eReceipts</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-800">{report.statistics.eReceipts}</dd></div>
            <div><dt className="text-slate-500">Summary updates</dt><dd className="mt-0.5 font-semibold tabular-nums text-slate-800">{report.statistics.summaryUpdates}</dd></div>
          </dl>
        </aside>
      </div>
    </article>
  );
}

function ReportMetric({ label, value, icon: Icon, tone = 'teal' }) {
  const tones = { teal: 'bg-teal-50 text-teal-700', red: 'bg-red-50 text-red-700', cyan: 'bg-cyan-50 text-cyan-700', amber: 'bg-amber-50 text-amber-700' };
  return <div className="flex min-h-24 items-center gap-3 px-4 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}><Icon className="h-4 w-4" /></span><div><div className="text-xl font-semibold tabular-nums text-[#17333b]">{value}</div><div className="text-xs leading-4 text-slate-500">{label}</div></div></div>;
}

function ReportInsights({ report }) {
  return (
    <aside className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5 lg:border-l lg:border-t-0">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#17333b]"><Lightbulb className="h-4 w-4 text-amber-600" />Management observations</div>
      <ul className="mt-3 space-y-2.5">{report.observations.map((observation) => <li key={observation} className="text-sm leading-5 text-slate-700">{observation}</li>)}</ul>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage position</h3>
        <dl className="mt-2 space-y-2">{report.statistics.byStatus.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><dt className="text-slate-600">{item.label}</dt><dd className="font-semibold tabular-nums text-[#17333b]">{item.count}</dd></div>)}</dl>
      </div>
    </aside>
  );
}

function SnapshotIssue({ row, index }) {
  return (
    <div className="py-4 first:pt-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold leading-5 text-[#17333b]">{row.title}</h4>
          <IssueMetadata row={row} />
          {row.attentionReasons.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{row.attentionReasons.map((reason) => <Tag key={reason}>{reason}</Tag>)}</div>}
          {row.currentPosition && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.currentPosition}</p>}
        </div>
      </div>
    </div>
  );
}

function ActivityIssue({ issue, options, index, selected, onToggle }) {
  return (
    <div className={`py-4 first:pt-3 ${selected ? '' : 'activity-issue-excluded opacity-45'}`}>
      <div className="flex items-start gap-3">
        <label className="report-selection-controls mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center" title={selected ? 'Exclude from report' : 'Include in report'}>
          <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 accent-teal-700" />
        </label>
        <span className="report-print-index hidden w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="text-sm font-semibold leading-5 text-[#17333b]">{issue.title}</h4>
            <div className="flex flex-wrap gap-1.5">{issue.completedDuringPeriod && <Tag tone="teal">Completed</Tag>}{issue.slippedAtEnd && <Tag>Slippage</Tag>}{issue.nextPeriodPriority && <Tag tone="cyan">Next priority</Tag>}</div>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><strong className="font-semibold text-slate-700">Officer:</strong> {issue.officerName || 'Unassigned'}</span>
            <span><strong className="font-semibold text-slate-700">Division:</strong> {issue.divisionName || 'Unassigned'}</span>
            <span><strong className="font-semibold text-slate-700">Period-end stage:</strong> {issue.statusAtEnd}</span>
          </div>
          {options.openingPosition && <div className="mt-3 rounded border-l-2 border-slate-300 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold text-slate-600">Opening position</div>
            <p className="mt-1 text-sm leading-5 text-slate-700">{issue.openingPosition ? `${issue.openingPosition.status}${issue.openingPosition.note ? ` - ${issue.openingPosition.note}` : ''}` : 'No earlier milestone was recorded.'}</p>
          </div>}
          {options.developments && <div className="mt-3">
            <div className="text-xs font-semibold text-slate-600">Developments during the period</div>
            {issue.events.length ? <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">{issue.events.map((event) => <li key={event.id} className="text-sm leading-5 text-slate-700"><span className="font-semibold text-slate-500">{formatDisplayDate(event.date)}</span> - <strong className="font-semibold text-slate-800">{event.label}</strong>{event.eReceiptNumber && <span className="ml-1 text-teal-800">[eReceipt {event.eReceiptNumber}]</span>}{event.detail && <span>: {event.detail}</span>}</li>)}</ol> : <p className="mt-1 text-sm text-slate-500">No dated development recorded.</p>}
          </div>}
          {options.runningSummary && <div className="mt-3 rounded-md border border-cyan-100 bg-cyan-50/40 px-3 py-2.5"><div className="text-xs font-semibold text-cyan-900">Running summary{issue.runningSummaryVersion ? ` - version ${issue.runningSummaryVersion}` : ''}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">{issue.runningSummary || 'No running summary was saved by the end of this period.'}</p></div>}
          {options.nextPriorities && issue.nextPeriodPriority && <p className="mt-3 text-sm leading-5 text-slate-700"><strong className="font-semibold text-slate-800">Next-period priority:</strong> {issue.nextAction || issue.currentPosition || 'Continue action on this Issue.'}</p>}
        </div>
      </div>
    </div>
  );
}

function IssueMetadata({ row }) {
  return <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span><strong className="font-semibold text-slate-700">Stage:</strong> {row.status}</span><span><strong className="font-semibold text-slate-700">Officer:</strong> {row.officerName || 'Unassigned'}</span><span><strong className="font-semibold text-slate-700">Division:</strong> {row.divisionName || 'Unassigned'}</span><span><strong className="font-semibold text-slate-700">Deadline:</strong> {formatDisplayDate(row.deadline)}</span>{row.eFileNumber && <span><strong className="font-semibold text-slate-700">eFile:</strong> {row.eFileNumber}</span>}</div>;
}

function Tag({ children, tone = 'amber' }) {
  const styles = { amber: 'bg-amber-50 text-amber-800 ring-amber-200', teal: 'bg-teal-50 text-teal-800 ring-teal-200', cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200' };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles[tone]}`}>{children}</span>;
}

function ActivitySectionList({ title, issues, empty }) {
  return <section><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>{issues.length ? <ul className="mt-1.5 space-y-1">{issues.map((issue) => <li key={issue.id} className="text-sm leading-5 text-slate-700">{issue.title}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">{empty}</p>}</section>;
}

function EmptyReport({ message = 'No Issues match this report view and division.' }) {
  return <div className="mt-3 rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}
