import { addDays, subDays } from 'date-fns';
import { createIssue, getAllIssues, permanentlyDeleteIssue } from './issueRepository';
import { toISODate } from '../utils/dateUtils';

export const sampleIssues = [
  {
    issueNumber: 'SWM/APPT/2026/01',
    shortTitle: 'Appointment of Director, FCRI',
    subject: 'Appointment to the post of Director in a fictional Centre for Research and Innovation',
    organisation: 'Department of Administrative Coordination',
    category: 'Appointment',
    priority: 'High',
    status: 'Pending',
    currentPosition: 'Search committee recommendations are under examination.',
    pendingWith: 'Establishment Section',
    nextAction: 'Place consolidated note before Secretary.',
    nextDeadline: toISODate(addDays(new Date(), 3)),
    dateOpened: toISODate(subDays(new Date(), 12)),
    description: 'The Issue concerns filling a scheduled vacancy through the approved selection process.',
    tags: ['appointment'],
    isDemo: true,
  },
  {
    issueNumber: 'SWM/COURT/2026/04',
    shortTitle: 'Court case on service seniority',
    subject: 'Examination of pleadings in a fictional service seniority court case',
    organisation: 'Office of Legal Affairs',
    category: 'Court Case',
    priority: 'Critical',
    status: 'In Progress',
    currentPosition: 'Draft counter affidavit is pending legal vetting.',
    pendingWith: 'Legal Cell',
    nextAction: 'Obtain vetted draft from counsel.',
    nextDeadline: toISODate(subDays(new Date(), 2)),
    dateOpened: toISODate(subDays(new Date(), 22)),
    description: 'The case requires timely coordination between administrative and legal sections.',
    tags: ['litigation'],
    isDemo: true,
  },
  {
    issueNumber: 'SWM/AUDIT/2026/02',
    shortTitle: 'Examination of CAG audit paragraph',
    subject: 'Response to CAG audit paragraph on procurement procedure in a fictional CPSE',
    organisation: 'National Engineering Corporation',
    category: 'Audit',
    priority: 'Normal',
    status: 'Awaiting Input',
    currentPosition: 'Clarifications have been sought from the CPSE.',
    pendingWith: 'National Engineering Corporation',
    nextAction: 'Review reply when received.',
    nextDeadline: '',
    dateOpened: toISODate(subDays(new Date(), 18)),
    description: 'The Issue relates to observations raised in a draft audit paragraph.',
    tags: ['audit'],
    isDemo: true,
  },
  {
    issueNumber: 'SWM/PROJECT/2026/06',
    shortTitle: 'Review of delayed township project',
    subject: 'Review of delay in a fictional township redevelopment project',
    organisation: 'Public Sector Policy Division',
    category: 'Project Review',
    priority: 'High',
    status: 'In Progress',
    currentPosition: 'Updated implementation schedule received and under scrutiny.',
    pendingWith: 'Project Monitoring Division',
    nextAction: 'Schedule review meeting.',
    nextDeadline: toISODate(addDays(new Date(), 6)),
    dateOpened: toISODate(subDays(new Date(), 35)),
    description: 'The project has slipped against approved milestones and requires periodic monitoring.',
    tags: ['project'],
    isDemo: true,
  },
  {
    issueNumber: 'SWM/REC/2026/03',
    shortTitle: 'Recruitment and Promotion Policy',
    subject: 'Revision of recruitment and promotion policy for technical cadres in a fictional enterprise',
    organisation: 'Finance Division',
    category: 'Recruitment',
    priority: 'Normal',
    status: 'Deferred',
    currentPosition: 'Comments from finance and legal divisions are awaited.',
    pendingWith: 'Finance Division',
    nextAction: '',
    nextDeadline: toISODate(addDays(new Date(), 14)),
    dateOpened: toISODate(subDays(new Date(), 40)),
    description: 'The proposal seeks harmonisation of qualifications, experience and promotion norms.',
    tags: ['recruitment'],
    isDemo: true,
  },
  {
    issueNumber: 'SWM/CHG/2026/05',
    shortTitle: 'Additional charge of CMD, IL',
    subject: 'Extension of additional charge arrangement for the post of CMD in a fictional undertaking',
    organisation: 'Infrastructure Limited',
    category: 'CPSE Governance',
    priority: 'Low',
    status: 'Completed',
    currentPosition: 'Approval issued and Issue closed.',
    pendingWith: '',
    nextAction: '',
    nextDeadline: toISODate(subDays(new Date(), 5)),
    dateOpened: toISODate(subDays(new Date(), 30)),
    dateClosed: toISODate(subDays(new Date(), 1)),
    description: 'Temporary charge arrangement was processed pending regular appointment.',
    tags: ['governance'],
    isDemo: true,
  },
];

export async function loadDemoIssues() {
  const existing = await getAllIssues();
  if (existing.some((issue) => issue.isDemo)) {
    return { loaded: false, count: 0 };
  }
  for (const issue of sampleIssues) {
    await createIssue({ ...issue, customFields: [], isArchived: false });
  }
  return { loaded: true, count: sampleIssues.length };
}

export async function clearDemoIssues() {
  const issues = await getAllIssues();
  const demoIssues = issues.filter((issue) => issue.isDemo);
  await Promise.all(demoIssues.map((issue) => permanentlyDeleteIssue(issue.id)));
  return { count: demoIssues.length };
}
