export function attendanceReportUrl(filters, type = 'all') {
  const query = new URLSearchParams();
  for (const key of ['startDate', 'endDate', 'term', 'school_year', 'semester', 'facultyId', 'faculty', 'status']) {
    if (filters[key] && (key !== 'status' || type === 'all')) query.set(key, filters[key]);
  }
  query.set('type', type);
  return `/admin/attendance/print?${query}`;
}
