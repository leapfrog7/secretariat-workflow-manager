import { useEffect, useState } from 'react';
import { HardDrive, LogOut, ShieldCheck, X } from 'lucide-react';
import ModalFrame from '../common/ModalFrame';
import Button from '../ui/Button';
import { useAuth } from '../../features/auth/AuthContext';

export default function SecureSignOutDialog({ open, onClose }) {
  const auth = useAuth();
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setBusyAction('');
      setError('');
    }
  }, [open]);

  const finishSignOut = async (clearLocalData) => {
    if (busyAction) return;
    setBusyAction(clearLocalData ? 'clear' : 'keep');
    setError('');
    try {
      await auth.signOut({ clearLocalData });
      onClose?.();
    } catch (signOutError) {
      setError(signOutError.message || 'Sign out could not be completed. Please try again.');
      setBusyAction('');
    }
  };

  return (
    <ModalFrame open={open} labelledBy="secure-sign-out-title" describedBy="secure-sign-out-description" busy={Boolean(busyAction)} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--swm-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 id="secure-sign-out-title" className="text-lg font-bold text-[var(--swm-ink)]">Sign out of SWM</h2>
          <p id="secure-sign-out-description" className="mt-1 text-sm leading-5 text-slate-600">Choose what should happen to this browser's offline workspace data.</p>
        </div>
        <Button variant="ghost" size="iconSm" aria-label="Close sign out options" onClick={onClose} disabled={Boolean(busyAction)}><X className="h-4 w-4" aria-hidden="true" /></Button>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        <SignOutChoice icon={HardDrive} title="Keep offline data" description="Best for your trusted device. Cached work remains available for the next sign-in.">
          <Button className="mt-3 w-full sm:w-auto" variant="secondary" loading={busyAction === 'keep'} loadingLabel="Signing out..." disabled={Boolean(busyAction)} onClick={() => finishSignOut(false)}><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</Button>
        </SignOutChoice>

        <SignOutChoice icon={ShieldCheck} title="Clear this device" description="Recommended on a shared device. Removes locally cached Issues, Notes, drafts and workspace settings after sign-out." danger>
          <Button className="mt-3 w-full sm:w-auto" variant="dangerSecondary" loading={busyAction === 'clear'} loadingLabel="Clearing device..." disabled={Boolean(busyAction)} onClick={() => finishSignOut(true)}><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Sign out and clear</Button>
        </SignOutChoice>

        {error ? <p role="alert" className="rounded-[var(--swm-radius-md)] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
      </div>
    </ModalFrame>
  );
}

function SignOutChoice({ icon: Icon, title, description, danger = false, children }) {
  return (
    <section className={`rounded-[var(--swm-radius-lg)] border p-4 ${danger ? 'border-red-200 bg-red-50/60' : 'border-[var(--swm-border)] bg-white'}`}>
      <div className="flex gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--swm-radius-md)] ${danger ? 'bg-white text-red-700' : 'bg-slate-100 text-slate-700'}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--swm-ink)]">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
