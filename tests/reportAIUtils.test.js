import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildReportRefinementInput, normalizeReportRefinement, REPORT_REFINEMENT_SYSTEM_PROMPT } from '../src/utils/reportAIUtils.js';
import { buildRefinedReportDocx } from '../src/utils/reportExportUtils.js';

const report = {
  kind: 'activity',
  title: 'Weekly progress report',
  scopeLabel: 'Administration',
  periodStart: '2026-07-22',
  periodEnd: '2026-07-28',
  coveringNote: 'Submitted for review.',
  contentOptions: {
    openingPosition: true,
    developments: true,
    runningSummary: true,
    nextPriorities: true,
  },
  statistics: {
    issueCount: 1,
    developments: 2,
    completed: 0,
    slippages: 1,
    eReceipts: 1,
  },
  observations: ['One Issue was past deadline at period end.'],
  issues: [{
    id: 'issue-1',
    title: 'Audit reply for FY 2025-26',
    eFileNumber: 'A-12/4/2026',
    divisionName: 'Administration',
    officerName: 'A. Officer',
    openingPosition: { status: 'Pending', note: 'Comments awaited.' },
    events: [{
      date: '2026-07-24',
      label: 'Comments received',
      detail: 'Comments received from Finance.',
      eReceiptNumber: 'ER/2026/44',
    }],
    statusAtEnd: 'In Progress',
    completedDuringPeriod: false,
    slippedAtEnd: true,
    deadline: '2026-07-23',
    nextPeriodPriority: true,
    nextAction: 'Submit draft reply.',
    currentPosition: 'Draft under preparation.',
  }],
};

test('report refinement prompt carries selected source facts and strict fact discipline', () => {
  const input = buildReportRefinementInput(report);
  assert.match(input, /Audit reply for FY 2025-26/);
  assert.match(input, /ER\/2026\/44/);
  assert.match(input, /SLIPPAGES: 1/);
  assert.match(REPORT_REFINEMENT_SYSTEM_PROMPT, /Use only facts present in SOURCE REPORT/);
  assert.match(REPORT_REFINEMENT_SYSTEM_PROMPT, /Do not silently omit an included Issue/);
});

test('oversized report context is rejected before an AI request', () => {
  assert.throws(
    () => buildReportRefinementInput(report, { maximumCharacters: 100 }),
    /too large for one AI request/,
  );
});

test('AI refinement warns when an included Issue title is omitted or inference is used', () => {
  const result = normalizeReportRefinement(
    '# Executive summary\nThe matter is likely to be resolved.',
    report,
  );
  assert.equal(result.missingTitles.length, 1);
  assert.equal(result.warnings.length, 2);
});

test('AI refinement strips code fences and exports headings, bullets and native tables to DOCX', async () => {
  const result = normalizeReportRefinement(
    '```markdown\n# Executive summary\nAudit reply for FY 2025-26\n- One development\n| Issue | Stage |\n| --- | --- |\n| Audit reply for FY 2025-26 | In Progress |\n```',
    report,
  );
  assert.doesNotMatch(result.text, /```/);
  const blob = await buildRefinedReportDocx({
    title: report.title,
    scopeLabel: report.scopeLabel,
    dateLine: '22 Jul 2026 to 28 Jul 2026',
    text: result.text,
  });
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const archive = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const documentXml = await archive.file('word/document.xml').async('string');
  assert.match(documentXml, /Executive summary/);
  assert.match(documentXml, /One development/);
  assert.match(documentXml, /Issue/);
  assert.match(documentXml, /Stage/);
  assert.match(documentXml, /<w:tbl>/);
});
