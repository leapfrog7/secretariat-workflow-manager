import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildActivityReport, buildIssueReport, getReportPeriod, toReportDate } from '../src/utils/reportUtils.js';
import { buildIssueReportDocx } from '../src/utils/reportExportUtils.js';
import { buildActivityReportCsv } from '../src/utils/reportCsvUtils.js';
import { buildReportRefinementInput } from '../src/utils/reportAIUtils.js';

const issues = [
  {
    id: 'overdue',
    shortTitle: 'Overdue audit reply',
    status: 'Pending',
    priority: 'High',
    assignedOfficerId: '',
    owningDivisionId: 'finance',
    nextDeadline: '2026-07-20',
    currentPosition: 'Reply is under examination.',
    dateOpened: '2026-07-01',
    updatedAt: '2026-07-25T10:00:00Z',
    isArchived: false,
    isScheduled: false,
  },
  {
    id: 'routine',
    shortTitle: 'Routine establishment matter',
    status: 'In Progress',
    priority: 'Normal',
    assignedOfficerId: 'officer-1',
    owningDivisionId: 'admin',
    nextDeadline: '2026-08-20',
    currentPosition: 'Draft has been prepared.',
    updatedAt: '2026-07-24T10:00:00Z',
    isArchived: false,
    isScheduled: false,
  },
  {
    id: 'completed',
    shortTitle: 'Completed parliamentary reply',
    status: 'Completed',
    assignedOfficerId: 'officer-1',
    owningDivisionId: 'admin',
    dateClosed: '2026-07-22',
    updatedAt: '2026-07-22T10:00:00Z',
    isArchived: true,
    isScheduled: false,
  },
];

const people = [{ id: 'officer-1', name: 'A. Officer' }];
const divisions = [{ id: 'finance', name: 'Finance' }, { id: 'admin', name: 'Administration' }];

test('current report excludes archived and scheduled Issues', () => {
  const report = buildIssueReport({ issues, officers: people, divisions, asOfDate: '2026-07-28' });
  assert.deepEqual(report.rows.map((row) => row.id), ['overdue', 'routine']);
  assert.equal(report.statistics.overdue, 1);
  assert.equal(report.statistics.unassigned, 1);
});

test('attention report includes operational risks and respects division scope', () => {
  const report = buildIssueReport({
    issues,
    officers: people,
    divisions,
    reportType: 'attention',
    divisionId: 'finance',
    asOfDate: '2026-07-28',
  });
  assert.deepEqual(report.rows.map((row) => row.id), ['overdue']);
  assert.deepEqual(report.rows[0].attentionReasons, ['Overdue', 'High priority']);
  assert.equal(report.scopeLabel, 'Finance');
});

test('completed report includes archived completed work and can omit position text', () => {
  const report = buildIssueReport({
    issues,
    officers: people,
    divisions,
    reportType: 'completed',
    includeCurrentPosition: false,
    asOfDate: '2026-07-28',
  });
  assert.deepEqual(report.rows.map((row) => row.id), ['completed']);
  assert.equal(report.rows[0].currentPosition, '');
});

async function readDocxDocumentXml(blob) {
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]);
  const archive = await JSZip.loadAsync(bytes);
  return archive.file('word/document.xml').async('string');
}

test('DOCX export creates a genuine Word document and preserves report facts', async () => {
  const report = buildIssueReport({
    issues: [{ ...issues[0], shortTitle: 'Audit {reply}' }],
    officers: people,
    divisions,
    asOfDate: '2026-07-28',
  });
  const xml = await readDocxDocumentXml(await buildIssueReportDocx(report));
  assert.match(xml, /Audit \{reply\}/);
  assert.match(xml, /Overdue audit|Overdue/);
  assert.match(xml, /Due today or within 7 days/);
});

test('weekly and monthly periods use inclusive official date boundaries', () => {
  assert.deepEqual(
    getReportPeriod({ preset: 'weekly', anchorDate: '2026-07-28' }),
    { preset: 'weekly', startDate: '2026-07-22', endDate: '2026-07-28' },
  );
  assert.deepEqual(
    getReportPeriod({ preset: 'monthly', anchorDate: '2026-07-28' }),
    { preset: 'monthly', startDate: '2026-07-01', endDate: '2026-07-28' },
  );
  assert.throws(
    () => getReportPeriod({ preset: 'custom', anchorDate: '2026-07-28', customStart: '2026-07-29', customEnd: '2026-07-28' }),
    /start date cannot be after/,
  );
});

test('timestamped history uses the report time zone while official date-only records remain fixed', () => {
  assert.equal(toReportDate('2026-07-21T19:00:00.000Z', 'Asia/Kolkata'), '2026-07-22');
  assert.equal(toReportDate('2026-07-21', 'America/New_York'), '2026-07-21');
});

test('activity report separates opening position, developments, completion and slippage', () => {
  const activityIssues = [
    {
      ...issues[1],
      id: 'completed-in-period',
      shortTitle: 'Periodic input',
      status: 'Completed',
      dateOpened: '2026-07-01',
      dateClosed: '2026-07-27',
      isScheduled: true,
      recurrenceType: 'Weekly',
      nextAppearanceDate: '2026-08-03',
    },
    {
      ...issues[0],
      id: 'slipped',
      shortTitle: 'Slipped court reply',
      status: 'Pending',
      nextDeadline: '2026-07-24',
      dateOpened: '2026-07-01',
    },
  ];
  const activity = buildActivityReport({
    issues: activityIssues,
    officers: people,
    divisions,
    periodStart: '2026-07-22',
    periodEnd: '2026-07-28',
    periodPreset: 'weekly',
    milestones: [
      { id: 'm1', issueId: 'completed-in-period', status: 'In Progress', note: 'Input was being compiled.', recordedAt: '2026-07-20T10:00:00Z' },
      { id: 'm2', issueId: 'completed-in-period', status: 'Completed', note: 'Input submitted.', recordedAt: '2026-07-27T10:00:00Z' },
      { id: 'm3', issueId: 'slipped', status: 'Pending', note: 'Comments awaited.', recordedAt: '2026-07-22T10:00:00Z' },
    ],
    communications: [
      { id: 'c1', issueId: 'completed-in-period', communicationDate: '2026-07-22', communicationType: 'Letter received', details: 'Opening-day communication.', eReceiptNumber: 'ER/1' },
      { id: 'c2', issueId: 'completed-in-period', communicationDate: '2026-07-28', communicationType: 'Letter issued', details: 'Closing-day communication.' },
    ],
    summaries: [
      { id: 's1', issueId: 'slipped', version: 2, content: 'The matter remains pending.', createdAt: '2026-07-25T10:00:00Z' },
    ],
  });

  assert.equal(activity.statistics.issueCount, 2);
  assert.equal(activity.statistics.completed, 1);
  assert.equal(activity.statistics.slippages, 1);
  assert.equal(activity.statistics.eReceipts, 1);
  const completed = activity.issues.find((issue) => issue.id === 'completed-in-period');
  assert.equal(completed.openingPosition.status, 'In Progress');
  assert.equal(completed.events.length, 1);
  assert.deepEqual(completed.events.map((event) => event.kind), ['milestone']);
  assert.equal(completed.completedDuringPeriod, true);
  assert.equal(activity.statistics.communications, 2);
  assert.equal(activity.statistics.summaryUpdates, 1);
  assert.equal(activity.sections.slippages[0].id, 'slipped');
});

test('activity Issue selection controls exported Word and CSV content', async () => {
  const report = buildActivityReport({
    issues: [
      { ...issues[0], id: 'included', shortTitle: 'Included issue', dateOpened: '2026-07-01' },
      { ...issues[1], id: 'excluded', shortTitle: 'Excluded issue', dateOpened: '2026-07-01' },
    ],
    officers: people,
    divisions,
    periodStart: '2026-07-22',
    periodEnd: '2026-07-28',
    selectedIssueIds: ['included'],
    milestones: [
      { id: 'm1', issueId: 'included', status: 'Pending', note: 'Included note.', recordedAt: '2026-07-24T10:00:00Z' },
      { id: 'm2', issueId: 'excluded', status: 'In Progress', note: 'Excluded note.', recordedAt: '2026-07-24T10:00:00Z' },
    ],
  });
  const documentXml = await readDocxDocumentXml(await buildIssueReportDocx(report));
  const csv = buildActivityReportCsv(report);
  assert.match(documentXml, /Included issue/);
  assert.doesNotMatch(documentXml, /Excluded issue/);
  assert.match(csv, /Included issue/);
  assert.doesNotMatch(csv, /Excluded issue/);
});

test('period content controls omit hidden context from preview data, Word and AI input', async () => {
  const controlled = buildActivityReport({
    issues: [{ ...issues[0], id: 'controlled', shortTitle: 'Controlled report issue', dateOpened: '2026-07-01' }],
    officers: people,
    divisions,
    periodStart: '2026-07-22',
    periodEnd: '2026-07-28',
    milestones: [
      { id: 'before', issueId: 'controlled', status: 'Pending', note: 'Opening note must stay hidden.', recordedAt: '2026-07-20T10:00:00Z' },
      { id: 'during', issueId: 'controlled', status: 'In Progress', note: 'Development must stay hidden.', recordedAt: '2026-07-24T10:00:00Z' },
    ],
    communications: [
      { id: 'communication', issueId: 'controlled', communicationDate: '2026-07-25', communicationType: 'Comments received', details: 'Hidden communication detail.' },
    ],
    summaries: [
      { id: 'summary', issueId: 'controlled', version: 3, content: 'Approved running summary text.', createdAt: '2026-07-26T10:00:00Z' },
    ],
    contentOptions: {
      openingPosition: false,
      developments: false,
      runningSummary: true,
      nextPriorities: false,
    },
  });
  const issue = controlled.issues[0];
  assert.equal(issue.openingPosition, null);
  assert.deepEqual(issue.events, []);
  assert.equal(issue.runningSummary, 'Approved running summary text.');
  assert.equal(issue.nextPeriodPriority, false);

  const documentXml = await readDocxDocumentXml(await buildIssueReportDocx(controlled));
  const csv = buildActivityReportCsv(controlled);
  const aiInput = buildReportRefinementInput(controlled);
  assert.match(documentXml, /Approved running summary text/);
  assert.match(csv, /Approved running summary text/);
  assert.match(aiInput, /Approved running summary text/);
  assert.doesNotMatch(documentXml, /Hidden communication detail|Opening note must stay hidden/);
  assert.doesNotMatch(csv, /Hidden communication detail|Opening note must stay hidden/);
  assert.doesNotMatch(aiInput, /Hidden communication detail|Opening note must stay hidden/);
});
