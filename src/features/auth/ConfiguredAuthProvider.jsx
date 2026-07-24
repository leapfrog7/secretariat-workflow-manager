import { useEffect, useMemo, useState } from 'react';
import { ensureProfile, getProfile } from './accountApi';
import { AuthContext } from './AuthContext';
import { cloudClient } from './cloudClient';
import { configureCloudIssueSync, syncWorkspaceIssues } from '../cloud/cloudIssueSync';
import { configureCloudOfficerSync, syncWorkspaceOfficers } from '../cloud/cloudOfficerSync';
import { configureCloudIssueItemSync, syncWorkspaceIssueItems } from '../cloud/cloudIssueItemSync';
import { configureCloudSettingsSync, syncWorkspaceSettings } from '../cloud/cloudSettingsSync';
import { ensurePlatformWorkspace, listMyWorkspaces } from '../cloud/workspaceApi';
import { commitLocalWorkspaceScope, prepareLocalWorkspaceScope } from '../cloud/localWorkspaceScope';
import { canEditWorkspace } from '../../utils/accessUtils';

async function synchronizeWorkspace(configuration) {
  await prepareLocalWorkspaceScope(configuration);
  const officers = await syncWorkspaceOfficers(configuration);
  const linkedConfiguration = { ...configuration, officerIdMap: officers.idMap };
  const issues = await syncWorkspaceIssues(linkedConfiguration);
  const items = await syncWorkspaceIssueItems(linkedConfiguration);
  const settings = await syncWorkspaceSettings(linkedConfiguration);
  const result = { officers, issues, items, settings, syncedAt: new Date().toISOString() };
  commitLocalWorkspaceScope(configuration);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('swm:workspace-synced', { detail: result }));
  return result;
}

export default function ConfiguredAuthProvider({ children }) {
  const session = cloudClient.auth.useSession();
  const user = session.data?.user || null;
  const userId = user?.id || '';
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const [profileState, setProfileState] = useState({ userId: '', profile: null, loading: false, error: '' });
  const [workspaceState, setWorkspaceState] = useState({ userId: '', workspaces: [], workspace: null, loading: false, error: '', syncState: { status: 'idle', error: '', syncedAt: '' } });

  useEffect(() => {
    let active = true;

    if (!userId) {
      setProfileState({ userId: '', profile: null, loading: false, error: '' });
      return undefined;
    }

    const identity = { id: userId, email: userEmail, name: userName };
    setProfileState({ userId, profile: null, loading: true, error: '' });
    ensureProfile(identity)
      .then((profile) => {
        if (active) setProfileState({ userId, profile, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setProfileState({ userId, profile: null, loading: false, error: error.message || 'Unable to load account access.' });
      });

    return () => {
      active = false;
    };
  }, [userEmail, userId, userName]);

  useEffect(() => {
    let active = true;
    const profile = profileState.userId === userId ? profileState.profile : null;

    if (!userId || profile?.status !== 'active') {
      configureCloudIssueSync(null);
      configureCloudOfficerSync(null);
      configureCloudIssueItemSync(null);
      configureCloudSettingsSync(null);
      setWorkspaceState({ userId: '', workspaces: [], workspace: null, loading: false, error: '', syncState: { status: 'idle', error: '', syncedAt: '' } });
      return undefined;
    }

    async function initializeWorkspace() {
      setWorkspaceState((current) => ({ ...current, userId, loading: true, error: '' }));
      try {
        let workspaces = await listMyWorkspaces(userId);
        if (!active) return;
        if (!workspaces.length && profile.role === 'platform_admin') {
          await ensurePlatformWorkspace();
          if (!active) return;
          workspaces = await listMyWorkspaces(userId);
          if (!active) return;
        }
        const workspace = workspaces[0] || null;
        if (workspace) {
          const canEdit = canEditWorkspace(profile, workspace);
          const canManageOfficerDirectory = workspace.membership?.role === 'workspace_admin';
          const onStatus = (syncState) => {
            if (active) setWorkspaceState((current) => ({ ...current, syncState: { error: '', syncedAt: '', ...syncState } }));
          };
          await synchronizeWorkspace({ workspaceId: workspace.id, userId, canEdit, canManageOfficerDirectory, onStatus });
          if (!active) return;
        }
        if (active) setWorkspaceState((current) => ({ ...current, userId, workspaces, workspace, loading: false, error: '' }));
      } catch (error) {
        if (active) setWorkspaceState((current) => ({ ...current, userId, loading: false, error: error.message || 'Unable to load workspace access.' }));
      }
    }

    initializeWorkspace();
    return () => {
      active = false;
      configureCloudIssueSync(null);
      configureCloudOfficerSync(null);
      configureCloudIssueItemSync(null);
      configureCloudSettingsSync(null);
    };
  }, [profileState.profile, profileState.userId, userId]);

  async function refreshProfile() {
    if (!user) return null;
    const profile = await getProfile(user.id);
    setProfileState({ userId: user.id, profile, loading: false, error: '' });
    return profile;
  }

  async function refreshWorkspaces() {
    if (!userId) return [];
    const workspaces = await listMyWorkspaces(userId);
    const workspace = workspaces[0] || null;
    setWorkspaceState((current) => ({ ...current, userId, workspaces, workspace, error: '' }));
    if (workspace) {
      const configuration = { workspaceId: workspace.id, userId, canEdit: canEditWorkspace(profileState.profile, workspace), canManageOfficerDirectory: workspace.membership?.role === 'workspace_admin', onStatus: (syncState) => setWorkspaceState((current) => ({ ...current, syncState: { error: '', syncedAt: '', ...syncState } })) };
      configureCloudIssueSync(configuration);
      configureCloudOfficerSync(configuration);
      configureCloudIssueItemSync(configuration);
      configureCloudSettingsSync(configuration);
    }
    return workspaces;
  }

  async function syncNow() {
    const workspace = workspaceState.workspace;
    if (!workspace || !userId) return null;
    const configuration = {
      workspaceId: workspace.id,
      userId,
      canEdit: canEditWorkspace(profileState.profile, workspace),
      canManageOfficerDirectory: workspace.membership?.role === 'workspace_admin',
      onStatus: (syncState) => setWorkspaceState((current) => ({ ...current, syncState: { error: '', syncedAt: '', ...syncState } })),
    };
    return synchronizeWorkspace(configuration);
  }

  const value = useMemo(() => ({
    mode: 'cloud',
    loading: Boolean(session.isPending || (user && (profileState.loading || profileState.userId !== user.id || (profileState.profile?.status === 'active' && (workspaceState.loading || workspaceState.userId !== user.id))))),
    user,
    profile: profileState.userId === user?.id ? profileState.profile : null,
    workspace: workspaceState.userId === user?.id ? workspaceState.workspace : null,
    workspaces: workspaceState.userId === user?.id ? workspaceState.workspaces : [],
    syncState: workspaceState.syncState,
    isAdmin: profileState.profile?.role === 'platform_admin' && profileState.profile?.status === 'active',
    isWorkspaceAdmin: workspaceState.workspace?.membership?.role === 'workspace_admin',
    canEdit: canEditWorkspace(profileState.profile, workspaceState.workspace),
    error: profileState.error || workspaceState.error,
    refreshProfile,
    refreshWorkspaces,
    syncNow,
    signIn: (credentials) => cloudClient.auth.signIn.email(credentials),
    signUp: (details) => cloudClient.auth.signUp.email(details),
    signOut: () => cloudClient.auth.signOut(),
  }), [profileState, session.isPending, user, workspaceState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
