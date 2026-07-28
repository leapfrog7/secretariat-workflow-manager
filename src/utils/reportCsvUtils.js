function safeFilename(value) {
  return String(value || 'issue-report').trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'issue-report';
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildActivityReportCsv(report) {
  if (report?.kind !== 'activity') throw new Error('CSV export is available for period activity reports.');
  const headers = [
    'Issue',
    'eFile number',
    'Division',
    'Assigned officer',
    'Opening position',
    'Stage at period end',
    'Deadline',
    'Completed during period',
    'Slippage at period end',
    'Recorded developments',
    'Communications',
    'eReceipts',
    'Running summary',
    'Next-period priority',
  ];
  const rows = report.issues.map((issue) => {
    const opening = issue.openingPosition
      ? `${issue.openingPosition.status}${issue.openingPosition.note ? ` - ${issue.openingPosition.note}` : ''}`
      : '';
    return [
      issue.title,
      issue.eFileNumber,
      issue.divisionName,
      issue.officerName,
      report.contentOptions?.openingPosition ? opening : '',
      issue.statusAtEnd,
      issue.deadline,
      issue.completedDuringPeriod ? 'Yes' : 'No',
      issue.slippedAtEnd ? 'Yes' : 'No',
      report.contentOptions?.developments ? issue.events.length : '',
      issue.recordedCommunicationCount,
      issue.recordedEReceiptCount,
      report.contentOptions?.runningSummary ? issue.runningSummary : '',
      report.contentOptions?.nextPriorities && issue.nextPeriodPriority ? issue.nextAction || issue.currentPosition || 'Yes' : '',
    ].map(csvCell).join(',');
  });
  return [`\uFEFF${headers.map(csvCell).join(',')}`, ...rows].join('\r\n');
}

export function downloadActivityReportAsCsv(report) {
  const content = buildActivityReportCsv(report);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(report.title)}-${report.periodEnd}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
