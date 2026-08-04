import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { APP_NAME } from '../constants/issueConstants';
import Sidebar from '../components/layout/Sidebar';
import MobileNavigation from '../components/layout/MobileNavigation';
import { ClipboardCheck, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import NotificationCenter from '../components/notifications/NotificationCenter';
import LoadingState from '../components/common/LoadingState';
import SyncConflictCenter from '../components/cloud/SyncConflictCenter';
import WelcomeBanner from '../components/common/WelcomeBanner';
import { NavigationFeedbackProvider } from '../components/common/NavigationFeedback';
import SyncStatusPanel from '../components/cloud/SyncStatusPanel';
import ConnectivityBanner from '../components/cloud/ConnectivityBanner';

export default function AppShell() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const firstRoute = useRef(true);
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

  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => document.getElementById('main-content')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <NavigationFeedbackProvider>
    <div className="min-h-screen bg-[#f2f6f5] text-slate-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[80] -translate-y-20 rounded-md bg-[#17333b] px-3 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">Skip to main content</a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <header className="app-header sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#d5e2df] bg-white/95 px-3 shadow-[0_1px_8px_rgb(15_49_56_/_0.04)] backdrop-blur sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#17333b] text-white shadow-sm">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-4 text-[#17333b]"><span className="app-brand-mobile">SWM</span><span className="app-brand-desktop">{APP_NAME}</span></div>
                <div className="mt-0.5 max-w-40 truncate text-xs leading-4 text-slate-500 sm:max-w-56">{auth.workspace?.name || 'Issue tracking workspace'}</div>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {auth.mode === 'local' ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Local mode</span>
              ) : (
                <>
                  <NotificationCenter />
                  <SyncStatusPanel />
                  {auth.isAdmin && <span title="System administrator" className="hidden rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 sm:inline-flex sm:items-center sm:gap-1"><ShieldCheck className="h-3.5 w-3.5" />System admin</span>}
                  <span className="hidden max-w-44 truncate text-xs font-medium text-slate-600 sm:block">{auth.profile?.display_name || auth.user?.email}</span>
                  <button type="button" title={signingOut ? 'Signing out' : 'Sign out'} aria-label={signingOut ? 'Signing out' : 'Sign out'} onClick={signOut} disabled={signingOut} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60">{signingOut ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}</button>
                </>
              )}
            </div>
            {auth.syncState?.status === 'syncing' && <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-cyan-100" role="status" aria-label="Synchronizing workspace"><span className="sync-progress block h-full w-1/3 bg-cyan-600" /></div>}
          </header>
          <ConnectivityBanner />
          <main id="main-content" tabIndex={-1} className="app-main mx-auto w-full max-w-[1600px] px-3 py-4 focus:outline-none sm:px-4 sm:py-5">
            {auth.mode === 'cloud' && auth.user?.id && auth.workspace?.id && <WelcomeBanner userId={auth.user.id} canEdit={auth.canEdit} />}
            <SyncConflictCenter />
            <Suspense fallback={<LoadingState message="Opening page..." />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <MobileNavigation />
    </div>
    </NavigationFeedbackProvider>
  );
}
