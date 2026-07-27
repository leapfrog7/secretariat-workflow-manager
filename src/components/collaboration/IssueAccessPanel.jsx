import { useEffect, useMemo, useState } from 'react';
import { Eye, LoaderCircle, LockKeyhole, Save, Share2, Trash2, Users } from 'lucide-react';
import AdaptiveSelect from '../common/AdaptiveSelect';
import { listProfiles } from '../../features/auth/accountApi';
import { listWorkspaceMembers } from '../../features/cloud/workspaceApi';
import {
  canManageIssueAccess,
  deleteIssueGrant,
  getIssueAccessLevel,
  listDivisionMembers,
  listDivisions,
  listIssueGrants,
  saveIssueGrant,
} from '../../features/collaboration/accessApi';

export default function IssueAccessPanel({ auth, issue, canEdit, onUpdateIssue }) {
  const [divisions, setDivisions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [divisionMembers, setDivisionMembers] = useState([]);
  const [grants, setGrants] = useState([]);
  const [accessLevel, setAccessLevel] = useState(canEdit ? 'editor' : 'viewer');
  const [policy, setPolicy] = useState({ owningDivisionId: issue.owningDivisionId || '', visibility: issue.visibility || 'workspace' });
  const [grant, setGrant] = useState({ principalType: 'user', principalId: '', accessLevel: 'viewer' });
  const [state, setState] = useState({ loading: true, busy: '', error: '', message: '', canManageAccess: false });

  async function load() {
    if (!auth.workspace?.id) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [divisionRows, divisionMemberRows, grantRows, level, canManageAccess, profileRows, memberRows] = await Promise.all([
        listDivisions(auth.workspace.id),
        listDivisionMembers(auth.workspace.id),
        listIssueGrants(auth.workspace.id, issue.id),
        getIssueAccessLevel(auth.workspace.id, issue.id),
        canManageIssueAccess(auth.workspace.id, issue.id),
        listProfiles(),
        listWorkspaceMembers(auth.workspace.id),
      ]);
      setDivisions(divisionRows);
      setDivisionMembers(divisionMemberRows);
      setGrants(grantRows);
      setAccessLevel(level);
      setProfiles(profileRows);
      setMembers(memberRows);
      setPolicy({ owningDivisionId: issue.owningDivisionId || '', visibility: issue.visibility || 'workspace' });
      setState((current) => ({ ...current, loading: false, canManageAccess }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Unable to load sharing information.' }));
    }
  }

  useEffect(() => {
    load();
  }, [auth.workspace?.id, issue.id]);

  const workspacePeople = useMemo(() => profiles.filter((profile) => (
    profile.status === 'active'
    && profile.user_id !== auth.user?.id
    && members.some((member) => member.user_id === profile.user_id && member.status === 'active')
  )), [auth.user?.id, members, profiles]);
  const myDivisionIds = new Set(divisionMembers.filter((member) => member.user_id === auth.user?.id && member.status === 'active').map((member) => member.division_id));
  const accessReason = auth.isWorkspaceAdmin
    ? 'Workspace manager'
    : issue.createdBy === auth.user?.id
      ? 'Issue creator'
      : grants.some((item) => item.principal_type === 'user' && item.principal_id === auth.user?.id)
        ? 'Explicit personal grant'
        : grants.some((item) => item.principal_type === 'division' && myDivisionIds.has(item.principal_id))
          ? 'Grant through your division'
          : issue.visibility === 'division' && myDivisionIds.has(issue.owningDivisionId)
            ? 'Membership of the owning division'
            : issue.visibility === 'workspace'
              ? 'Workspace-wide visibility'
              : 'Effective access policy';

  async function savePolicy(event) {
    event.preventDefault();
    if (policy.visibility === 'division' && !policy.owningDivisionId) {
      setState((current) => ({ ...current, error: 'Choose an owning division before using division-only visibility.', message: '' }));
      return;
    }
    setState((current) => ({ ...current, busy: 'policy', error: '', message: '' }));
    try {
      await onUpdateIssue(policy);
      setState((current) => ({ ...current, busy: '', message: 'Issue access policy saved.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to save access policy.' }));
    }
  }

  async function addGrant(event) {
    event.preventDefault();
    if (!grant.principalId) return;
    setState((current) => ({ ...current, busy: 'grant', error: '', message: '' }));
    try {
      await saveIssueGrant({ workspaceId: auth.workspace.id, issueId: issue.id, grant, userId: auth.user.id });
      setGrant((current) => ({ ...current, principalId: '' }));
      await load();
      setState((current) => ({ ...current, busy: '', message: 'Access granted.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to grant access.' }));
    }
  }

  async function removeGrant(grantId) {
    setState((current) => ({ ...current, busy: grantId, error: '', message: '' }));
    try {
      await deleteIssueGrant(auth.workspace.id, grantId);
      setGrants((current) => current.filter((item) => item.id !== grantId));
      setState((current) => ({ ...current, busy: '', message: 'Access grant removed.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to remove access.' }));
    }
  }

  const principalName = (item) => {
    if (item.principal_type === 'division') return divisions.find((division) => division.id === item.principal_id)?.name || 'Unknown division';
    const profile = profiles.find((person) => person.user_id === item.principal_id);
    return profile?.display_name || profile?.email || 'Unknown colleague';
  };
  const canManage = state.canManageAccess;

  if (auth.mode !== 'cloud') {
    return <section className="surface rounded-md px-4 py-8 text-center"><Share2 className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">Sharing requires a cloud workspace</p><p className="mt-1 text-xs text-slate-500">Local-only Issues remain available only in this browser.</p></section>;
  }

  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-2"><Share2 className="mt-0.5 h-5 w-5 text-teal-700" /><div><h2 className="text-base font-semibold text-[#17333b]">Share and access</h2><p className="mt-1 text-sm text-slate-600">Control which colleagues can view or edit this Issue.</p></div></div>
        <div className="text-right"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${accessLevel === 'editor' ? 'bg-emerald-50 text-emerald-800' : 'bg-cyan-50 text-cyan-800'}`}>{accessLevel === 'editor' ? <Share2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{accessLevel === 'editor' ? 'You can edit' : 'View only'}</span><p className="mt-1 text-xs text-slate-500">{accessReason}</p></div>
      </div>
      {state.error && <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>}
      {!state.loading && !canManage && <p className="border-b border-cyan-200 bg-cyan-50 px-4 py-3 text-xs leading-5 text-cyan-950">You can see the access arrangement, but only a workspace manager or the owning division manager can change it.</p>}
      {!auth.workspace?.division_access_enabled && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Division rules are not active.</strong> These settings can be prepared now, but users with editing access retain workspace-wide access until a manager enables Division access.</div>}
      {state.loading ? <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin" />Loading access</div> : (
        <>
          <form onSubmit={savePolicy} className="grid gap-3 border-b border-slate-200 px-4 py-4 sm:grid-cols-2 sm:px-5">
            <AdaptiveSelect label="Owning division" value={policy.owningDivisionId} onChange={(owningDivisionId) => setPolicy((current) => ({ ...current, owningDivisionId }))} options={divisions.filter((item) => item.is_active).map((item) => ({ value: item.id, label: item.name }))} placeholder="No division assigned" disabled={!canManage} />
            <AdaptiveSelect label="Visibility" value={policy.visibility} onChange={(visibility) => setPolicy((current) => ({ ...current, visibility }))} includeBlank={false} disabled={!canManage} options={[
              { value: 'workspace', label: 'Entire workspace' },
              { value: 'division', label: 'Owning division' },
              { value: 'restricted', label: 'Restricted to explicit access' },
            ]} />
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{policy.visibility === 'workspace' ? 'Entire workspace is a deliberate exception: every active member can access this Issue.' : policy.visibility === 'division' ? 'Members of the owning division receive access according to their division role.' : 'Only administrators, the creator and explicit grants receive access.'}</p>
            <div className="flex items-center gap-2 text-xs leading-5 text-slate-500 sm:col-span-2"><LockKeyhole className="h-4 w-4 shrink-0" />Restricted Issues remain available to workspace managers, their creator, and the people or divisions listed below.</div>
            {canManage && <div className="sm:col-span-2 sm:text-right"><button type="submit" disabled={state.busy === 'policy'} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-auto">{state.busy === 'policy' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{state.busy === 'policy' ? 'Saving...' : 'Save access policy'}</button></div>}
          </form>

          {canManage && <form onSubmit={addGrant} className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-3 sm:px-5">
            <AdaptiveSelect label="Share with" value={grant.principalType} onChange={(principalType) => setGrant((current) => ({ ...current, principalType, principalId: '' }))} includeBlank={false} options={[
              { value: 'user', label: 'Named colleague' },
              { value: 'division', label: 'Division' },
            ]} />
            <AdaptiveSelect label={grant.principalType === 'user' ? 'Colleague' : 'Division'} value={grant.principalId} onChange={(principalId) => setGrant((current) => ({ ...current, principalId }))} options={grant.principalType === 'user'
              ? workspacePeople.map((person) => ({ value: person.user_id, label: person.display_name || person.email }))
              : divisions.filter((item) => item.is_active && item.id !== policy.owningDivisionId).map((item) => ({ value: item.id, label: item.name }))} />
            <AdaptiveSelect label="Permission" value={grant.accessLevel} onChange={(accessLevel) => setGrant((current) => ({ ...current, accessLevel }))} includeBlank={false} options={[
              { value: 'viewer', label: 'Can view' },
              { value: 'editor', label: 'Can edit' },
            ]} />
            <div className="sm:col-span-3 sm:text-right"><button type="submit" disabled={state.busy === 'grant' || !grant.principalId} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17333b] px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-auto"><Users className="h-4 w-4" />{state.busy === 'grant' ? 'Sharing...' : 'Grant access'}</button></div>
          </form>}

          <div className="px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-slate-900">Explicit access</h3>
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {grants.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{principalName(item)}</p><p className="mt-0.5 text-xs text-slate-500">{item.principal_type === 'division' ? 'Division' : 'Colleague'} - Can {item.access_level === 'editor' ? 'edit' : 'view'}</p></div>{canManage && <button type="button" title="Remove access" onClick={() => removeGrant(item.id)} disabled={state.busy === item.id} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{state.busy === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span className="sr-only">Remove access for {principalName(item)}</span></button>}</div>)}
              {!grants.length && <p className="py-4 text-sm text-slate-500">No explicit access grants. The visibility policy above determines access.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
