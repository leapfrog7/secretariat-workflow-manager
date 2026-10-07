import { useEffect, useRef, useState } from 'react';
import { CloudOff, Wifi } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import Alert from '../ui/Alert';

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
      <Alert tone="warning" title="Working offline" icon={CloudOff} compact className="rounded-none border-x-0 border-t-0 px-3 sm:px-5">
        Changes remain on this device{auth.mode === 'cloud' ? ' and will synchronize when the network returns.' : '.'}
      </Alert>
    );
  }
  if (restored) {
    const syncing = auth.mode === 'cloud' && auth.syncState?.status === 'syncing';
    return (
      <Alert tone={syncing ? 'progress' : 'success'} title={syncing ? 'Connection restored' : 'Back online'} icon={syncing ? true : Wifi} compact className="rounded-none border-x-0 border-t-0 px-3 sm:px-5">
        {syncing ? 'Synchronizing workspace changes…' : 'Network connection restored.'}
      </Alert>
    );
  }
  return null;
}
