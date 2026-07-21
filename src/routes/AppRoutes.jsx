import { Navigate, createHashRouter, RouterProvider } from 'react-router-dom';
import AppShell from '../layouts/AppShell';
import IssueRegisterPage from '../pages/IssueRegisterPage';
import IssueFormPage from '../pages/IssueFormPage';
import IssueWorkspacePage from '../pages/IssueWorkspacePage';
import SettingsPage from '../pages/SettingsPage';
import HelpPage from '../pages/HelpPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/issues" replace /> },
      { path: 'issues', element: <IssueRegisterPage /> },
      { path: 'issues/new', element: <IssueFormPage mode="create" /> },
      { path: 'issues/:issueId', element: <IssueWorkspacePage /> },
      { path: 'issues/:issueId/edit', element: <IssueFormPage mode="edit" /> },
      { path: 'review', element: <Navigate to="/issues" replace /> },
      { path: 'tasks', element: <Navigate to="/issues" replace /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}
