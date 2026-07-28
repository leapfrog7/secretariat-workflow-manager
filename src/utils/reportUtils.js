import { differenceInCalendarDays, format, isValid, parseISO, startOfMonth, subDays } from 'date-fns';
import { ISSUE_STATUSES } from '../constants/issueConstants.js';

export const REPORT_TYPES = [
  {
    value: 'current',
    label: 'Current position',
    description: 'A complete snapshot of the current Issue register.',
  },
  {
    value: 'attention',
    label: 'Attention required',
    description: 'Deadline risks and matters awaiting input or discussion.',
  },
  {
    value: 'completed',
    label: 'Completed work',
    description: 'Completed matters, including those already archived or scheduled.',
  },
];

export const REPORT_PERIOD_PRESETS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom dates' },
];

export const DEFAULT_REPORT_TIME_ZONE = 'Asia/Kolkata';

export const DEFAULT_ACTIVITY_CONTENT_OPTIONS = {
  openingPosition: true,
  developments: true,
  runningSummary: false,
  nextPriorities: true,
};

const deadlineRank = { overdue: 0, today: 1, upcoming: 2, future: 3, none: 4, closed: 5 };
const priorityRanks = { Critical: 0, High: 1, Normal: 2, Low: 3 };

function currentDateISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toReportDate(value, timeZone = DEFAULT_REPORT_TIME_ZONE) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getReportPeriod({
  preset = 'weekly',
  anchorDate = currentDateISO(),
  customStart = '',
  customEnd = '',
} = {}) {
  const anchor = parseISO(anchorDate);
  if (!isValid(anchor)) throw new Error('Choose a valid report date.');
  if (preset === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customStart) || !/^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
      throw new Error('Choose both dates for the custom report period.');
    }
    if (customStart > customEnd) throw new Error('The report start date cannot be after the end date.');
    return { preset, startDate: customStart, endDate: customEnd };
  }
  if (preset === 'monthly') {
    return { preset, startDate: format(startOfMonth(anchor), 'yyyy-MM-dd'), endDate: anchorDate };
  }
  return { preset: 'weekly', startDate: format(subDays(anchor, 6), 'yyyy-MM-dd'), endDate: anchorDate };
}

function isWithinPeriod(value, startDate, endDate, timeZone) {
  const date = toReportDate(value, timeZone);
  return Boolean(date && date >= startDate && date <= endDate);
}

function compactText(value, maximum = 420) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3).trimEnd()}...`;
}

function groupByIssue(items = []) {
  const grouped = new Map();
  items.forEach((item) => {
    const existing = grouped.get(item.issueId) || [];
    existing.push(item);
    grouped.set(item.issueId, existing);
  });
  return grouped;
}

function milestoneEvent(milestone, timeZone) {
  const assignment = milestone.assignedOfficerName ? `Assigned to ${milestone.assignedOfficerName}.` : '';
  return {
    id: `milestone:${milestone.id}`,
    kind: 'milestone',
    date: toReportDate(milestone.recordedAt, timeZone),
    timestamp: milestone.recordedAt || milestone.createdAt || '',
    label: `Position updated to ${milestone.status}`,
    detail: compactText(milestone.note || assignment || 'No position note was recorded.'),
    eReceiptNumber: '',
  };
}

function communicationEvent(communication, timeZone) {
  const source = [communication.correspondent, communication.sourceSubject].filter(Boolean).join(' - ');
  return {
    id: `communication:${communication.id}`,
    kind: 'communication',
    date: toReportDate(communication.communicationDate || communication.createdAt, timeZone),
    timestamp: communication.createdAt || communication.communicationDate || '',
    label: communication.communicationType || 'Communication recorded',
    detail: compactText(communication.details || communication.sourceDigest || source || 'Communication recorded.'),
    eReceiptNumber: communication.eReceiptNumber || '',
  };
}

function summaryEvent(summary, timeZone) {
  return {
    id: `summary:${summary.id}`,
    kind: 'summary',
    date: toReportDate(summary.createdAt, timeZone),
    timestamp: summary.createdAt || '',
    label: `Running summary updated${summary.version ? ` (version ${summary.version})` : ''}`,
    detail: compactText(summary.content || 'Summary updated.'),
    eReceiptNumber: '',
  };
}

function activityObservations(statistics) {
  if (!statistics.issueCount) return ['No recorded activity or reportable slippage falls within this period.'];
  const observations = [];
  if (statistics.completed) observations.push(`${statistics.completed} Issue${statistics.completed === 1 ? ' was' : 's were'} completed during the period.`);
  if (statistics.slippages) observations.push(`${statistics.slippages} Issue${statistics.slippages === 1 ? ' was' : 's were'} past deadline at the end of the period.`);
  if (statistics.eReceipts) observations.push(`${statistics.eReceipts} eReceipt${statistics.eReceipts === 1 ? ' was' : 's were'} recorded during the period.`);
  if (statistics.summaryUpdates) observations.push(`${statistics.summaryUpdates} running-summary update${statistics.summaryUpdates === 1 ? ' was' : 's were'} recorded.`);
  if (!observations.length) observations.push(`${statistics.developments} recorded development${statistics.developments === 1 ? ' falls' : 's fall'} within the period.`);
  return observations.slice(0, 4);
}

export function buildActivityReport({
  issues = [],
  officers = [],
  divisions = [],
  milestones = [],
  communications = [],
  summaries = [],
  periodStart,
  periodEnd,
  periodPreset = 'weekly',
  divisionId = '',
  selectedIssueIds,
  coveringNote = '',
  contentOptions = DEFAULT_ACTIVITY_CONTENT_OPTIONS,
  timeZone = DEFAULT_REPORT_TIME_ZONE,
} = {}) {
  if (!periodStart || !periodEnd || periodStart > periodEnd) throw new Error('Choose a valid report period.');
  const officerNames = new Map(officers.map((officer) => [officer.id, officer.name]));
  const divisionNames = new Map(divisions.map((division) => [division.id, division.name]));
  const selectedDivision = divisions.find((division) => division.id === divisionId);
  const milestonesByIssue = groupByIssue(milestones);
  const communicationsByIssue = groupByIssue(communications);
  const summariesByIssue = groupByIssue(summaries);
  const selected = selectedIssueIds == null ? null : new Set(selectedIssueIds);
  const includedContent = { ...DEFAULT_ACTIVITY_CONTENT_OPTIONS, ...(contentOptions || {}) };

  const candidateIssues = issues.flatMap((issue) => {
    if (divisionId === '__unassigned__' && issue.owningDivisionId) return [];
    if (divisionId && divisionId !== '__unassigned__' && issue.owningDivisionId !== divisionId) return [];

    const issueMilestones = (milestonesByIssue.get(issue.id) || [])
      .map((item) => ({ raw: item, event: milestoneEvent(item, timeZone) }))
      .filter(({ event }) => event.date)
      .sort((left, right) => left.event.timestamp.localeCompare(right.event.timestamp));
    const openingMilestone = [...issueMilestones].reverse().find(({ event }) => event.date < periodStart);
    const milestonesToEnd = issueMilestones.filter(({ event }) => event.date <= periodEnd);
    const endMilestone = milestonesToEnd[milestonesToEnd.length - 1];
    const milestoneEvents = issueMilestones.filter(({ event }) => event.date >= periodStart && event.date <= periodEnd).map(({ event }) => event);
    const communicationEvents = (communicationsByIssue.get(issue.id) || [])
      .map((item) => communicationEvent(item, timeZone))
      .filter((event) => event.date >= periodStart && event.date <= periodEnd);
    const issueSummaries = (summariesByIssue.get(issue.id) || [])
      .map((item) => ({ raw: item, event: summaryEvent(item, timeZone) }))
      .filter(({ event }) => event.date)
      .sort((left, right) => left.event.timestamp.localeCompare(right.event.timestamp));
    const latestSummary = [...issueSummaries].reverse().find(({ event }) => event.date <= periodEnd);
    const summaryEvents = issueSummaries
      .filter(({ event }) => event.date >= periodStart && event.date <= periodEnd)
      .map(({ event }) => event);
    const recordedEvents = [...milestoneEvents, ...communicationEvents, ...summaryEvents]
      .sort((left, right) => left.date.localeCompare(right.date) || left.timestamp.localeCompare(right.timestamp));
    const completedDuringPeriod = milestoneEvents.some((event) => event.label === 'Position updated to Completed')
      || isWithinPeriod(issue.dateClosed, periodStart, periodEnd, timeZone);
    const openedDate = toReportDate(issue.dateOpened || issue.createdAt, timeZone);
    const statusAtEnd = endMilestone?.raw.status
      || (openedDate && openedDate <= periodEnd ? issue.status : '');
    const openAtEnd = statusAtEnd && !['Completed', 'Cancelled'].includes(statusAtEnd);
    const slippedAtEnd = Boolean(openAtEnd && issue.nextDeadline && issue.nextDeadline < periodEnd);
    if (!recordedEvents.length && !completedDuringPeriod && !slippedAtEnd) return [];

    return [{
      id: issue.id,
      title: issue.shortTitle || issue.subject || 'Untitled Issue',
      eFileNumber: issue.eFileNumber || '',
      divisionName: divisionNames.get(issue.owningDivisionId) || '',
      officerName: endMilestone?.raw.assignedOfficerName || officerNames.get(issue.assignedOfficerId) || '',
      openingPosition: includedContent.openingPosition && openingMilestone ? {
        date: openingMilestone.event.date,
        status: openingMilestone.raw.status,
        note: compactText(openingMilestone.raw.note || ''),
      } : null,
      statusAtEnd: statusAtEnd || 'Not recorded',
      runningSummary: includedContent.runningSummary && latestSummary
        ? String(latestSummary.raw.content || '').trim()
        : '',
      runningSummaryVersion: includedContent.runningSummary ? latestSummary?.raw.version || 0 : 0,
      currentPosition: includedContent.nextPriorities ? compactText(issue.currentPosition || '') : '',
      nextAction: includedContent.nextPriorities ? compactText(issue.nextAction || '') : '',
      deadline: issue.nextDeadline || '',
      events: includedContent.developments ? milestoneEvents : [],
      recordedDevelopmentCount: milestoneEvents.length,
      recordedCommunicationCount: communicationEvents.length,
      recordedEReceiptCount: communicationEvents.filter((event) => event.eReceiptNumber).length,
      recordedSummaryUpdateCount: summaryEvents.length,
      completedDuringPeriod,
      slippedAtEnd,
      nextPeriodPriority: Boolean(includedContent.nextPriorities && openAtEnd && (issue.nextAction || issue.nextDeadline > periodEnd || ['High', 'Critical'].includes(issue.priority))),
      priority: issue.priority || '',
      updatedAt: issue.updatedAt || '',
    }];
  }).sort((left, right) => {
    if (left.slippedAtEnd !== right.slippedAtEnd) return left.slippedAtEnd ? -1 : 1;
    if (left.nextPeriodPriority !== right.nextPeriodPriority) return left.nextPeriodPriority ? -1 : 1;
    return left.title.localeCompare(right.title);
  });

  const reportIssues = selected ? candidateIssues.filter((issue) => selected.has(issue.id)) : candidateIssues;
  const statistics = {
    issueCount: reportIssues.length,
    developments: reportIssues.reduce((total, issue) => total + issue.recordedDevelopmentCount, 0),
    completed: reportIssues.filter((issue) => issue.completedDuringPeriod).length,
    slippages: reportIssues.filter((issue) => issue.slippedAtEnd).length,
    eReceipts: reportIssues.reduce((total, issue) => total + issue.recordedEReceiptCount, 0),
    communications: reportIssues.reduce((total, issue) => total + issue.recordedCommunicationCount, 0),
    summaryUpdates: reportIssues.reduce((total, issue) => total + issue.recordedSummaryUpdateCount, 0),
  };

  return {
    kind: 'activity',
    title: `${periodPreset === 'monthly' ? 'Monthly' : periodPreset === 'custom' ? 'Period' : 'Weekly'} progress report`,
    scopeLabel: divisionId === '__unassigned__'
      ? 'Issues without an owning division'
      : selectedDivision?.name || 'All accessible divisions',
    periodPreset,
    periodStart,
    periodEnd,
    coveringNote: String(coveringNote || '').trim(),
    contentOptions: includedContent,
    timeZone,
    candidateIssueIds: candidateIssues.map((issue) => issue.id),
    issues: reportIssues,
    statistics,
    observations: activityObservations(statistics),
    sections: {
      developments: reportIssues.filter((issue) => issue.events.length),
      completed: reportIssues.filter((issue) => issue.completedDuringPeriod),
      slippages: reportIssues.filter((issue) => issue.slippedAtEnd),
      nextPriorities: reportIssues.filter((issue) => issue.nextPeriodPriority),
    },
  };
}

function deadlineState(issue, asOfDate) {
  if (!issue?.nextDeadline) return 'none';
  if (['Completed', 'Cancelled'].includes(issue.status) || issue.dateClosed) return 'closed';
  const deadline = parseISO(issue.nextDeadline);
  const asOf = parseISO(asOfDate);
  if (!isValid(deadline) || !isValid(asOf)) return 'none';
  const days = differenceInCalendarDays(deadline, asOf);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'upcoming';
  return 'future';
}

function attentionReasons(issue, state) {
  const reasons = [];
  if (state === 'overdue') reasons.push('Overdue');
  if (state === 'today') reasons.push('Due today');
  if (state === 'upcoming') reasons.push('Due within 7 days');
  if (issue.status === 'Awaiting Input') reasons.push('Awaiting input');
  if (issue.status === 'Awaiting Discussion') reasons.push('Awaiting discussion');
  if (['High', 'Critical'].includes(issue.priority)) reasons.push(`${issue.priority} priority`);
  return reasons;
}

function buildObservations(rows, statistics, reportType) {
  if (!rows.length) return ['No Issues match the selected report scope.'];
  const observations = [];
  if (statistics.overdue) {
    observations.push(`${statistics.overdue} of ${statistics.total} Issue${statistics.total === 1 ? '' : 's'} ${statistics.overdue === 1 ? 'is' : 'are'} overdue.`);
  }
  if (statistics.dueSoon) {
    observations.push(`${statistics.dueSoon} Issue${statistics.dueSoon === 1 ? '' : 's'} ${statistics.dueSoon === 1 ? 'is' : 'are'} due today or within the next 7 days.`);
  }
  if (statistics.unassigned) {
    observations.push(`${statistics.unassigned} ${statistics.unassigned === 1 ? 'Issue has' : 'Issues have'} no assigned officer.`);
  }
  if (reportType !== 'completed' && statistics.withoutDeadline) {
    observations.push(`${statistics.withoutDeadline} ${statistics.withoutDeadline === 1 ? 'Issue does' : 'Issues do'} not have a deadline recorded.`);
  }
  const dominant = statistics.byStatus.reduce((best, item) => (!best || item.count > best.count ? item : best), null);
  if (dominant && dominant.count > 1 && observations.length < 4) {
    observations.push(`${dominant.label} is the largest stage group, with ${dominant.count} Issues.`);
  }
  if (!observations.length) observations.push('No immediate deadline or allocation risks are visible in this report.');
  return observations.slice(0, 4);
}

export function buildIssueReport({
  issues = [],
  officers = [],
  divisions = [],
  reportType = 'current',
  divisionId = '',
  includeCurrentPosition = true,
  asOfDate = currentDateISO(),
} = {}) {
  const selectedType = REPORT_TYPES.find((type) => type.value === reportType) || REPORT_TYPES[0];
  const officerNames = new Map(officers.map((officer) => [officer.id, officer.name]));
  const divisionNames = new Map(divisions.map((division) => [division.id, division.name]));
  const selectedDivision = divisions.find((division) => division.id === divisionId);

  const rows = issues.flatMap((issue) => {
    if (divisionId === '__unassigned__' && issue.owningDivisionId) return [];
    if (divisionId && divisionId !== '__unassigned__' && issue.owningDivisionId !== divisionId) return [];

    const current = !issue.isArchived && !issue.isScheduled;
    const state = deadlineState(issue, asOfDate);
    const reasons = attentionReasons(issue, state);
    if (reportType === 'current' && !current) return [];
    if (reportType === 'attention' && (!current || !reasons.length)) return [];
    if (reportType === 'completed' && issue.status !== 'Completed') return [];

    return [{
      id: issue.id,
      title: issue.shortTitle || issue.subject || 'Untitled Issue',
      eFileNumber: issue.eFileNumber || '',
      subjectType: issue.subjectType || '',
      status: issue.status,
      priority: issue.priority || '',
      officerName: officerNames.get(issue.assignedOfficerId) || '',
      divisionName: divisionNames.get(issue.owningDivisionId) || '',
      dateOpened: issue.dateOpened || '',
      deadline: issue.nextDeadline || '',
      deadlineState: state,
      currentPosition: includeCurrentPosition ? String(issue.currentPosition || '').trim() : '',
      updatedAt: issue.updatedAt || '',
      attentionReasons: reasons,
    }];
  }).sort((left, right) => {
    const stateDifference = (deadlineRank[left.deadlineState] ?? 9) - (deadlineRank[right.deadlineState] ?? 9);
    if (stateDifference) return stateDifference;
    const priorityDifference = (priorityRanks[left.priority] ?? 4) - (priorityRanks[right.priority] ?? 4);
    if (priorityDifference) return priorityDifference;
    return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
  });

  const statistics = {
    total: rows.length,
    overdue: rows.filter((row) => row.deadlineState === 'overdue').length,
    dueSoon: rows.filter((row) => ['today', 'upcoming'].includes(row.deadlineState)).length,
    unassigned: rows.filter((row) => !row.officerName).length,
    withoutDeadline: rows.filter((row) => !row.deadline).length,
    byStatus: ISSUE_STATUSES
      .map((status) => ({ label: status, count: rows.filter((row) => row.status === status).length }))
      .filter((item) => item.count),
  };

  return {
    reportType: selectedType.value,
    title: `${selectedType.label} report`,
    description: selectedType.description,
    scopeLabel: divisionId === '__unassigned__'
      ? 'Issues without an owning division'
      : selectedDivision?.name || 'All accessible divisions',
    asOfDate,
    includeCurrentPosition,
    rows,
    statistics,
    observations: buildObservations(rows, statistics, selectedType.value),
  };
}
