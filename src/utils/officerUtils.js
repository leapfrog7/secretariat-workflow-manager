import { OFFICER_ROLES } from '../constants/issueConstants';

export function normalizeOfficer(input = {}) {
  return {
    id: input.id,
    name: input.name || '',
    designation: input.designation || '',
    telephone: input.telephone || '',
    email: input.email || '',
    section: input.section || '',
    role: OFFICER_ROLES.includes(input.role) ? input.role : 'Other',
    isActive: input.isActive !== false,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export function validateOfficer(officer) {
  const errors = {};
  if (!officer.name?.trim()) errors.name = 'Name is required.';
  return errors;
}
