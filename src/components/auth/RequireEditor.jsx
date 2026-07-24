import { Navigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

export default function RequireEditor({ children }) {
  const auth = useAuth();
  return auth.canEdit ? children : <Navigate to="/issues" replace />;
}
