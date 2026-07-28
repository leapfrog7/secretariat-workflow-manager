export const REPORT_REFINEMENT_SYSTEM_PROMPT = [
  'Improve the supplied official management report for human review.',
  'Use only facts present in SOURCE REPORT. Do not add causes, explanations, achievements, recommendations, deadlines, decisions, risks, names, dates, numbers or next steps that are not explicitly supplied.',
  'Preserve every Issue title, eFile number, date, count, stage, officer, division, eReceipt number and rule-based classification exactly.',
  'Do not silently omit an included Issue. If information is absent, omit the assertion instead of guessing.',
  'Distinguish recorded facts from management observations. Do not describe a matter as delayed, urgent, satisfactory or resolved unless the source says so.',
  'Remove repetition, improve ordering and use concise Government-office language.',
  'Return Markdown only, using these headings: Executive summary; Work position and progress; Issues requiring attention; Next-period priorities.',
  'Use short paragraphs, bullets and a Markdown table only when it materially improves comparison.',
  'Do not include a preface, drafting commentary, disclaimer, signature or invented conclusion.',
].join(' ');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function snapshotSource(report) {
  const rows = report.rows.map((row, index) => [
    `ISSUE ${index + 1}`,
    `Title: ${row.title}`,
    `eFile number: ${row.eFileNumber || 'Not recorded'}`,
    `Division: ${row.divisionName || 'Unassigned'}`,
    `Assigned officer: ${row.officerName || 'Unassigned'}`,
    `Stage: ${row.status}`,
    `Priority: ${row.priority || 'Not recorded'}`,
    `Deadline: ${row.deadline || 'Not recorded'}`,
    `Attention: ${row.attentionReasons.join(', ') || 'None identified'}`,
    `Current position: ${clean(row.currentPosition) || 'Not included'}`,
  ].join('\n')).join('\n\n');
  return [
    'REPORT FORM: Current snapshot',
    `REPORT TITLE: ${report.title}`,
    `SCOPE: ${report.scopeLabel}`,
    `AS ON: ${report.asOfDate}`,
    `TOTAL ISSUES: ${report.statistics.total}`,
    `OVERDUE: ${report.statistics.overdue}`,
    `DUE TODAY OR WITHIN 7 DAYS: ${report.statistics.dueSoon}`,
    `UNASSIGNED: ${report.statistics.unassigned}`,
    `STAGE POSITION: ${report.statistics.byStatus.map((item) => `${item.label}: ${item.count}`).join(' | ') || 'None'}`,
    `RULE-BASED OBSERVATIONS:\n${report.observations.map((item) => `- ${item}`).join('\n')}`,
    rows,
  ].join('\n\n');
}

function activitySource(report) {
  const issues = report.issues.map((issue, index) => {
    const events = issue.events.map((event) => [
      `- ${event.date}: ${event.label}`,
      event.eReceiptNumber ? ` [eReceipt ${event.eReceiptNumber}]` : '',
      event.detail ? ` - ${clean(event.detail)}` : '',
    ].join('')).join('\n');
    return [
      `ISSUE ${index + 1}`,
      `Title: ${issue.title}`,
      `eFile number: ${issue.eFileNumber || 'Not recorded'}`,
      `Division: ${issue.divisionName || 'Unassigned'}`,
      `Assigned officer: ${issue.officerName || 'Unassigned'}`,
      report.contentOptions?.openingPosition
        ? `Opening position: ${issue.openingPosition ? `${issue.openingPosition.status}${issue.openingPosition.note ? ` - ${clean(issue.openingPosition.note)}` : ''}` : 'No earlier milestone recorded'}`
        : '',
      report.contentOptions?.developments ? `Developments:\n${events || '- No dated development recorded'}` : '',
      report.contentOptions?.runningSummary
        ? `Running summary${issue.runningSummaryVersion ? ` (version ${issue.runningSummaryVersion})` : ''}: ${clean(issue.runningSummary) || 'Not recorded'}`
        : '',
      `Stage at period end: ${issue.statusAtEnd}`,
      `Completed during period: ${issue.completedDuringPeriod ? 'Yes' : 'No'}`,
      `Slippage at period end: ${issue.slippedAtEnd ? `Yes - deadline ${issue.deadline || 'not recorded'}` : 'No'}`,
      report.contentOptions?.nextPriorities
        ? `Next-period priority: ${issue.nextPeriodPriority ? clean(issue.nextAction || issue.currentPosition || 'Continue action on this Issue') : 'None identified'}`
        : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
  return [
    'REPORT FORM: Period progress',
    `REPORT TITLE: ${report.title}`,
    `SCOPE: ${report.scopeLabel}`,
    `PERIOD: ${report.periodStart} to ${report.periodEnd}`,
    `COVERING NOTE: ${clean(report.coveringNote) || 'None'}`,
    `ISSUES INCLUDED: ${report.statistics.issueCount}`,
    `RECORDED DEVELOPMENTS: ${report.statistics.developments}`,
    `COMPLETED: ${report.statistics.completed}`,
    `SLIPPAGES: ${report.statistics.slippages}`,
    `ERECEIPTS: ${report.statistics.eReceipts}`,
    `RULE-BASED OBSERVATIONS:\n${report.observations.map((item) => `- ${item}`).join('\n')}`,
    issues,
  ].join('\n\n');
}

export function buildReportRefinementInput(report, { maximumCharacters = 70000 } = {}) {
  if (!report) throw new Error('Generate a source report before using AI.');
  const issueCount = report.kind === 'activity' ? report.issues.length : report.rows.length;
  if (!issueCount) throw new Error('Include at least one Issue before using AI.');
  const source = report.kind === 'activity' ? activitySource(report) : snapshotSource(report);
  const input = `TASK\nPrepare a clearer management-facing version of the report below. Retain all included Issues and source facts.\n\nSOURCE REPORT\n${source}`;
  if (input.length > maximumCharacters) {
    throw new Error('This report is too large for one AI request. Select fewer Issues or a shorter period.');
  }
  return input;
}

export function normalizeReportRefinement(text, report) {
  const output = String(text || '').replace(/```(?:markdown|md)?/gi, '').replace(/```/g, '').trim();
  if (!output) throw new Error('AI returned no report text.');
  const issues = report?.kind === 'activity' ? report.issues || [] : report?.rows || [];
  const normalizedOutput = output.toLocaleLowerCase();
  const missingTitles = issues
    .map((issue) => issue.title)
    .filter((title) => title && !normalizedOutput.includes(String(title).toLocaleLowerCase()));
  const warnings = [];
  if (missingTitles.length) {
    warnings.push(`${missingTitles.length} included Issue title${missingTitles.length === 1 ? ' is' : 's are'} missing from the AI version.`);
  }
  if (/\b(?:assume|presumably|likely|apparently)\b/i.test(output)) {
    warnings.push('The AI version contains inferential wording. Verify it against the source report.');
  }
  return { text: output, warnings, missingTitles };
}
