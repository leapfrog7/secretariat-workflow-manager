import { db, getSettings } from '../../db/database';
import { DEFAULT_AI_PREFERENCES, DEFAULT_LOCAL_AI_SETTINGS, DEFAULT_OFFICE_PROFILE, DEFAULT_REMINDER_SETTINGS, DEFAULT_SETTINGS, SETTINGS_ID } from '../../constants/issueConstants';
import { getCloudUserSettings, getCloudWorkspaceSettings, upsertCloudUserSettings, upsertCloudWorkspaceSettings } from './cloudSettingsApi';

let runtime = null;

export function configureCloudSettingsSync(configuration) {
  runtime = configuration?.workspaceId && configuration?.userId ? configuration : null;
}

function workspacePayload(settings) {
  return { categories: settings.categories, officeProfile: settings.officeProfile };
}

function userPayload(settings) {
  return { localAI: settings.localAI, aiPreferences: settings.aiPreferences, reminders: settings.reminders };
}

export function queueCloudSettingsUpsert(settings, scope = 'all') {
  const current = runtime;
  if (!current || !settings) return;
  current.onStatus?.({ status: 'syncing' });
  const requests = [];
  if (scope !== 'user' && current.canEdit !== false) {
    requests.push(upsertCloudWorkspaceSettings({
      workspaceId: current.workspaceId,
      userId: current.userId,
      payload: workspacePayload(settings),
      updatedAt: settings.workspaceSettingsUpdatedAt || settings.updatedAt || new Date().toISOString(),
    }));
  }
  if (scope !== 'workspace') {
    requests.push(upsertCloudUserSettings({
      workspaceId: current.workspaceId,
      userId: current.userId,
      payload: userPayload(settings),
      updatedAt: settings.userSettingsUpdatedAt || settings.updatedAt || new Date().toISOString(),
    }));
  }
  Promise.all(requests)
    .then(() => current.onStatus?.({ status: 'synced', syncedAt: new Date().toISOString() }))
    .catch((error) => current.onStatus?.({ status: 'error', error: error.message || 'Unable to sync settings.' }));
}

export async function syncWorkspaceSettings({ workspaceId, userId, canEdit = true, officerIdMap = {}, onStatus }) {
  configureCloudSettingsSync({ workspaceId, userId, canEdit, onStatus });
  onStatus?.({ status: 'syncing' });
  try {
    const stored = await db.settings.get(SETTINGS_ID);
    const local = await getSettings();
    const [cloudWorkspace, cloudUser] = await Promise.all([
      getCloudWorkspaceSettings(workspaceId),
      getCloudUserSettings(workspaceId, userId),
    ]);
    let merged = { ...DEFAULT_SETTINGS, ...local };
    const localWorkspaceAt = new Date(local.workspaceSettingsUpdatedAt || local.updatedAt || 0).getTime();
    const localUserAt = new Date(local.userSettingsUpdatedAt || local.updatedAt || 0).getTime();
    const cloudWorkspaceAt = new Date(cloudWorkspace?.updated_at || 0).getTime();
    const cloudUserAt = new Date(cloudUser?.updated_at || 0).getTime();

    if (cloudWorkspace && (!stored || cloudWorkspaceAt > localWorkspaceAt)) {
      merged = {
        ...merged,
        categories: Array.isArray(cloudWorkspace.payload?.categories) ? cloudWorkspace.payload.categories : merged.categories,
        officeProfile: { ...DEFAULT_OFFICE_PROFILE, ...(cloudWorkspace.payload?.officeProfile || {}) },
        workspaceSettingsUpdatedAt: cloudWorkspace.updated_at,
      };
    } else if (canEdit && (!cloudWorkspace || localWorkspaceAt > cloudWorkspaceAt)) {
      const updatedAt = local.workspaceSettingsUpdatedAt || local.updatedAt || new Date().toISOString();
      await upsertCloudWorkspaceSettings({ workspaceId, userId, payload: workspacePayload(local), updatedAt });
      merged.workspaceSettingsUpdatedAt = updatedAt;
    }

    if (cloudUser && (!stored || cloudUserAt > localUserAt)) {
      merged = {
        ...merged,
        localAI: { ...DEFAULT_LOCAL_AI_SETTINGS, ...(cloudUser.payload?.localAI || {}) },
        aiPreferences: { ...DEFAULT_AI_PREFERENCES, ...(cloudUser.payload?.aiPreferences || {}) },
        reminders: { ...DEFAULT_REMINDER_SETTINGS, ...(cloudUser.payload?.reminders || {}) },
        userSettingsUpdatedAt: cloudUser.updated_at,
      };
    } else if (!cloudUser || localUserAt > cloudUserAt) {
      const updatedAt = local.userSettingsUpdatedAt || local.updatedAt || new Date().toISOString();
      await upsertCloudUserSettings({ workspaceId, userId, payload: userPayload(local), updatedAt });
      merged.userSettingsUpdatedAt = updatedAt;
    }

    const selectedSignatories = merged.officeProfile?.authorizedSignatoryIds || [];
    const remappedSignatories = [...new Set(selectedSignatories.map((id) => officerIdMap[id] || id))];
    const signatoriesChanged = JSON.stringify(selectedSignatories) !== JSON.stringify(remappedSignatories);
    if (signatoriesChanged) {
      merged.officeProfile = { ...merged.officeProfile, authorizedSignatoryIds: remappedSignatories };
      merged.workspaceSettingsUpdatedAt = new Date().toISOString();
      if (canEdit) {
        await upsertCloudWorkspaceSettings({
          workspaceId,
          userId,
          payload: workspacePayload(merged),
          updatedAt: merged.workspaceSettingsUpdatedAt,
        });
      }
    }
    merged = { ...merged, id: SETTINGS_ID, updatedAt: new Date().toISOString() };
    await db.settings.put(merged);
    const result = { syncedAt: new Date().toISOString() };
    onStatus?.({ status: 'synced', ...result });
    return result;
  } catch (error) {
    onStatus?.({ status: 'error', error: error.message || 'Unable to synchronize settings.' });
    throw error;
  }
}
