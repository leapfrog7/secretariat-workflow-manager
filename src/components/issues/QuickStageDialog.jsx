import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { ISSUE_STATUSES } from "../../constants/issueConstants";
import ModalFrame from "../common/ModalFrame";

export default function QuickStageDialog({
  issue,
  saveStatus = "idle",
  error = "",
  onClose,
  onSave,
}) {
  const [stage, setStage] = useState(issue.status);
  const saving = saveStatus === "saving";
  const saved = saveStatus === "saved";

  function submit(event) {
    event.preventDefault();
    if (stage === issue.status) return;
    onSave(stage);
  }

  return (
    <ModalFrame
      open
      labelledBy="quick-stage-title"
      busy={saving || saved}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form onSubmit={submit} className="w-full">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="quick-stage-title" className="text-base font-semibold text-slate-950">
              Update stage
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{issue.shortTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || saved}
            aria-label="Close stage update"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Stage
            </span>
            <select
              autoFocus
              value={stage}
              disabled={saving || saved}
              onChange={(event) => setStage(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
            >
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
            This changes only the stage. The present position remains unchanged.
          </p>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
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
            disabled={saving || saved || stage === issue.status}
            className={`inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${saved ? "bg-emerald-600" : "bg-teal-700 hover:bg-teal-800"}`}
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {saved ? <Check className="h-4 w-4" /> : null}
            {saving ? "Saving..." : saved ? "Stage saved" : "Update stage"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
