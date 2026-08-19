import { Bot, Check, CheckCheck, ChevronRight, History, LoaderCircle, MessageSquareText, RotateCcw, Send, Sparkles, UserRound, X } from 'lucide-react';

const QUICK_REFINEMENTS = ['Make the note more concise', 'Strengthen the reasoning', 'Clarify the proposed course'];

export default function NoteAIConversation({
  open, messages, instruction, candidate, candidates, comparison, busy, canUndo,
  previewInEditor, providerLabel, onInstructionChange, onSend, onApply, onRejectAll,
  onAcceptSuggestion, onRejectSuggestion, onSelectCandidate, onPreviewChange,
  onUndoApply, onReset, onToggle,
}) {
  if (!open) return <button type="button" onClick={onToggle} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-900 hover:bg-cyan-100"><MessageSquareText className="h-4 w-4" />Refine this note with AI</button>;
  const reviewComplete = Boolean(comparison && comparison.pending === 0);

  return (
    <section aria-labelledby="note-ai-conversation-title" className="overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-cyan-100 bg-cyan-50 px-3 py-3 sm:px-4">
        <div><h4 id="note-ai-conversation-title" className="flex items-center gap-2 text-sm font-semibold text-cyan-950"><Sparkles className="h-4 w-4" />Refine with AI</h4><p className="mt-0.5 text-[11px] leading-4 text-cyan-800">Ask for a change, then review suggestions directly in the editor.</p></div>
        <button type="button" onClick={onToggle} disabled={busy} aria-label="Close AI refinement" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-cyan-800 hover:bg-cyan-100 disabled:opacity-50 sm:h-9 sm:w-9"><X className="h-4 w-4" /></button>
      </header>

      <div className="p-3 sm:p-4">
        {candidate && comparison ? (
          <div className={`mb-3 rounded-lg border p-3 ${reviewComplete ? 'border-slate-200 bg-slate-50' : 'border-emerald-200 bg-emerald-50/60'}`} aria-live="polite">
            <div className="flex items-start gap-2.5"><span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${reviewComplete ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>{reviewComplete ? <CheckCheck className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-900">{reviewComplete ? 'Revision reviewed' : `${comparison.pending} suggestion${comparison.pending === 1 ? '' : 's'} waiting in the editor`}</p><p className="mt-1 text-[11px] leading-4 text-slate-600">Red wording is proposed for removal. Green wording is the AI replacement.</p></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <label className="col-span-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 sm:mr-auto sm:min-h-10 sm:w-auto"><input type="checkbox" checked={previewInEditor} onChange={(event) => onPreviewChange(event.target.checked)} disabled={busy} className="h-4 w-4 accent-cyan-700" />Show changes in editor</label>
              <button type="button" onClick={onRejectAll} disabled={busy || reviewComplete} className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:min-h-10">Reject all</button>
              <button type="button" onClick={onApply} disabled={busy || reviewComplete} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40 sm:min-h-10"><Check className="h-3.5 w-3.5" />Accept all</button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <label htmlFor="note-refinement-instruction" className="text-xs font-semibold text-slate-800">What should change next?</label>
          <textarea id="note-refinement-instruction" value={instruction} onChange={(event) => onInstructionChange(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!busy && instruction.trim()) onSend(); } }} disabled={busy} rows={3} maxLength={2000} placeholder="For example: strengthen the reasoning in paragraphs 3 and 4, but retain the conclusion" className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100" />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-1.5">{QUICK_REFINEMENTS.map((suggestion) => <button key={suggestion} type="button" onClick={() => onInstructionChange(suggestion)} disabled={busy} className="min-h-10 rounded-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-medium leading-4 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-900 disabled:opacity-50 sm:min-h-8 sm:px-2.5 sm:text-[10px]">{suggestion}</button>)}</div><button type="button" onClick={onSend} disabled={busy || !instruction.trim()} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-10 sm:w-auto">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{busy ? 'Refining…' : candidate ? 'Refine current note' : 'Refine note'}</button></div>
        </div>

        {busy ? <div className="mt-3 flex items-center gap-3 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-xs font-medium text-cyan-900" role="status" aria-live="polite"><LoaderCircle className="h-4 w-4 animate-spin" />AI is reviewing the current editor wording…</div> : null}
        {!candidate && !busy ? <p className="px-2 py-4 text-center text-xs leading-5 text-slate-500">Enter an instruction above. Suggestions will appear beside the relevant wording in the editor.</p> : null}

        {(messages.length || candidates.length) ? (
          <details className="mt-3 rounded-md border border-slate-200 bg-slate-50">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-slate-700"><span className="flex items-center gap-2"><History className="h-4 w-4" />Conversation and revisions</span><span className="font-normal text-slate-500">{candidates.length} revision{candidates.length === 1 ? '' : 's'}</span></summary>
            <div className="space-y-4 border-t border-slate-200 bg-white p-3">
              {candidates.length ? <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 sm:flex-row sm:items-center"><span>Revision</span><select value={candidate?.id || ''} onChange={(event) => onSelectCandidate(event.target.value)} disabled={busy} className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-normal text-slate-700"><option value="">Choose a revision</option>{candidates.map((version, index) => <option key={version.id} value={version.id}>Revision {index + 1} · {version.instruction.slice(0, 64)}</option>)}</select></label> : null}
              {messages.length ? <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Conversation</p><div className="max-h-56 space-y-2 overflow-y-auto">{messages.map((message) => <div key={message.id} className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>{message.role === 'assistant' ? <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-800"><Bot className="h-3.5 w-3.5" /></span> : null}<p className={`max-w-[88%] rounded-lg px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'bg-cyan-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{message.text}</p>{message.role === 'user' ? <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"><UserRound className="h-3.5 w-3.5" /></span> : null}</div>)}</div></div> : null}
              {candidate && comparison?.groups.length ? <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggestion status</p><div className="space-y-2">{comparison.groups.map((group, index) => <div key={group.id} className="rounded-md border border-slate-200 p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-800">Suggestion {index + 1}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${group.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : group.status === 'rejected' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{group.status}</span></div>{group.status === 'pending' ? <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => onRejectSuggestion(group.id)} className="min-h-10 rounded-md border border-slate-300 text-xs font-semibold text-slate-700">Reject</button><button type="button" onClick={() => onAcceptSuggestion(group.id)} className="min-h-10 rounded-md bg-emerald-700 text-xs font-semibold text-white">Accept</button></div> : null}</div>)}</div></div> : null}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-500">{providerLabel} · session only</span><div className="flex gap-1"><button type="button" onClick={onUndoApply} disabled={busy || !canUndo} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Original</button><button type="button" onClick={onReset} disabled={busy} className="min-h-9 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Start over</button></div></div>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
