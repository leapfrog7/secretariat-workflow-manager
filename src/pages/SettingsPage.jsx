import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BellRing, Bot, Building2, CheckCircle2, Cloud, Database, Download, HardDrive, LoaderCircle, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import DisclosureSection from '../components/common/DisclosureSection';
import OfficerForm from '../components/officers/OfficerForm';
import { useToast } from '../components/common/ToastProvider';
import { APP_NAME, DB_NAME, DB_VERSION, DEFAULT_AI_PREFERENCES, DEFAULT_LOCAL_AI_SETTINGS, DEFAULT_OFFICE_PROFILE, DEFAULT_REMINDER_SETTINGS } from '../constants/issueConstants';
import { getIssueStatistics } from '../db/issueRepository';
import {
  buildBackupPayload,
  downloadBackup,
  formatBytes,
  getBackupStatus,
  getBrowserStorageStatus,
  importDatabase,
  markBackupSuccessful,
  requestPersistentStorage,
  saveBackupToLocalFile,
  validateBackupPayload,
} from '../db/backupService';
import { getAllOfficers, getOfficerStatistics, saveOfficer } from '../db/officerRepository';
import { clearDemoIssues, loadDemoIssues } from '../db/seedData';
import { formatDateTime } from '../utils/dateUtils';
import { getSettings, saveSettings } from '../db/database';
import { listLMStudioModels, normalizeLocalAISettings } from '../services/lmStudioClient';
import { normalizeOfficeProfile } from '../utils/governmentDraftUtils';
import { queueCloudSettingsUpsert } from '../features/cloud/cloudSettingsSync';
import { useAuth } from '../features/auth/AuthContext';
import { getCloudAIStatus } from '../services/cloudAIClient';

export default function SettingsPage() {
  const fileRef = useRef(null);
  const { showToast } = useToast();
  const auth = useAuth();
  const [state, setState] = useState({
    loading: true,
    busy: '',
    error: '',
    stats: null,
    pendingImport: null,
    confirmClearDemo: false,
    storageStatus: null,
    backupStatus: null,
    fileSystemAccessSupported: false,
    officers: [],
    officerForm: null,
    officeProfile: DEFAULT_OFFICE_PROFILE,
    aiSettings: DEFAULT_LOCAL_AI_SETTINGS,
    aiPreferences: DEFAULT_AI_PREFERENCES,
    cloudProviders: [],
    reminderSettings: DEFAULT_REMINDER_SETTINGS,
    aiModels: [],
    aiStatus: 'idle',
    aiMessage: '',
  });

  const load = async () => {
    try {
      const [stats, officerStats, officers, storageStatus, backupStatus, settings] = await Promise.all([
        getIssueStatistics(),
        getOfficerStatistics(),
        getAllOfficers(),
        getBrowserStorageStatus(),
        getBackupStatus(),
        getSettings(),
      ]);
      setState((current) => ({
        ...current,
        loading: false,
        error: '',
        stats,
        officerStats,
        officers,
        storageStatus,
        backupStatus,
        fileSystemAccessSupported: typeof window !== 'undefined' && 'showSaveFilePicker' in window,
        aiSettings: normalizeLocalAISettings(settings.localAI),
        aiPreferences: { ...DEFAULT_AI_PREFERENCES, ...(settings.aiPreferences || {}) },
        reminderSettings: { ...DEFAULT_REMINDER_SETTINGS, ...(settings.reminders || {}) },
        officeProfile: normalizeOfficeProfile(settings.officeProfile),
      }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    load();
    window.addEventListener('swm:workspace-synced', load);
    return () => window.removeEventListener('swm:workspace-synced', load);
  }, []);

  useEffect(() => {
    if (!auth.workspace?.id) return;
    getCloudAIStatus(auth.workspace.id)
      .then(({ providers }) => setState((current) => ({ ...current, cloudProviders: providers || [] })))
      .catch(() => setState((current) => ({ ...current, cloudProviders: [] })));
  }, [auth.workspace?.id]);

  const exportData = async () => {
    try {
      setState((current) => ({ ...current, busy: 'export' }));
      const payload = await buildBackupPayload();
      downloadBackup(payload);
      await markBackupSuccessful();
      showToast('JSON backup downloaded.');
      await load();
    } catch (error) {
      showToast(error.message || 'Backup export failed.', 'error');
    } finally {
      setState((current) => ({ ...current, busy: '' }));
    }
  };

  const saveLocalFile = async () => {
    try {
      setState((current) => ({ ...current, busy: 'save-file' }));
      const payload = await buildBackupPayload();
      const result = await saveBackupToLocalFile(payload);
      await markBackupSuccessful();
      showToast(result.usedFallback ? 'File picker is not supported here. JSON backup downloaded instead.' : 'Backup saved to local file.');
      await load();
    } catch (error) {
      if (error.name === 'AbortError') return;
      showToast(error.message || 'Unable to save backup file.', 'error');
    } finally {
      setState((current) => ({ ...current, busy: '' }));
    }
  };

  const requestPersistence = async () => {
    try {
      setState((current) => ({ ...current, busy: 'persist' }));
      const granted = await requestPersistentStorage();
      showToast(granted ? 'Persistent storage granted by the browser.' : 'Persistent storage was not granted by the browser.', granted ? 'success' : 'error');
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to request persistent storage.', 'error');
    } finally {
      setState((current) => ({ ...current, busy: '' }));
    }
  };

  const chooseImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await validateBackupPayload(payload);
      setState((current) => ({ ...current, pendingImport: payload }));
    } catch (error) {
      showToast(error.message || 'Unable to read backup.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const confirmImport = async () => {
    try {
      await validateBackupPayload(state.pendingImport);
      const result = await importDatabase(state.pendingImport);
      showToast(`Imported backup with ${result.imported} Issues and ${result.officersImported || 0} officers.`);
      setState((current) => ({ ...current, pendingImport: null }));
      await load();
    } catch (error) {
      showToast(error.message || 'Import failed.', 'error');
    }
  };

  const loadDemo = async () => {
    const result = await loadDemoIssues();
    showToast(result.loaded ? `Loaded ${result.count} demo Issues.` : 'Demo Issues are already loaded.');
    await load();
  };

  const clearDemo = async () => {
    const result = await clearDemoIssues();
    showToast(`Cleared ${result.count} demo Issues.`);
    setState((current) => ({ ...current, confirmClearDemo: false }));
    await load();
  };

  const saveOfficerDetails = async (officer) => {
    try {
      await saveOfficer(officer);
      showToast(officer.id ? 'Officer updated.' : 'Officer added.');
      setState((current) => ({ ...current, officerForm: null }));
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to save officer.', 'error');
    }
  };

  const testLocalAI = async () => {
    try {
      setState((current) => ({ ...current, busy: 'ai-test', aiStatus: 'testing', aiMessage: '' }));
      const models = await listLMStudioModels(state.aiSettings);
      if (!models.length) throw new Error('LM Studio did not report any language models.');
      const selectedModel = models.some((model) => model.id === state.aiSettings.model) ? state.aiSettings.model : models[0].id;
      setState((current) => ({
        ...current,
        busy: '',
        aiStatus: 'connected',
        aiMessage: `${models.length} language model${models.length === 1 ? '' : 's'} available.`,
        aiModels: models,
        aiSettings: { ...current.aiSettings, model: selectedModel },
      }));
    } catch (error) {
      setState((current) => ({ ...current, busy: '', aiStatus: 'error', aiMessage: error.message || 'Unable to connect to LM Studio.' }));
    }
  };

  const saveAISettings = async () => {
    try {
      setState((current) => ({ ...current, busy: 'ai-save' }));
      const settings = await getSettings();
      const saved = await saveSettings({
        ...settings,
        localAI: normalizeLocalAISettings(state.aiSettings),
        aiPreferences: { ...DEFAULT_AI_PREFERENCES, ...state.aiPreferences },
      });
      queueCloudSettingsUpsert(saved, 'user');
      setState((current) => ({ ...current, busy: '', aiSettings: saved.localAI, aiPreferences: saved.aiPreferences }));
      showToast('AI preferences saved.');
    } catch (error) {
      setState((current) => ({ ...current, busy: '' }));
      showToast(error.message || 'Unable to save AI preferences.', 'error');
    }
  };

  const saveReminders = async () => {
    try {
      setState((current) => ({ ...current, busy: 'reminders-save' }));
      const settings = await getSettings();
      const reminders = {
        ...DEFAULT_REMINDER_SETTINGS,
        ...state.reminderSettings,
        upcomingDays: Math.min(30, Math.max(1, Number(state.reminderSettings.upcomingDays) || 7)),
      };
      const saved = await saveSettings({ ...settings, reminders });
      queueCloudSettingsUpsert(saved, 'user');
      setState((current) => ({ ...current, busy: '', reminderSettings: saved.reminders }));
      showToast('Reminder preferences saved.');
    } catch (error) {
      setState((current) => ({ ...current, busy: '' }));
      showToast(error.message || 'Unable to save reminder preferences.', 'error');
    }
  };

  const updateOfficeProfile = (field, value) => {
    setState((current) => ({ ...current, officeProfile: { ...current.officeProfile, [field]: value } }));
  };

  const toggleSignatory = (officerId) => {
    setState((current) => {
      const selected = current.officeProfile.authorizedSignatoryIds;
      return {
        ...current,
        officeProfile: {
          ...current.officeProfile,
          authorizedSignatoryIds: selected.includes(officerId) ? selected.filter((id) => id !== officerId) : [...selected, officerId],
        },
      };
    });
  };

  const saveOfficeProfile = async () => {
    try {
      setState((current) => ({ ...current, busy: 'profile-save' }));
      const settings = await getSettings();
      const saved = await saveSettings({ ...settings, officeProfile: normalizeOfficeProfile(state.officeProfile) });
      queueCloudSettingsUpsert(saved, 'workspace');
      setState((current) => ({ ...current, busy: '', officeProfile: saved.officeProfile }));
      showToast('Official drafting profile saved.');
    } catch (error) {
      setState((current) => ({ ...current, busy: '' }));
      showToast(error.message || 'Unable to save the drafting profile.', 'error');
    }
  };

  if (state.loading) return <LoadingState message="Loading settings..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const storage = state.storageStatus;
  const backup = state.backupStatus;

  return (
    <>
      <PageHeader title="Settings" description="Manage officers, the official drafting profile, Local AI and application data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface rounded-md border-t-4 border-t-teal-600 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Officers</h2>
              <p className="mt-1 text-sm text-slate-600">These names appear when an Issue is allocated.</p>
            </div>
            {!state.officerForm && (
              <button type="button" onClick={() => setState((current) => ({ ...current, officerForm: { mode: 'new', officer: null } }))} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add officer
              </button>
            )}
          </div>
          {state.officerForm && (
            <div className="mt-4">
              <OfficerForm initialOfficer={state.officerForm.officer} onSubmit={saveOfficerDetails} onCancel={() => setState((current) => ({ ...current, officerForm: null }))} />
            </div>
          )}
          <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {state.officers.map((officer) => (
              <div key={officer.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{officer.name}</div>
                  {(officer.designation || !officer.isActive) && <div className="mt-0.5 text-xs text-slate-500">{officer.designation}{officer.designation && !officer.isActive ? ' - ' : ''}{!officer.isActive ? 'Inactive' : ''}</div>}
                </div>
                <button type="button" title="Edit officer" onClick={() => setState((current) => ({ ...current, officerForm: { mode: 'edit', officer } }))} className="rounded-md border border-slate-300 p-2 text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800">
                  <span className="sr-only">Edit {officer.name}</span>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {!state.officers.length && <p className="py-4 text-sm text-slate-500">No officers added.</p>}
          </div>
        </section>

        <section className="surface rounded-md border-t-4 border-t-amber-500 p-4 lg:col-span-2">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
            <div><h2 className="text-sm font-semibold text-slate-950">Official drafting profile</h2><p className="mt-1 text-sm text-slate-600">Office identity and officers authorized to sign generated communications.</p></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileInput label="Government heading" value={state.officeProfile.governmentName} onChange={(value) => updateOfficeProfile('governmentName', value)} />
            <ProfileInput label="Government heading (Hindi transliteration)" value={state.officeProfile.governmentHindiName} onChange={(value) => updateOfficeProfile('governmentHindiName', value)} />
            <ProfileInput label="Ministry" value={state.officeProfile.ministry} onChange={(value) => updateOfficeProfile('ministry', value)} />
            <ProfileInput label="Department" value={state.officeProfile.department} onChange={(value) => updateOfficeProfile('department', value)} />
            <ProfileInput label="Department (Hindi transliteration)" value={state.officeProfile.departmentHindiName} onChange={(value) => updateOfficeProfile('departmentHindiName', value)} />
            <ProfileInput label="Division" value={state.officeProfile.division} onChange={(value) => updateOfficeProfile('division', value)} />
            <ProfileInput label="Section" value={state.officeProfile.section} onChange={(value) => updateOfficeProfile('section', value)} />
            <ProfileInput label="Place of issue" value={state.officeProfile.placeOfIssue} onChange={(value) => updateOfficeProfile('placeOfIssue', value)} />
            <label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-sm font-medium text-slate-700">Office address <span className="font-normal text-slate-500">(optional)</span></span><textarea rows={2} value={state.officeProfile.officeAddress} onChange={(event) => updateOfficeProfile('officeAddress', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900" /></label>
            <label className="block sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-sm font-medium text-slate-700">House-style drafting notes <span className="font-normal text-slate-500">(optional)</span></span><textarea rows={3} value={state.officeProfile.houseStyleNotes} onChange={(event) => updateOfficeProfile('houseStyleNotes', event.target.value)} placeholder="Example: Refer to the Ministry as this Ministry; use concise numbered paragraphs." className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900" /><span className="mt-1 block text-xs text-slate-500">Applied to the prose while the standard communication structure remains fixed.</span></label>
          </div>
          <fieldset className="mt-5 border-t border-slate-200 pt-4">
            <legend className="pr-2 text-sm font-semibold text-slate-800">Authorized signatories</legend>
            <p className="mt-1 text-xs text-slate-500">Only selected active officers will be offered in the drafting workspace.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {state.officers.filter((officer) => officer.isActive).map((officer) => (
                <label key={officer.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 hover:border-amber-300 hover:bg-amber-50">
                  <input type="checkbox" checked={state.officeProfile.authorizedSignatoryIds.includes(officer.id)} onChange={() => toggleSignatory(officer.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-700" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{officer.name}</span><span className="mt-0.5 block text-xs text-slate-500">{officer.designation || 'Designation not set'}</span></span>
                </label>
              ))}
              {!state.officers.some((officer) => officer.isActive) && <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">Add an active officer above before choosing signatories.</p>}
            </div>
          </fieldset>
          <div className="mt-4 flex justify-end"><button type="button" onClick={saveOfficeProfile} disabled={state.busy === 'profile-save'} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:bg-slate-400">{state.busy === 'profile-save' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{state.busy === 'profile-save' ? 'Saving...' : 'Save drafting profile'}</button></div>
        </section>

        <section className="surface rounded-md border-t-4 border-t-cyan-600 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><Bot className="h-5 w-5 text-cyan-700" /><h2 className="text-sm font-semibold text-slate-950">AI drafting</h2></div>
              <p className="mt-1 text-sm text-slate-600">Choose whether drafting runs on this computer or through an approved workspace provider.</p>
            </div>
            {state.aiPreferences.mode === 'local' && <AIStatus status={state.aiStatus} />}
          </div>
          <div className="mt-4 inline-flex rounded-md border border-slate-300 bg-white p-1" aria-label="AI processing location">
            <button type="button" onClick={() => setState((current) => ({ ...current, aiPreferences: { ...current.aiPreferences, mode: 'local' } }))} className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-semibold ${state.aiPreferences.mode === 'local' ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Bot className="h-4 w-4" />Local LLM</button>
            <button type="button" disabled={!auth.workspace} onClick={() => setState((current) => ({ ...current, aiPreferences: { ...current.aiPreferences, mode: 'cloud' } }))} className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${state.aiPreferences.mode === 'cloud' ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Cloud className="h-4 w-4" />Cloud API</button>
          </div>

          {state.aiPreferences.mode === 'local' ? <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Server connection</span><input value={state.aiSettings.baseUrl} onChange={(event) => setState((current) => ({ ...current, aiStatus: 'idle', aiMessage: '', aiSettings: { ...current.aiSettings, baseUrl: event.target.value } }))} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Model</span><select value={state.aiSettings.model} onChange={(event) => setState((current) => ({ ...current, aiSettings: { ...current.aiSettings, model: event.target.value } }))} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value={state.aiSettings.model}>{state.aiModels.find((model) => model.id === state.aiSettings.model)?.name || state.aiSettings.model}</option>{state.aiModels.filter((model) => model.id !== state.aiSettings.model).map((model) => <option key={model.id} value={model.id}>{model.name}{model.params ? ` (${model.params})` : ''}{model.loaded ? ' - loaded' : ''}</option>)}</select></label>
            </div>
            {state.aiMessage && <p className={`mt-3 text-sm ${state.aiStatus === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.aiMessage}</p>}
            {typeof window !== 'undefined' && window.location.hostname.endsWith('github.io') && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">On the hosted app, start LM Studio locally with <code className="font-mono font-semibold">lms server start --cors</code>, load a model, then test this connection. Your browser may ask for permission to access localhost.</p>}
          </> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {['gemini', 'openai'].map((providerId) => {
              const provider = state.cloudProviders.find((item) => item.provider === providerId);
              const selected = state.aiPreferences.cloudProvider === providerId;
              return <button key={providerId} type="button" disabled={!provider?.enabled || !provider?.keyConfigured} onClick={() => setState((current) => ({ ...current, aiPreferences: { ...current.aiPreferences, cloudProvider: providerId } }))} className={`flex min-h-20 items-center justify-between gap-3 rounded-md border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-55 ${selected ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white'}`}><span><span className="block text-sm font-semibold text-slate-900">{providerId === 'gemini' ? 'Gemini' : 'OpenAI'}</span><span className="mt-1 block text-xs text-slate-500">{provider?.model || 'Not configured by an administrator'}</span></span><span className={`text-xs font-semibold ${provider?.enabled && provider?.keyConfigured ? 'text-emerald-700' : 'text-slate-500'}`}>{provider?.enabled && provider?.keyConfigured ? 'Available' : 'Unavailable'}</span></button>;
            })}
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Cloud providers are controlled by the workspace administrator. The provider API key remains on the server and is never sent to this browser.</p>
          </div>}
          <div className="mt-4 flex flex-wrap gap-2">
            {state.aiPreferences.mode === 'local' && <button type="button" onClick={testLocalAI} disabled={state.busy === 'ai-test'} className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-900 hover:bg-cyan-100 disabled:opacity-60">{state.busy === 'ai-test' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{state.busy === 'ai-test' ? 'Testing...' : 'Test connection'}</button>}
            <button type="button" onClick={saveAISettings} disabled={state.busy === 'ai-save'} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400">{state.busy === 'ai-save' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{state.busy === 'ai-save' ? 'Saving...' : 'Save AI preference'}</button>
          </div>
        </section>

        <section className="surface rounded-md border-t-4 border-t-rose-600 p-4 lg:col-span-2">
          <div className="flex items-start gap-2">
            <BellRing className="mt-0.5 h-5 w-5 text-rose-700" aria-hidden="true" />
            <div><h2 className="text-sm font-semibold text-slate-950">Reminders and digests</h2><p className="mt-1 text-sm text-slate-600">Choose how this account is notified about scheduled returns and deadlines.</p></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ReminderToggle label="In-app notifications" description="Show reminders in the notification inbox." checked={state.reminderSettings.inAppEnabled} onChange={(value) => setState((current) => ({ ...current, reminderSettings: { ...current.reminderSettings, inAppEnabled: value } }))} />
            <ReminderToggle label="Email notifications" description="Send reminders to the signed-in email when server email delivery is configured." checked={state.reminderSettings.emailEnabled} onChange={(value) => setState((current) => ({ ...current, reminderSettings: { ...current.reminderSettings, emailEnabled: value } }))} />
          </div>
          <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Upcoming deadline window</span><div className="flex items-center gap-2"><input type="number" min="1" max="30" value={state.reminderSettings.upcomingDays} onChange={(event) => setState((current) => ({ ...current, reminderSettings: { ...current.reminderSettings, upcomingDays: event.target.value } }))} className="h-10 w-24 rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-900" /><span className="text-sm text-slate-500">days</span></div></label>
            <fieldset><legend className="mb-1 text-sm font-medium text-slate-700">Workload digest</legend><div className="inline-flex rounded-md border border-slate-300 bg-white p-1">{[['none', 'None'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([value, label]) => <button key={value} type="button" onClick={() => setState((current) => ({ ...current, reminderSettings: { ...current.reminderSettings, digestFrequency: value } }))} className={`h-8 rounded px-3 text-xs font-semibold ${state.reminderSettings.digestFrequency === value ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div></fieldset>
          </div>
          <div className="mt-4 flex justify-end"><button type="button" onClick={saveReminders} disabled={state.busy === 'reminders-save'} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-400">{state.busy === 'reminders-save' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{state.busy === 'reminders-save' ? 'Saving...' : 'Save reminders'}</button></div>
        </section>

        <DisclosureSection title="Data and backup" description="Storage, backup, restore and demo data." className="lg:col-span-2">
          <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-b border-slate-200 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Database information</h2>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Total Issues" value={state.stats.total} />
            <Info label="Unarchived Issues" value={state.stats.active} />
            <Info label="Archived Issues" value={state.stats.archived} />
            <Info label="Completed Issues" value={state.stats.completed} />
            <Info label="Demo Issues" value={state.stats.demo} />
            <Info label="Officers" value={state.officerStats.total} />
            <Info label="Active Officers" value={state.officerStats.active} />
            <Info label="Database name" value={DB_NAME} />
            <Info label="Schema version" value={DB_VERSION} />
            <Info label="Application" value={APP_NAME} />
          </dl>
        </section>

        <section className="border-b border-slate-200 pb-5">
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-950">Browser storage</h2>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Persistent storage" value={!storage?.supported ? 'Not supported' : storage.persisted ? 'Granted' : 'Not granted'} />
            <Info label="Estimated usage" value={formatBytes(storage?.usage)} />
            <Info label="Estimated quota" value={formatBytes(storage?.quota)} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestPersistence}
              disabled={!storage?.supported || storage.persisted || state.busy === 'persist'}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {storage?.persisted ? 'Persistence granted' : 'Request persistence'}
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Persistent storage reduces the chance of automatic browser eviction. It does not protect against deliberate clearing of site data, so external backups are required for recovery.
          </p>
        </section>

        <section className="border-b border-slate-200 pb-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Backup and restore</h2>
              <p className="mt-1 text-sm text-slate-600">Backups include all Issues, officers and related local data.</p>
            </div>
            <StatusPill warning={backup?.backupWarning} />
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Last successful backup" value={backup?.lastBackupText || 'No successful backup recorded'} />
            <Info label="Backup date" value={formatDateTime(backup?.lastBackupAt)} />
            <Info label="Local file save" value={state.fileSystemAccessSupported ? 'Supported' : 'Falls back to download'} />
          </dl>

          {backup?.backupWarning ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>No recent external backup is recorded. Create a JSON backup now and keep it outside the browser.</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportData}
              disabled={state.busy === 'export'}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download JSON backup
            </button>
            <button
              type="button"
              onClick={saveLocalFile}
              disabled={state.busy === 'save-file'}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save backup to local file
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={chooseImport} className="hidden" />
          </div>
          <p className="mt-3 text-sm text-slate-600">Importing a backup replaces all current Issues after confirmation.</p>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-950">Demo data</h2>
          <p className="mt-1 text-sm text-slate-600">Demo Issues are fictional and loaded only from this page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={loadDemo} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              Load demo Issues
            </button>
            <button type="button" onClick={() => setState((current) => ({ ...current, confirmClearDemo: true }))} className="inline-flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear demo data
            </button>
          </div>
        </section>
          </div>
        </DisclosureSection>
      </div>

      <ConfirmDialog
        open={Boolean(state.pendingImport)}
        title="Import backup?"
        message="This will replace the current local database with the selected backup file."
        confirmLabel="Import and replace"
        destructive
        onCancel={() => setState((current) => ({ ...current, pendingImport: null }))}
        onConfirm={confirmImport}
      />
      <ConfirmDialog
        open={state.confirmClearDemo}
        title="Clear demo data?"
        message="Only Issues marked as demo data will be permanently removed."
        confirmLabel="Clear demo data"
        destructive
        onCancel={() => setState((current) => ({ ...current, confirmClearDemo: false }))}
        onConfirm={clearDemo}
      />
    </>
  );
}

function StatusPill({ warning }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        warning ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
      }`}
    >
      {warning ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {warning ? 'Backup needed' : 'Backup current'}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ProfileInput({ label, value, onChange }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><input value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" /></label>;
}

function ReminderToggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <div><div className="text-sm font-semibold text-slate-900">{label}</div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-teal-700' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button>
    </div>
  );
}

function AIStatus({ status }) {
  const label = status === 'connected' ? 'Connected' : status === 'testing' ? 'Testing' : status === 'error' ? 'Unavailable' : 'Not tested';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'connected' ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : status === 'error' ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-slate-100 text-slate-600'}`}>{label}</span>;
}
