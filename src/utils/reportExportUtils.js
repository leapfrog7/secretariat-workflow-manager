import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
};

function safeFilename(value) {
  return String(value || 'issue-report').trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'issue-report';
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
}

function textRuns(value, options = {}) {
  const text = String(value ?? '');
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    return new TextRun({
      text: bold ? part.slice(2, -2) : part,
      bold: bold || options.bold,
      italics: options.italics,
      color: options.color,
      size: options.size,
    });
  });
}

function paragraph(value = '', options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    heading: options.heading,
    bullet: options.bullet ? { level: 0 } : undefined,
    spacing: { after: options.after ?? 120, line: 276 },
    children: textRuns(value, options),
  });
}

function titleBlock(title, scopeLabel, dateLine) {
  return [
    paragraph(title, { alignment: AlignmentType.CENTER, bold: true, size: 32, after: 100 }),
    paragraph(scopeLabel, { alignment: AlignmentType.CENTER, color: '334155', after: 40 }),
    paragraph(dateLine, { alignment: AlignmentType.CENTER, color: '475569', after: 280 }),
  ];
}

function heading(value, level = HeadingLevel.HEADING_1) {
  return paragraph(value, { heading: level, bold: true, color: '17333B', after: 120 });
}

function detailTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          shading: { fill: 'EAF4F1' },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [paragraph(label, { bold: true, after: 0 })],
        }),
        new TableCell({
          width: { size: 66, type: WidthType.PERCENTAGE },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [paragraph(displayValue(value), { after: 0 })],
        }),
      ],
    })),
  });
}

function reportDocument(children) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Aptos', size: 22, color: '1E293B' },
          paragraph: { spacing: { line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Aptos Display', size: 28, bold: true, color: '17333B' },
          paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Aptos Display', size: 24, bold: true, color: '17333B' },
          paragraph: { spacing: { before: 180, after: 100 }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children,
    }],
  });
}

function activityReportChildren(report) {
  const children = [
    ...titleBlock(report.title, report.scopeLabel, `${report.periodStart} to ${report.periodEnd}`),
  ];
  if (report.coveringNote) {
    children.push(heading('Covering note'), paragraph(report.coveringNote));
  }
  children.push(
    heading('Period summary'),
    detailTable([
      ['Issues included', report.statistics.issueCount],
      ['Recorded developments', report.statistics.developments],
      ['Completed', report.statistics.completed],
      ['Slippages', report.statistics.slippages],
      ['eReceipts recorded', report.statistics.eReceipts],
    ]),
    heading('Management observations'),
    ...report.observations.map((item) => paragraph(item, { bullet: true })),
    heading('Issue-wise progress'),
  );

  if (!report.issues.length) {
    children.push(paragraph('No Issues selected for this report.'));
    return children;
  }

  report.issues.forEach((issue, index) => {
    const details = [
      ...(issue.eFileNumber ? [['eFile number', issue.eFileNumber]] : []),
      ['Division', issue.divisionName],
      ['Assigned officer', issue.officerName],
    ];
    if (report.contentOptions?.openingPosition) {
      details.push([
        'Opening position',
        issue.openingPosition
          ? `${issue.openingPosition.status}${issue.openingPosition.note ? ` - ${issue.openingPosition.note}` : ''}`
          : 'No earlier milestone recorded',
      ]);
    }
    details.push(['Position at period end', issue.statusAtEnd]);
    if (issue.completedDuringPeriod) details.push(['Completion', 'Completed during the period']);
    if (issue.slippedAtEnd) details.push(['Slippage', `Past deadline ${issue.deadline || ''} at period end`]);
    if (report.contentOptions?.nextPriorities && issue.nextPeriodPriority) {
      details.push(['Next-period priority', issue.nextAction || issue.currentPosition || 'Continue action on this Issue']);
    }

    children.push(heading(`${index + 1}. ${issue.title}`, HeadingLevel.HEADING_2), detailTable(details));
    if (report.contentOptions?.developments) {
      children.push(paragraph('Developments during the period', { bold: true, after: 80 }));
      if (issue.events.length) {
        issue.events.forEach((event) => {
          const receipt = event.eReceiptNumber ? ` [eReceipt ${event.eReceiptNumber}]` : '';
          const detail = event.detail ? `: ${event.detail}` : '';
          children.push(paragraph(`${event.date} - ${event.label}${receipt}${detail}`, { bullet: true }));
        });
      } else {
        children.push(paragraph('No dated development recorded.', { italics: true, color: '64748B' }));
      }
    }
    if (report.contentOptions?.runningSummary) {
      children.push(
        paragraph(`Running summary${issue.runningSummaryVersion ? ` (version ${issue.runningSummaryVersion})` : ''}`, { bold: true, after: 80 }),
        paragraph(displayValue(issue.runningSummary)),
      );
    }
  });
  return children;
}

function snapshotReportChildren(report) {
  const statusSummary = report.statistics.byStatus.map((item) => `${item.label}: ${item.count}`).join(' | ') || 'No Issues';
  const children = [
    ...titleBlock(report.title, report.scopeLabel, `As on ${report.asOfDate}`),
    heading('Summary'),
    detailTable([
      ['Total Issues', report.statistics.total],
      ['Overdue', report.statistics.overdue],
      ['Due today or within 7 days', report.statistics.dueSoon],
      ['Unassigned', report.statistics.unassigned],
      ['Stage position', statusSummary],
    ]),
    heading('Management observations'),
    ...report.observations.map((item) => paragraph(item, { bullet: true })),
    heading('Issue-wise position'),
  ];

  if (!report.rows.length) {
    children.push(paragraph('No Issues match this report.'));
    return children;
  }

  report.rows.forEach((row, index) => {
    const details = [
      ['Stage', row.status],
      ['Division', row.divisionName],
      ['Assigned officer', row.officerName],
      ['Deadline', row.deadline],
      ...(row.eFileNumber ? [['eFile number', row.eFileNumber]] : []),
      ...(row.attentionReasons.length ? [['Attention', row.attentionReasons.join(', ')]] : []),
      ...(row.currentPosition ? [['Current position', row.currentPosition]] : []),
    ];
    children.push(heading(`${index + 1}. ${row.title}`, HeadingLevel.HEADING_2), detailTable(details));
  });
  return children;
}

export function buildIssueReportDocument(report) {
  if (!report) throw new Error('There is no report to export.');
  return reportDocument(report.kind === 'activity' ? activityReportChildren(report) : snapshotReportChildren(report));
}

function markdownTable(lines) {
  const rows = lines
    .filter((line, index) => index !== 1 || !/^\|\s*:?-{3,}/.test(line))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
  const columnCount = Math.max(...rows.map((row) => row.length));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: rows.map((row, rowIndex) => new TableRow({
      children: Array.from({ length: columnCount }, (_, columnIndex) => new TableCell({
        shading: rowIndex === 0 ? { fill: 'EAF4F1' } : undefined,
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [paragraph(row[columnIndex] || '', { bold: rowIndex === 0, after: 0 })],
      })),
    })),
  });
}

function markdownChildren(text) {
  const lines = String(text || '').split(/\r?\n/);
  const children = [];
  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index].trim();
    if (!lineText) {
      children.push(paragraph('', { after: 60 }));
      continue;
    }
    const headingMatch = lineText.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      children.push(heading(
        headingMatch[2],
        headingMatch[1].length === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      ));
      continue;
    }
    const bulletMatch = lineText.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      children.push(paragraph(bulletMatch[1], { bullet: true }));
      continue;
    }
    if (/^\|.*\|$/.test(lineText)) {
      const tableLines = [lineText];
      while (index + 1 < lines.length && /^\|.*\|$/.test(lines[index + 1].trim())) {
        tableLines.push(lines[index + 1].trim());
        index += 1;
      }
      children.push(markdownTable(tableLines));
      continue;
    }
    children.push(paragraph(lineText));
  }
  return children;
}

export function buildRefinedReportDocument({ title, scopeLabel, dateLine, text }) {
  if (!String(text || '').trim()) throw new Error('There is no AI-refined report to export.');
  return reportDocument([
    ...titleBlock(title, scopeLabel, dateLine),
    ...markdownChildren(text),
  ]);
}

export async function buildIssueReportDocx(report) {
  return Packer.toBlob(buildIssueReportDocument(report));
}

export async function buildRefinedReportDocx(details) {
  return Packer.toBlob(buildRefinedReportDocument(details));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadIssueReportAsDocx(report) {
  const blob = await buildIssueReportDocx(report);
  downloadBlob(
    new Blob([blob], { type: DOCX_MIME }),
    `${safeFilename(report.title)}-${report.periodEnd || report.asOfDate}.docx`,
  );
}

export async function downloadRefinedReportAsDocx({ title, scopeLabel, dateLine, text, filenameDate }) {
  const blob = await buildRefinedReportDocx({ title, scopeLabel, dateLine, text });
  downloadBlob(
    new Blob([blob], { type: DOCX_MIME }),
    `${safeFilename(title)}-AI-refined-${filenameDate}.docx`,
  );
}
