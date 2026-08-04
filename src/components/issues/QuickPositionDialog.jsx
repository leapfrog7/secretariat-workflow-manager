import { useState } from "react";
import {
  Check,
  History,
  LoaderCircle,
  PencilLine,
  Plus,
  X,
} from "lucide-react";
import { ISSUE_STATUSES } from "../../constants/issueConstants";
import { todayISO } from "../../utils/dateUtils";
import ModalFrame from "../common/ModalFrame";

export default function QuickPositionDialog({
  issue,
  latestMilestone,
  historyLoading = false,
  saveStatus = "idle",
  error = "",
  onClose,
  onSave,
}) {
  const [mode, setMode] = useState("add");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState(issue.status);
  const [recordedDate, setRecordedDate] = useState(todayISO());
  const saving = saveStatus === "saving";
  const saved = saveStatus === "saved";
  const correctionAvailable = Boolean(latestMilestone);

  function changeMode(nextMode) {
    if (nextMode === "correct" && !correctionAvailable) return;
    setMode(nextMode);
    setNote(nextMode === "correct" ? issue.currentPosition || "" : "");
    setStage(issue.status);
    setRecordedDate(todayISO());
  }

  function submit(event) {
    event.preventDefault();
    onSave({
      mode,
      note: note.trim(),
      status: stage,
      recordedDate,
    });
  }

  return (
    <ModalFrame open labelledBy="quick-position-title" busy={saving || saved} onClose={onClose} maxWidth="max-w-xl">
      <form
        onSubmit={submit}
        className="w-full"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id="quick-position-title"
              className="text-base font-semibold text-slate-950"
            >
              Quick position update
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {issue.shortTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || saved}
            aria-label="Close quick position update"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          <div
            className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1"
            aria-label="Position update mode"
          >
            <ModeButton
              active={mode === "add"}
              disabled={saving || saved}
              icon={Plus}
              label="Add update"
              onClick={() => changeMode("add")}
            />
            <ModeButton
              active={mode === "correct"}
              disabled={
                saving || saved || historyLoading || !correctionAvailable
              }
              icon={PencilLine}
              label={historyLoading ? "Checking history..." : "Correct latest"}
              onClick={() => changeMode("correct")}
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <History className="h-3.5 w-3.5 text-teal-700" />
              Current recorded position
            </div>
            <p className="mt-1.5 text-sm leading-5 text-slate-800">
              {issue.currentPosition || "No position has been recorded yet."}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              {mode === "add" ? "New position" : "Corrected position"}
            </span>
            <textarea
              autoFocus
              required
              rows={4}
              maxLength={2000}
              value={note}
              disabled={saving || saved}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                mode === "add"
                  ? "Record the latest development in one or two clear lines."
                  : "Correct the wording of the latest recorded position."
              }
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
            />
            <span className="mt-1 block text-right text-[11px] tabular-nums text-slate-400">
              {note.length}/2000
            </span>
          </label>

          {mode === "add" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Stage after this update
                </span>
                <select
                  value={stage}
                  disabled={saving || saved}
                  onChange={(event) => setStage(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
                >
                  {ISSUE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Update date
                </span>
                <input
                  type="date"
                  required
                  max={todayISO()}
                  value={recordedDate}
                  disabled={saving || saved}
                  onChange={(event) => setRecordedDate(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
                />
              </label>
            </div>
          )}

          {mode === "correct" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950">
              This corrects the latest displayed position and its existing
              milestone. Use Add update when a new development has occurred.
            </p>
          )}

          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || saved}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || saved || !note.trim()}
            className={`inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors disabled:cursor-wait disabled:opacity-70 ${
              saved ? "bg-emerald-600" : "bg-teal-700 hover:bg-teal-800"
            }`}
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saved && <Check className="h-4 w-4" />}
            {saving
              ? "Saving update..."
              : saved
                ? "Position saved"
                : mode === "add"
                  ? "Record update"
                  : "Save correction"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ModeButton({ active, disabled, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded px-2 text-xs font-semibold transition-colors ${
        active
          ? "bg-white text-teal-800 shadow-sm ring-1 ring-slate-200"
          : "text-slate-500 hover:text-slate-800"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </button>
  );
}
