import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, UserRoundCog } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { listProfiles, updateProfileAccess } from '../features/auth/accountApi';
import { useAuth } from '../features/auth/AuthContext';
import { listWorkspaceMembers, setWorkspaceMember } from '../features/cloud/workspaceApi';

export default function AdminPage() {
  const auth = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [state, setState] = useState({ loading: true, saving: '', error: '', message: '' });

  const counts = useMemo(() => ({
    total: profiles.length,
    pending: profiles.filter((profile) => profile.status === 'pending').length,
    active: profiles.filter((profile) => profile.status === 'active').length,
    suspended: profiles.filter((profile) => profile.status === 'suspended').length,
  }), [profiles]);

  async function loadProfiles() {
    setState((current) => ({ ...current, loading: true, error: '', message: '' }));
    try {
      const [result, memberResult] = await Promise.all([
        listProfiles(),
        auth.workspace?.id ? listWorkspaceMembers(auth.workspace.id) : Promise.resolve([]),
      ]);
      setProfiles(result);
      setMemberships(memberResult);
      setState({ loading: false, saving: '', error: '', message: '' });
    } catch (error) {
      setState({ loading: false, saving: '', error: error.message || 'Unable to load registered users.', message: '' });
    }
  }

  useEffect(() => {
    loadProfiles();
  }, [auth.workspace?.id]);

  async function changeAccess(profile, nextStatus, nextRole = profile.role) {
    setState((current) => ({ ...current, saving: profile.user_id, error: '', message: '' }));
    try {
      const updated = await updateProfileAccess({ userId: profile.user_id, status: nextStatus, role: nextRole });
      setProfiles((current) => current.map((item) => item.user_id === profile.user_id ? updated : item));
      if (nextStatus === 'active' && auth.workspace?.id && !memberships.some((membership) => membership.user_id === profile.user_id && membership.status === 'active')) {
        const membership = await setWorkspaceMember({ workspaceId: auth.workspace.id, userId: profile.user_id, role: 'officer', status: 'active' });
        setMemberships((current) => [...current.filter((item) => item.user_id !== profile.user_id), membership]);
      }
      setState({ loading: false, saving: '', error: '', message: `Access updated for ${profile.display_name || profile.email}.` });
    } catch (error) {
      setState((current) => ({ ...current, saving: '', error: error.message || 'Unable to update access.', message: '' }));
    }
  }

  async function changeMembership(profile, value) {
    const existing = memberships.find((membership) => membership.user_id === profile.user_id);
    const status = value === 'none' ? 'suspended' : 'active';
    const role = value === 'none' ? existing?.role || 'officer' : value;
    setState((current) => ({ ...current, saving: profile.user_id, error: '', message: '' }));
    try {
      const membership = await setWorkspaceMember({ workspaceId: auth.workspace.id, userId: profile.user_id, role, status });
      setMemberships((current) => [...current.filter((item) => item.user_id !== profile.user_id), membership]);
      setState({ loading: false, saving: '', error: '', message: `Workspace access updated for ${profile.display_name || profile.email}.` });
    } catch (error) {
      setState((current) => ({ ...current, saving: '', error: error.message || 'Unable to update workspace access.', message: '' }));
    }
  }

  return (
    <>
      <PageHeader title="Administration" description="Approve registered users and control access to official workspaces." />
      <div className="mb-4 flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"><Building2 className="h-5 w-5 shrink-0" /><div><p className="font-semibold">{auth.workspace?.name}</p><p className="mt-0.5 text-xs text-teal-800">Workspace code: {auth.workspace?.code}</p></div></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Registered" value={counts.total} />
        <Metric label="Pending" value={counts.pending} tone="amber" />
        <Metric label="Active" value={counts.active} tone="emerald" />
        <Metric label="Suspended" value={counts.suspended} tone="rose" />
      </div>
      <section className="surface overflow-hidden rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div><h2 className="text-sm font-semibold text-slate-950">Registered users</h2><p className="mt-1 text-xs text-slate-500">New registrations remain pending until approved.</p></div>
          <button type="button" onClick={loadProfiles} disabled={state.loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"><RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>
        {state.error && <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
        {state.message && <p className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>}
        {state.loading ? <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-600"><LoaderCircle className="h-5 w-5 animate-spin" />Loading registered users</div> : (
          <div className="divide-y divide-slate-200">
            {profiles.map((profile) => {
              const isSelf = profile.user_id === auth.user?.id;
              const saving = state.saving === profile.user_id;
              const membership = memberships.find((item) => item.user_id === profile.user_id);
              const membershipValue = membership?.status === 'active' ? membership.role : 'none';
              return (
                <div key={profile.user_id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_140px_140px_170px_auto] lg:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{profile.display_name || 'Unnamed user'} {isSelf && <span className="font-normal text-slate-500">(you)</span>}</p><p className="mt-1 truncate text-xs text-slate-500">{profile.email}</p></div>
                  <select aria-label={`Role for ${profile.email}`} value={profile.role} disabled={saving || isSelf} onChange={(event) => changeAccess(profile, profile.status, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="user">User</option><option value="platform_admin">Platform admin</option></select>
                  <AccessStatus status={profile.status} />
                  <select aria-label={`Workspace access for ${profile.email}`} value={membershipValue} disabled={saving || isSelf || profile.status !== 'active'} onChange={(event) => changeMembership(profile, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100"><option value="none">No workspace access</option><option value="officer">Officer</option><option value="workspace_admin">Workspace admin</option></select>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {profile.status === 'pending' && <ActionButton disabled={saving} onClick={() => changeAccess(profile, 'active')} tone="approve">Approve</ActionButton>}
                    {profile.status === 'active' && !isSelf && <ActionButton disabled={saving} onClick={() => changeAccess(profile, 'suspended')} tone="suspend">Suspend</ActionButton>}
                    {profile.status === 'suspended' && <ActionButton disabled={saving} onClick={() => changeAccess(profile, 'active')} tone="approve">Restore</ActionButton>}
                  </div>
                </div>
              );
            })}
            {!profiles.length && <div className="px-4 py-12 text-center"><UserRoundCog className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm text-slate-600">No registered users found.</p></div>}
          </div>
        )}
      </section>
      <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Approval activates the account and adds it to this workspace as an Officer. Workspace access can grant workspace administration or remove the user from official Issues.</p></div>
    </>
  );
}

function Metric({ label, value, tone = 'slate' }) {
  const tones = { slate: 'border-slate-200 bg-white text-slate-950', amber: 'border-amber-200 bg-amber-50 text-amber-950', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950', rose: 'border-rose-200 bg-rose-50 text-rose-950' };
  return <div className={`rounded-md border px-4 py-3 ${tones[tone]}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

function AccessStatus({ status }) {
  const styles = { pending: 'bg-amber-100 text-amber-900', active: 'bg-emerald-100 text-emerald-900', suspended: 'bg-rose-100 text-rose-900' };
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}><CheckCircle2 className="h-3.5 w-3.5" />{status[0].toUpperCase() + status.slice(1)}</span>;
}

function ActionButton({ children, disabled, onClick, tone }) {
  const style = tone === 'approve' ? 'bg-teal-700 text-white' : 'border border-rose-200 bg-rose-50 text-rose-800';
  return <button type="button" disabled={disabled} onClick={onClick} className={`h-9 rounded-md px-3 text-xs font-semibold disabled:opacity-50 ${style}`}>{disabled ? 'Saving...' : children}</button>;
}
