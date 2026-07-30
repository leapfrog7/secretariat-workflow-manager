export const PARAGRAPH_BANK_CATEGORIES = [
  'Opening',
  'Previous reference',
  'Reminder',
  'Information request',
  'Approval or sanction',
  'Clarification',
  'Statutory language',
  'Forwarding',
  'Closing',
  'Address / addressee',
  'Other',
];

const PLACEHOLDER_PATTERN = /\[([A-Z][A-Z0-9 ._/-]{1,60})\]/g;

function stringList(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

export function extractParagraphPlaceholders(content) {
  return [...new Set([...String(content || '').matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]))];
}

export function normalizeParagraphBankEntry(input = {}, ownerUserId = '') {
  const now = new Date().toISOString();
  const scope = input.scope === 'workspace' ? 'workspace' : 'personal';
  const content = String(input.content || '').trim();
  return {
    id: input.id || crypto.randomUUID(),
    scope,
    ownerUserId: String(input.ownerUserId || ownerUserId || '').trim(),
    title: String(input.title || '').trim(),
    content,
    category: PARAGRAPH_BANK_CATEGORIES.includes(input.category) ? input.category : 'Other',
    tags: stringList(input.tags),
    communicationTypes: stringList(input.communicationTypes),
    placeholders: extractParagraphPlaceholders(content),
    status: input.status === 'retired' ? 'retired' : 'active',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    cloudRevision: Number(input.cloudRevision || 0),
    cloudUpdatedAt: input.cloudUpdatedAt || '',
    cloudUpdatedBy: input.cloudUpdatedBy || '',
    cloudPending: Boolean(input.cloudPending),
  };
}

export function validateParagraphBankEntry(input) {
  const errors = {};
  if (!String(input?.title || '').trim()) errors.title = 'Enter a short name for this paragraph.';
  if (!String(input?.content || '').trim()) errors.content = 'Enter the reusable paragraph text.';
  if (String(input?.content || '').trim().length > 6000) errors.content = 'Keep a reusable paragraph below 6,000 characters.';
  if (!['personal', 'workspace'].includes(input?.scope)) errors.scope = 'Choose personal or shared scope.';
  if (input?.scope === 'personal' && !String(input?.ownerUserId || '').trim()) errors.scope = 'Personal paragraphs require a signed-in owner.';
  return errors;
}

export function searchParagraphBank(entries, { query = '', category = '', communicationType = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return entries
    .filter((entry) => entry.status === 'active')
    .filter((entry) => !category || entry.category === category)
    .filter((entry) => !communicationType || !entry.communicationTypes.length || entry.communicationTypes.includes(communicationType))
    .filter((entry) => {
      if (!needle) return true;
      return [entry.title, entry.content, entry.category, ...entry.tags]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle);
    })
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'workspace' ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
}

export function canManageParagraphBankEntry(entry, { mode, userId, isWorkspaceAdmin }) {
  if (mode === 'local') return true;
  if (entry.scope === 'workspace') return Boolean(isWorkspaceAdmin);
  return Boolean(userId && entry.ownerUserId === userId);
}
