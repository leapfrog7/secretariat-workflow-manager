import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  Files,
  GitBranch,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { APP_NAME } from '../constants/issueConstants';
import { useAuth } from '../features/auth/AuthContext';

const OUTCOMES = [
  { icon: Radar, title: 'Monitor what matters', text: 'See present positions, deadlines and recent movement without reconstructing the file every morning.' },
  { icon: UsersRound, title: 'Collaborate with control', text: 'Share matters through workspaces and divisions while retaining clear ownership and permission boundaries.' },
  { icon: GitBranch, title: 'Manage the full lifecycle', text: 'Keep references, communications, notes, drafts and decisions connected from receipt to closure.' },
];

const WORKFLOW = [
  ['01', 'Capture', 'Record the matter, ownership, deadline and current position.'],
  ['02', 'Examine', 'Bring source material together and prepare structured Notes.'],
  ['03', 'Act', 'Draft official communication and move the matter forward.'],
  ['04', 'Close', 'Retain the complete chronology, decision and issued record.'],
];

export default function PublicLandingPage() {
  const resetToken = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') || '';
  const [authDialog, setAuthDialog] = useState(resetToken ? 'reset-password' : '');
  const openAuth = (mode = 'sign-in') => setAuthDialog(mode);
  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="public-home min-h-screen overflow-hidden bg-[#f6f8f7] text-slate-950">
      <header className="relative z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:h-18 sm:px-6 lg:px-10">
          <button type="button" onClick={() => scrollToSection('home')} className="flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#17333b] text-white shadow-sm"><Layers3 className="h-4.5 w-4.5" /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-bold tracking-tight text-[#17333b] sm:text-base">SWM</span><span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:block">Secretariat workflow</span></span>
          </button>
          <nav aria-label="Homepage" className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <button type="button" onClick={() => scrollToSection('why-swm')} className="hover:text-teal-800">Why SWM</button>
            <button type="button" onClick={() => scrollToSection('workflow')} className="hover:text-teal-800">How it works</button>
            <button type="button" onClick={() => scrollToSection('trust')} className="hover:text-teal-800">Built for official work</button>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openAuth('sign-in')} className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:px-4">Sign in</button>
            <button type="button" onClick={() => openAuth('sign-up')} className="hidden min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#176b63] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#125b55] sm:inline-flex">Get started <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <section id="home" className="relative isolate">
        <div aria-hidden="true" className="public-home-glow public-home-glow-one" />
        <div aria-hidden="true" className="public-home-glow public-home-glow-two" />
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pb-18 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-sm"><Sparkles className="h-3.5 w-3.5 text-teal-600" />One workspace for the life of every matter</div>
            <h1 className="mt-6 text-balance text-[2.35rem] font-bold leading-[1.08] tracking-[-0.035em] text-[#15343c] sm:text-5xl lg:text-[3.8rem]">Move official work from receipt to resolution.</h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Secretariat Workflow Manager brings monitoring, collaboration, noting and drafting into one dependable lifecycle—so the current position is always clear and the record remains complete.</p>
            <div className="mt-8 grid gap-3 min-[420px]:flex min-[420px]:flex-wrap">
              <button type="button" onClick={() => openAuth('sign-in')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#176b63] px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgb(23_107_99_/_0.22)] hover:bg-[#125b55]">Open your workspace <ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => openAuth('sign-up')} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-300 hover:bg-teal-50">Create an account</button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Permission-aware</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Offline-capable</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-700" />Human-controlled AI</span>
            </div>
          </div>

          <LifecycleGraphic />
        </div>
      </section>

      <section id="why-swm" className="border-y border-slate-200/80 bg-white py-16 sm:py-22">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Clarity at every level</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-[#17333b] sm:text-3xl">Designed around the way matters actually move.</h2><p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">SWM keeps attention on the work—not on hunting through disconnected records or rebuilding context.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {OUTCOMES.map(({ icon: Icon, title, text }) => <article key={title} className="group rounded-2xl border border-slate-200 bg-[#fbfcfc] p-5 transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:bg-white hover:shadow-[0_18px_45px_rgb(15_49_56_/_0.08)] sm:p-6"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-800"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-base font-bold text-[#17333b]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="workflow" className="py-16 sm:py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">A continuous record</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-[#17333b] sm:text-3xl">One matter. One chronology. Four natural movements.</h2></div>
          <div className="relative mt-11 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-7 hidden border-t border-dashed border-teal-200 lg:block" />
            {WORKFLOW.map(([number, title, text]) => <article key={number} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#f6f8f7] bg-[#17333b] text-xs font-bold tracking-wider text-white shadow-sm">{number}</span><h3 className="mt-5 font-bold text-[#17333b]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="trust" className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-10">
        <div className="mx-auto grid max-w-[1280px] overflow-hidden rounded-3xl bg-[#17333b] text-white shadow-[0_24px_70px_rgb(15_49_56_/_0.18)] lg:grid-cols-[1fr_0.9fr]">
          <div className="p-6 sm:p-10 lg:p-12"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-teal-100"><ShieldCheck className="h-5 w-5" /></span><h2 className="mt-6 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Modern assistance, with official control retained.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Identity, workspace membership and Issue access remain authoritative. AI helps prepare wording, while attribution, structure, review and the final decision stay with the user.</p><button type="button" onClick={() => openAuth('sign-up')} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#17333b] hover:bg-teal-50">Request workspace access <ArrowRight className="h-4 w-4" /></button></div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-1">
            {[['Controlled access', 'Workspace, division and matter-level permissions.'], ['Review before record', 'AI output remains editable until a user saves it.'], ['Continuity by design', 'The full matter stays connected across notes, drafts and communications.']].map(([title, text], index) => <div key={title} className="flex items-start gap-3 bg-[#1c3c44] p-6 lg:px-8"><span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-200"><CheckCircle2 className="h-4 w-4" /></span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-300">{text}</p></div><span className="sr-only">Item {index + 1}</span></div>)}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10"><div className="flex items-center gap-2 font-semibold text-[#17333b]"><Layers3 className="h-4 w-4" />{APP_NAME}</div><p>Clear ownership. Complete context. Confident action.</p></div>
      </footer>

      <AuthDialog mode={authDialog} onModeChange={setAuthDialog} onClose={() => setAuthDialog('')} />
    </main>
  );
}

function LifecycleGraphic() {
  return (
    <div className="public-home-visual relative mx-auto w-full max-w-[680px]" aria-label="Illustration showing the lifecycle of an Issue">
      <div aria-hidden="true" className="absolute -inset-4 rounded-[2.25rem] bg-gradient-to-br from-teal-200/40 via-white/20 to-cyan-200/30 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/90 bg-white/94 p-3 shadow-[0_28px_80px_rgb(15_49_56_/_0.18)] backdrop-blur sm:p-4">
        <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Matter overview</span></div>
        <div className="grid gap-3 pt-3 sm:grid-cols-[1fr_0.78fr]">
          <div className="rounded-xl border border-slate-200 bg-[#fbfcfc] p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">Active matter</p><h3 className="mt-2 text-sm font-bold leading-5 text-[#17333b]">Inter-ministerial policy reference</h3><p className="mt-1 text-[11px] text-slate-500">eFile 14218 · Administration Division</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-800">IN PROGRESS</span></div>
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between text-[10px] font-semibold text-slate-500"><span>Present position</span><span>Today</span></div><p className="mt-2 text-xs leading-5 text-slate-700">Comments received. Note under examination for the proposed course.</p></div>
            <div className="mt-5 space-y-3">
              {[['Reference received', 'Completed', FileCheck2], ['Examination and Note', 'In progress', CircleGauge], ['Issue communication', 'Next', MessageSquareText]].map(([title, status, Icon], index) => <div key={title} className="relative flex items-center gap-3"><div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${index === 0 ? 'bg-emerald-100 text-emerald-700' : index === 1 ? 'public-home-pulse bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-700">{title}</p><p className="text-[10px] text-slate-500">{status}</p></div>{index < 2 ? <span aria-hidden="true" className="absolute left-[15px] top-8 h-3 border-l border-dashed border-slate-300" /> : null}</div>)}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="rounded-xl bg-[#17333b] p-4 text-white"><div className="flex items-center justify-between"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Clock3 className="h-4 w-4" /></span><span className="text-[9px] font-bold uppercase tracking-wider text-teal-200">Attention</span></div><p className="mt-5 text-2xl font-bold">3</p><p className="mt-1 text-[11px] text-slate-300">matters due this week</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><Files className="h-4 w-4 text-indigo-600" /><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Connected record</p></div><div className="mt-4 space-y-2">{[['Notes', '4'], ['Drafts', '2'], ['References', '7']].map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-2 text-[11px]"><span className="font-semibold text-slate-600">{label}</span><span className="font-bold text-[#17333b]">{count}</span></div>)}</div></div>
            <div className="public-home-float hidden items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 p-3 sm:flex"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm"><ShieldCheck className="h-4 w-4" /></span><div><p className="text-[11px] font-bold text-teal-950">Access checked</p><p className="text-[9px] text-teal-700">Editor through Administration</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthDialog({ mode, onModeChange, onClose }) {
  const auth = useAuth();
  const dialogRef = useRef(null);
  const resetToken = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') || '';
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ busy: false, error: '', success: '' });

  useEffect(() => {
    if (!mode) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    const handleDialogKeys = (event) => {
      if (event.key === 'Escape' && mode !== 'reset-password') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeys);
    window.setTimeout(() => dialogRef.current?.querySelector('input')?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleDialogKeys);
      previouslyFocused?.focus?.();
    };
  }, [mode, onClose]);

  if (!mode) return null;
  const accountMode = mode === 'sign-up' || mode === 'sign-in';
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const changeMode = (nextMode) => { onModeChange(nextMode); setShowPassword(false); setState({ busy: false, error: '', success: '' }); };

  async function submit(event) {
    event.preventDefault();
    if (mode === 'reset-password' && form.password !== form.confirmPassword) {
      setState({ busy: false, error: 'The passwords do not match.', success: '' });
      return;
    }
    setState({ busy: true, error: '', success: '' });
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
        onModeChange('sign-in');
        setState({ busy: false, error: '', success: 'Password updated. You can now sign in.' });
        return;
      }
      window.location.reload();
    } catch (error) {
      const message = /invalid account/i.test(error.message || '') && mode === 'sign-in'
        ? 'No account matches those details. Choose Create account if this is your first visit.'
        : error.message || 'Authentication failed.';
      setState({ busy: false, error: message, success: '' });
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
      <div aria-hidden="true" onClick={mode === 'reset-password' ? undefined : onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
        {mode !== 'reset-password' ? <button type="button" onClick={onClose} aria-label="Close account dialog" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button> : null}
        <div className="pr-9"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#17333b] text-white"><LockKeyhole className="h-4.5 w-4.5" /></span><h2 id="account-dialog-title" className="mt-4 text-xl font-bold tracking-tight text-[#17333b]">{mode === 'forgot-password' ? 'Reset your password' : mode === 'reset-password' ? 'Choose a new password' : 'Enter your SWM workspace'}</h2><p className="mt-1.5 text-sm leading-6 text-slate-600">{mode === 'forgot-password' ? 'We will send a secure reset link to your account email.' : mode === 'reset-password' ? 'Use at least eight characters for your new password.' : 'Sign in to an approved account or register for administrator review.'}</p></div>
        {accountMode ? <div className="mt-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Account action"><ModeTab active={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Sign in</ModeTab><ModeTab active={mode === 'sign-up'} onClick={() => changeMode('sign-up')}>Create account</ModeTab></div> : <button type="button" onClick={() => changeMode('sign-in')} className="mt-4 inline-flex min-h-10 items-center rounded-lg text-sm font-semibold text-teal-700 hover:text-teal-900">← Back to sign in</button>}
        <form onSubmit={submit} className="mt-5 grid min-w-0 gap-4">
          {mode === 'sign-up' ? <Field label="Name"><input required autoComplete="name" value={form.name} onChange={(event) => update('name', event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></Field> : null}
          {mode !== 'reset-password' ? <Field label="Email"><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></Field> : null}
          {mode !== 'forgot-password' ? <Field label={mode === 'reset-password' ? 'New password' : 'Password'}><PasswordInput value={form.password} onChange={(event) => update('password', event.target.value)} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></Field> : null}
          {mode === 'reset-password' ? <Field label="Confirm new password"><PasswordInput value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} autoComplete="new-password" label="confirmation password" /></Field> : null}
          {mode === 'sign-in' ? <button type="button" onClick={() => changeMode('forgot-password')} className="-mt-2 justify-self-start rounded text-sm font-semibold text-teal-700 underline-offset-4 hover:underline">Forgot password?</button> : null}
          {state.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{state.error}</p> : null}
          {state.success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{state.success}</p> : null}
          <button type="submit" disabled={state.busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#176b63] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#125b55] disabled:cursor-wait disabled:bg-slate-500">{state.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{state.busy ? 'Please wait…' : mode === 'sign-up' ? 'Register for approval' : mode === 'sign-in' ? 'Sign in' : mode === 'forgot-password' ? 'Send reset link' : 'Update password'}</button>
        </form>
        <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">Registration does not grant access automatically. An administrator must activate the account.</p>
      </section>
    </div>
  );
}

function PasswordInput({ value, onChange, visible, onToggle, autoComplete, label = 'password' }) {
  return <div className="relative"><input required minLength={8} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} className="h-11 w-full rounded-lg border border-slate-300 py-2 pl-3 pr-12 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /><button type="button" onClick={onToggle} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} aria-pressed={visible} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">{visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>;
}

function ModeTab({ active, children, onClick }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-10 rounded-md px-3 text-sm font-semibold ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{children}</button>;
}

function Field({ label, children }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
