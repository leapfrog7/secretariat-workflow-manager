import { useState } from "react";
import {
  Check,
  History,
  PencilLine,
  Plus,
  X,
} from "lucide-react";
import { ISSUE_STATUSES } from "../../constants/issueConstants";
import { todayISO } from "../../utils/dateUtils";
import ModalFrame from "../common/ModalFrame";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import { Field, Input, Select, Textarea } from "../ui/FormControls";
import IconButton from "../ui/IconButton";

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
        aria-busy={saving || undefined}
        className={`w-full ${saved ? "save-surface-confirm" : ""}`}
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
          <IconButton
            label="Close quick position update"
            onClick={onClose}
            disabled={saving || saved}
            variant="ghost"
            size="iconSm"
          >
            <X className="h-4 w-4" />
          </IconButton>
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

          <Field label={mode === "add" ? "New position" : "Corrected position"} htmlFor="quick-position-note">
            <Textarea
              id="quick-position-note"
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
              className="min-h-28"
            />
            <span className="mt-1 block text-right text-xs tabular-nums text-slate-400">
              {note.length}/2000
            </span>
          </Field>

          {mode === "add" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stage after this update" htmlFor="quick-position-stage">
                <Select
                  id="quick-position-stage"
                  value={stage}
                  disabled={saving || saved}
                  onChange={(event) => setStage(event.target.value)}
                  className="h-11"
                >
                  {ISSUE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Update date" htmlFor="quick-position-date" required>
                <Input
                  id="quick-position-date"
                  type="date"
                  required
                  max={todayISO()}
                  value={recordedDate}
                  disabled={saving || saved}
                  onChange={(event) => setRecordedDate(event.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
          )}

          {mode === "correct" && (
            <Alert tone="warning">
              This corrects the latest displayed position and its existing
              milestone. Use Add update when a new development has occurred.
            </Alert>
          )}

          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" onClick={onClose} disabled={saving || saved} variant="secondary">Cancel</Button>
          <Button
            type="submit"
            aria-live="polite"
            disabled={saving || saved || !note.trim()}
            loading={saving}
            loadingLabel="Saving update..."
            variant={saved ? "success" : "primary"}
            className={`min-w-36 ${saved ? "action-confirm" : ""}`}
          >
            {saved && <Check className="h-4 w-4" />}
            {saved
                ? "Position saved"
                : mode === "add"
                  ? "Record update"
                  : "Save correction"}
          </Button>
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
