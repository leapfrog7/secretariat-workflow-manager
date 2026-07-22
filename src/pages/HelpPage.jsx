import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cloud,
  Database,
  FilePlus2,
  FileText,
  HardDrive,
  History,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';

const sections = [
  ['Start here', 'start'],
  ['Account and workspace', 'access'],
  ['Create an Issue', 'create'],
  ['Issues register', 'issues'],
  ['Issue workspace', 'workspace'],
  ['Periodic work', 'periodic'],
  ['Reminders', 'reminders'],
  ['AI drafting', 'ai'],
  ['Local LLM', 'local-ai'],
  ['Administration', 'admin'],
  ['Data and sync', 'data'],
  ['Cloud AI', 'api'],
];

export default function HelpPage() {
  const scrollToTopic = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <PageHeader title="How to use" description="A practical guide to access, Issue management, official records, AI drafting and data safety." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="surface min-w-0 overflow-hidden rounded-md p-2 lg:sticky lg:top-20" aria-label="Topics on this page">
          <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</div>
          <div className="flex gap-1 overflow-x-auto lg:block">
            {sections.map(([label, id]) => (
              <button key={id} type="button" onClick={() => scrollToTopic(id)} className="block shrink-0 rounded px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-800 lg:w-full">
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-5" style={{ overflowWrap: 'anywhere' }}>
          <HelpSection id="start" icon={CheckCircle2} title="Start with the basic workflow" tone="teal">
            <p className="mb-4 text-sm leading-6 text-slate-600">The application is designed around a simple official-work cycle. Create the matter, keep its present position visible, preserve the record behind it and use that context when preparing a communication.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Step number="1" title="Create an Issue">Enter a clear title. Add the deadline, subject type, eFile number, stage or allocation only when they are useful.</Step>
              <Step number="2" title="Allocate and update">Assign the Issue to a saved officer and update its stage and current position as work progresses.</Step>
              <Step number="3" title="Preserve and use context">Record communications, eReceipts, references and summary updates. Use selected context to prepare a structured official draft.</Step>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/issues/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold !text-white hover:bg-teal-800"><FilePlus2 className="h-4 w-4" />Create Issue</Link>
              <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" />Open Settings</Link>
            </div>
          </HelpSection>

          <HelpSection id="access" icon={Users} title="Account and workspace access" tone="blue">
            <GuideLocation>Sign-in screen and the workspace name in the application header</GuideLocation>
            <GuideRows rows={[
              ['Create an account', 'Register with your email address and password. A new account remains in Approval pending until a platform administrator activates it.'],
              ['Workspace access', 'After account approval, the user must also belong to an official workspace. The workspace name in the header identifies the shared register currently in use.'],
              ['Check again', 'Use Check again on an approval or workspace-access screen after an administrator has changed your access. There is no need to create a second account.'],
              ['Across laptops', 'Sign in to the same account and workspace on another laptop to receive the complete Issue workspace, shared officer directory and saved drafting context.'],
              ['Sign out', 'Use the account control in the header when leaving a shared computer. Signing out does not delete locally cached work.'],
            ]} />
          </HelpSection>

          <HelpSection id="create" icon={FilePlus2} title="Creating an Issue" tone="emerald">
            <GuideLocation link="/issues/new" label="Open Create Issue">Main navigation &gt; Create Issue</GuideLocation>
            <GuideRows className="mt-4" rows={[
              ['Title', 'The only essential description. Use a short, recognizable subject so the Issue is easy to find later.'],
              ['Current stage', 'Defaults to Pending. Change it during creation only when the matter is already at another stage.'],
              ['Assigned to', 'Optionally allocate the Issue to an officer already saved in Settings. Leave it blank when ownership is not yet decided.'],
              ['Deadline and identifiers', 'Deadline, subject type, eFile number, category and priority are optional. Subject types include RTI, Parliamentary Matter, Audit, VIP Reference, Public Grievance, Court Case, Administrative, PMO and Cabinet Secretariat matters.'],
              ['After saving', 'The Issue opens in its workspace, where its position, communications, references and AI drafting context can be maintained.'],
            ]} />
          </HelpSection>

          <HelpSection id="issues" icon={ClipboardList} title="Using the Issues register" tone="cyan">
            <GuideLocation link="/issues" label="Open Issues">Main navigation &gt; Issues</GuideLocation>
            <GuideRows rows={[
              ['Dashboard indicators', 'Total, Pending, Overdue, In Progress and Awaiting Discussion show the current workload at a glance.'],
              ['Search', 'Searches Issue titles as well as recorded eReceipt and source-document details, including receipt number, subject and source.'],
              ['Current register', 'Shows active work, its current stage, assigned officer, age and deadline position.'],
              ['Register views', 'Use Current for active work, Scheduled for Issues waiting to return and Archived for retained inactive matters.'],
              ['Row actions', 'Use the archive icon to move an Issue out of the current register, the restore icon to bring it back and the delete icon only when the complete Issue record should be permanently removed.'],
              ['Deadline position', 'The table shows how many days have passed since creation and whether the matter is due on a future date or already overdue.'],
              ['Scheduled', 'Contains completed periodic Issues waiting for their next appearance date.'],
              ['Archive', 'Retains completed or inactive Issues outside the current register. Restore an archived Issue when fresh work or a new receipt arrives.'],
            ]} />
          </HelpSection>

          <HelpSection id="workspace" icon={FileText} title="Inside an Issue" tone="amber">
            <GuideLocation link="/issues" label="Choose an Issue">Issues &gt; select an Issue from the table</GuideLocation>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              <WorkspaceRow icon={History} title="Current Position">Update the stage (Pending, In Progress, Awaiting Input, Awaiting Discussion, Completed, Cancelled or Deferred), assignment and latest position. Every saved position becomes a dated milestone instead of replacing history. The latest five appear first; open the earlier history when needed. Maintain the running summary for a concise account of the matter.</WorkspaceRow>
              <WorkspaceRow icon={MessageSquareText} title="Record of Communication">Add incoming, outgoing and internal communications chronologically. Record the eReceipt number, source, subject, date, direction and useful details. The application stores the register entry, not the PDF.</WorkspaceRow>
              <WorkspaceRow icon={FileText} title="References">Capture rules, O.M.s, instructions, court directions or other authorities with their citation, date and relevant proposition.</WorkspaceRow>
              <WorkspaceRow icon={Bot} title="AI Context">Preview the material available for drafting and choose exactly which summary, communications and references may be supplied to the model. Search eReceipts where needed and review the assembled context before generation.</WorkspaceRow>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Use the running summary for the current understanding of the matter. Use milestones for position history, communications for the correspondence chain and references for the legal or rule position.</p>
          </HelpSection>

          <HelpSection id="periodic" icon={CalendarClock} title="Periodic and returning work" tone="cyan">
            <GuideLocation link="/issues" label="Choose an Issue">Issue workspace &gt; Current Position &gt; Schedule return</GuideLocation>
            <p className="text-sm leading-6 text-slate-700">For weekly, monthly or one-time future work, open <strong>Schedule return</strong> in Current Position and select the pattern and next appearance date. When the current cycle is completed, the Issue moves to Scheduled and returns to the current register as Pending on that date.</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">A protected daily background job checks scheduled dates even when nobody has the application open. Use this for periodic returns, recurring reports and matters that should remain out of the active register until a known future date.</p>
          </HelpSection>

          <HelpSection id="reminders" icon={BellRing} title="Reminders and digests" tone="rose">
            <GuideLocation link="/settings" label="Open Settings">Settings &gt; Reminders and digests</GuideLocation>
            <GuideRows rows={[
              ['Notification inbox', 'The bell in the application header shows scheduled returns, upcoming deadlines, matters due today, overdue matters and workload digests. Open an Issue notification to go directly to it.'],
              ['Upcoming window', 'Choose how many days before a deadline the first upcoming reminder should be created. Due-today and overdue notices are handled separately.'],
              ['Digest', 'Choose a weekly digest, a monthly digest or no digest. The digest gives a short count of current, overdue, due-today and upcoming Issues.'],
              ['Email', 'Email is optional. It works only after the deployment administrator configures the protected email service; in-app notifications do not require email setup.'],
              ['Personal preferences', 'Reminder choices follow the signed-in user and do not change the notification preferences of other workspace members.'],
            ]} />
          </HelpSection>

          <HelpSection id="ai" icon={Bot} title="Preparing an AI-assisted draft" tone="violet">
            <GuideLocation link="/issues" label="Choose an Issue">Issue workspace &gt; AI Context</GuideLocation>
            <ol className="space-y-3">
              <Instruction number="1" title="Prepare the office profile">In Settings, enter the Ministry or Department, bilingual heading if required, place of issue and house-style notes. Select the officers authorized to sign communications.</Instruction>
              <Instruction number="2" title="Build reliable Issue context">Keep the running summary current and record only relevant communications and references. Better source material produces safer drafts.</Instruction>
              <Instruction number="3" title="Select context deliberately">In AI Context, choose the summary, communications and references needed for this draft. Sensitive or irrelevant entries can remain unselected.</Instruction>
              <Instruction number="4" title="Describe the outgoing communication">Choose Office Memorandum, D.O. Letter, Letter, Office Order, Order, I.D. Note or another available form. Select the authorized signatory, recipient relationship and recipient organization. State who should do what and by when.</Instruction>
              <Instruction number="5" title="Choose the drafting scope">Leave detailed Issue context off for a concise purpose-led draft. Enable it when the body must draw facts from selected communications, summary or references.</Instruction>
              <Instruction number="6" title="Review before use">The application supplies the CSMOP-oriented document structure and asks the model to draft the body from the Ministry&apos;s perspective. Edit the result, verify every fact and citation, complete placeholders and obtain the required approval before issue.</Instruction>
            </ol>
            <div className="mt-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p>AI output is a drafting aid, not an official decision. The responsible officer remains accountable for factual accuracy, authority, tone, classification and approval.</p></div>
          </HelpSection>

          <HelpSection id="local-ai" icon={HardDrive} title="Using a Local LLM" tone="emerald">
            <GuideLocation link="/settings" label="Open Settings">Settings &gt; AI drafting</GuideLocation>
            <p className="text-sm leading-6 text-slate-700">Local AI is available now. The model runs through LM Studio on the user&apos;s own laptop; the hosted application does not run or pay for the model.</p>
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100">
              <div>lms server stop</div>
              <div>lms server start --cors</div>
            </div>
            <GuideRows className="mt-4" rows={[
              ['Connect', 'Open Settings > AI drafting, choose Local LLM, use http://127.0.0.1:1234, test the connection and select a loaded model.'],
              ['Browser permission', 'When using the hosted application, allow localhost or local-network access if the browser asks.'],
              ['Model choice', 'A stronger instruct model generally follows official drafting constraints better. Small models should be used with conservative drafting and close review.'],
              ['Privacy boundary', 'Selected context is sent to LM Studio on that laptop. Stop the local server when it is not needed and do not expose it to the wider network without authentication.'],
            ]} />
          </HelpSection>

          <HelpSection id="admin" icon={UserRoundCog} title="Administration" tone="amber">
            <GuideLocation link="/admin" label="Open Administration">Main navigation &gt; Administration (platform administrators only)</GuideLocation>
            <GuideRows rows={[
              ['Approve registration', 'Activate a pending account after verifying the user. Approval also adds the user to the current workspace as an Officer.'],
              ['Workspace access', 'Choose Officer, Workspace admin or No workspace access. Removing workspace access prevents the user from opening that workspace while keeping the account available for later reassignment.'],
              ['Cloud AI policy', 'Enable OpenAI or Gemini, select the model, set daily and monthly limits, optionally set a budget and current per-token rates, and override access for individual users when needed.'],
              ['Suspend an account', 'Suspension blocks cloud access for that profile. Use it when a user should no longer access official workspaces.'],
              ['Protect the administrator', 'The signed-in administrator cannot remove or suspend their own access from the Administration page. Keep at least one verified platform administrator available.'],
            ]} />
            <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p>Account approval and workspace membership are separate controls. A user needs both an active account and active workspace access to open the official register.</p></div>
          </HelpSection>

          <HelpSection id="data" icon={Database} title="Data, cloud sync and backup" tone="rose">
            <GuideLocation link="/settings" label="Open Settings">Settings &gt; Data and backup</GuideLocation>
            <GuideRows rows={[
              ['Cloud-synced now', 'Issue details, officers, communications, eReceipts, references, milestones, summary versions and saved drafts sync through Neon for approved workspace members.'],
              ['Local working copy', 'The browser keeps an IndexedDB copy so the interface remains responsive. When connected, newer cloud and local changes are reconciled in the background.'],
              ['Drafting settings', 'The official office profile and authorised signatories are shared with the workspace. LM Studio preferences follow the signed-in user.'],
              ['Saved drafts', 'Generation remains temporary until Save version is selected. Up to five versions are retained per Issue; version six replaces the oldest slot. Saved versions are available on another laptop after cloud sync.'],
              ['Draft tools', 'Open a saved version from the history, export the current text as an editable Word-compatible RTF file, or select one paragraph and regenerate only that passage. Review every replacement before saving it as a new version.'],
              ['Record outgoing', 'After saving the final version, use Record outgoing to add it to the communication chronology with its communication type, draft version and authorised signatory.'],
              ['Sync status', 'The cloud control in the application header shows the latest workspace sync result. Select it to retry after reconnecting or check for recent changes.'],
              ['JSON backup', 'Export a backup regularly from Settings. Import replaces the current local database, so confirm that the selected file is the intended backup before proceeding.'],
              ['Hosted and localhost', 'The hosted application and localhost use separate browser caches. When both use the same cloud account and workspace they reconcile through Neon; a localhost build in Local mode requires export and import.'],
            ]} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Choice title="Shared workspace data" status="Cloud synced" icon={Cloud}>The complete Issue workspace, official profile, officers and saved drafts are shared subject to account and workspace access rules.</Choice>
              <Choice title="Local resilience" status="Backup still recommended" icon={HardDrive}>IndexedDB keeps a local working copy. JSON backup remains useful for recovery and data portability even though operational records synchronize.</Choice>
            </div>
          </HelpSection>

          <HelpSection id="api" icon={Cloud} title="Cloud AI" tone="slate" badge="Paid provider">
            <GuideLocation link="/settings" label="Choose an AI provider">Settings &gt; AI drafting &gt; Cloud API</GuideLocation>
            <p className="text-sm leading-6 text-slate-700">Approved workspace users can draft through OpenAI or Gemini after an administrator enables the provider and the server has its API key. Provider usage charges may apply.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Choice title="Local LLM" status="Available now" icon={HardDrive}>Runs on the user&apos;s computer through LM Studio. There is no per-request API charge, but capability depends on the local model and hardware.</Choice>
              <Choice title="Cloud API" status="Administrator controlled" icon={Cloud}>Uses a protected server-side provider credential. Before every request, the application identifies the provider and asks for confirmation that the selected official context may be transmitted.</Choice>
            </div>
            <GuideRows className="mt-4" rows={[
              ['What is transmitted', 'For a new draft: the drafting brief and selected Issue context. For paragraph regeneration: the selected passage, surrounding draft, brief and relevant context.'],
              ['What is logged', 'Provider, model, operation, status, token counts, estimated cost and character counts. The AI log does not store the official prompt or generated text.'],
              ['Limits', 'Workspace policy and individual overrides determine access. Daily user limits, monthly request limits and an optional workspace budget are checked before provider contact.'],
              ['API keys', 'Keys remain in protected Vercel environment variables. They are never stored in browser settings, Neon user settings or VITE_ variables.'],
            ]} />
          </HelpSection>
        </div>
      </div>
    </>
  );
}

function HelpSection({ id, icon: Icon, title, tone, badge, children }) {
  const tones = { teal: 'border-t-teal-600 text-teal-700', blue: 'border-t-blue-600 text-blue-700', amber: 'border-t-amber-500 text-amber-700', cyan: 'border-t-cyan-600 text-cyan-700', violet: 'border-t-violet-600 text-violet-700', emerald: 'border-t-emerald-600 text-emerald-700', slate: 'border-t-slate-500 text-slate-700', rose: 'border-t-rose-600 text-rose-700' };
  return <section id={id} className={`surface min-w-0 scroll-mt-20 overflow-hidden rounded-md border-t-4 p-4 sm:p-5 ${tones[tone]}`}><div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3"><Icon className="h-5 w-5 shrink-0" /><h2 className="text-base font-semibold text-[#17333b]">{title}</h2>{badge && <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{badge}</span>}</div>{children}</section>;
}

function Step({ number, title, children }) {
  return <div className="border-l-2 border-teal-200 pl-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">{number}</span><h3 className="text-sm font-semibold text-slate-900">{title}</h3></div><p className="mt-2 text-sm leading-6 text-slate-600">{children}</p></div>;
}

function GuideRows({ rows, className = '' }) {
  return <dl className={`divide-y divide-slate-200 border-y border-slate-200 ${className}`}>{rows.map(([term, description]) => <div key={term} className="grid gap-1 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4"><dt className="text-sm font-semibold text-slate-900">{term}</dt><dd className="text-sm leading-6 text-slate-600">{description}</dd></div>)}</dl>;
}

function WorkspaceRow({ icon: Icon, title, children }) {
  return <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4 text-amber-700" />{title}</div><p className="text-sm leading-6 text-slate-600">{children}</p></div>;
}

function Instruction({ number, title, children }) {
  return <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">{number}</span><div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{children}</p></div></li>;
}

function Choice({ title, status, icon: Icon, children }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-slate-700" /><h3 className="text-sm font-semibold text-slate-900">{title}</h3></div><div className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{status}</div><p className="mt-2 text-sm leading-6 text-slate-600">{children}</p></div>;
}

function GuideLocation({ link, label, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span><strong className="font-semibold text-slate-800">Where to find it:</strong> {children}</span>
      {link && <Link to={link} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900">{label}<ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}
