import { useState } from 'react';
import { CheckCircle2, CloudOff, LoaderCircle, LockKeyhole, ShieldAlert } from 'lucide-react';
import { APP_NAME } from '../../constants/issueConstants';
import { useAuth } from '../../features/auth/AuthContext';

export default function AccessGate({ children }) {
  const auth = useAuth();

  if (auth.mode === 'local') return children;
  if (auth.loading) return <AccessMessage icon={LoaderCircle} spin title="Checking access" description="Verifying your account and application access." />;
  if (!auth.user) return <AccountPage />;
  if (auth.error) return <AccessMessage icon={CloudOff} title="Cloud access unavailable" description={auth.error} action={<SignOutButton />} />;
  if (auth.profile?.status === 'pending') {
    return <AccessMessage icon={ShieldAlert} title="Approval pending" description="Your account has been created. An administrator must approve access before you can open official workspaces." action={<div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => auth.refreshProfile()} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Check again</button><SignOutButton /></div>} />;
  }
  if (auth.profile?.status === 'suspended') {
    return <AccessMessage icon={LockKeyhole} title="Access suspended" description="This account cannot currently access Secretariat Workflow Manager. Contact an administrator if this is unexpected." action={<SignOutButton />} />;
  }
  if (auth.profile?.status !== 'active') {
    return <AccessMessage icon={CloudOff} title="Access not configured" description="No active access profile is available for this account." action={<SignOutButton />} />;
  }
  if (!auth.workspace) {
    return <AccessMessage icon={ShieldAlert} title="Workspace access pending" description="Your account is active, but it has not yet been assigned to an official workspace. An administrator can add you from Administration." action={<div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => auth.refreshWorkspaces()} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Check again</button><SignOutButton /></div>} />;
  }

  return children;
}

function AccountPage() {
  const auth = useAuth();
  const [mode, setMode] = useState('sign-up');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [state, setState] = useState({ busy: false, error: '' });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const result = mode === 'sign-up'
        ? await auth.signUp(form)
        : await auth.signIn({ email: form.email, password: form.password });
      if (result?.error) throw new Error(result.error.message || 'Authentication failed.');
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
    setState({ busy: false, error: '' });
  }

  return (
    <div className="min-h-screen bg-[#eef4f2] px-4 py-10 text-slate-900">
      <div className="mx-auto min-w-0 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#17333b] text-white"><LockKeyhole className="h-6 w-6" /></div>
          <h1 className="mt-4 text-xl font-semibold text-[#17333b]">{APP_NAME}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to an approved account or register for administrator review.</p>
        </div>
        <section className="min-w-0 rounded-md border border-[#d7e3e0] bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1" role="tablist" aria-label="Account action">
            <ModeTab active={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Create account</ModeTab>
            <ModeTab active={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Sign in</ModeTab>
          </div>
          <form onSubmit={submit} className="mt-5 grid min-w-0 gap-4">
            {mode === 'sign-up' && <Field label="Name"><input required value={form.name} onChange={(event) => update('name', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>}
            <Field label="Email"><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
            <Field label="Password"><input required minLength={8} type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => update('password', event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></Field>
            {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
            <button type="submit" disabled={state.busy} className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white disabled:bg-slate-400">{state.busy ? 'Please wait...' : mode === 'sign-up' ? 'Register for approval' : 'Sign in'}</button>
          </form>
        </section>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">Registration does not grant access automatically. An administrator must activate the account.</p>
      </div>
    </div>
  );
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
  return <button type="button" onClick={() => auth.signOut()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button>;
}

function ModeTab({ active, children, onClick }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded px-3 py-2 text-sm font-semibold ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{children}</button>;
}

function Field({ label, children }) {
  return <label className="block min-w-0"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
