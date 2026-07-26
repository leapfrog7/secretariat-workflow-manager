import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardCheck, ClipboardList, FilePlus2, LoaderCircle, PanelLeftClose, PanelLeftOpen, Settings, UserRoundCog } from 'lucide-react';
import { APP_NAME } from '../../constants/issueConstants';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigationFeedback } from '../common/NavigationFeedback';

const navItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Create Issue', to: '/issues/new', icon: FilePlus2 },
  { label: 'How to use', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const { pendingPath } = useNavigationFeedback();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = window.localStorage.getItem('swm:sidebar-collapsed');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(max-width: 1100px) and (orientation: landscape)').matches;
  });
  const permittedItems = auth.canEdit ? navItems : navItems.filter((item) => item.to !== '/issues/new');
  const visibleItems = auth.isAdmin || auth.isWorkspaceAdmin ? [...permittedItems, { label: 'Administration', to: '/admin', icon: UserRoundCog }] : permittedItems;
  const toggleSidebar = () => {
    setCollapsed((current) => {
      window.localStorage.setItem('swm:sidebar-collapsed', String(!current));
      return !current;
    });
  };
  return (
    <aside className={`app-sidebar shrink-0 border-r border-[#244750] bg-[#17333b] text-white transition-[width] ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`border-b border-white/10 py-5 ${collapsed ? 'px-3' : 'px-4'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-500 text-white shadow-sm">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'hidden' : ''}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-200">SWM</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-white">{APP_NAME}</div>
          </div>
        </div>
        <button type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={toggleSidebar} className={`mt-3 inline-flex h-9 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white ${collapsed ? 'w-9' : 'w-full gap-2 px-3'}`}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /><span className="text-xs font-semibold">Collapse sidebar</span></>}
        </button>
      </div>
      <nav className={`space-y-1.5 ${collapsed ? 'p-2' : 'p-3'}`} aria-label="Main navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/issues'
            ? pathname === '/issues' || (pathname.startsWith('/issues/') && pathname !== '/issues/new')
            : pathname === item.to;
          const isPending = pendingPath === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isPending || undefined}
              className={`flex items-center rounded-md border py-2.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                  isActive ? 'border-teal-400/30 bg-teal-400/15 text-white' : 'border-transparent text-slate-300 hover:bg-white/7 hover:text-white'
                }`}
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              {!collapsed && (isPending ? `Opening ${item.label}` : item.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
