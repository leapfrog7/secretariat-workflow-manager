import { createContext, lazy, Suspense, useContext } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cloudConfigured } from './authConfig';

export const AuthContext = createContext(null);
const ConfiguredAuthProvider = lazy(() => import('./ConfiguredAuthProvider'));

export function AuthProvider({ children }) {
  if (!cloudConfigured) {
    return (
      <AuthContext.Provider value={{
        mode: 'local',
        loading: false,
        user: null,
        profile: null,
        workspace: null,
        workspaces: [],
        syncState: { status: 'local', error: '', syncedAt: '' },
        isAdmin: false,
        isWorkspaceAdmin: false,
        error: '',
        refreshWorkspaces: null,
        syncNow: null,
        signIn: null,
        signUp: null,
        signOut: null,
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center gap-3 bg-[#eef4f2] px-4 text-sm font-medium text-slate-700" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />Loading secure access...</div>}><ConfiguredAuthProvider>{children}</ConfiguredAuthProvider></Suspense>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
