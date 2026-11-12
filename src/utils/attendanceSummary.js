// One record represents one scheduled class, not one working day.
export function summarizeAttendance(rows = [], facultyNames = new Map()) {
  const faculty = new Map();
  const dates = new Map();
  const byStatus = {};
  for (const row of rows) {
    const status = String(row.status || '').trim().toLowerCase();
    const schedule = row.schedule || {};
    const id = schedule.facultyId ?? schedule.faculty_id;
    const name = facultyNames.get(String(id)) || schedule.instructor || 'Unknown faculty';
    const key = id != null ? `id:${id}` : `name:${name.trim().toLowerCase()}`;
    if (!faculty.has(key)) faculty.set(key, { key, name, total: 0, present: 0, absent: 0, late: 0, excused: 0, absentDates: new Set(), presentDates: new Set() });
    const person = faculty.get(key);
    person.total++;
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (['present', 'absent', 'late', 'excused'].includes(status)) person[status]++;
    const date = String(row.date || '').slice(0, 10);
    if (status === 'present' && date) person.presentDates.add(date);
    if (status === 'absent' && date) {
      person.absentDates.add(date);
      if (!dates.has(date)) dates.set(date, { date, records: 0, faculty: new Set() });
      dates.get(date).records++;
      dates.get(date).faculty.add(key);
    }
  }
  const people = [...faculty.values()].map(p => ({ ...p, absentDates: [...p.absentDates].sort(), presentDates: [...p.presentDates].sort(), absenceRate: p.total ? Math.round(p.absent / p.total * 100) : 0 }))
    .sort((a, b) => b.absentDates.length - a.absentDates.length || b.absent - a.absent || a.name.localeCompare(b.name));
  return { total: rows.length, byStatus, people, dates: [...dates.values()].map(d => ({ ...d, faculty: d.faculty.size })).sort((a, b) => b.faculty - a.faculty || b.records - a.records || b.date.localeCompare(a.date)) };
}
