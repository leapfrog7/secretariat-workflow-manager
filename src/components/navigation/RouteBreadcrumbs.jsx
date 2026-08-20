import { ArrowLeft, ChevronRight, House } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

function routeTrail(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'issues' && parts[1] === 'new') return [{ label: 'Home', to: '/home' }, { label: 'Issues', to: '/issues' }, { label: 'New Issue' }];
  if (parts[0] === 'issues' && parts[1]) {
    const matterPath = `/issues/${encodeURIComponent(parts[1])}`;
    return parts[2] === 'edit'
      ? [{ label: 'Home', to: '/home' }, { label: 'Issues', to: '/issues' }, { label: 'Matter', to: matterPath }, { label: 'Edit' }]
      : [{ label: 'Home', to: '/home' }, { label: 'Issues', to: '/issues' }, { label: 'Matter' }];
  }
  if (parts[0] === 'casework' && parts[1]) return [{ label: 'Home', to: '/home' }, { label: 'Casework', to: '/casework' }, { label: 'Matter' }];
  return [];
}

export default function RouteBreadcrumbs() {
  const { pathname } = useLocation();
  const trail = routeTrail(pathname);
  if (!trail.length) return null;
  const mobileParent = [...trail].reverse().find((item) => item.to);
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-xs text-slate-500 sm:mb-4">
      <Link to={mobileParent.to} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1 font-semibold text-slate-600 hover:text-teal-800 sm:hidden"><ArrowLeft className="h-3.5 w-3.5" />Back to {mobileParent.label}</Link>
      <ol className="hidden min-h-8 items-center gap-1 sm:flex">
        {trail.map((item, index) => <li key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
          {item.to ? <Link to={item.to} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium hover:bg-white hover:text-teal-800">{index === 0 && <House className="h-3.5 w-3.5" aria-hidden="true" />}{item.label}</Link> : <span aria-current="page" className="px-1.5 py-1 font-semibold text-slate-700">{item.label}</span>}
        </li>)}
      </ol>
    </nav>
  );
}

export { routeTrail };
