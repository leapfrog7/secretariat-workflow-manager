import { useEffect, useMemo, useState } from 'react';
import { ensureProfile, getProfile } from './accountApi';
import { AuthContext } from './AuthContext';
import { cloudClient } from './cloudClient';

export default function ConfiguredAuthProvider({ children }) {
  const session = cloudClient.auth.useSession();
  const user = session.data?.user || null;
  const userId = user?.id || '';
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const [profileState, setProfileState] = useState({ userId: '', profile: null, loading: false, error: '' });

  useEffect(() => {
    let active = true;

    if (!userId) {
      setProfileState({ userId: '', profile: null, loading: false, error: '' });
      return undefined;
    }

    const identity = { id: userId, email: userEmail, name: userName };
    setProfileState({ userId, profile: null, loading: true, error: '' });
    ensureProfile(identity)
      .then((profile) => {
        if (active) setProfileState({ userId, profile, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setProfileState({ userId, profile: null, loading: false, error: error.message || 'Unable to load account access.' });
      });

    return () => {
      active = false;
    };
  }, [userEmail, userId, userName]);

  async function refreshProfile() {
    if (!user) return null;
    const profile = await getProfile(user.id);
    setProfileState({ userId: user.id, profile, loading: false, error: '' });
    return profile;
  }

  const value = useMemo(() => ({
    mode: 'cloud',
    loading: Boolean(session.isPending || (user && (profileState.loading || profileState.userId !== user.id))),
    user,
    profile: profileState.userId === user?.id ? profileState.profile : null,
    isAdmin: profileState.profile?.role === 'platform_admin' && profileState.profile?.status === 'active',
    error: profileState.error,
    refreshProfile,
    signIn: (credentials) => cloudClient.auth.signIn.email(credentials),
    signUp: (details) => cloudClient.auth.signUp.email(details),
    signOut: () => cloudClient.auth.signOut(),
  }), [profileState, session.isPending, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
