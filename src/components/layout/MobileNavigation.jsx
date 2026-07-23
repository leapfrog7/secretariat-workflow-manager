import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardList, FilePlus2, Settings, UserRoundCog } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';

const navItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Create Issue', to: '/issues/new', icon: FilePlus2 },
  { label: 'How to use', mobileLabel: 'Help', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function MobileNavigation() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const visibleItems = auth.isAdmin ? [...navItems, { label: 'Administration', mobileLabel: 'Admin', to: '/admin', icon: UserRoundCog }] : navItems;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d2dfdc] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(15_49_56_/_0.06)] backdrop-blur md:hidden" aria-label="Mobile navigation">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/issues'
            ? pathname === '/issues' || (pathname.startsWith('/issues/') && pathname !== '/issues/new')
            : pathname === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'border-teal-600 bg-teal-50/70 text-teal-800' : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-105' : ''}`} aria-hidden="true" />
              <span className="max-w-full truncate">{item.mobileLabel || item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
