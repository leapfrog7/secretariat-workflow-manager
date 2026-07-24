import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, LoaderCircle, Pencil, Plus, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import AdaptiveSelect from '../common/AdaptiveSelect';
import {
  getIssueAccessReadiness,
  listDivisionMembers,
  listDivisions,
  saveDivision,
  setDivisionAccessEnabled,
  setDivisionMember,
} from '../../features/collaboration/accessApi';

export default function DivisionAdminPanel({ auth, profiles, workspaceMembers }) {
  const [divisions, setDivisions] = useState([]);
  const [members, setMembers] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [divisionForm, setDivisionForm] = useState({ name: '', code: '' });
  const [assignment, setAssignment] = useState({ divisionId: '', userId: '', role: 'editor' });
  const [state, setState] = useState({ loading: true, busy: '', error: '', message: '' });

  const activeUsers = useMemo(() => profiles.filter((profile) => (
    profile.status === 'active'
    && workspaceMembers.some((member) => member.user_id === profile.user_id && member.status === 'active')
  )), [profiles, workspaceMembers]);

  async function load() {
    if (!auth.workspace?.id) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [divisionRows, memberRows, readinessRow] = await Promise.all([
        listDivisions(auth.workspace.id),
        listDivisionMembers(auth.workspace.id),
        getIssueAccessReadiness(auth.workspace.id),
      ]);
      setDivisions(divisionRows);
      setMembers(memberRows);
      setReadiness(readinessRow);
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Unable to load division access.' }));
    }
  }

  useEffect(() => {
    load();
  }, [auth.workspace?.id]);

  async function submitDivision(event) {
    event.preventDefault();
    if (!divisionForm.name.trim() || !divisionForm.code.trim()) return;
    setState((current) => ({ ...current, busy: 'division', error: '', message: '' }));
    try {
      await saveDivision({ workspaceId: auth.workspace.id, userId: auth.user.id, division: divisionForm });
      setDivisionForm({ name: '', code: '' });
      await load();
      setState((current) => ({ ...current, busy: '', message: divisionForm.id ? 'Division updated.' : 'Division added.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to save division.' }));
    }
  }

  function editDivision(division) {
    setDivisionForm({
      id: division.id,
      name: division.name,
      code: division.code,
      is_active: division.is_active,
    });
    setState((current) => ({ ...current, error: '', message: '' }));
  }

  function cancelDivisionEdit() {
    setDivisionForm({ name: '', code: '' });
  }

  async function assignMember(event) {
    event.preventDefault();
    if (!assignment.divisionId || !assignment.userId) return;
    setState((current) => ({ ...current, busy: 'member', error: '', message: '' }));
    try {
      await setDivisionMember({
        workspaceId: auth.workspace.id,
        divisionId: assignment.divisionId,
        userId: assignment.userId,
        role: assignment.role,
        status: 'active',
        createdBy: auth.user.id,
      });
      setAssignment((current) => ({ ...current, userId: '' }));
      await load();
      setState((current) => ({ ...current, busy: '', message: 'Division membership saved.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to save division membership.' }));
    }
  }

  async function changeMembership(member, roleOrStatus) {
    setState((current) => ({ ...current, busy: `member:${member.division_id}:${member.user_id}`, error: '', message: '' }));
    try {
      await setDivisionMember({
        workspaceId: auth.workspace.id,
        divisionId: member.division_id,
        userId: member.user_id,
        role: roleOrStatus === 'suspended' ? member.role : roleOrStatus,
        status: roleOrStatus === 'suspended' ? 'suspended' : 'active',
        createdBy: auth.user.id,
      });
      await load();
      setState((current) => ({ ...current, busy: '', message: roleOrStatus === 'suspended' ? 'Colleague removed from the division.' : 'Division role updated.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to update division membership.' }));
    }
  }

  async function toggleEnforcement() {
    const enabled = !auth.workspace.division_access_enabled;
    setState((current) => ({ ...current, busy: 'enforcement', error: '', message: '' }));
    try {
      await setDivisionAccessEnabled(auth.workspace.id, enabled);
      await auth.refreshWorkspaces();
      await load();
      setState((current) => ({ ...current, busy: '', message: enabled ? 'Division access is now enforced.' : 'Division access enforcement is paused.' }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', error: error.message || 'Unable to change division access.' }));
    }
  }

  const userName = (id) => {
    const profile = profiles.find((item) => item.user_id === id);
    return profile?.display_name || profile?.email || id;
  };
  const divisionName = (id) => divisions.find((item) => item.id === id)?.name || 'Unknown division';

  return (
    <section className="surface mb-5 overflow-hidden rounded-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
        <div className="flex items-start gap-2"><Building2 className="mt-0.5 h-5 w-5 text-teal-700" /><div><h2 className="text-sm font-semibold text-slate-950">Divisions and shared access</h2><p className="mt-1 text-xs leading-5 text-slate-500">Group colleagues by division before restricting Issue visibility.</p></div></div>
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
      {state.error && <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      {state.message && <p className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>}
      <div className={`border-b px-4 py-3 ${auth.workspace.division_access_enabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <p className={`text-sm font-semibold ${auth.workspace.division_access_enabled ? 'text-emerald-900' : 'text-amber-950'}`}>
          {auth.workspace.division_access_enabled ? 'Division rules are active' : 'Workspace-wide access is still active'}
        </p>
        <p className={`mt-1 text-xs leading-5 ${auth.workspace.division_access_enabled ? 'text-emerald-800' : 'text-amber-900'}`}>
          {auth.workspace.division_access_enabled
            ? 'Users see their division Issues and any matters explicitly shared with them. Issues marked Entire workspace remain visible to every active workspace member.'
            : 'Assigning a colleague to a division does not restrict access by itself. Assign every Issue and colleague first, then enable Division access below.'}
        </p>
      </div>
      <div className="grid gap-5 p-4 lg:grid-cols-2">
        <form onSubmit={submitDivision} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{divisionForm.id ? 'Edit division' : 'Add division'}</h3>
            {divisionForm.id && <button type="button" onClick={cancelDivisionEdit} title="Cancel editing" aria-label="Cancel editing division" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Division name" value={divisionForm.name} onChange={(name) => setDivisionForm((current) => ({ ...current, name }))} placeholder="Administration" />
            <Field label="Short code" value={divisionForm.code} onChange={(code) => setDivisionForm((current) => ({ ...current, code }))} placeholder="ADMIN" />
          </div>
          <button type="submit" disabled={state.busy === 'division' || !divisionForm.name.trim() || !divisionForm.code.trim()} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-auto">{state.busy === 'division' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : divisionForm.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{state.busy === 'division' ? 'Saving...' : divisionForm.id ? 'Save changes' : 'Add division'}</button>
          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {divisions.map((division) => <div key={division.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{division.name}</span><span className="text-xs font-semibold uppercase text-slate-500">{division.code}</span></div><button type="button" onClick={() => editDivision(division)} title={`Edit ${division.name}`} aria-label={`Edit ${division.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-teal-50 hover:text-teal-800"><Pencil className="h-4 w-4" /></button></div>)}
            {!divisions.length && <p className="py-4 text-sm text-slate-500">No divisions created.</p>}
          </div>
        </form>

        <form onSubmit={assignMember} className="rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Assign colleague</h3>
          <div className="mt-3 grid gap-3">
            <AdaptiveSelect label="Division" value={assignment.divisionId} onChange={(divisionId) => setAssignment((current) => ({ ...current, divisionId }))} options={divisions.filter((item) => item.is_active).map((item) => ({ value: item.id, label: item.name }))} />
            <AdaptiveSelect label="Workspace member" value={assignment.userId} onChange={(userId) => setAssignment((current) => ({ ...current, userId }))} options={activeUsers.map((profile) => ({ value: profile.user_id, label: profile.display_name || profile.email }))} />
            <AdaptiveSelect label="Division role" value={assignment.role} onChange={(role) => setAssignment((current) => ({ ...current, role }))} includeBlank={false} options={[
              { value: 'division_admin', label: 'Division administrator' },
              { value: 'editor', label: 'Editor' },
              { value: 'viewer', label: 'Viewer' },
            ]} />
          </div>
          <button type="submit" disabled={state.busy === 'member' || !assignment.divisionId || !assignment.userId} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-auto">{state.busy === 'member' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{state.busy === 'member' ? 'Saving...' : 'Save membership'}</button>
        </form>
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Current division memberships</h3>
        <div className="mt-3 divide-y divide-slate-200">
          {members.filter((member) => member.status === 'active').map((member) => (
            <div key={`${member.division_id}:${member.user_id}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_190px] sm:items-center">
              <span className="truncate text-sm font-medium text-slate-800">{userName(member.user_id)}</span>
              <span className="text-xs text-slate-500">{divisionName(member.division_id)}</span>
              <AdaptiveSelect value={member.role} ariaLabel={`Division role for ${userName(member.user_id)}`} includeBlank={false} options={[
                { value: 'division_admin', label: 'Division administrator' },
                { value: 'editor', label: 'Editor' },
                { value: 'viewer', label: 'Viewer' },
                { value: 'suspended', label: 'Remove from division' },
              ]} onChange={(value) => changeMembership(member, value)} disabled={state.busy === `member:${member.division_id}:${member.user_id}`} controlClassName="h-9" />
            </div>
          ))}
          {!members.some((member) => member.status === 'active') && <p className="py-4 text-sm text-slate-500">No active division memberships.</p>}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-700" /><h3 className="text-sm font-semibold text-slate-900">Division enforcement</h3></div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{readiness ? `${readiness.unassigned_issues} unassigned Issues; ${readiness.active_members_without_division} members without a division.` : 'Checking readiness...'}</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">For division-only access, open each Issue's Share &amp; Access tab, select its owning division and choose Owning division visibility. Entire workspace is an intentional exception for matters everyone may access.</p>
          </div>
          <button type="button" onClick={toggleEnforcement} disabled={state.busy === 'enforcement' || (!auth.workspace.division_access_enabled && !readiness?.ready)} className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white disabled:bg-slate-400 sm:w-auto ${auth.workspace.division_access_enabled ? 'bg-rose-700' : 'bg-teal-700'}`}>{state.busy === 'enforcement' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{state.busy === 'enforcement' ? 'Updating...' : auth.workspace.division_access_enabled ? 'Pause enforcement' : 'Enable division access'}</button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label>;
}
