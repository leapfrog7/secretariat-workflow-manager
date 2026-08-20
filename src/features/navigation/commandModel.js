const BASE_COMMANDS = [
  { id: 'home', label: 'Home', description: 'Return to your work overview', to: '/home', icon: 'home' },
  { id: 'issues', label: 'Issues', description: 'Browse and manage the Issue register', to: '/issues', icon: 'issues' },
  { id: 'casework', label: 'Casework', description: 'Continue noting and drafting', to: '/casework', icon: 'casework' },
  { id: 'references', label: 'Reference Library', description: 'Open shared source material', to: '/references', icon: 'references' },
  { id: 'reports', label: 'Reports', description: 'Review workspace reporting', to: '/reports', icon: 'reports' },
  { id: 'settings', label: 'Settings', description: 'Manage your workspace preferences', to: '/settings', icon: 'settings' },
  { id: 'help', label: 'How to use SWM', description: 'Open guidance and shortcuts', to: '/help', icon: 'help' },
];

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function getWorkspaceCommands({ canEdit = false, isAdmin = false, isWorkspaceAdmin = false } = {}) {
  const commands = [...BASE_COMMANDS];
  if (canEdit) commands.unshift({ id: 'new-issue', label: 'Create new Issue', description: 'Add a matter to the register', to: '/issues/new', icon: 'create', action: true });
  if (isAdmin || isWorkspaceAdmin) commands.push({ id: 'admin', label: 'Administration', description: 'Manage workspace access and configuration', to: '/admin', icon: 'admin' });
  return commands;
}

export function filterWorkspaceCommands(commands, query = '') {
  const needle = normalized(query);
  if (!needle) return commands;
  return commands.filter((command) => normalized(`${command.label} ${command.description}`).includes(needle));
}

export function filterIssueCommands(issues, query = '', { limit = 8 } = {}) {
  const needle = normalized(query);
  const ranked = issues
    .filter((issue) => !issue.isArchived && !issue.isScheduled)
    .map((issue) => {
      const title = normalized(issue.shortTitle);
      const searchable = normalized([issue.shortTitle, issue.eFileNumber, issue.subjectType, issue.currentPosition, issue.status].filter(Boolean).join(' '));
      if (needle && !searchable.includes(needle)) return null;
      const rank = !needle ? 0 : title.startsWith(needle) ? 2 : title.includes(needle) ? 1 : 0;
      return { issue, rank };
    })
    .filter(Boolean)
    .sort((left, right) => right.rank - left.rank || String(right.issue.updatedAt || '').localeCompare(String(left.issue.updatedAt || '')));
  return ranked.slice(0, limit).map(({ issue }) => issue);
}
