import assert from 'node:assert/strict';
import { summarizeAttendance } from '../src/utils/attendanceSummary.js';

const row = (id, name, status, date) => ({ status, date, schedule: { facultyId: id, instructor: name } });
const summary = summarizeAttendance([
  row(1, 'A', 'absent', '2026-11-01'),
  row(1, 'A', 'absent', '2026-11-01'),
  row(1, 'A', 'present', '2026-11-02'),
  row(null, 'B', 'absent', '2026-11-01'),
  row(null, 'C', 'late', '2026-11-01'),
], new Map([['1', 'Faculty A']]));
assert.equal(summary.total, 5);
assert.equal(summary.people.length, 3, 'Unlinked instructors must remain separate');
assert.equal(summary.people[0].name, 'Faculty A');
assert.equal(summary.people[0].absent, 2);
assert.deepEqual(summary.people[0].absentDates, ['2026-11-01'], 'Multiple absent classes on one date count as one distinct date');
assert.equal(summary.people[0].absenceRate, 67);
assert.equal(summary.dates[0].faculty, 2);
assert.equal(summary.dates[0].records, 3);
assert.equal(summary.byStatus.present, 1, 'Late does not silently count as present');
assert.deepEqual(summarizeAttendance([]).people, []);
console.log('Attendance summary checks passed');
