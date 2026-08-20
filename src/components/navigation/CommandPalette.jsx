import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked, BookOpenCheck, ChevronRight, ClipboardList, FilePenLine, FilePlus2, FileText, House, LoaderCircle, Search, Settings, UserRoundCog, X } from 'lucide-react';
import ModalFrame from '../common/ModalFrame';
import { getAllIssues } from '../../db/issueRepository';
import { recordCaseworkOperationalEvent, searchCloudCaseworkIssues } from '../../features/casework/caseworkApi';
import { shouldUseCloudCaseworkSearch } from '../../features/casework/caseworkSearch';
import { filterIssueCommands, filterWorkspaceCommands, getWorkspaceCommands } from '../../features/navigation/commandModel';

const ICONS = { home: House, issues: ClipboardList, casework: FilePenLine, references: BookMarked, reports: FileText, settings: Settings, help: BookOpenCheck, create: FilePlus2, admin: UserRoundCog };

export default function CommandPalette({ open, onClose, auth }) {
  const navigate = useNavigate();
  const requestRef = useRef(0);
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState([]);
  const [issueResults, setIssueResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const commands = useMemo(() => getWorkspaceCommands(auth), [auth.canEdit, auth.isAdmin, auth.isWorkspaceAdmin]);
  const navigationResults = useMemo(() => filterWorkspaceCommands(commands, query), [commands, query]);
  const results = useMemo(() => [
    ...navigationResults.map((item) => ({ ...item, kind: item.action ? 'action' : 'navigation' })),
    ...issueResults.map((issue) => ({ id: `issue-${issue.id}`, label: issue.shortTitle, description: [issue.eFileNumber, issue.status || issue.currentPosition].filter(Boolean).join(' · ') || 'Open matter', to: `/issues/${issue.id}`, kind: 'issue' })),
  ], [navigationResults, issueResults]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setQuery('');
    setActiveIndex(0);
    setStatus('loading');
    getAllIssues({ includeArchived: false, includeScheduled: false })
      .then((items) => {
        if (cancelled) return;
        setIssues(items);
        setIssueResults(filterIssueCommands(items, '', { limit: 5 }));
      })
      .catch(() => {
        if (!cancelled) setIssueResults([]);
      })
      .finally(() => {
        if (!cancelled) setStatus('idle');
      });
    return () => { cancelled = true; };
  }, [open, auth.workspace?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const timer = window.setTimeout(async () => {
      const useCloud = query.trim() && shouldUseCloudCaseworkSearch({ mode: auth.mode, workspaceId: auth.workspace?.id, issueCount: issues.length });
      if (!useCloud) {
        setIssueResults(filterIssueCommands(issues, query, { limit: query.trim() ? 8 : 5 }));
        setStatus('idle');
        return;
      }
      setStatus('loading');
      try {
        const response = await searchCloudCaseworkIssues({ workspaceId: auth.workspace.id, query, limit: 8, offset: 0 });
        if (requestId === requestRef.current) setIssueResults(response.items);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        setIssueResults(filterIssueCommands(issues, query));
        recordCaseworkOperationalEvent({ workspaceId: auth.workspace?.id, eventType: 'casework.search_failed', operation: 'command_palette', error });
      } finally {
        if (requestId === requestRef.current) setStatus('idle');
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query, issues, auth.mode, auth.workspace?.id]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  const choose = (item) => {
    navigate(item.to);
    onClose();
  };

  return (
    <ModalFrame open={open} onClose={onClose} labelledBy="workspace-search-title" mobilePlacement="top" maxWidth="max-w-2xl" className="overflow-hidden">
      <div className="border-b border-slate-200 px-2.5 py-2.5 sm:px-4 sm:py-3">
        <h2 id="workspace-search-title" className="sr-only">Search and navigate workspace</h2>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg bg-slate-50 px-1 ring-1 ring-slate-200 transition-[background-color,box-shadow] focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-200">
            <Search className="ml-1.5 h-[18px] w-[18px] shrink-0 text-teal-700 sm:h-5 sm:w-5" aria-hidden="true" />
            <input
              data-autofocus
              role="combobox"
              aria-expanded="true"
              aria-controls="workspace-command-results"
              aria-activedescendant={results[activeIndex]?.id ? `command-${results[activeIndex].id}` : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((current) => Math.min(results.length - 1, current + 1)); }
                if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
                if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]); }
              }}
              placeholder="Search matters, eFiles, or areas…"
              className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none sm:h-11"
            />
            {status === 'loading' && <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-teal-700" aria-label="Searching" />}
            {query && status !== 'loading' ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close search" className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 hover:text-teal-900 sm:flex sm:h-9 sm:w-9 sm:items-center sm:justify-center sm:p-0 sm:text-slate-500"><span className="sm:hidden">Cancel</span><X className="hidden h-4 w-4 sm:block" /></button>
        </div>
      </div>
      <div id="workspace-command-results" role="listbox" className="max-h-[min(68dvh,34rem)] overscroll-contain overflow-y-auto p-1.5 sm:p-3">
        {!query.trim() && navigationResults.length > 0 && <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Quick access</p>}
        {navigationResults.map((item, index) => <CommandRow key={item.id} item={{ ...item, kind: item.action ? 'action' : 'navigation' }} index={index} active={index === activeIndex} onActivate={setActiveIndex} onChoose={choose} />)}
        {issueResults.length > 0 && <p className="px-2 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{query.trim() ? 'Matching matters' : 'Recent matters'}</p>}
        {issueResults.map((issue, issueIndex) => {
          const item = results[navigationResults.length + issueIndex];
          return <CommandRow key={issue.id} item={item} index={navigationResults.length + issueIndex} active={navigationResults.length + issueIndex === activeIndex} onActivate={setActiveIndex} onChoose={choose} />;
        })}
        {status !== 'loading' && !results.length && <div className="px-4 py-12 text-center"><Search className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No matching workspace items</p><p className="mt-1 text-xs text-slate-500">Try a title, eFile number, status, or workspace area.</p></div>}
      </div>
      <div className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-500 sm:flex"><span><kbd className="font-semibold">↑↓</kbd> move</span><span><kbd className="font-semibold">Enter</kbd> open</span><span><kbd className="font-semibold">Esc</kbd> close</span></div>
    </ModalFrame>
  );
}

function CommandRow({ item, index, active, onActivate, onChoose }) {
  const Icon = item.kind === 'issue' ? ClipboardList : ICONS[item.icon] || ChevronRight;
  return (
    <button id={`command-${item.id}`} type="button" role="option" aria-selected={active} onMouseEnter={() => onActivate(index)} onFocus={() => onActivate(index)} onClick={() => onChoose(item)} className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors sm:min-h-14 sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5 ${active ? 'bg-teal-50 text-teal-950' : 'text-slate-800 hover:bg-slate-50'}`} data-command-index={index}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${item.action ? 'bg-teal-700 text-white' : active ? 'bg-white text-teal-700 shadow-sm' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold sm:text-sm">{item.label}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500 sm:text-xs">{item.description}</span></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
    </button>
  );
}
