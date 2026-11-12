import assert from 'node:assert/strict';
import { attendanceReportUrl } from '../src/utils/attendanceReport.js';

const filters = { startDate: '2026-11-01', endDate: '2026-11-12', status: 'late', facultyId: '5', faculty: 'A & B', term: '1st', semester: '2nd', school_year: '2026-2027' };
const read = type => new URL(attendanceReportUrl(filters, type), 'https://example.test').searchParams;
const all = read('all');
for (const [key, value] of Object.entries(filters)) assert.equal(all.get(key), value);
for (const type of ['present', 'absent', 'late', 'excused']) {
  const query = read(type);
  assert.equal(query.get('type'), type);
  assert.equal(query.has('status'), false, 'Selected summary status overrides the record status filter');
  for (const [key, value] of Object.entries(filters)) if (key !== 'status') assert.equal(query.get(key), value);
}
console.log('Attendance report filter checks passed');
