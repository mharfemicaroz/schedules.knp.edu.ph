import { conflictsByFacultyTermTimeF2F } from '../src/utils/conflictUtils.js';

const rows = [
  {
    id: 1,
    facultyId: 100,
    facultyName: 'John Doe',
    code: 'For Sci 5',
    section: 'BSCRIM 4-1',
    semester: '1st',
    schedule: '8-9AM',
    f2fSched: 'Mon,Tue',
  },
  {
    id: 2,
    facultyId: 100,
    facultyName: 'John Doe',
    code: 'For Sci 5',
    section: 'BSCRIM 4-1',
    semester: '1st',
    schedule: '9-10AM',
    f2fSched: 'Mon,Tue',
  },
];

const changes = {
  '1': { time: '9-10AM' },
};

const res = conflictsByFacultyTermTimeF2F(rows, changes);
console.log('Conflicts:', JSON.stringify(res, null, 2));

