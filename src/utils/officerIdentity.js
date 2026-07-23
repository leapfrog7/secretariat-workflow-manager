function comparable(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function getOfficerIdentityKey(officer = {}) {
  return [
    comparable(officer.name),
    comparable(officer.designation),
    comparable(officer.telephone),
    comparable(officer.email),
    comparable(officer.section),
    comparable(officer.role),
    officer.isActive === false ? 'inactive' : 'active',
  ].join('|');
}
