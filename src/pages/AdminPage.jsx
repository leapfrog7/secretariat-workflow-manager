import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Eye,
  FilePenLine,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Shield,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { listProfiles, updateProfileAccess } from "../features/auth/accountApi";
import { useAuth } from "../features/auth/AuthContext";
import {
  approveAndAssignUser,
  createWorkspaceForUser,
  listWorkspaceAccessDirectory,
  listWorkspaceMembers,
  setWorkspaceMember,
} from "../features/cloud/workspaceApi";
import {
  CLOUD_AI_PROVIDERS,
  getAIUsageSummary,
  listAIProviderSettings,
  listAIUserPermissions,
  saveAIProviderSettings,
  setAIUserPermission,
} from "../features/ai/cloudAIAdminApi";
import DivisionAdminPanel from "../components/collaboration/DivisionAdminPanel";

export default function AdminPage() {
  const auth = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [workspaceDirectory, setWorkspaceDirectory] = useState([]);
  const [aiProviders, setAIProviders] = useState([]);
  const [aiPermissions, setAIPermissions] = useState([]);
  const [aiUsage, setAIUsage] = useState([]);
  const [activeTab, setActiveTab] = useState("people");
  const [workspaceSetup, setWorkspaceSetup] = useState(null);
  const [assignmentSetup, setAssignmentSetup] = useState(null);
  const [state, setState] = useState({
    loading: true,
    saving: "",
    error: "",
    message: "",
  });

  const counts = useMemo(
    () => ({
      total: profiles.length,
      pending: profiles.filter((profile) => profile.status === "pending")
        .length,
      suspended: profiles.filter((profile) => profile.status === "suspended")
        .length,
      independent: new Set(
        workspaceDirectory
          .filter(
            (membership) =>
              membership.status === "active" &&
              membership.workspace_id !== auth.workspace?.id,
          )
          .map((membership) => membership.workspace_id),
      ).size,
      currentMembers: memberships.filter(
        (membership) => membership.status === "active",
      ).length,
    }),
    [auth.workspace?.id, memberships, profiles, workspaceDirectory],
  );

  const availableWorkspaces = useMemo(() => {
    const workspaces = new Map();
    if (auth.workspace?.id) workspaces.set(auth.workspace.id, auth.workspace);
    workspaceDirectory.forEach((membership) => {
      if (membership.workspace?.id && membership.workspace.is_active !== false) {
        workspaces.set(membership.workspace.id, membership.workspace);
      }
    });
    return [...workspaces.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [auth.workspace, workspaceDirectory]);

  async function loadProfiles() {
    setState((current) => ({
      ...current,
      loading: true,
      error: "",
      message: "",
    }));
    try {
      const [
        result,
        memberResult,
        directoryResult,
        providerResult,
        permissionResult,
        usageResult,
      ] = await Promise.all([
        listProfiles(),
        auth.workspace?.id
          ? listWorkspaceMembers(auth.workspace.id)
          : Promise.resolve([]),
        listWorkspaceAccessDirectory(),
        auth.workspace?.id
          ? listAIProviderSettings(auth.workspace.id)
          : Promise.resolve([]),
        auth.workspace?.id
          ? listAIUserPermissions(auth.workspace.id)
          : Promise.resolve([]),
        auth.workspace?.id
          ? getAIUsageSummary(auth.workspace.id)
          : Promise.resolve([]),
      ]);
      setProfiles(result);
      setMemberships(memberResult);
      setWorkspaceDirectory(directoryResult);
      setAIProviders(
        CLOUD_AI_PROVIDERS.map((provider) => ({
          provider: provider.id,
          enabled: false,
          model: provider.defaultModel,
          allowed_roles: ["workspace_admin", "officer"],
          daily_user_request_limit: 20,
          monthly_workspace_request_limit: 500,
          monthly_budget_usd: 0,
          input_cost_per_million_usd: 0,
          output_cost_per_million_usd: 0,
          ...providerResult.find((item) => item.provider === provider.id),
        })),
      );
      setAIPermissions(permissionResult);
      setAIUsage(usageResult);
      setState({ loading: false, saving: "", error: "", message: "" });
    } catch (error) {
      setState({
        loading: false,
        saving: "",
        error: error.message || "Unable to load registered users.",
        message: "",
      });
    }
  }

  useEffect(() => {
    loadProfiles();
  }, [auth.workspace?.id]);

  async function changeAccess(profile, nextStatus, nextRole = profile.role) {
    setState((current) => ({
      ...current,
      saving: profile.user_id,
      error: "",
      message: "",
    }));
    try {
      const updated = await updateProfileAccess({
        userId: profile.user_id,
        status: nextStatus,
        role: nextRole,
      });
      setProfiles((current) =>
        current.map((item) =>
          item.user_id === profile.user_id ? updated : item,
        ),
      );
      setState({
        loading: false,
        saving: "",
        error: "",
        message:
          nextStatus === "active" && profile.status === "suspended"
            ? `${profile.display_name || profile.email} has been restored. Existing workspace access resumes.`
            : `Account access updated for ${profile.display_name || profile.email}.`,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to update access.",
        message: "",
      }));
    }
  }

  async function changeMembership(profile, value) {
    const existing = memberships.find(
      (membership) => membership.user_id === profile.user_id,
    );
    const status = value === "none" ? "suspended" : "active";
    const role = value === "none" ? existing?.role || "officer" : value;
    setState((current) => ({
      ...current,
      saving: profile.user_id,
      error: "",
      message: "",
    }));
    try {
      const membership = await setWorkspaceMember({
        workspaceId: auth.workspace.id,
        userId: profile.user_id,
        role,
        status,
      });
      setMemberships((current) => [
        ...current.filter((item) => item.user_id !== profile.user_id),
        membership,
      ]);
      setWorkspaceDirectory((current) => [
        ...current.filter(
          (item) =>
            item.user_id !== profile.user_id ||
            item.workspace_id !== auth.workspace.id,
        ),
        { ...membership, workspace: auth.workspace },
      ]);
      setState({
        loading: false,
        saving: "",
        error: "",
        message: `Workspace access updated for ${profile.display_name || profile.email}.`,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to update workspace access.",
        message: "",
      }));
    }
  }

  function openAssignmentSetup(profile) {
    const current = workspaceDirectory.find(
      (membership) =>
        membership.user_id === profile.user_id &&
        membership.status === "active",
    );
    setAssignmentSetup({
      profile,
      workspaceId: current?.workspace_id || auth.workspace?.id || "",
      role: current?.role || "officer",
    });
  }

  async function submitAssignment(event) {
    event.preventDefault();
    if (!assignmentSetup?.workspaceId) return;
    const { profile, workspaceId, role } = assignmentSetup;
    setState((current) => ({
      ...current,
      saving: `assignment:${profile.user_id}`,
      error: "",
      message: "",
    }));
    try {
      const result = await approveAndAssignUser({
        userId: profile.user_id,
        workspaceId,
        role,
      });
      setAssignmentSetup(null);
      await loadProfiles();
      setState({
        loading: false,
        saving: "",
        error: "",
        message: `${profile.display_name || profile.email} is now ${workspaceRoleMeta(role).label.toLowerCase()} in ${result.workspace.name}.`,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to approve and assign this user.",
        message: "",
      }));
    }
  }

  function openWorkspaceSetup(profile) {
    const person =
      profile.display_name?.trim() || profile.email?.split("@")[0] || "New";
    setWorkspaceSetup({
      profile,
      name: `${person} Workspace`,
      code: workspaceCodeFrom(person),
    });
  }

  async function provisionWorkspace(event) {
    event.preventDefault();
    if (!workspaceSetup || !auth.workspace?.id) return;
    const { profile, name, code } = workspaceSetup;
    setState((current) => ({
      ...current,
      saving: `workspace:${profile.user_id}`,
      error: "",
      message: "",
    }));
    try {
      const workspace = await createWorkspaceForUser({
        userId: profile.user_id,
        name,
        code,
        sourceWorkspaceId: auth.workspace.id,
      });
      setMemberships((current) =>
        current.map((membership) =>
          membership.user_id === profile.user_id
            ? { ...membership, status: "suspended" }
            : membership,
        ),
      );
      setWorkspaceDirectory((current) => [
        ...current.map((membership) =>
          membership.user_id === profile.user_id &&
          membership.workspace_id === auth.workspace.id
            ? { ...membership, status: "suspended" }
            : membership,
        ),
        {
          workspace_id: workspace.id,
          user_id: profile.user_id,
          role: "workspace_admin",
          status: "active",
          workspace,
        },
      ]);
      setWorkspaceSetup(null);
      setState({
        loading: false,
        saving: "",
        error: "",
        message: `${profile.display_name || profile.email} now manages the separate workspace “${workspace.name}” and no longer has access to ${auth.workspace.name}.`,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to create the separate workspace.",
        message: "",
      }));
    }
  }

  function updateAIProvider(provider, field, value) {
    setAIProviders((current) =>
      current.map((item) =>
        item.provider === provider ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function saveProvider(provider) {
    const settings = aiProviders.find((item) => item.provider === provider);
    setState((current) => ({
      ...current,
      saving: `provider:${provider}`,
      error: "",
      message: "",
    }));
    try {
      await saveAIProviderSettings({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        settings,
      });
      setState((current) => ({
        ...current,
        saving: "",
        message: `${provider === "openai" ? "OpenAI" : "Gemini"} policy saved.`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to save AI provider policy.",
      }));
    }
  }

  async function changeAIPermission(profile, provider, value) {
    setState((current) => ({
      ...current,
      saving: `ai:${profile.user_id}:${provider}`,
      error: "",
      message: "",
    }));
    try {
      await setAIUserPermission({
        workspaceId: auth.workspace.id,
        userId: profile.user_id,
        provider,
        value,
        updatedBy: auth.user.id,
      });
      setAIPermissions((current) => [
        ...current.filter(
          (item) =>
            item.user_id !== profile.user_id || item.provider !== provider,
        ),
        ...(value === "inherit"
          ? []
          : [
              {
                workspace_id: auth.workspace.id,
                user_id: profile.user_id,
                provider,
                allowed: value === "allow",
                daily_request_limit: null,
              },
            ]),
      ]);
      setState((current) => ({
        ...current,
        saving: "",
        message: `AI access updated for ${profile.display_name || profile.email}.`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: "",
        error: error.message || "Unable to update AI access.",
      }));
    }
  }

  return (
    <>
      <PageHeader
        title="Administration"
        description="Approve registered users and control access to official workspaces."
      />
      <div className="mb-4 flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
        <Building2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{auth.workspace?.name}</p>
          <p className="mt-0.5 text-xs text-teal-800">
            Workspace code: {auth.workspace?.code}
          </p>
        </div>
      </div>
      <nav
        className="mb-5 overflow-x-auto border-b border-slate-200"
        aria-label="Administration sections"
      >
        <div className="flex min-w-max gap-1">
          {[
            { id: "people", label: "People & Roles", icon: Users },
            { id: "divisions", label: "Divisions & Sharing", icon: Building2 },
            { id: "ai", label: "AI Controls", icon: Bot },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={`inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${activeTab === id ? "border-teal-700 text-teal-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      {state.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.message}
        </p>
      )}
      {activeTab === "people" && (
        <AdminGuide
          title="People and roles"
          intro="Users register themselves. The System Administrator approves each account, chooses its primary workspace and sets its starting role."
          items={[
            [
              "1. User registers",
              "The user creates their own password. The account remains pending and cannot open official work.",
            ],
            [
              "2. Approve and assign",
              "Choose an existing workspace and select Viewer, Editor or Manager. Account and membership activate together.",
            ],
            [
              "3. Change placement",
              "Use Change primary workspace for an existing user. The previous membership is suspended; Issues stay where they were created.",
            ],
            [
              "Workspace managers",
              "Managers may adjust roles for colleagues already in their workspace. New-user placement remains with the System Administrator.",
            ],
          ]}
        />
      )}
      {activeTab === "people" && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="Registered" value={counts.total} />
          <Metric label="Pending" value={counts.pending} tone="amber" />
          <Metric
            label="In this workspace"
            value={counts.currentMembers}
            tone="emerald"
          />
          <Metric
            label="Independent workspaces"
            value={counts.independent}
            tone="cyan"
          />
          <Metric label="Suspended" value={counts.suspended} tone="rose" />
        </div>
      )}
      {activeTab === "divisions" && (
        <AdminGuide
          title="How division sharing works"
          intro="A division is a group of colleagues who normally handle the same set of Issues."
          items={[
            [
              "1. Create divisions",
              "Add practical units such as Administration, Finance or Establishment. The short code is only a compact label.",
            ],
            [
              "2. Add colleagues",
              "Can edit permits changes to Issues available to that division. Can view is read only. A Division manager may also manage that division.",
            ],
            [
              "3. Assign Issues",
              "Open each Issue, use Share & Access, and select its owning division. Entire workspace remains visible to everyone; Owning division limits normal access to that division; Restricted requires an explicit grant.",
            ],
            [
              "4. Enable enforcement last",
              "The application checks that every active Issue and colleague has been assigned. Until you enable enforcement, current workspace-wide access continues unchanged.",
            ],
          ]}
        />
      )}
      {activeTab === "divisions" && (
        <DivisionAdminPanel
          auth={auth}
          profiles={profiles}
          workspaceMembers={memberships}
        />
      )}
      {activeTab === "ai" && (
        <AdminGuide
          title="Cloud AI controls"
          intro="Use this tab to decide whether a paid cloud provider is available and who may use it."
          items={[
            [
              "Workspace default",
              "The provider policy sets the normal rule for everyone: administrators only, or administrators and officers.",
            ],
            [
              "Use workspace default",
              "This means the person follows that normal provider rule. It does not grant or block anything separately.",
            ],
            [
              "Allow or block",
              "Use an individual override only for an exception. Allow gives that person access; Block removes it even when their workspace role would normally allow it.",
            ],
            [
              "Limits and cost",
              "Request limits prevent accidental overuse. Cost figures are estimates based on the rates entered here, not provider invoices.",
            ],
          ]}
        />
      )}
      {activeTab === "ai" && (
        <>
          <section className="surface mb-5 overflow-hidden rounded-md">
            <div className="flex items-start gap-2 border-b border-slate-200 px-4 py-3">
              <Bot className="mt-0.5 h-5 w-5 text-cyan-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Cloud AI providers
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enable providers, choose server-side models, and set workspace
                  safeguards. API keys are configured only in Vercel.
                </p>
              </div>
            </div>
            <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {aiProviders.map((provider) => {
                const label =
                  provider.provider === "openai" ? "OpenAI" : "Gemini";
                const usage = aiUsage.find(
                  (item) => item.provider === provider.provider,
                );
                const saving = state.saving === `provider:${provider.provider}`;
                return (
                  <div key={provider.provider} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {label}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {usage?.requests || 0} requests this month - $
                          {Number(usage?.estimatedCost || 0).toFixed(4)}{" "}
                          estimated
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(event) =>
                            updateAIProvider(
                              provider.provider,
                              "enabled",
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 accent-teal-700"
                        />
                        Enabled
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {provider.provider === "gemini" ? (
                        <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs leading-5 text-cyan-950 sm:col-span-2">
                          <span className="font-semibold">
                            Task-based routing:
                          </span>{" "}
                          Simple uses Flash-Lite with minimal reasoning;
                          Moderate and Hard use Gemini 3.6 Flash with medium or
                          high reasoning.
                        </div>
                      ) : (
                        <AdminInput
                          label="Model"
                          value={provider.model}
                          onChange={(value) =>
                            updateAIProvider(provider.provider, "model", value)
                          }
                          className="sm:col-span-2"
                        />
                      )}
                      <AdminInput
                        label="Daily requests per user"
                        type="number"
                        min="1"
                        value={provider.daily_user_request_limit}
                        onChange={(value) =>
                          updateAIProvider(
                            provider.provider,
                            "daily_user_request_limit",
                            value,
                          )
                        }
                      />
                      <AdminInput
                        label="Monthly workspace requests"
                        type="number"
                        min="1"
                        value={provider.monthly_workspace_request_limit}
                        onChange={(value) =>
                          updateAIProvider(
                            provider.provider,
                            "monthly_workspace_request_limit",
                            value,
                          )
                        }
                      />
                      <AdminInput
                        label="Monthly budget (USD, 0 = off)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={provider.monthly_budget_usd}
                        onChange={(value) =>
                          updateAIProvider(
                            provider.provider,
                            "monthly_budget_usd",
                            value,
                          )
                        }
                      />
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-slate-600">
                          Default access
                        </span>
                        <select
                          value={
                            provider.allowed_roles.includes("officer")
                              ? "officers"
                              : "admins"
                          }
                          onChange={(event) =>
                            updateAIProvider(
                              provider.provider,
                              "allowed_roles",
                              event.target.value === "officers"
                                ? ["workspace_admin", "officer"]
                                : ["workspace_admin"],
                            )
                          }
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                        >
                          <option value="officers">
                            Workspace managers and editors
                          </option>
                          <option value="admins">Workspace managers only</option>
                        </select>
                      </label>
                      <AdminInput
                        label="Input USD / 1M tokens"
                        type="number"
                        min="0"
                        step="0.000001"
                        value={provider.input_cost_per_million_usd}
                        onChange={(value) =>
                          updateAIProvider(
                            provider.provider,
                            "input_cost_per_million_usd",
                            value,
                          )
                        }
                      />
                      <AdminInput
                        label="Output USD / 1M tokens"
                        type="number"
                        min="0"
                        step="0.000001"
                        value={provider.output_cost_per_million_usd}
                        onChange={(value) =>
                          updateAIProvider(
                            provider.provider,
                            "output_cost_per_million_usd",
                            value,
                          )
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500">
                        Enter current provider rates for cost estimates.
                      </p>
                      <button
                        type="button"
                        disabled={saving || !provider.model.trim()}
                        onClick={() => saveProvider(provider.provider)}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:bg-slate-400 sm:w-auto"
                      >
                        {saving ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {saving ? "Saving..." : "Save policy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <p>
                Usage records contain provider, model, token counts, estimated
                cost, operation and status. Official prompts and generated
                drafts are not stored in the AI log.
              </p>
            </div>
          </section>
          <AIUserAccess
            profiles={profiles}
            permissions={aiPermissions}
            saving={state.saving}
            onChange={changeAIPermission}
          />
        </>
      )}
      {activeTab === "people" && (
        <PeopleDirectory
          auth={auth}
          profiles={profiles}
          memberships={memberships}
          workspaceDirectory={workspaceDirectory}
          loading={state.loading}
          saving={state.saving}
          onRefresh={loadProfiles}
          onAccountChange={changeAccess}
          onMembershipChange={changeMembership}
          onAssignWorkspace={openAssignmentSetup}
          onOwnWorkspace={openWorkspaceSetup}
        />
      )}
      {workspaceSetup && (
        <WorkspaceSetupDialog
          value={workspaceSetup}
          currentWorkspace={auth.workspace}
          saving={
            state.saving === `workspace:${workspaceSetup.profile.user_id}`
          }
          onChange={setWorkspaceSetup}
          onClose={() => setWorkspaceSetup(null)}
          onSubmit={provisionWorkspace}
        />
      )}
      {assignmentSetup && (
        <WorkspaceAssignmentDialog
          value={assignmentSetup}
          workspaces={availableWorkspaces}
          saving={
            state.saving === `assignment:${assignmentSetup.profile.user_id}`
          }
          onChange={setAssignmentSetup}
          onClose={() => setAssignmentSetup(null)}
          onSubmit={submitAssignment}
        />
      )}
    </>
  );
}

function PeopleDirectory({
  auth,
  profiles,
  memberships,
  workspaceDirectory,
  loading,
  saving,
  onRefresh,
  onAccountChange,
  onMembershipChange,
  onAssignWorkspace,
  onOwnWorkspace,
}) {
  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            User access directory
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Review the account, workspace placement and practical rights of
            every registered person.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="grid border-b border-slate-200 bg-slate-50 md:grid-cols-3 md:divide-x md:divide-slate-200">
        <RightsKey
          icon={CircleUserRound}
          title="Account"
          description="Users create their own password. Approval activates the account and its primary workspace together."
        />
        <RightsKey
          icon={Users}
          title="This workspace"
          description={`Controls access to ${auth.workspace?.name}. Editors can see workspace-wide Issues.`}
        />
        <RightsKey
          icon={Building2}
          title="Independent workspace"
          description="Keeps another office's Issues separate. Its manager administers that workspace."
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading user rights
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {profiles.map((profile) => {
            const isSelf = profile.user_id === auth.user?.id;
            const accountSaving = saving === profile.user_id;
            const workspaceSaving =
              saving === `workspace:${profile.user_id}`;
            const assignmentSaving =
              saving === `assignment:${profile.user_id}`;
            const currentMembership = memberships.find(
              (item) => item.user_id === profile.user_id,
            );
            const membershipValue =
              currentMembership?.status === "active"
                ? currentMembership.role
                : "none";
            const assignments = workspaceDirectory.filter(
              (item) =>
                item.user_id === profile.user_id &&
                item.status === "active" &&
                item.workspace?.is_active !== false,
            );
            const hasIndependentWorkspace = assignments.some(
              (item) => item.workspace_id !== auth.workspace?.id,
            );

            return (
              <article key={profile.user_id} className="px-4 py-5 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700">
                    {userInitials(profile)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-slate-950">
                        {profile.display_name || "Unnamed user"}
                        {isSelf ? " (you)" : ""}
                      </h3>
                      <AccessStatus status={profile.status} />
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${profile.role === "platform_admin" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {profile.role === "platform_admin"
                          ? "System administrator"
                          : "Standard account"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {profile.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    Active workspace rights
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assignments.map((assignment) => (
                      <WorkspaceRight
                        key={`${assignment.workspace_id}:${assignment.user_id}`}
                        assignment={assignment}
                        current={
                          assignment.workspace_id === auth.workspace?.id
                        }
                      />
                    ))}
                    {!assignments.length && (
                      <span className="inline-flex min-h-8 items-center rounded-md border border-dashed border-slate-300 px-2.5 text-xs text-slate-500">
                        No active workspace assigned
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(160px,0.65fr)_minmax(220px,1fr)_minmax(220px,auto)] lg:items-end">
                  <ControlField
                    label="System authority"
                    help="System administrators approve accounts and provision workspaces."
                  >
                    <select
                      aria-label={`System authority for ${profile.email}`}
                      value={profile.role}
                      disabled={accountSaving || isSelf || !auth.isAdmin}
                      onChange={(event) =>
                        onAccountChange(
                          profile,
                          profile.status,
                          event.target.value,
                        )
                      }
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="user">Standard account</option>
                      <option value="platform_admin">
                        System administrator
                      </option>
                    </select>
                  </ControlField>

                  <ControlField
                    label={`Access to ${auth.workspace?.name}`}
                    help={
                      auth.isAdmin
                        ? "System Administrators use Change primary workspace below. Workspace managers use this control for colleagues already placed here."
                        : workspaceAccessTip(membershipValue)
                    }
                  >
                    <select
                      aria-label={`Access to ${auth.workspace?.name} for ${profile.email}`}
                      value={membershipValue}
                      disabled={
                        auth.isAdmin ||
                        accountSaving ||
                        isSelf ||
                        profile.status !== "active"
                      }
                      onChange={(event) =>
                        onMembershipChange(profile, event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="none">No access to this workspace</option>
                      <option value="viewer">Viewer - can read</option>
                      <option value="officer">Editor - can work on Issues</option>
                      <option value="workspace_admin">
                        Manager - controls this workspace
                      </option>
                    </select>
                  </ControlField>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-slate-700">
                      Administrative actions
                    </p>
                    <div className="flex min-h-10 flex-wrap items-center gap-2">
                      {auth.isAdmin &&
                        profile.status === "active" &&
                        !hasIndependentWorkspace &&
                        !isSelf && (
                          <ActionButton
                            disabled={
                              accountSaving ||
                              workspaceSaving ||
                              assignmentSaving
                            }
                            onClick={() => onOwnWorkspace(profile)}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            {membershipValue === "none"
                              ? "Create independent workspace"
                              : "Move to independent workspace"}
                          </ActionButton>
                        )}
                      {auth.isAdmin && profile.status === "pending" && (
                        <ActionButton
                          disabled={accountSaving || assignmentSaving}
                          onClick={() => onAssignWorkspace(profile)}
                          tone="approve"
                        >
                          Approve and assign
                        </ActionButton>
                      )}
                      {auth.isAdmin &&
                        profile.status === "active" &&
                        !isSelf && (
                          <ActionButton
                            disabled={accountSaving || assignmentSaving}
                            onClick={() => onAssignWorkspace(profile)}
                          >
                            <Users className="h-3.5 w-3.5" />
                            Change primary workspace
                          </ActionButton>
                        )}
                      {auth.isAdmin &&
                        profile.status === "active" &&
                        !isSelf && (
                          <ActionButton
                            disabled={accountSaving}
                            onClick={() =>
                              onAccountChange(profile, "suspended")
                            }
                            tone="suspend"
                          >
                            Suspend account
                          </ActionButton>
                        )}
                      {auth.isAdmin && profile.status === "suspended" && (
                        <ActionButton
                          disabled={accountSaving}
                          onClick={() => onAccountChange(profile, "active")}
                          tone="approve"
                        >
                          Restore account
                        </ActionButton>
                      )}
                      {!auth.isAdmin && (
                        <span className="text-xs text-slate-500">
                          Workspace controls only
                        </span>
                      )}
                      {auth.isAdmin &&
                        hasIndependentWorkspace &&
                        !isSelf && (
                          <span className="sr-only">
                            Independent workspace assigned
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {!profiles.length && (
            <div className="px-4 py-12 text-center">
              <UserRoundCog className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm text-slate-600">
                No registered users found.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-3 border-t border-slate-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 sm:px-5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Every active user should have one primary workspace. An Editor can see
          workspace-wide Issues there. Moving a user changes access only; it
          never moves Issues between workspaces.
        </p>
      </div>
    </section>
  );
}

function RightsKey({ icon: Icon, title, description }) {
  return (
    <div className="flex gap-3 px-4 py-3 sm:px-5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
      <div>
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function ControlField({ label, help, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
        {help}
      </span>
    </label>
  );
}

function WorkspaceRight({ assignment, current }) {
  const role = workspaceRoleMeta(assignment.role);
  const Icon = role.icon;
  return (
    <span
      className={`inline-flex min-h-8 max-w-full items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${role.style}`}
      title={`${role.label} in ${assignment.workspace?.name}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <strong className="font-semibold">{role.label}</strong>
      <span className="truncate">{assignment.workspace?.name}</span>
      {current && (
        <span className="shrink-0 border-l border-current/20 pl-2 text-[10px] font-semibold uppercase">
          Current
        </span>
      )}
    </span>
  );
}

function workspaceRoleMeta(role) {
  if (role === "workspace_admin") {
    return {
      label: "Manager",
      icon: Shield,
      style: "border-teal-200 bg-teal-50 text-teal-900",
    };
  }
  if (role === "officer") {
    return {
      label: "Editor",
      icon: FilePenLine,
      style: "border-cyan-200 bg-cyan-50 text-cyan-900",
    };
  }
  return {
    label: "Viewer",
    icon: Eye,
    style: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function userInitials(profile) {
  const source = profile.display_name?.trim() || profile.email || "?";
  const words = source.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function workspaceAccessTip(role) {
  if (role === "viewer") {
    return "Can read workspace-wide Issues here. This is not an isolated personal workspace.";
  }
  if (role === "officer") {
    return "Can edit workspace-wide Issues here. Use Own workspace for independent work.";
  }
  if (role === "workspace_admin") {
    return "Can edit all Issues here and manage this workspace's people, divisions and sharing.";
  }
  return "The person cannot open this workspace.";
}

function workspaceCodeFrom(value) {
  const code = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return code.length >= 2 ? code : "new-workspace";
}

function WorkspaceAssignmentDialog({
  value,
  workspaces,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  const approving = value.profile.status === "pending";
  const selectedWorkspace = workspaces.find(
    (workspace) => workspace.id === value.workspaceId,
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-assignment-title"
        className="w-full max-w-lg rounded-t-lg bg-white shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2
              id="workspace-assignment-title"
              className="text-base font-semibold text-slate-950"
            >
              {approving
                ? "Approve and assign user"
                : "Change primary workspace"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {value.profile.display_name || value.profile.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close workspace assignment"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Primary workspace
            </span>
            <select
              required
              value={value.workspaceId}
              onChange={(event) =>
                onChange({ ...value, workspaceId: event.target.value })
              }
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Select workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.code})
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">
              Workspace role
            </legend>
            <div className="mt-2 grid grid-cols-3 rounded-md border border-slate-300 bg-slate-50 p-1">
              {[
                ["viewer", "Viewer"],
                ["officer", "Editor"],
                ["workspace_admin", "Manager"],
              ].map(([role, label]) => (
                <label key={role} className="cursor-pointer">
                  <input
                    type="radio"
                    name="workspace-role"
                    value={role}
                    checked={value.role === role}
                    onChange={() => onChange({ ...value, role })}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-9 items-center justify-center rounded text-xs font-semibold transition-colors ${value.role === role ? "bg-white text-teal-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {workspaceRoleDescription(value.role)}
            </p>
          </fieldset>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
            {approving ? (
              <>
                Approval will activate the account and place it in{" "}
                <strong>
                  {selectedWorkspace?.name || "the selected workspace"}
                </strong>
                .
              </>
            ) : (
              <>
                This user will keep one active primary workspace. Other
                workspace memberships will be suspended. Existing Issues are
                not moved.
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !value.workspaceId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving
              ? "Saving assignment..."
              : approving
                ? "Approve and assign"
                : "Change workspace"}
          </button>
        </div>
      </form>
    </div>
  );
}

function workspaceRoleDescription(role) {
  if (role === "viewer") {
    return "Can read workspace-wide Issues but cannot change them.";
  }
  if (role === "workspace_admin") {
    return "Can manage the workspace, its members, divisions and Issue access.";
  }
  return "Can create and update Issues available in the workspace.";
}

function WorkspaceSetupDialog({
  value,
  currentWorkspace,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  const person =
    value.profile.display_name || value.profile.email || "This person";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-setup-title"
        className="w-full max-w-lg rounded-t-lg bg-white shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2
              id="workspace-setup-title"
              className="text-base font-semibold text-slate-950"
            >
              Create an independent workspace
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {person} will manage this workspace without access to your
              workspace’s Issues.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close workspace setup"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Workspace name
            </span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={120}
              value={value.name}
              onChange={(event) =>
                onChange({ ...value, name: event.target.value })
              }
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Workspace code
            </span>
            <input
              required
              minLength={2}
              maxLength={48}
              pattern="[a-z0-9](?:[a-z0-9]|-){1,47}"
              value={value.code}
              onChange={(event) =>
                onChange({
                  ...value,
                  code: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, ""),
                })
              }
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <span className="mt-1.5 block text-xs text-slate-500">
              A short unique identifier using lowercase letters, numbers and
              hyphens.
            </span>
          </label>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-950">
            Any access {person} currently has to{" "}
            <strong>{currentWorkspace?.name}</strong> will be removed. Existing
            Issues stay in their present workspace and are not copied.
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving ? "Creating workspace..." : "Create and move user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminGuide({ title, intro, items }) {
  return (
    <section className="mb-5 border-l-4 border-l-cyan-600 bg-cyan-50 px-4 py-4">
      <h2 className="text-sm font-semibold text-cyan-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-cyan-900">{intro}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map(([label, description]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-cyan-950">{label}</p>
            <p className="mt-1 text-xs leading-5 text-cyan-900">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AIUserAccess({ profiles, permissions, saving, onChange }) {
  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-950">
          Individual exceptions
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Most people should use the workspace default. Add an override only
          when one person needs different access.
        </p>
      </div>
      <div className="divide-y divide-slate-200">
        {profiles
          .filter((profile) => profile.status === "active")
          .map((profile) => (
            <div
              key={profile.user_id}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:items-end"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile.display_name || "Unnamed user"}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {profile.email}
                </p>
              </div>
              {CLOUD_AI_PROVIDERS.map((provider) => {
                const permission = permissions.find(
                  (item) =>
                    item.user_id === profile.user_id &&
                    item.provider === provider.id,
                );
                const value = permission
                  ? permission.allowed
                    ? "allow"
                    : "block"
                  : "inherit";
                return (
                  <label key={provider.id} className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      {provider.label}
                    </span>
                    <select
                      aria-label={`${provider.label} access for ${profile.email}`}
                      value={value}
                      disabled={
                        saving === `ai:${profile.user_id}:${provider.id}`
                      }
                      onChange={(event) =>
                        onChange(profile, provider.id, event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs disabled:bg-slate-100"
                    >
                      <option value="inherit">Use workspace default</option>
                      <option value="allow">Allow this person</option>
                      <option value="block">Block this person</option>
                    </select>
                  </label>
                );
              })}
            </div>
          ))}
        {!profiles.some((profile) => profile.status === "active") && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No active users available.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return (
    <div className={`rounded-md border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AccessStatus({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-900",
    active: "bg-emerald-100 text-emerald-900",
    suspended: "bg-rose-100 text-rose-900",
  };
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}

function ActionButton({ children, disabled, onClick, tone }) {
  const styles = {
    approve: "bg-teal-700 text-white",
    suspend: "border border-rose-200 bg-rose-50 text-rose-800",
    neutral: "border border-slate-300 bg-white text-slate-700",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold disabled:opacity-50 ${styles[tone || "neutral"]}`}
    >
      {disabled ? "Saving..." : children}
    </button>
  );
}

function AdminInput({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
  className = "",
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
      />
    </label>
  );
}
