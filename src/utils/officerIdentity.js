function comparable(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function getOfficerIdentityKey(officer = {}) {
  return [
    comparable(officer.name),
    comparable(officer.designation),
  ].join('|');
}
