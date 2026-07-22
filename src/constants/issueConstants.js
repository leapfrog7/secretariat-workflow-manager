export const APP_NAME = 'Secretariat Workflow Manager';
export const DB_NAME = 'secretariatWorkflowManagerIssues';
export const DB_VERSION = 11;

export const ISSUE_RECURRENCE_TYPES = ['One-time', 'Weekly', 'Monthly'];

export const ISSUE_STATUSES = [
  'Pending',
  'In Progress',
  'Awaiting Input',
  'Awaiting Discussion',
  'Completed',
  'Cancelled',
  'Deferred',
];

export const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'];

export const SUBJECT_TYPES = [
  'RTI',
  'Parliamentary Matter',
  'Audit',
  'VIP Reference',
  'Public Grievance',
  'Court Case',
  'Administrative',
  'PMO Reference',
  'Cabinet Secretariat',
  'Vigilance',
  'Establishment',
  'Policy',
  'Financial',
  'Project / Programme',
  'Inter-Ministerial Reference',
  'Appointment',
  'Procurement',
  'Other',
];

export const ACTION_STATUSES = [
  'Pending',
  'In Progress',
  'Awaiting Input',
  'Completed',
  'Cancelled',
  'Deferred',
];

export const CLOSED_ACTION_STATUSES = ['Completed', 'Cancelled'];

export const RECORD_TYPES = [
  'Incoming Communication',
  'Outgoing Communication',
  'Internal Note',
  'Meeting',
  'Consultation',
  'Submission',
  'Reference',
  'Other',
];

export const RECORD_DIRECTIONS = ['Incoming', 'Outgoing', 'Internal'];

export const CHRONOLOGY_EVENT_TYPES = [
  'Issue created',
  'Issue updated',
  'Issue archived',
  'Issue restored',
  'Issue scheduled',
  'Issue returned',
  'Record created',
  'Record updated',
  'Record archived',
  'Action created',
  'Action completed',
  'Action reopened',
  'Action archived',
  'Assignment added',
  'Assignment changed',
  'Assignment work started',
  'Assignment clarification sought',
  'Assignment submitted',
  'Assignment accepted',
  'Assignment returned for revision',
  'Assignment completed',
  'Assignment reopened',
];

export const REVIEW_STATUSES = [
  'Not Submitted',
  'Submitted',
  'Accepted',
  'Returned for Revision',
  'Closed',
];

export const OFFICER_ROLES = ['Section Officer', 'Assistant Section Officer', 'Dealing Assistant', 'Consultant', 'Other'];

export const TASK_INACTIVITY_DAYS = 5;

export const DEFAULT_CATEGORIES = [
  'Miscellaneous',
  'Appointment',
  'Establishment',
  'Court Case',
  'Audit',
  'Vigilance',
  'Parliament',
  'Policy',
  'Financial',
  'Project Review',
  'CPSE Governance',
  'Recruitment',
  'RTI/CIC',
];

export const SETTINGS_ID = 'application-settings';

export const DEFAULT_LOCAL_AI_SETTINGS = {
  baseUrl: typeof window !== 'undefined' && window.location.hostname.endsWith('github.io') ? 'http://127.0.0.1:1234' : '/lmstudio',
  model: 'llama-3.2-3b-instruct',
};

export const DEFAULT_OFFICE_PROFILE = {
  governmentName: 'Government of India',
  governmentHindiName: 'Bharat Sarkar',
  ministry: '',
  department: '',
  departmentHindiName: '',
  division: '',
  section: '',
  officeAddress: '',
  placeOfIssue: 'New Delhi',
  houseStyleNotes: '',
  authorizedSignatoryIds: [],
};

export const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  categories: DEFAULT_CATEGORIES,
  localAI: DEFAULT_LOCAL_AI_SETTINGS,
  officeProfile: DEFAULT_OFFICE_PROFILE,
  workspaceSettingsUpdatedAt: '',
  userSettingsUpdatedAt: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const REQUIRED_ISSUE_FIELDS = [
  'shortTitle',
  'dateOpened',
  'status',
];

export const DEADLINE_THRESHOLDS = {
  upcomingDays: 7,
  staleDays: 10,
};

export const ROUTES = {
  dashboard: '/',
  issues: '/issues',
  newIssue: '/issues/new',
  settings: '/settings',
  review: '/review',
};
