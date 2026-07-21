import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardList, FilePlus2, Settings } from 'lucide-react';

const navItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Create Issue', to: '/issues/new', icon: FilePlus2 },
  { label: 'How to use', mobileLabel: 'Help', to: '/help', icon: BookOpenCheck },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function MobileNavigation() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d2dfdc] bg-white/95 backdrop-blur md:hidden" aria-label="Mobile navigation">
      <div className="grid grid-cols-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/issues'
            ? pathname === '/issues' || (pathname.startsWith('/issues/') && pathname !== '/issues/new')
            : pathname === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`min-w-0 flex flex-col items-center gap-1 border-t-2 px-1 py-2 text-[11px] font-medium ${
                  isActive ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500'
                }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-full truncate">{item.mobileLabel || item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
