export function facultyOverloadOverrideKey(faculty) {
  const id = faculty?.facultyId ?? faculty?.faculty_id ?? faculty?.id;
  if (id !== null && id !== undefined && String(id).trim() !== '') {
    return `id:${String(id).trim()}`;
  }

  const name = String(
    faculty?.faculty ?? faculty?.name ?? faculty?.full_name ?? faculty?.instructor ?? ''
  ).toLowerCase().replace(/[^a-z0-9]/g, '');
  return name ? `name:${name}` : '';
}

export function getFacultyOverloadOverride(overrides, faculty) {
  const key = facultyOverloadOverrideKey(faculty);
  return key && overrides ? overrides[key] || null : null;
}

export function applyFacultyOverloadOverride(row, overrides) {
  const override = getFacultyOverloadOverride(overrides, row);
  if (!override) return row;

  const firstUnits = Number(override.firstUnits);
  const secondUnits = Number(override.secondUnits);
  return {
    ...row,
    overload: firstUnits + secondUnits,
    overloadUnits: firstUnits + secondUnits,
    overloadFirst: firstUnits,
    overloadSecond: secondUnits,
    overloadFirstHours: String(override.firstHours),
    overloadSecondHours: String(override.secondHours)
  };
}
