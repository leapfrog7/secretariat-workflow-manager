import { Outlet } from 'react-router-dom';
import { APP_NAME } from '../constants/issueConstants';
import Sidebar from '../components/layout/Sidebar';
import MobileNavigation from '../components/layout/MobileNavigation';

export default function AppShell() {
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
                Issue tracking
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1240px] px-3 py-5 pb-20 sm:px-4 md:px-7 md:py-7 md:pb-10">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
