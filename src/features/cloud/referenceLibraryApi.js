import { cloudClient } from '../auth/cloudClient';
import { fetchCompleteCloudCollection } from './cloudPagination';

function client() { if (!cloudClient) throw new Error('Cloud access is not configured.'); return cloudClient; }

export function listCloudWorkspaceReferences(workspaceId) { return fetchCompleteCloudCollection(({ from, to, includeCount }) => client().from('workspace_references').select('workspace_id,id,payload,status,revision,updated_at,updated_by,deleted_at', includeCount ? { count: 'exact' } : undefined).eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).range(from, to)); }
export function listCloudIssueReferenceLinks(workspaceId) { return fetchCompleteCloudCollection(({ from, to, includeCount }) => client().from('issue_reference_links').select('workspace_id,issue_id,id,reference_id,payload,revision,updated_at,updated_by,deleted_at', includeCount ? { count: 'exact' } : undefined).eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).range(from, to)); }
export async function saveCloudWorkspaceReference(workspaceId, item) { const { data, error } = await client().rpc('save_workspace_reference_revision', { target_workspace_id: workspaceId, target_id: item.id, target_payload: item, expected_revision: Number(item.cloudRevision || 0) }); if (error) throw error; return data?.[0]; }
export async function saveCloudIssueReferenceLink(workspaceId, item) { const { data, error } = await client().rpc('save_issue_reference_link_revision', { target_workspace_id: workspaceId, target_issue_id: item.issueId, target_id: item.id, target_reference_id: item.referenceId, target_payload: item, expected_revision: Number(item.cloudRevision || 0) }); if (error) throw error; return data?.[0]; }
export async function deleteCloudIssueReferenceLink(workspaceId, item) { const { error } = await client().from('issue_reference_links').delete().eq('workspace_id', workspaceId).eq('id', item.id); if (error) throw error; return true; }
