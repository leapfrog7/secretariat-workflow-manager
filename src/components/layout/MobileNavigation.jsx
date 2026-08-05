import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpenCheck, ClipboardList, Ellipsis, FilePenLine, FilePlus2, FileText, LoaderCircle, Settings, UserRoundCog } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useNavigationFeedback } from '../common/NavigationFeedback';

const primaryItems = [
  { label: 'Issues', to: '/issues', icon: ClipboardList },
  { label: 'Casework', to: '/casework', icon: FilePenLine },
  { label: 'Create Issue', mobileLabel: 'Create', to: '/issues/new', icon: FilePlus2 },
  { label: 'Reports', to: '/reports', icon: FileText },
];

export default function MobileNavigation() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const { pendingPath } = useNavigationFeedback();
  const containerRef = useRef(null);
  const firstMenuItemRef = useRef(null);
  const moreButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const permittedItems = auth.canEdit ? primaryItems : primaryItems.filter((item) => item.to !== '/issues/new');
  const secondaryItems = [
    { label: 'How to use', to: '/help', icon: BookOpenCheck },
    { label: 'Settings', to: '/settings', icon: Settings },
    ...(auth.isAdmin || auth.isWorkspaceAdmin ? [{ label: 'Administration', to: '/admin', icon: UserRoundCog }] : []),
  ];
  const moreActive = secondaryItems.some((item) => pathname === item.to);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    firstMenuItemRef.current?.focus();
    const close = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        moreButtonRef.current?.focus();
      } else if (event.type === 'pointerdown' && !containerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [menuOpen]);

  return (
    <nav ref={containerRef} className="app-mobile-navigation fixed inset-x-0 bottom-0 z-40 border-t border-[#d2dfdc] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(15_49_56_/_0.06)] backdrop-blur" aria-label="Mobile navigation">
      {menuOpen && (
        <div role="menu" aria-label="More navigation" className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] z-50 ml-auto max-w-xs overflow-hidden rounded-md border border-slate-200 bg-white p-1.5 shadow-xl">
          {secondaryItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.to;
            const isPending = pendingPath === item.to;
            return (
              <Link
                key={item.to}
                ref={index === 0 ? firstMenuItemRef : undefined}
                role="menuitem"
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                aria-busy={isPending || undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-teal-50 text-teal-900' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />}
                <span>{isPending ? `Opening ${item.label}` : item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${permittedItems.length + 1}, minmax(0, 1fr))` }}>
        {permittedItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === '/issues'
            ? pathname === '/issues' || (pathname.startsWith('/issues/') && pathname !== '/issues/new')
            : item.to === '/casework' ? pathname.startsWith('/casework') : pathname === item.to;
          const isPending = pendingPath === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              aria-busy={isPending || undefined}
              className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'border-teal-600 bg-teal-50/70 text-teal-800' : 'border-transparent text-slate-500 hover:bg-slate-50'
                }`}
            >
              {isPending ? <LoaderCircle className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <Icon className={`h-[18px] w-[18px] transition-transform ${isActive ? 'scale-105' : ''}`} aria-hidden="true" />}
              <span className="max-w-full truncate">{isPending ? 'Opening' : item.mobileLabel || item.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="More navigation"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((current) => !current)}
          className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1 text-[11px] font-medium transition-colors ${
            menuOpen || moreActive ? 'border-teal-600 bg-teal-50/70 text-teal-800' : 'border-transparent text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Ellipsis className={`h-[18px] w-[18px] transition-transform ${menuOpen || moreActive ? 'scale-105' : ''}`} aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
