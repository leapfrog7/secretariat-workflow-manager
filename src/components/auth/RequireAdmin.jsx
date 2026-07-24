import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

export default function RequireAdmin({ children }) {
  const auth = useAuth();
  return auth.isAdmin || auth.isWorkspaceAdmin ? children : <Navigate to="/issues" replace />;
}
