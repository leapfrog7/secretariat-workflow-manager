import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Inbox, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../features/auth/AuthContext';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../features/notifications/cloudNotificationApi';

export default function NotificationCenter() {
  const auth = useAuth();
  const containerRef = useRef(null);
  const [state, setState] = useState({ open: false, loading: false, markingAll: false, error: '', items: [] });
  const workspaceId = auth.workspace?.id;
  const userId = auth.user?.id;

  const load = async () => {
    if (!workspaceId || !userId) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const items = await listNotifications(workspaceId, userId);
      setState((current) => ({ ...current, loading: false, items }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Unable to load notifications.' }));
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    window.addEventListener('swm:workspace-synced', load);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('swm:workspace-synced', load);
    };
  }, [workspaceId, userId]);

  useEffect(() => {
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setState((current) => ({ ...current, open: false }));
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  if (auth.mode !== 'cloud' || !workspaceId || !userId) return null;
  const unread = state.items.filter((item) => !item.read_at).length;

  const readOne = async (item) => {
    setState((current) => ({ ...current, open: false, items: current.items.map((entry) => entry.id === item.id ? { ...entry, read_at: entry.read_at || new Date().toISOString() } : entry) }));
    if (!item.read_at) await markNotificationRead(item.id).catch(() => load());
  };

  const readAll = async () => {
    if (state.markingAll) return;
    setState((current) => ({ ...current, markingAll: true, items: current.items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })) }));
    try {
      await markAllNotificationsRead(workspaceId, userId);
      setState((current) => ({ ...current, markingAll: false }));
    } catch {
      setState((current) => ({ ...current, markingAll: false }));
      load();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button type="button" title="Notifications" aria-label={`${unread} unread notifications`} aria-expanded={state.open} onClick={() => setState((current) => ({ ...current, open: !current.open }))} className="relative flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-900">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {state.open && (
        <div className="absolute right-0 top-10 z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3">
            <div><h2 className="text-sm font-semibold text-[#17333b]">Notifications</h2><p className="text-[11px] text-slate-500">Deadlines, returns and digests</p></div>
            {(unread > 0 || state.markingAll) && <button type="button" onClick={readAll} disabled={state.markingAll} title="Mark all as read" className="flex h-9 w-9 items-center justify-center rounded-md text-teal-700 hover:bg-teal-50 disabled:cursor-wait"><CheckCheck className={`h-4 w-4 ${state.markingAll ? 'animate-pulse' : ''}`} /></button>}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {state.loading && !state.items.length && <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading...</div>}
            {state.error && <div className="px-4 py-5 text-sm text-red-700">{state.error}</div>}
            {!state.loading && !state.error && !state.items.length && <div className="px-4 py-10 text-center"><Inbox className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">Nothing needs your attention</p></div>}
            {state.items.map((item) => {
              const content = <div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-slate-300' : 'bg-teal-600'}`} /><div className="min-w-0"><div className="text-sm font-semibold text-slate-900">{item.title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p><time className="mt-1.5 block text-[11px] text-slate-400">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</time></div></div>;
              return item.issue_id ? <Link key={item.id} to={`/issues/${item.issue_id}`} onClick={() => readOne(item)} className={`block border-b border-slate-100 px-3 py-3 hover:bg-slate-50 ${item.read_at ? 'bg-white' : 'bg-teal-50/60'}`}>{content}</Link> : <button key={item.id} type="button" onClick={() => readOne(item)} className={`block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${item.read_at ? 'bg-white' : 'bg-teal-50/60'}`}>{content}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
