import { useState } from 'react';
import { CloudOff, LoaderCircle, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import PublicLandingPage from '../../pages/PublicLandingPage';

export default function AccessGate({ children }) {
  const auth = useAuth();
  const [checking, setChecking] = useState('');

  const checkAgain = async (kind) => {
    if (checking) return;
    setChecking(kind);
    try {
      if (kind === 'profile') await auth.refreshProfile();
      else await auth.refreshWorkspaces();
    } finally {
      setChecking('');
    }
  };

  if (auth.mode === 'local') return children;
  if (auth.loading) return <AccessMessage icon={LoaderCircle} spin title="Checking access" description="Verifying your account and application access." />;
  if (!auth.user) return <PublicLandingPage />;
  if (auth.error) return <AccessMessage icon={CloudOff} title="Cloud access unavailable" description={auth.error} action={<SignOutButton />} />;
  if (auth.profile?.status === 'pending') {
    return <AccessMessage icon={ShieldAlert} title="Approval pending" description="Your account has been created. A System Administrator must approve it and assign your primary workspace before official work can open." action={<div className="flex flex-col justify-center gap-2 sm:flex-row"><button type="button" onClick={() => checkAgain('profile')} disabled={Boolean(checking)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">{checking === 'profile' && <LoaderCircle className="h-4 w-4 animate-spin" />}{checking === 'profile' ? 'Checking...' : 'Check again'}</button><SignOutButton /></div>} />;
  }
  if (auth.profile?.status === 'suspended') {
    return <AccessMessage icon={LockKeyhole} title="Access suspended" description="This account cannot currently access Secretariat Workflow Manager. Contact an administrator if this is unexpected." action={<SignOutButton />} />;
  }
  if (auth.profile?.status !== 'active') {
    return <AccessMessage icon={CloudOff} title="Access not configured" description="No active access profile is available for this account." action={<SignOutButton />} />;
  }
  if (!auth.workspace) {
    return <AccessMessage icon={ShieldAlert} title="Workspace access pending" description="Your account is active, but it has not yet been assigned to an official workspace. An administrator can add you from Administration." action={<div className="flex flex-col justify-center gap-2 sm:flex-row"><button type="button" onClick={() => checkAgain('workspace')} disabled={Boolean(checking)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">{checking === 'workspace' && <LoaderCircle className="h-4 w-4 animate-spin" />}{checking === 'workspace' ? 'Checking...' : 'Check again'}</button><SignOutButton /></div>} />;
  }

  return children;
}

function AccessMessage({ icon: Icon, spin = false, title, description, action }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef4f2] px-4 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-md border border-[#d7e3e0] bg-white p-7 text-center shadow-sm">
        <Icon className={`mx-auto h-8 w-8 text-teal-700 ${spin ? 'animate-spin' : ''}`} />
        <h1 className="mt-4 text-lg font-semibold text-[#17333b]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </section>
    </div>
  );
}

function SignOutButton() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await auth.signOut();
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" onClick={signOut} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? 'Signing out...' : 'Sign out'}</button>;
}
