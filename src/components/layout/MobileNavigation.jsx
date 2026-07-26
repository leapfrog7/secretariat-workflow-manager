import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardList, FilePlus2, LoaderCircle, Settings, UserRoundCog } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigationFeedback } from '../common/NavigationFeedback';

const navItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Create Issue', to: '/issues/new', icon: FilePlus2 },
  { label: 'How to use', mobileLabel: 'Help', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function MobileNavigation() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const { pendingPath } = useNavigationFeedback();
  const permittedItems = auth.canEdit ? navItems : navItems.filter((item) => item.to !== '/issues/new');
  const visibleItems = auth.isAdmin || auth.isWorkspaceAdmin ? [...permittedItems, { label: 'Administration', mobileLabel: 'Admin', to: '/admin', icon: UserRoundCog }] : permittedItems;
  return (
    <nav className="app-mobile-navigation fixed inset-x-0 bottom-0 z-40 border-t border-[#d2dfdc] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(15_49_56_/_0.06)] backdrop-blur" aria-label="Mobile navigation">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
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
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isPending || undefined}
              className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1 text-xs font-medium transition-colors ${
                  isActive ? 'border-teal-600 bg-teal-50/70 text-teal-800' : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
              {isPending ? <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <Icon className={`h-[18px] w-[18px] transition-transform ${isActive ? 'scale-105' : ''}`} aria-hidden="true" />}
              <span className="max-w-full truncate">{isPending ? 'Opening' : item.mobileLabel || item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
