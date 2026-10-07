import { useState } from "react";
import { Check, X } from "lucide-react";
import { ISSUE_STATUSES } from "../../constants/issueConstants";
import ModalFrame from "../common/ModalFrame";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import { Field, Select } from "../ui/FormControls";
import IconButton from "../ui/IconButton";

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
      <form
        onSubmit={submit}
        aria-busy={saving || undefined}
        className={`w-full ${saved ? "save-surface-confirm" : ""}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="quick-stage-title" className="text-base font-semibold text-slate-950">
              Update stage
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">{issue.shortTitle}</p>
          </div>
          <IconButton
            label="Close stage update"
            onClick={onClose}
            disabled={saving || saved}
            variant="ghost"
            size="iconSm"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          <Field label="Stage" htmlFor="quick-stage-select">
            <Select
              id="quick-stage-select"
              autoFocus
              value={stage}
              disabled={saving || saved}
              onChange={(event) => setStage(event.target.value)}
              className="h-11"
            >
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
          </Field>

          <Alert tone="neutral">This changes only the stage. The present position remains unchanged.</Alert>

          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <Button type="button" onClick={onClose} disabled={saving || saved} variant="secondary">Cancel</Button>
          <Button
            type="submit"
            aria-live="polite"
            disabled={saving || saved || stage === issue.status}
            loading={saving}
            loadingLabel="Saving..."
            variant={saved ? "success" : "primary"}
            className={`min-w-32 ${saved ? "action-confirm" : ""}`}
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Stage saved" : "Update stage"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
