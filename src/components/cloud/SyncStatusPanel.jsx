import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, RefreshCw, X } from 'lucide-react';
import { db } from '../../db/database';
import { SYNC_CONFLICT_EVENT } from '../../db/syncConflictRepository';
import { useAuth } from '../../features/auth/AuthContext';
import { formatDateTime } from '../../utils/dateUtils';

export const OPEN_SYNC_CONFLICTS_EVENT = 'swm:open-sync-conflicts';

export default function SyncStatusPanel() {
  const auth = useAuth();
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, conflicts: 0 });

  const refreshCounts = async () => {
    const [pending, conflicts] = await Promise.all([
      db.syncMutations.count(),
      db.syncConflicts.count(),
    ]);
    setCounts({ pending, conflicts });
  };

  useEffect(() => {
    if (open) refreshCounts();
  }, [open, auth.syncState?.status]);

  useEffect(() => {
    const refresh = () => refreshCounts();
    refresh();
    window.addEventListener('swm:workspace-synced', refresh);
    window.addEventListener(SYNC_CONFLICT_EVENT, refresh);
    return () => {
      window.removeEventListener('swm:workspace-synced', refresh);
      window.removeEventListener(SYNC_CONFLICT_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!panelRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const syncing = auth.syncState?.status === 'syncing';
  const failed = auth.syncState?.status === 'error';
  const statusLabel = failed
    ? 'Synchronization needs attention'
    : syncing
      ? 'Synchronizing workspace'
      : counts.pending
        ? `${counts.pending} change${counts.pending === 1 ? '' : 's'} waiting to sync`
        : 'Workspace is up to date';

  const syncNow = async () => {
    try {
      await auth.syncNow?.();
    } catch {
      // The provider exposes a user-facing error through syncState.
    } finally {
      await refreshCounts();
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        title="Cloud synchronization status"
        aria-label="Open cloud synchronization status"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md border bg-white transition-colors ${failed ? 'border-red-200 text-red-700' : counts.pending ? 'border-amber-300 text-amber-700' : 'border-slate-200 text-slate-600 hover:text-slate-900'}`}
      >
        {failed ? <CloudOff className="h-4 w-4" /> : syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
        {(counts.pending > 0 || counts.conflicts > 0) && <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${counts.conflicts ? 'bg-red-500' : 'bg-amber-500'}`} />}
      </button>

      {open && (
        <section ref={panelRef} aria-label="Cloud synchronization" className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-[min(calc(100vw-1.5rem),22rem)] sm:max-h-[calc(100dvh-4.5rem)]">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-[#17333b]">Cloud synchronization</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">{auth.workspace?.name}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close synchronization status" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </header>
          <div className="space-y-3 px-4 py-4">
            <div className={`flex items-start gap-3 rounded-md border px-3 py-3 ${failed ? 'border-red-200 bg-red-50' : counts.pending ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              {failed ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-red-700" /> : syncing ? <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan-700" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{statusLabel}</p>
                {failed && <p className="mt-1 break-words text-xs leading-5 text-red-800">{auth.syncState.error}</p>}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-200 px-3 py-2"><dt className="text-slate-500">Pending changes</dt><dd className="mt-1 text-base font-semibold tabular-nums text-slate-800">{counts.pending}</dd></div>
              <div className="rounded-md border border-slate-200 px-3 py-2"><dt className="text-slate-500">Conflicts</dt><dd className="mt-1 text-base font-semibold tabular-nums text-slate-800">{counts.conflicts}</dd></div>
            </dl>
            <p className="text-xs leading-5 text-slate-500">{auth.syncState?.syncedAt ? `Last synchronized ${formatDateTime(auth.syncState.syncedAt)}.` : 'A successful synchronization has not been recorded in this session.'}</p>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
            {counts.conflicts > 0 && <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event(OPEN_SYNC_CONFLICTS_EVENT)); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50"><AlertTriangle className="h-4 w-4" />Review conflicts</button>}
            <button type="button" disabled={syncing} onClick={syncNow} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-65"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Synchronizing...' : 'Sync now'}</button>
          </footer>
        </section>
      )}
    </div>
  );
}
