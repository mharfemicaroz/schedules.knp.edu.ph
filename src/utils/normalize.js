// Attempts to normalize flexible JSON structures into a canonical shape
// Canonical Faculty shape:
// { id, name, department, email, rank, stats: { loadHours, overloadHours, contactHours, courseCount }, courses: [ { id, code, title, section, hours, students, schedule, room, semester, year } ] }

function pick(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return fallback;
}

function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function ensureId(val, alt) {
  if (val == null || val === '') return alt ?? cryptoRandom();
  return String(val);
}

function cryptoRandom() {
  try {
    // Not critical; just to avoid collisions
    return Math.random().toString(36).slice(2);
  } catch {
    return Date.now().toString(36);
  }
}

function mapFromFacultyLoads(root) {
  const list = root.facultyLoads || [];
  return list.map((f, idx) => {
    const courses = (f.courses || []).map((c, i) => ({
      id: ensureId(c.id ?? `${idx}-${i}`),
      code: pick(c, ['code', 'courseCode', 'course'], ''),
      title: pick(c, ['title', 'name'], ''),
      section: pick(c, ['section', 'sec'], ''),
      hours: toNumber(pick(c, ['hours', 'loadHours', 'creditHours', 'credits'], 0)),
      students: toNumber(pick(c, ['students', 'enrolled', 'headcount'], 0)),
      schedule: pick(c, ['schedule', 'time'], ''),
      room: pick(c, ['room', 'location'], ''),
      semester: pick(c, ['semester', 'term'], ''),
      year: pick(c, ['year', 'acadYear'], ''),
    }));

    return {
      id: ensureId(pick(f, ['id', 'facultyId']), idx),
      name: pick(f, ['name', 'facultyName', 'instructor', 'lecturer'], 'Unknown'),
      department: pick(f, ['department', 'dept', 'unit'], 'N/A'),
      email: pick(f, ['email', 'mail'], ''),
      rank: pick(f, ['rank', 'title', 'designation'], ''),
      stats: {
        loadHours: toNumber(pick(f, ['totalLoad', 'loadHours', 'hours'], 0)),
        overloadHours: toNumber(pick(f, ['overload', 'overloadHours'], 0)),
        contactHours: toNumber(pick(f, ['contactHours'], 0)),
        courseCount: courses.length,
      },
      courses,
    };
  });
}

function mapFromRelational(root) {
  // Attempt: faculties[], courses[], sections[], assignments[] linking facultyId->sectionId
  const facMap = new Map();
  const faculties = (root.faculties || root.instructors || []).map((f, i) => {
    const id = ensureId(pick(f, ['id', 'facultyId', 'instructorId']), i);
    const item = {
      id,
      name: pick(f, ['name', 'fullName', 'facultyName'], 'Unknown'),
      department: pick(f, ['department', 'dept', 'unit'], 'N/A'),
      email: pick(f, ['email'], ''),
      rank: pick(f, ['rank', 'title'], ''),
      stats: { loadHours: 0, overloadHours: 0, contactHours: 0, courseCount: 0 },
      courses: [],
    };
    facMap.set(id, item);
    return item;
  });

  const courses = root.courses || [];
  const sections = root.sections || root.classes || [];
  const assignments = root.assignments || root.loads || [];

  const courseById = new Map(courses.map(c => [ensureId(pick(c, ['id', 'courseId']), pick(c, ['code'])), c]));
  const sectionById = new Map(sections.map(s => [ensureId(pick(s, ['id', 'sectionId']), pick(s, ['crn'])), s]));

  assignments.forEach((a, i) => {
    const fid = ensureId(pick(a, ['facultyId', 'instructorId', 'lecturerId']), undefined);
    const sid = ensureId(pick(a, ['sectionId', 'classId']), i);
    const f = facMap.get(fid);
    const sec = sectionById.get(sid) || {};
    const crs = courseById.get(ensureId(pick(sec, ['courseId']), pick(sec, ['code'])) ) || {};
    if (!f) return;
    const hours = toNumber(pick(a, ['hours', 'loadHours'], pick(sec, ['hours', 'creditHours'], pick(crs, ['hours', 'creditHours'], 0))));
    const contactHours = toNumber(pick(a, ['contactHours'], pick(sec, ['contactHours'], 0)));
    const overloadHours = Math.max(0, toNumber(pick(a, ['overload', 'overloadHours'], 0)));

    f.courses.push({
      id: ensureId(pick(sec, ['id', 'sectionId', 'crn']), `${fid}-${i}`),
      code: pick(crs, ['code', 'courseCode', 'number'], ''),
      title: pick(crs, ['title', 'name'], ''),
      section: pick(sec, ['section', 'sec'], ''),
      hours,
      students: toNumber(pick(sec, ['enrolled', 'students', 'headcount'], 0)),
      schedule: pick(sec, ['schedule', 'time'], ''),
      room: pick(sec, ['room', 'location'], ''),
      semester: pick(sec, ['semester', 'term'], pick(a, ['semester', 'term'], '')),
      year: pick(sec, ['year'], pick(a, ['year'], '')),
    });

    f.stats.loadHours += hours;
    f.stats.contactHours += contactHours || hours;
    f.stats.overloadHours += overloadHours;
  });

  faculties.forEach(f => { f.stats.courseCount = f.courses.length; });
  return faculties;
}

function parseTimeToMinutes(s) {
  if (!s || typeof s !== 'string') return null;
  // Examples: "8-9AM", "10-11AM", "8-10AM", "11-12NN", "4-5PM"
  const parts = s.split('-');
  if (parts.length < 1) return null;
  const startRaw = parts[0].trim();
  const endRaw = parts[1]?.trim() || '';
  // Extract AM/PM/NN from end if not on start
  const meridiemMatch = endRaw.match(/(AM|PM|NN)$/i);
  const inferredMeridiem = meridiemMatch ? meridiemMatch[1].toUpperCase() : undefined;
  const startMatch = startRaw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|NN)?$/i);
  if (!startMatch) return null;
  let [, hStr, mStr, ampm] = startMatch;
  ampm = (ampm || inferredMeridiem || '').toUpperCase();
  let h = Number(hStr);
  let m = Number(mStr || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (ampm === 'NN') { h = 12; m = m || 0; }
  else if (ampm === 'PM') { if (h !== 12) h += 12; }
  else if (ampm === 'AM') { if (h === 12) h = 0; }
  // If no meridiem found anywhere, assume morning
  return h * 60 + m;
}

function termOrder(term) {
  const t = String(term || '').toLowerCase();
  if (t.startsWith('1')) return 1;
  if (t.startsWith('2')) return 2;
  if (t.includes('sem')) return 3; // Semestral
  if (t.includes('sum')) return 4; // Summer
  return 9;
}

const DAY_ALIASES = {
  mon: 'Mon', monday: 'Mon', m: 'Mon',
  tue: 'Tue', tues: 'Tue', tuesday: 'Tue', tu: 'Tue', t: 'Tue',
  wed: 'Wed', wednesday: 'Wed', w: 'Wed',
  thu: 'Thu', thurs: 'Thu', thursday: 'Thu', th: 'Thu',
  fri: 'Fri', friday: 'Fri', f: 'Fri',
  sat: 'Sat', saturday: 'Sat', sa: 'Sat',
  sun: 'Sun', sunday: 'Sun', su: 'Sun',
};

function expandDayRange(s) {
  // e.g., "MON-FRI" -> [Mon..Fri]
  if (!s) return [];
  const u = String(s).toUpperCase();
  if (!u.includes('-')) return [];
  const [a,b] = u.split('-');
  const order = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const i = order.indexOf(a), j = order.indexOf(b);
  if (i === -1 || j === -1) return [];
  const slice = i <= j ? order.slice(i, j+1) : [...order.slice(i), ...order.slice(0, j+1)];
  return slice.map(x => DAY_ALIASES[x.toLowerCase()] || x.charAt(0) + x.slice(1).toLowerCase());
}

function parseF2FDays(str) {
  const out = new Set();
  const add = (v) => { const k = String(v||'').trim(); if (!k) return; const norm = DAY_ALIASES[k.toLowerCase()] || k; if (norm) out.add(norm); };
  if (str) {
    String(str).split(/[,&]/).forEach(tok => add(tok));
  }
  return Array.from(out);
}

function mapFromFlatArray(arr) {
  // Determine mode by scanning dataset for any name-bearing fields
  const nameKeys = ['faculty', 'facultyName', 'instructor', 'lecturer', 'name'];
  const anyHasName = Array.isArray(arr) && arr.some(row => nameKeys.some(k => row && row[k]));
  const map = new Map();

  arr.forEach((row, idx) => {
    let key;
    let id;
    let displayName;
    let department;

    if (anyHasName) {
      // Resolve per-row; if missing, mark as Unassigned to avoid showing block codes as faculty
      displayName = row?.faculty ?? row?.facultyName ?? row?.instructor ?? row?.lecturer ?? row?.name;
      if (!displayName || String(displayName).trim() === '') displayName = 'Unassigned';
      key = String(row?.facultyId ?? row?.instructorId ?? displayName);
      id = ensureId(row?.facultyId ?? row?.instructorId ?? key, key);
      department = row?.department ?? row?.dept ?? row?.programcode ?? row?.program ?? row?.program_code ?? row?.programCode ?? 'N/A';
    } else {
      // No faculty/instructor present anywhere; group by block/program to keep structure meaningful
      const blockCode = row['block code'] ?? row.blockcode ?? row.blockcode_2 ?? row.block;
      const program = row.programcode ?? row.program ?? row.programCode ?? row.program_code;
      const yearlevel = row.yearlevel ?? row.yearLevel;
      const fallbackLabel = [program, yearlevel, row.block].filter(Boolean).join(' ').trim();
      displayName = String((blockCode ?? fallbackLabel) || 'Group');
      key = `block:${displayName}`;
      id = ensureId(key, `idx-${idx}`);
      department = program || row?.department || row?.dept || 'N/A';
    }

    if (!map.has(key)) {
      map.set(key, {
        id,
        name: displayName,
        department,
        email: row.email || '',
        rank: row.rank || row.title || '',
        designation: row.designation || row.title || '',
        employment: row.employment || '',
        loadReleaseUnits: toNumber(row.load_release_units, 0),
        stats: { loadHours: 0, overloadHours: 0, contactHours: 0, courseCount: 0 },
        courses: [],
      });
    }
    const f = map.get(key);
    // Backfill profile fields from subsequent rows if missing
    if (!f.designation && (row.designation || row.title)) f.designation = row.designation || row.title;
    if (!f.rank && (row.rank || row.title)) f.rank = row.rank || row.title;
    if (!f.employment && row.employment) f.employment = row.employment;
    if ((!f.loadReleaseUnits || f.loadReleaseUnits === 0) && (row.load_release_units != null)) f.loadReleaseUnits = toNumber(row.load_release_units, 0);
    const hours = toNumber(row.loadHours ?? row.hours ?? row.creditHours ?? row.credits ?? row.unit, 0);
    const contactHours = toNumber(row.contactHours ?? hours, 0);
    const overloadHours = toNumber(row.overload ?? row.overloadHours, 0);
    const semester = row.semester ?? row.term ?? '';
    const timeStr = row.schedule ?? row.time ?? '';
    f.courses.push({
      id: ensureId(row.id ?? row.sectionId ?? `${key}-${idx}`),
      code: row.code ?? row.courseCode ?? row.course ?? row.course_name ?? row['course name'] ?? '',
      title: row.title ?? row.course_title ?? row['course title'] ?? row.name ?? '',
      section: row.section ?? row.sec ?? row.blockcode_2 ?? row.blockcode ?? row['block code'] ?? row.block ?? '',
      hours, // treat as units
      units: hours,
      students: toNumber(row.students ?? row.enrolled ?? row.headcount, 0),
      schedule: timeStr,
      day: row.day ?? '',
      session: row.session ?? '',
      f2f: row.f2f_sched ?? row.f2f ?? '',
      f2fDays: parseF2FDays(row.f2f_sched ?? row.f2f),
      room: row.room ?? row.location ?? '',
      semester,
      year: row.year ?? '',
      timeStartMinutes: parseTimeToMinutes(timeStr),
      termOrder: termOrder(semester),
      instructor: row.instructor ?? '',
      program: row.programcode ?? row.program ?? '',
      yearlevel: row.yearlevel ?? '',
    });
    f.stats.loadHours += hours;
    f.stats.contactHours += contactHours;
    f.stats.overloadHours += overloadHours;
  });

  const list = Array.from(map.values());
  // Sort each faculty's courses by term then time
  list.forEach(f => {
    f.courses.sort((a, b) => {
      const ta = a.timeStartMinutes ?? Infinity;
      const tb = b.timeStartMinutes ?? Infinity;
      const oa = a.termOrder ?? 9;
      const ob = b.termOrder ?? 9;
      if (oa !== ob) return oa - ob;
      return ta - tb;
    });
    f.stats.courseCount = f.courses.length;
    // Compute overload vs baseline adjusted by load release units (regular load is 24 minus load release)
    const release = Number.isFinite(f.loadReleaseUnits) ? f.loadReleaseUnits : toNumber(f.loadReleaseUnits, 0);
    const baseline = Math.max(0, 24 - (release || 0));
    f.stats.overloadHours = Math.max(0, (f.stats.loadHours || 0) - baseline);
  });
  return list;
}

export function normalizeFacultyDataset(root) {
  try {
    let faculties = [];
    if (Array.isArray(root)) {
      faculties = mapFromFlatArray(root);
    } else if (root && typeof root === 'object') {
      if (Array.isArray(root.facultyLoads)) {
        faculties = mapFromFacultyLoads(root);
      } else if (Array.isArray(root.faculties) || Array.isArray(root.instructors)) {
        faculties = mapFromRelational(root);
      } else if (Array.isArray(root.data)) {
        faculties = mapFromFlatArray(root.data);
      } else {
        // fallback: try flatten any array-like property
        const firstArrayKey = Object.keys(root).find(k => Array.isArray(root[k]));
        if (firstArrayKey) faculties = mapFromFlatArray(root[firstArrayKey]);
      }
    }

    const departments = Array.from(new Set(faculties.map(f => f.department).filter(Boolean)));
    const semesters = Array.from(new Set(
      faculties.flatMap(f => (f.courses || []).map(c => c.semester)).filter(Boolean)
    ));

    return { faculties, meta: { departments, semesters } };
  } catch (e) {
    console.error('Normalization failed', e);
    return { faculties: [], meta: {} };
  }
}
