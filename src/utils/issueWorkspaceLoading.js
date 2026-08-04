export function dataSectionForIssueTab(tab) {
  if (tab === 'Casework') return 'casework';
  if (tab === 'References') return 'references';
  if (tab === 'Record of Communication') return 'communications';
  return '';
}

export function recordCountForIssueTab(tab, counts, summaryVersionCount = 0) {
  if (tab === 'Running Summary') return summaryVersionCount;
  if (tab === 'Casework') return counts.notes;
  if (tab === 'References') return counts.references;
  if (tab === 'Record of Communication') return counts.communications;
  return null;
}

export function loadedSectionsToRefresh(sections) {
  const loaded = new Set(sections);
  if (loaded.has('casework')) return ['casework'];
  return ['references', 'communications'].filter((section) => loaded.has(section));
}
