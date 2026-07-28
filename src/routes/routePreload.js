const routeImports = {
  issues: () => import('../pages/IssueRegisterPage'),
  issueForm: () => import('../pages/IssueFormPage'),
  issueWorkspace: () => import('../pages/IssueWorkspacePage'),
  reports: () => import('../pages/ReportsPage'),
  settings: () => import('../pages/SettingsPage'),
  help: () => import('../pages/HelpPage'),
  admin: () => import('../pages/AdminPage'),
  notFound: () => import('../pages/NotFoundPage'),
};

export function getRouteImport(pathname) {
  if (pathname === '/issues') return routeImports.issues;
  if (pathname === '/issues/new' || pathname.endsWith('/edit'))
    return routeImports.issueForm;
  if (pathname.startsWith('/issues/')) return routeImports.issueWorkspace;
  if (pathname === '/reports') return routeImports.reports;
  if (pathname === '/settings') return routeImports.settings;
  if (pathname === '/help') return routeImports.help;
  if (pathname === '/admin') return routeImports.admin;
  return routeImports.notFound;
}

export function preloadRoute(pathname) {
  return getRouteImport(pathname)();
}
