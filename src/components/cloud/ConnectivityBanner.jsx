import { useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';

export default function ConnectivityBanner() {
  const auth = useAuth();
  const mounted = useRef(false);
  const timeoutRef = useRef(null);
  const authRef = useRef(auth);
  authRef.current = auth;
  const [online, setOnline] = useState(() => navigator.onLine);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const wentOffline = () => {
      setOnline(false);
      setRestored(false);
    };
    const cameOnline = async () => {
      setOnline(true);
      setRestored(true);
      if (authRef.current.mode === 'cloud') {
        try {
          await authRef.current.syncNow?.();
        } catch {
          // The sync control exposes the actionable cloud error.
        }
      }
      if (mounted.current) timeoutRef.current = window.setTimeout(() => mounted.current && setRestored(false), 4000);
    };
    window.addEventListener('offline', wentOffline);
    window.addEventListener('online', cameOnline);
    return () => {
      mounted.current = false;
      window.clearTimeout(timeoutRef.current);
      window.removeEventListener('offline', wentOffline);
      window.removeEventListener('online', cameOnline);
    };
  }, []);

  if (!online) {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-amber-950" role="status" aria-live="polite">
        <div className="mx-auto flex max-w-[1600px] items-start gap-2 text-xs leading-5"><CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><span><strong>Working offline.</strong> Changes remain on this device{auth.mode === 'cloud' ? ' and the application will try to synchronize when the network returns.' : '.'}</span></div>
      </div>
    );
  }
  if (restored) {
    const syncing = auth.mode === 'cloud' && auth.syncState?.status === 'syncing';
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950" role="status" aria-live="polite">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 text-xs"><span className="relative flex h-4 w-4 items-center justify-center">{syncing ? <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" /> : <Wifi className="h-4 w-4 text-emerald-700" />}</span><span>{syncing ? 'Network restored. Synchronizing workspace changes...' : 'Network connection restored.'}</span></div>
      </div>
    );
  }
  return null;
}
