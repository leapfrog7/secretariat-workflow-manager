import { db } from '../../db/database';

const STORAGE_KEY = 'swm:local-cloud-scope';
const SHARED_TABLES = [
  'issues',
  'records',
  'actions',
  'communications',
  'references',
  'issueMilestones',
  'issueSummaries',
  'drafts',
  'officers',
  'chronology',
  'syncTombstones',
  'settings',
];

function scopeKey(workspaceId, userId) {
  return `${workspaceId}:${userId}`;
}

export async function prepareLocalWorkspaceScope({ workspaceId, userId }) {
  if (typeof window === 'undefined' || !workspaceId || !userId) return;
  const nextScope = scopeKey(workspaceId, userId);
  const currentScope = window.localStorage.getItem(STORAGE_KEY);
  if (!currentScope || currentScope === nextScope) return;

  await db.transaction('rw', ...SHARED_TABLES.map((table) => db[table]), async () => {
    await Promise.all(SHARED_TABLES.map((table) => db[table].clear()));
  });
}

export function commitLocalWorkspaceScope({ workspaceId, userId }) {
  if (typeof window === 'undefined' || !workspaceId || !userId) return;
  window.localStorage.setItem(STORAGE_KEY, scopeKey(workspaceId, userId));
}
