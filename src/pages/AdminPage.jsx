import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, Building2, CheckCircle2, LoaderCircle, RefreshCw, Save, ShieldCheck, UserRoundCog } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import { listProfiles, updateProfileAccess } from '../features/auth/accountApi';
import { useAuth } from '../features/auth/AuthContext';
import { listWorkspaceMembers, setWorkspaceMember } from '../features/cloud/workspaceApi';
import { CLOUD_AI_PROVIDERS, getAIUsageSummary, listAIProviderSettings, listAIUserPermissions, saveAIProviderSettings, setAIUserPermission } from '../features/ai/cloudAIAdminApi';

export default function AdminPage() {
  const auth = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [aiProviders, setAIProviders] = useState([]);
  const [aiPermissions, setAIPermissions] = useState([]);
  const [aiUsage, setAIUsage] = useState([]);
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
      const [result, memberResult, providerResult, permissionResult, usageResult] = await Promise.all([
        listProfiles(),
        auth.workspace?.id ? listWorkspaceMembers(auth.workspace.id) : Promise.resolve([]),
        auth.workspace?.id ? listAIProviderSettings(auth.workspace.id) : Promise.resolve([]),
        auth.workspace?.id ? listAIUserPermissions(auth.workspace.id) : Promise.resolve([]),
        auth.workspace?.id ? getAIUsageSummary(auth.workspace.id) : Promise.resolve([]),
      ]);
      setProfiles(result);
      setMemberships(memberResult);
      setAIProviders(CLOUD_AI_PROVIDERS.map((provider) => ({
        provider: provider.id,
        enabled: false,
        model: provider.defaultModel,
        allowed_roles: ['workspace_admin', 'officer'],
        daily_user_request_limit: 20,
        monthly_workspace_request_limit: 500,
        monthly_budget_usd: 0,
        input_cost_per_million_usd: 0,
        output_cost_per_million_usd: 0,
        ...providerResult.find((item) => item.provider === provider.id),
      })));
      setAIPermissions(permissionResult);
      setAIUsage(usageResult);
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

  function updateAIProvider(provider, field, value) {
    setAIProviders((current) => current.map((item) => item.provider === provider ? { ...item, [field]: value } : item));
  }

  async function saveProvider(provider) {
    const settings = aiProviders.find((item) => item.provider === provider);
    setState((current) => ({ ...current, saving: `provider:${provider}`, error: '', message: '' }));
    try {
      await saveAIProviderSettings({ workspaceId: auth.workspace.id, userId: auth.user.id, settings });
      setState((current) => ({ ...current, saving: '', message: `${provider === 'openai' ? 'OpenAI' : 'Gemini'} policy saved.` }));
    } catch (error) {
      setState((current) => ({ ...current, saving: '', error: error.message || 'Unable to save AI provider policy.' }));
    }
  }

  async function changeAIPermission(profile, provider, value) {
    setState((current) => ({ ...current, saving: `ai:${profile.user_id}:${provider}`, error: '', message: '' }));
    try {
      await setAIUserPermission({ workspaceId: auth.workspace.id, userId: profile.user_id, provider, value, updatedBy: auth.user.id });
      setAIPermissions((current) => [
        ...current.filter((item) => item.user_id !== profile.user_id || item.provider !== provider),
        ...(value === 'inherit' ? [] : [{ workspace_id: auth.workspace.id, user_id: profile.user_id, provider, allowed: value === 'allow', daily_request_limit: null }]),
      ]);
      setState((current) => ({ ...current, saving: '', message: `AI access updated for ${profile.display_name || profile.email}.` }));
    } catch (error) {
      setState((current) => ({ ...current, saving: '', error: error.message || 'Unable to update AI access.' }));
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
      <section className="surface mb-5 overflow-hidden rounded-md">
        <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3"><Bot className="mt-0.5 h-5 w-5 text-cyan-700" /><div><h2 className="text-sm font-semibold text-slate-950">Cloud AI providers</h2><p className="mt-1 text-xs text-slate-500">Enable providers, choose server-side models, and set workspace safeguards. API keys are configured only in Vercel.</p></div></div>
        <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {aiProviders.map((provider) => {
            const label = provider.provider === 'openai' ? 'OpenAI' : 'Gemini';
            const usage = aiUsage.find((item) => item.provider === provider.provider);
            const saving = state.saving === `provider:${provider.provider}`;
            return <div key={provider.provider} className="p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{label}</h3><p className="mt-1 text-xs text-slate-500">{usage?.requests || 0} requests this month - ${Number(usage?.estimatedCost || 0).toFixed(4)} estimated</p></div><label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={provider.enabled} onChange={(event) => updateAIProvider(provider.provider, 'enabled', event.target.checked)} className="h-4 w-4 accent-teal-700" />Enabled</label></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {provider.provider === 'gemini'
                  ? <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs leading-5 text-cyan-950 sm:col-span-2"><span className="font-semibold">Task-based routing:</span> Simple uses Flash-Lite with minimal reasoning; Moderate and Hard use Gemini 3.6 Flash with medium or high reasoning.</div>
                  : <AdminInput label="Model" value={provider.model} onChange={(value) => updateAIProvider(provider.provider, 'model', value)} className="sm:col-span-2" />}
                <AdminInput label="Daily requests per user" type="number" min="1" value={provider.daily_user_request_limit} onChange={(value) => updateAIProvider(provider.provider, 'daily_user_request_limit', value)} />
                <AdminInput label="Monthly workspace requests" type="number" min="1" value={provider.monthly_workspace_request_limit} onChange={(value) => updateAIProvider(provider.provider, 'monthly_workspace_request_limit', value)} />
                <AdminInput label="Monthly budget (USD, 0 = off)" type="number" min="0" step="0.01" value={provider.monthly_budget_usd} onChange={(value) => updateAIProvider(provider.provider, 'monthly_budget_usd', value)} />
                <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Default access</span><select value={provider.allowed_roles.includes('officer') ? 'officers' : 'admins'} onChange={(event) => updateAIProvider(provider.provider, 'allowed_roles', event.target.value === 'officers' ? ['workspace_admin', 'officer'] : ['workspace_admin'])} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="officers">Admins and officers</option><option value="admins">Admins only</option></select></label>
                <AdminInput label="Input USD / 1M tokens" type="number" min="0" step="0.000001" value={provider.input_cost_per_million_usd} onChange={(value) => updateAIProvider(provider.provider, 'input_cost_per_million_usd', value)} />
                <AdminInput label="Output USD / 1M tokens" type="number" min="0" step="0.000001" value={provider.output_cost_per_million_usd} onChange={(value) => updateAIProvider(provider.provider, 'output_cost_per_million_usd', value)} />
              </div>
              <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Enter current provider rates for cost estimates.</p><button type="button" disabled={saving || !provider.model.trim()} onClick={() => saveProvider(provider.provider)} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:bg-slate-400 sm:w-auto">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving...' : 'Save policy'}</button></div>
            </div>;
          })}
        </div>
        <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600"><BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" /><p>Usage records contain provider, model, token counts, estimated cost, operation and status. Official prompts and generated drafts are not stored in the AI log.</p></div>
      </section>
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
                <div key={profile.user_id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_130px_130px_160px_220px_auto] lg:items-center">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{profile.display_name || 'Unnamed user'} {isSelf && <span className="font-normal text-slate-500">(you)</span>}</p><p className="mt-1 truncate text-xs text-slate-500">{profile.email}</p></div>
                  <select aria-label={`Role for ${profile.email}`} value={profile.role} disabled={saving || isSelf} onChange={(event) => changeAccess(profile, profile.status, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="user">User</option><option value="platform_admin">Platform admin</option></select>
                  <AccessStatus status={profile.status} />
                  <select aria-label={`Workspace access for ${profile.email}`} value={membershipValue} disabled={saving || isSelf || profile.status !== 'active'} onChange={(event) => changeMembership(profile, event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100"><option value="none">No workspace access</option><option value="viewer">Viewer</option><option value="officer">Officer</option><option value="workspace_admin">Workspace admin</option></select>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CLOUD_AI_PROVIDERS.map((provider) => {
                      const permission = aiPermissions.find((item) => item.user_id === profile.user_id && item.provider === provider.id);
                      const value = permission ? permission.allowed ? 'allow' : 'block' : 'inherit';
                      return <label key={provider.id} className="block"><span className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{provider.label}</span><select aria-label={`${provider.label} access for ${profile.email}`} value={value} disabled={state.saving === `ai:${profile.user_id}:${provider.id}` || profile.status !== 'active'} onChange={(event) => changeAIPermission(profile, provider.id, event.target.value)} className="h-8 w-full rounded border border-slate-300 bg-white px-1 text-[11px]"><option value="inherit">By role</option><option value="allow">Allow</option><option value="block">Block</option></select></label>;
                    })}
                  </div>
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
      <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>Approval activates the account and adds it to this workspace as an Officer. Viewers can inspect Issues but cannot change them; Officers can edit; Workspace admins can also manage access.</p></div>
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

function AdminInput({ label, value, onChange, type = 'text', min, step, className = '' }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span><input type={type} min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900" /></label>;
}
