import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { APP_NAME } from '../constants/issueConstants';
import Sidebar from '../components/layout/Sidebar';
import MobileNavigation from '../components/layout/MobileNavigation';
import { Cloud, CloudOff, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import NotificationCenter from '../components/notifications/NotificationCenter';
import LoadingState from '../components/common/LoadingState';

export default function AppShell() {
  const auth = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f6f5] text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#dce6e4] bg-white/95 px-4 backdrop-blur md:px-7">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#17333b] md:hidden">{APP_NAME}</div>
              <div className="hidden items-center gap-2 text-sm font-medium text-slate-600 md:flex">
                <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
                <span className="max-w-56 truncate">{auth.workspace?.name || 'Issue tracking'}</span>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {auth.mode === 'local' ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Local mode</span>
              ) : (
                <>
                  <NotificationCenter />
                  <button type="button" title={auth.syncState?.status === 'error' ? auth.syncState.error : auth.syncState?.status === 'syncing' ? 'Synchronizing workspace' : 'Workspace synchronized'} aria-label="Synchronize workspace" onClick={() => auth.syncNow()} disabled={auth.syncState?.status === 'syncing'} className={`flex h-8 w-8 items-center justify-center rounded-md border bg-white ${auth.syncState?.status === 'error' ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-600 hover:text-slate-900'}`}>{auth.syncState?.status === 'error' ? <CloudOff className="h-4 w-4" /> : auth.syncState?.status === 'syncing' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}</button>
                  {auth.isAdmin && <span title="Platform administrator" className="hidden rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 sm:inline-flex sm:items-center sm:gap-1"><ShieldCheck className="h-3.5 w-3.5" />Admin</span>}
                  <span className="hidden max-w-44 truncate text-xs font-medium text-slate-600 sm:block">{auth.profile?.display_name || auth.user?.email}</span>
                  <button type="button" title={signingOut ? 'Signing out' : 'Sign out'} aria-label={signingOut ? 'Signing out' : 'Sign out'} onClick={signOut} disabled={signingOut} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60">{signingOut ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}</button>
                </>
              )}
            </div>
            {auth.syncState?.status === 'syncing' && <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-cyan-100" role="status" aria-label="Synchronizing workspace"><span className="sync-progress block h-full w-1/3 bg-cyan-600" /></div>}
          </header>
          <main className="mx-auto w-full max-w-[1240px] px-3 py-5 pb-20 sm:px-4 md:px-7 md:py-7 md:pb-10">
            <Suspense fallback={<LoadingState message="Opening page..." />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
