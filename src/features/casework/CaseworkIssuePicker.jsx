import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { searchCloudCaseworkIssues, recordCaseworkOperationalEvent } from './caseworkApi';
import { searchLocalCaseworkIssues, shouldUseCloudCaseworkSearch } from './caseworkSearch';

const PAGE_SIZE = 20;

export default function CaseworkIssuePicker({ issues, selectedId = '', auth, onSelect }) {
  const listId = useId();
  const containerRef = useRef(null);
  const requestRef = useRef(0);
  const selectedIssue = useMemo(() => issues.find((issue) => issue.id === selectedId), [issues, selectedId]);
  const [query, setQuery] = useState(selectedIssue?.shortTitle || '');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [cloudSearchAvailable, setCloudSearchAvailable] = useState(true);
  const useCloudSearch = cloudSearchAvailable && shouldUseCloudCaseworkSearch({ mode: auth.mode, workspaceId: auth.workspace?.id, issueCount: issues.length });

  useEffect(() => {
    setQuery(selectedIssue?.shortTitle || '');
  }, [selectedIssue?.shortTitle]);

  useEffect(() => {
    setCloudSearchAvailable(true);
    setUsingLocalFallback(false);
  }, [auth.workspace?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !containerRef.current?.contains(event.target))) {
        setOpen(false);
        setQuery(selectedIssue?.shortTitle || '');
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open, selectedIssue?.shortTitle]);

  const search = async (searchQuery, offset = 0, append = false) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus('loading');
    let response;
    try {
      response = useCloudSearch
        ? await searchCloudCaseworkIssues({ workspaceId: auth.workspace.id, query: searchQuery, limit: PAGE_SIZE, offset })
        : searchLocalCaseworkIssues(issues, searchQuery, { limit: PAGE_SIZE, offset });
      if (requestId !== requestRef.current) return;
      if (useCloudSearch) setUsingLocalFallback(false);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      response = searchLocalCaseworkIssues(issues, searchQuery, { limit: PAGE_SIZE, offset });
      setUsingLocalFallback(true);
      setCloudSearchAvailable(false);
      recordCaseworkOperationalEvent({
        workspaceId: auth.workspace?.id,
        eventType: 'casework.search_failed',
        operation: 'issue_search',
        error,
      });
    }
    setResults((current) => append ? [...current, ...response.items] : response.items);
    setTotal(response.total);
    setStatus('idle');
  };

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => search(query, 0, false), 220);
    return () => window.clearTimeout(timer);
  }, [open, query, useCloudSearch]);

  const choose = (issue) => {
    setQuery(issue.shortTitle);
    setOpen(false);
    onSelect(issue.id);
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Choose a matter</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          value={query}
          placeholder="Search title, eFile no. or position"
          autoComplete="off"
          onFocus={(event) => {
            event.currentTarget.select();
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && results.length === 1) {
              event.preventDefault();
              choose(results[0]);
            }
          }}
          className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm font-medium text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:h-12"
        />
        {status === 'loading' ? <LoaderCircle className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin text-teal-700" aria-label="Searching Issues" /> : <ChevronDown className={`pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 transition-[transform,color] duration-150 ${open ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} aria-hidden="true" />}
      </div>

      {open && (
        <div id={listId} role="listbox" className="popover-enter absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-80 origin-top overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/10">
          {results.map((issue) => (
            <button key={issue.id} type="button" role="option" aria-selected={issue.id === selectedId} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(issue)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-teal-50">
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{issue.shortTitle}</span><span className="mt-0.5 block text-xs text-slate-500">{issue.status || 'Pending'}</span></span>
              {issue.id === selectedId && <Check className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />}
            </button>
          ))}
          {status !== 'loading' && !results.length && <p className="px-3 py-6 text-center text-sm text-slate-500">No matching Issues.</p>}
          {results.length < total && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => search(query, results.length, true)} disabled={status === 'loading'} className="mt-1 flex h-10 w-full items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">Load more results</button>}
          {usingLocalFallback && <p className="border-t border-slate-100 px-3 py-2 text-xs text-amber-700">Cloud search is unavailable. Showing the synchronized local copy.</p>}
        </div>
      )}
    </div>
  );
}
