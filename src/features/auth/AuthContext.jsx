import { createContext, lazy, Suspense, useContext } from 'react';
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

  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#eef4f2] text-sm font-medium text-slate-600">Loading secure access...</div>}><ConfiguredAuthProvider>{children}</ConfiguredAuthProvider></Suspense>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
