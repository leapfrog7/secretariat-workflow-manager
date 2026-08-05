import { cloudClient } from '../../auth/cloudClient';
import { fetchCompleteCloudCollection } from '../../cloud/cloudPagination';

const FIELDS = 'workspace_id, id, scope, owner_user_id, payload, status, revision, updated_by, updated_at, deleted_at';

function requireClient() {
  if (!cloudClient) throw new Error('Cloud access is not configured for this build.');
  return cloudClient;
}

export async function listCloudParagraphBankEntries(workspaceId) {
  const client = requireClient();
  return fetchCompleteCloudCollection(({ from, to, includeCount }) => client
    .from('paragraph_bank_entries')
    .select(FIELDS, includeCount ? { count: 'exact' } : undefined)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to));
}

export async function saveCloudParagraphBankEntry({ workspaceId, entry }) {
  const { data, error } = await requireClient().rpc('save_paragraph_bank_entry_revision', {
    target_workspace_id: workspaceId,
    target_entry_id: entry.id,
    target_payload: entry,
    expected_revision: Number(entry.cloudRevision || 0),
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function deleteCloudParagraphBankEntry({ workspaceId, entry }) {
  const { data, error } = await requireClient().rpc('delete_paragraph_bank_entry_revision', {
    target_workspace_id: workspaceId,
    target_entry_id: entry.id,
    expected_revision: Number(entry.cloudRevision || 0),
  });
  if (error) throw error;
  return data?.[0] || null;
}
