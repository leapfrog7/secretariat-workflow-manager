import { formatDisplayDate } from './dateUtils';

function addLine(lines, label, value) {
  const text = String(value || '').trim();
  if (text) lines.push(`${label}: ${text}`);
}

function makeSection(title, lines) {
  const content = lines.filter(Boolean);
  return content.length ? `${title}\n${content.join('\n')}` : '';
}

export function buildAIContext({
  issue,
  assignedOfficer,
  summary,
  communications = [],
  references = [],
  includeIssueDetails = true,
  includeSummary = true,
  includeCurrentPosition = true,
} = {}) {
  const sections = [];

  if (includeIssueDetails && issue) {
    const lines = [];
    addLine(lines, 'Title', issue.shortTitle);
    addLine(lines, 'eFile number', issue.eFileNumber);
    addLine(lines, 'Subject type', issue.subjectType);
    addLine(lines, 'Organisation', issue.organisation);
    addLine(lines, 'Stage', issue.status);
    addLine(lines, 'Assigned officer', assignedOfficer?.name);
    addLine(lines, 'Deadline', issue.nextDeadline ? formatDisplayDate(issue.nextDeadline) : '');
    addLine(lines, 'Date opened', issue.dateOpened ? formatDisplayDate(issue.dateOpened) : '');
    sections.push(makeSection('ISSUE', lines));
  }

  if (includeCurrentPosition && issue?.currentPosition?.trim()) {
    sections.push(makeSection('CURRENT POSITION', [issue.currentPosition.trim()]));
  }

  if (includeSummary && summary) {
    const lines = [];
    addLine(lines, 'What this Issue is about', summary.overview);
    addLine(lines, 'Important facts and background', summary.keyFacts);
    addLine(lines, 'Present position', summary.presentPosition);
    addLine(lines, 'Decisions or questions outstanding', summary.outstandingDecisions);
    addLine(lines, 'Immediate next step', summary.nextStep);
    const section = makeSection(`RUNNING SUMMARY${summary.version ? ` (VERSION ${summary.version})` : ''}`, lines);
    if (section) sections.push(section);
  }

  if (communications.length) {
    const entries = communications.map((communication, index) => {
      const lines = [];
      addLine(lines, 'Date', formatDisplayDate(communication.communicationDate));
      addLine(lines, 'Type', communication.communicationType);
      addLine(lines, 'Organisation / person', communication.correspondent);
      addLine(lines, 'Details', communication.details);
      addLine(lines, 'eReceipt number', communication.eReceiptNumber);
      addLine(lines, 'Document date', communication.documentDate ? formatDisplayDate(communication.documentDate) : '');
      addLine(lines, 'Document subject', communication.sourceSubject);
      addLine(lines, 'File name', communication.sourceFileName);
      addLine(lines, 'Document location', communication.sourceLocation);
      addLine(lines, 'Relevant pages', communication.relevantPages);
      addLine(lines, 'Source digest', communication.sourceDigest);
      addLine(lines, 'Key facts / directions', communication.keyFacts);
      return `${index + 1}. ${lines.join('\n   ')}`;
    });
    sections.push(makeSection('SELECTED COMMUNICATIONS', entries));
  }

  if (references.length) {
    const entries = references.map((reference, index) => {
      const heading = `${index + 1}. ${reference.citation}`;
      const details = [];
      addLine(details, 'Date', reference.referenceDate ? formatDisplayDate(reference.referenceDate) : '');
      addLine(details, 'Relevant provision / notes', reference.notes);
      return details.length ? `${heading}\n   ${details.join('\n   ')}` : heading;
    });
    sections.push(makeSection('SELECTED REFERENCES', entries));
  }

  const text = sections.filter(Boolean).join('\n\n');
  return {
    text,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    selectedSourceCount: communications.length + references.length,
  };
}
