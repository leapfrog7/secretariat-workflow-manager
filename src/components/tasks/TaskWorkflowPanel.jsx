import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { REVIEW_STATUSES } from '../../constants/issueConstants';
import DisclosureSection from '../common/DisclosureSection';

export default function TaskWorkflowPanel({ action, officers, onAssign, onProgress, onSubmitTask, onReview }) {
  const [assign, setAssign] = useState({
    assignedOfficerId: action.assignedOfficerId || '',
    assignedByOfficerId: action.assignedByOfficerId || '',
    assignedOn: action.assignedOn?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    assignmentInstructions: action.assignmentInstructions || '',
    expectedOutput: action.expectedOutput || '',
    dueDate: action.dueDate || '',
    reason: '',
  });
  const [progress, setProgress] = useState({ progressPercent: action.progressPercent || 0, progressNote: '', updatedByOfficerId: action.assignedOfficerId || '', blocker: '', clarificationRequired: false });
  const [submission, setSubmission] = useState({ submissionNote: '', outputSummary: '', submittedByOfficerId: action.assignedOfficerId || '' });
  const [review, setReview] = useState({ reviewStatus: 'Accepted', reviewRemarks: '', reviewedByOfficerId: action.assignedByOfficerId || '', revisedDueDate: '' });

  return (
    <div className="space-y-3">
      <Panel title="Assignment">
        <OfficerSelect label="Assigned officer" value={assign.assignedOfficerId} officers={officers} onChange={(value) => setAssign({ ...assign, assignedOfficerId: value })} />
        <OfficerSelect label="Assigned by" value={assign.assignedByOfficerId} officers={officers} onChange={(value) => setAssign({ ...assign, assignedByOfficerId: value })} />
        <Input label="Assignment date" type="date" value={assign.assignedOn} onChange={(value) => setAssign({ ...assign, assignedOn: value })} />
        <Input label="Due date" type="date" value={assign.dueDate} onChange={(value) => setAssign({ ...assign, dueDate: value })} />
        <Textarea label="Instructions" value={assign.assignmentInstructions} onChange={(value) => setAssign({ ...assign, assignmentInstructions: value })} />
        <Textarea label="Expected output" value={assign.expectedOutput} onChange={(value) => setAssign({ ...assign, expectedOutput: value })} />
        <Input label="Reassignment reason" value={assign.reason} onChange={(value) => setAssign({ ...assign, reason: value })} />
        <Button onClick={() => onAssign(assign)}>Assign / Reassign</Button>
      </Panel>
      <DisclosureSection title="Progress update" description="Update percentage, notes or clarification status.">
        <OfficerSelect label="Updated by" value={progress.updatedByOfficerId} officers={officers} onChange={(value) => setProgress({ ...progress, updatedByOfficerId: value })} />
        <Input label="Progress percent" type="number" value={progress.progressPercent} onChange={(value) => setProgress({ ...progress, progressPercent: value })} />
        <Textarea label="Progress note" value={progress.progressNote} onChange={(value) => setProgress({ ...progress, progressNote: value })} />
        <Textarea label="Blocker / clarification" value={progress.blocker} onChange={(value) => setProgress({ ...progress, blocker: value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={progress.clarificationRequired} onChange={(event) => setProgress({ ...progress, clarificationRequired: event.target.checked })} /> Clarification required</label>
        <Button onClick={() => onProgress(progress)}>Update Progress</Button>
      </DisclosureSection>
      <DisclosureSection title="Submission" description="Mark work as submitted for review.">
        <OfficerSelect label="Submitted by" value={submission.submittedByOfficerId} officers={officers} onChange={(value) => setSubmission({ ...submission, submittedByOfficerId: value })} />
        <Textarea label="Submission note" value={submission.submissionNote} onChange={(value) => setSubmission({ ...submission, submissionNote: value })} />
        <Textarea label="Output summary" value={submission.outputSummary} onChange={(value) => setSubmission({ ...submission, outputSummary: value })} />
        <Button onClick={() => onSubmitTask(submission)}>Submit for Review</Button>
      </DisclosureSection>
      <DisclosureSection title="Review" description="Accept, return for revision or close the assigned Action.">
        <OfficerSelect label="Reviewed by" value={review.reviewedByOfficerId} officers={officers} onChange={(value) => setReview({ ...review, reviewedByOfficerId: value })} />
        <label className="block"><span className="mb-1 block text-sm font-medium">Review status</span><select value={review.reviewStatus} onChange={(event) => setReview({ ...review, reviewStatus: event.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm">{REVIEW_STATUSES.filter((status) => status !== 'Not Submitted' && status !== 'Submitted').map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <Input label="Revised due date" type="date" value={review.revisedDueDate} onChange={(value) => setReview({ ...review, revisedDueDate: value })} />
        <Textarea label="Review remarks" value={review.reviewRemarks} onChange={(value) => setReview({ ...review, reviewRemarks: value })} />
        <Button onClick={() => onReview(review)}>Save Review</Button>
      </DisclosureSection>
    </div>
  );
}

function Panel({ title, children }) {
  return <section className="rounded-md border border-slate-200 p-3"><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></section>;
}
function Button({ children, onClick }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" onClick={run} disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-blue-400 sm:w-auto">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? 'Working...' : children}</button>;
}
function OfficerSelect({ label, value, officers, onChange }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"><option value="">Select officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}{officer.isActive ? '' : ' (inactive)'}</option>)}</select></label>;
}
function Input({ label, value, onChange, type = 'text' }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>;
}
function Textarea({ label, value, onChange }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>;
}
