import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Cloud, Laptop, LoaderCircle } from 'lucide-react';
import { db } from '../../db/database';
import { SYNC_CONFLICT_EVENT } from '../../db/syncConflictRepository';
import { acceptCloudVersion, retryLocalVersion } from '../../features/cloud/syncConflictResolution';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../common/ToastProvider';
import { formatDateTime } from '../../utils/dateUtils';

function preview(payload) {
  if (!payload) return 'No content available.';
  const text = payload.shortTitle || payload.title || payload.summary || payload.note ||
    payload.description || payload.content || payload.subject || '';
  return text ? String(text).slice(0, 220) : 'Record details changed.';
}

function label(type) {
  return type === 'issue' ? 'Issue details' : type === 'summary' ? 'Running summary' :
    type.charAt(0).toUpperCase() + type.slice(1);
}

export default function SyncConflictCenter() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [conflicts, setConflicts] = useState([]);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    const items = await db.syncConflicts.toArray();
    setConflicts(items.sort((a, b) => new Date(b.detectedAt || 0) - new Date(a.detectedAt || 0)));
  };

  useEffect(() => {
    load();
    window.addEventListener(SYNC_CONFLICT_EVENT, load);
    return () => window.removeEventListener(SYNC_CONFLICT_EVENT, load);
  }, [auth.workspace?.id]);

  const resolve = async (conflict, choice) => {
    setBusyId(conflict.id);
    try {
      if (choice === 'cloud') await acceptCloudVersion(conflict);
      else {
        if (!auth.workspace?.id || !auth.user?.id) throw new Error('Cloud session is not available.');
        await retryLocalVersion(conflict, { workspaceId: auth.workspace.id, userId: auth.user.id });
      }
      showToast(choice === 'cloud' ? 'Cloud version kept.' : 'Your version saved as the latest version.');
      await load();
      await auth.syncNow?.();
    } catch (error) {
      showToast(error.message || 'Unable to resolve the change.', 'error');
    } finally {
      setBusyId('');
    }
  };

  if (auth.mode !== 'cloud' || !conflicts.length) return null;

  return (
    <section className="mb-5 overflow-hidden rounded-md border border-amber-300 bg-amber-50" aria-labelledby="sync-conflict-title">
      <div className="flex items-start gap-3 border-b border-amber-200 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 id="sync-conflict-title" className="text-sm font-semibold text-amber-950">Changes need review</h2>
          <p className="mt-0.5 text-xs leading-5 text-amber-900">Another device or user saved a materially different version while a local change was still pending. Nothing has been discarded.</p>
        </div>
      </div>
      <div className="divide-y divide-amber-200">
        {conflicts.map((conflict) => {
          const busy = busyId === conflict.id;
          return (
            <div key={conflict.id} className="bg-white/70 px-4 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">{label(conflict.entityType)}</div>
                <div className="text-xs text-slate-500">Detected {formatDateTime(conflict.detectedAt)}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Laptop className="h-4 w-4" />Your change</div>
                  <p className="text-sm leading-5 text-slate-800">{conflict.operation === 'delete' ? 'Delete this record.' : preview(conflict.localPayload)}</p>
                </div>
                <div className="rounded-md border border-cyan-200 bg-cyan-50/60 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-800"><Cloud className="h-4 w-4" />Latest cloud version</div>
                  <p className="text-sm leading-5 text-slate-800">{preview(conflict.cloudPayload)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={busy} onClick={() => resolve(conflict, 'cloud')} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><Cloud className="h-4 w-4" />Keep cloud version</button>
                <button type="button" disabled={busy} onClick={() => resolve(conflict, 'local')} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Use my change</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
