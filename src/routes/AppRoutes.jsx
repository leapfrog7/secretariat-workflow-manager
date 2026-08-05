import { lazy } from 'react';
import { Navigate, createHashRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../layouts/AppShell';
import AccessGate from '../components/auth/AccessGate';
import RequireAdmin from '../components/auth/RequireAdmin';
import RequireEditor from '../components/auth/RequireEditor';
import { getRouteImport } from './routePreload';
import RouteErrorPage from '../components/common/RouteErrorPage';

const IssueRegisterPage = lazy(getRouteImport('/issues'));
const IssueFormPage = lazy(getRouteImport('/issues/new'));
const IssueWorkspacePage = lazy(getRouteImport('/issues/example'));
const CaseworkPage = lazy(getRouteImport('/casework'));
const ReportsPage = lazy(getRouteImport('/reports'));
const SettingsPage = lazy(getRouteImport('/settings'));
const HelpPage = lazy(getRouteImport('/help'));
const NotFoundPage = lazy(getRouteImport('/not-found'));
const AdminPage = lazy(getRouteImport('/admin'));

const router = createHashRouter([
  {
    path: '/',
    element: <AccessGate><AppShell /></AccessGate>,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/issues" replace /> },
      { path: 'issues', element: <IssueRegisterPage /> },
      { path: 'issues/new', element: <RequireEditor><IssueFormPage mode="create" /></RequireEditor> },
      { path: 'issues/:issueId', element: <IssueWorkspacePage /> },
      { path: 'issues/:issueId/edit', element: <RequireEditor><IssueFormPage mode="edit" /></RequireEditor> },
      { path: 'casework', element: <CaseworkPage /> },
      { path: 'casework/:issueId', element: <CaseworkPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'review', element: <Navigate to="/issues" replace /> },
      { path: 'tasks', element: <Navigate to="/issues" replace /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'admin', element: <RequireAdmin><AdminPage /></RequireAdmin> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
