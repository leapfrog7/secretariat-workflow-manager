import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookMarked, BookOpenCheck, ClipboardCheck, ClipboardList, FilePenLine, FilePlus2, FileText, LoaderCircle, PanelLeftClose, PanelLeftOpen, Settings, UserRoundCog } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigationFeedback } from '../common/NavigationFeedback';

const workspaceItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Casework', to: '/casework', icon: FilePenLine },
  { label: 'References', to: '/references', icon: BookMarked },
];

const reportingItems = [{ label: 'Reports', to: '/reports', icon: FileText }];
const utilityItems = [
  { label: 'How to use', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

function isItemActive(pathname, to) {
  if (to === '/issues') return pathname === '/issues' || (pathname.startsWith('/issues/') && pathname !== '/issues/new');
  if (to === '/casework') return pathname.startsWith('/casework');
  return pathname === to;
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const { pendingPath } = useNavigationFeedback();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = window.localStorage.getItem('swm:sidebar-collapsed');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(max-width: 1100px) and (orientation: landscape)').matches;
  });
  const toggleSidebar = () => {
    setCollapsed((current) => {
      window.localStorage.setItem('swm:sidebar-collapsed', String(!current));
      return !current;
    });
  };
  return (
    <aside className={`app-sidebar sticky top-0 h-screen shrink-0 overflow-y-auto border-r border-[#294950] bg-[#17333b] text-white transition-[width] ${collapsed ? 'w-[68px]' : 'w-64'}`}>
      <div className={`py-5 ${collapsed ? 'px-3' : 'px-4'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <ClipboardCheck className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'hidden' : ''}`}>
            <div className="text-sm font-semibold tracking-wide text-white">SWM</div>
            <div className="mt-0.5 truncate text-xs text-slate-300">{auth.workspace?.name || 'Secretariat workspace'}</div>
          </div>
        </div>
      </div>
      <nav className={`flex min-h-[calc(100vh-76px)] flex-col pb-3 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="Main navigation">
        {auth.canEdit && (
          <div className="mb-5">
            <SidebarLink
              item={{ label: 'Create New', to: '/issues/new', icon: FilePlus2 }}
              collapsed={collapsed}
              active={pathname === '/issues/new'}
              pending={pendingPath === '/issues/new'}
              action
            />
          </div>
        )}
        <SidebarGroup label="Workspace" collapsed={collapsed}>
          {workspaceItems.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} active={isItemActive(pathname, item.to)} pending={pendingPath === item.to} />
          ))}
        </SidebarGroup>
        <SidebarGroup label="Reporting" collapsed={collapsed} className="mt-5">
          {reportingItems.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} active={isItemActive(pathname, item.to)} pending={pendingPath === item.to} />
          ))}
        </SidebarGroup>
        <div className="mt-auto pt-6">
          {utilityItems.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} active={isItemActive(pathname, item.to)} pending={pendingPath === item.to} />
          ))}
          {(auth.isAdmin || auth.isWorkspaceAdmin) && (
            <SidebarLink item={{ label: 'Administration', to: '/admin', icon: UserRoundCog }} collapsed={collapsed} active={pathname === '/admin'} pending={pendingPath === '/admin'} />
          )}
          <button type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={toggleSidebar} className={`mt-2 inline-flex min-h-10 items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 ${collapsed ? 'w-full justify-center' : 'w-full gap-3 px-3'}`}>
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <><PanelLeftClose className="h-[18px] w-[18px]" /><span className="text-xs font-medium">Collapse sidebar</span></>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

function SidebarGroup({ label, collapsed, className = '', children }) {
  return (
    <div className={className}>
      {!collapsed && <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SidebarLink({ item, collapsed, active, pending, action = false }) {
  const Icon = item.icon;

  const stateClass = action
    ? active
      ? 'border-teal-300 bg-teal-400/15 text-teal-100 hover:bg-white hover:text-gray-500'
      : 'border-white/15 bg-white/[0.06] text-white hover:border-teal-300/40 hover:bg-white hover:text-gray-500'
    : active
      ? 'bg-white/10 text-white'
      : 'text-slate-300 hover:bg-white/5 hover:text-white';

  return (
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      aria-busy={pending || undefined}
      className={`
        flex items-center rounded-lg text-sm transition-colors
        ${
          action
            ? 'min-h-[44px] border font-semibold'
            : 'min-h-[42px] font-medium'
        }
        ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}
        ${stateClass}
      `}
    >
      {pending ? (
        <LoaderCircle
          className="h-[18px] w-[18px] animate-spin"
          aria-hidden="true"
        />
      ) : (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            action ? 'text-teal-300' : ''
          }`}
          aria-hidden="true"
        />
      )}

      {!collapsed && (
        <span className="truncate">
          {pending ? `Opening ${item.label}` : item.label}
        </span>
      )}
    </Link>
  );
}
