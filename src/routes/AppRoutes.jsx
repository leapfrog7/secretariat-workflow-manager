import { lazy } from 'react';
import { Navigate, createHashRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../layouts/AppShell';
import AccessGate from '../components/auth/AccessGate';
import RequireAdmin from '../components/auth/RequireAdmin';
import RequireEditor from '../components/auth/RequireEditor';

const IssueRegisterPage = lazy(() => import('../pages/IssueRegisterPage'));
const IssueFormPage = lazy(() => import('../pages/IssueFormPage'));
const IssueWorkspacePage = lazy(() => import('../pages/IssueWorkspacePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const HelpPage = lazy(() => import('../pages/HelpPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

const router = createHashRouter([
  {
    path: '/',
    element: <AccessGate><AppShell /></AccessGate>,
    children: [
      { index: true, element: <Navigate to="/issues" replace /> },
      { path: 'issues', element: <IssueRegisterPage /> },
      { path: 'issues/new', element: <RequireEditor><IssueFormPage mode="create" /></RequireEditor> },
      { path: 'issues/:issueId', element: <IssueWorkspacePage /> },
      { path: 'issues/:issueId/edit', element: <RequireEditor><IssueFormPage mode="edit" /></RequireEditor> },
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
