import { db } from '../../db/database';
import { localWorkspaceScopeKey, shouldResetLocalWorkspaceScope } from './workspaceScopeUtils';

const STORAGE_KEY = 'swm:local-cloud-scope';
const SHARED_TABLES = [
  'issues',
  'records',
  'actions',
  'communications',
  'references',
  'issueMilestones',
  'issueSummaries',
  'notes',
  'drafts',
  'paragraphBank',
  'officers',
  'chronology',
  'syncTombstones',
  'syncConflicts',
  'syncMutations',
  'settings',
];

export async function prepareLocalWorkspaceScope({ workspaceId, userId }) {
  if (typeof window === 'undefined' || !workspaceId || !userId) return;
  const currentScope = window.localStorage.getItem(STORAGE_KEY);
  if (!shouldResetLocalWorkspaceScope(currentScope, workspaceId, userId)) return;

  await db.transaction('rw', ...SHARED_TABLES.map((table) => db[table]), async () => {
    await Promise.all(SHARED_TABLES.map((table) => db[table].clear()));
  });
}

export function commitLocalWorkspaceScope({ workspaceId, userId }) {
  if (typeof window === 'undefined' || !workspaceId || !userId) return;
  window.localStorage.setItem(STORAGE_KEY, localWorkspaceScopeKey(workspaceId, userId));
}
