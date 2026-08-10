import { useEffect, useState } from 'react';
import { BellRing, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { decodeApplicationServerKey, registerPushSubscription, unregisterPushSubscription } from '../../features/notifications/pushNotificationApi';

const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() || '';

function capability() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!publicKey) return 'not-configured';
  return 'available';
}

export default function PushNotificationSetting() {
  const auth = useAuth();
  const [state, setState] = useState({ status: 'loading', enabled: false, message: '' });
  const workspaceId = auth.workspace?.id || '';
  const available = auth.mode === 'cloud' && workspaceId && capability() === 'available';

  useEffect(() => {
    let active = true;
    if (!available) {
      const reason = auth.mode !== 'cloud'
        ? 'Push notifications require a signed-in cloud account.'
        : capability() === 'not-configured'
          ? 'Push delivery has not yet been configured by the administrator.'
          : 'This browser does not support Web Push.';
      setState({ status: 'idle', enabled: false, message: reason });
      return undefined;
    }
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (subscription) await registerPushSubscription(workspaceId, subscription);
        if (active) setState({ status: 'idle', enabled: Boolean(subscription), message: subscription ? 'Enabled on this device.' : 'Off on this device.' });
      })
      .catch((error) => {
        if (active) setState({ status: 'idle', enabled: false, message: error.message || 'Unable to check push notifications.' });
      });
    return () => { active = false; };
  }, [auth.mode, available, workspaceId]);

  const toggle = async () => {
    if (!available || state.status === 'saving') return;
    setState((current) => ({ ...current, status: 'saving', message: '' }));
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (state.enabled) {
        if (subscription) {
          await unregisterPushSubscription(workspaceId, subscription.endpoint);
          await subscription.unsubscribe();
        }
        setState({ status: 'idle', enabled: false, message: 'Push notifications are off on this device.' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted. You can change it in the browser site settings.');
      if (subscription) await subscription.unsubscribe();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(publicKey),
      });
      await registerPushSubscription(workspaceId, subscription);
      setState({ status: 'idle', enabled: true, message: 'Enabled. This device will receive approaching and overdue deadline alerts.' });
    } catch (error) {
      setState((current) => ({ ...current, status: 'idle', message: error.message || 'Unable to update push notifications.' }));
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:col-span-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
        <div><div className="text-sm font-semibold text-slate-900">Push notifications on this device</div><p className="mt-1 text-xs leading-5 text-slate-600">Receive alerts when an accessible Issue is approaching its deadline, due today or overdue. Alerts may appear on this device's lock screen. {state.message}</p></div>
      </div>
      <button type="button" role="switch" aria-checked={state.enabled} aria-label="Push notifications on this device" disabled={!available || state.status === 'saving'} onClick={toggle} className={`relative mt-0.5 h-7 w-12 shrink-0 overflow-hidden rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${state.enabled ? 'bg-teal-700' : 'bg-slate-300'}`}>
        {state.status === 'saving' ? <LoaderCircle className="absolute left-3.5 top-1.5 h-4 w-4 animate-spin text-white" /> : <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${state.enabled ? 'translate-x-5' : 'translate-x-0'}`} />}
      </button>
    </div>
  );
}
