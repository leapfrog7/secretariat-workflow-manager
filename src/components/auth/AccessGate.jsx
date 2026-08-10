import { useState } from 'react';
import { CheckCircle2, CloudOff, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldAlert } from 'lucide-react';
import { APP_NAME } from '../../constants/issueConstants';
import { useAuth } from '../../features/auth/AuthContext';

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
  if (!auth.user) return <AccountPage />;
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

function AccountPage() {
  const auth = useAuth();
  const resetToken = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') || '';
  const [mode, setMode] = useState(resetToken ? 'reset-password' : 'sign-in');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    if (mode === 'reset-password' && form.password !== form.confirmPassword) {
      setState({ busy: false, error: 'The passwords do not match.' });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      let result;
      if (mode === 'sign-up') result = await auth.signUp({ name: form.name, email: form.email, password: form.password });
      else if (mode === 'sign-in') result = await auth.signIn({ email: form.email, password: form.password });
      else if (mode === 'forgot-password') {
        const redirectTo = new URL(window.location.href);
        redirectTo.search = 'auth_action=reset-password';
        redirectTo.hash = '';
        result = await auth.requestPasswordReset({ email: form.email, redirectTo: redirectTo.toString() });
      } else result = await auth.resetPassword({ newPassword: form.password, token: resetToken });
      if (result?.error) throw new Error(result.error.message || 'Authentication failed.');
      if (mode === 'forgot-password') {
        setState({ busy: false, error: '', success: 'If an account exists for this email, a password-reset link has been sent. Please also check your spam folder.' });
        return;
      }
      if (mode === 'reset-password') {
        window.history.replaceState({}, '', window.location.pathname);
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
        setMode('sign-in');
        setState({ busy: false, error: '', success: 'Password updated. You can now sign in.' });
        return;
      }
      window.location.reload();
    } catch (error) {
      const message = /invalid account/i.test(error.message || '') && mode === 'sign-in'
        ? 'No account matches those details. Choose Create account if this is your first visit.'
        : error.message || 'Authentication failed.';
      setState({ busy: false, error: message });
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setShowPassword(false);
    setState({ busy: false, error: '' });
  }

  const accountMode = mode === 'sign-up' || mode === 'sign-in';

  return (
    <main className="min-h-screen bg-[#eef4f2] px-4 py-10 text-slate-900">
      <div className="mx-auto min-w-0 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#17333b] text-white"><LockKeyhole className="h-6 w-6" /></div>
          <h1 className="mt-4 text-xl font-semibold text-[#17333b]">{APP_NAME}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to an approved account or register for administrator review.</p>
        </div>
        <section className="min-w-0 rounded-md border border-[#d7e3e0] bg-white p-5 shadow-sm">
          {accountMode ? <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1" role="tablist" aria-label="Account action">
            <ModeTab active={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Sign in</ModeTab>
            <ModeTab active={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Create account</ModeTab>
          </div> : <div>
            <button type="button" onClick={() => changeMode('sign-in')} className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 sm:min-h-10">Back to sign in</button>
            <h2 className="mt-2 text-lg font-semibold text-[#17333b]">{mode === 'forgot-password' ? 'Reset your password' : 'Choose a new password'}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{mode === 'forgot-password' ? 'Enter your account email and we will send you a secure reset link.' : 'Use at least eight characters for your new password.'}</p>
          </div>}
          <form onSubmit={submit} className="mt-5 grid min-w-0 gap-4">
            {mode === 'sign-up' && <Field label="Name"><input required value={form.name} onChange={(event) => update('name', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>}
            {mode !== 'reset-password' && <Field label="Email"><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="h-11 w-full rounded-md border border-slate-300 px-3 text-base sm:h-10 sm:text-sm" /></Field>}
            {mode !== 'forgot-password' && <Field label={mode === 'reset-password' ? 'New password' : 'Password'}><PasswordInput value={form.password} onChange={(event) => update('password', event.target.value)} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></Field>}
            {mode === 'reset-password' && <Field label="Confirm new password"><PasswordInput value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} autoComplete="new-password" label="confirmation password" /></Field>}
            {mode === 'sign-in' && <button type="button" onClick={() => changeMode('forgot-password')} className="-mt-2 justify-self-start rounded text-sm font-semibold text-teal-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Forgot password?</button>}
            {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{state.error}</p>}
            {state.success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{state.success}</p>}
            <button type="submit" disabled={state.busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-slate-500 sm:h-10">{state.busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{state.busy ? 'Please wait...' : mode === 'sign-up' ? 'Register for approval' : mode === 'sign-in' ? 'Sign in' : mode === 'forgot-password' ? 'Send reset link' : 'Update password'}</button>
          </form>
        </section>
        <p className="mt-4 text-center text-xs leading-5 text-slate-600">Registration does not grant access automatically. An administrator must activate the account.</p>
      </div>
    </main>
  );
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete, label = 'password' }) {
  return <div className="relative"><input required minLength={8} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} className="h-11 w-full rounded-md border border-slate-300 py-2 pl-3 pr-12 text-base sm:h-10 sm:text-sm" /><button type="button" onClick={onToggle} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">{visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}</button></div>;
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

function ModeTab({ active, children, onClick }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded px-3 py-2 text-sm font-semibold ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>{children}</button>;
}

function Field({ label, children }) {
  return <label className="block min-w-0"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
