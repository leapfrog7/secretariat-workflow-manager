import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardCheck, ClipboardList, FilePlus2, Settings, UserRoundCog } from 'lucide-react';
import { APP_NAME } from '../../constants/issueConstants';
import { useAuth } from '../../features/auth/AuthContext';

const navItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Create Issue', to: '/issues/new', icon: FilePlus2 },
  { label: 'How to use', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const permittedItems = auth.canEdit ? navItems : navItems.filter((item) => item.to !== '/issues/new');
  const visibleItems = auth.isAdmin ? [...permittedItems, { label: 'Administration', to: '/admin', icon: UserRoundCog }] : permittedItems;
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[#244750] bg-[#17333b] text-white md:block">
      <div className="border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-500 text-white shadow-sm">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-200">SWM</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-white">{APP_NAME}</div>
          </div>
        </div>
      </div>
      <nav className="space-y-1.5 p-3" aria-label="Main navigation">
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
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'border-teal-400/30 bg-teal-400/15 text-white' : 'border-transparent text-slate-300 hover:bg-white/7 hover:text-white'
                }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
