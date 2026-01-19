import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Heading, HStack, Avatar, Text, Badge, VStack, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue } from '@chakra-ui/react';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import LoadingState from '../components/LoadingState';
import { normalizeSem } from '../utils/facultyScoring';
import { encodeFacultyPublicCode } from '../utils/share';
import { parseTimeBlockToMinutes, parseF2FDays } from '../utils/conflicts';
import api from '../services/apiService';

const TARGET_SY = '2025-2026';
const TARGET_SEM = '2nd';
const TARGET_TERMS = ['1st', 'Sem'];
const CODE_RE = /^[a-z0-9]{6}$/i;

const normalizeSy = (val) => String(val || '').toUpperCase().replace(/[^0-9-]/g, '').trim();
const normalizeDeptLabel = (val) => String(val || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const normalizeProgramLabel = (val) => String(val || '').toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/-+/g, '-').trim();
const normalizeTermLabel = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('sem') || v.includes('semestral')) return 'Sem';
  if (/summer|mid\s*year|midyear/.test(v) || v.startsWith('3')) return '3rd';
  if (v.startsWith('2') || /\bsecond\b/.test(v)) return '2nd';
  if (v.startsWith('1') || /\bfirst\b/.test(v)) return '1st';
  return '';
};
const isDeptExempt = (dept) => {
  const d = normalizeDeptLabel(dept);
  if (!d) return false;
  const compact = d.replace(/\s+/g, '');
  if (compact.includes('KNPPARTTIME') || compact.includes('PARTTIME')) return true;
  if (compact.includes('GENED')) return true;
  if (compact === 'PE') return true;
  const tokens = d.split(' ').filter(Boolean);
  return tokens.includes('PE');
};
const deptGroupKey = (dept) => {
  const d = normalizeDeptLabel(dept);
  if (!d || isDeptExempt(d)) return '';
  if (d.includes('BSED') || d.includes('BTLED')) return 'BSED';
  if (d.includes('BSBA')) return 'BSBA';
  if (d.includes('BSCRIM')) return 'BSCRIM';
  if (d.includes('BSTM')) return 'BSTM';
  if (d.includes('BSAB')) return 'BSAB';
  if (d.includes('BSENTREP') || d.includes('BSENT')) return 'BSENTREP';
  const token = d.split(' ').filter(Boolean)[0] || '';
  return token;
};
const programGroupKey = (programcode) => {
  const raw = normalizeProgramLabel(programcode);
  if (!raw) return '';
  const base = raw.split('-')[0] || '';
  if (base.startsWith('BTLED')) return 'BSED';
  if (base.startsWith('BSED')) return 'BSED';
  if (base.startsWith('BSBA')) return 'BSBA';
  if (base.startsWith('BSCRIM')) return 'BSCRIM';
  if (base.startsWith('BSTM')) return 'BSTM';
  if (base.startsWith('BSAB')) return 'BSAB';
  if (base.startsWith('BSENTREP') || base.startsWith('BSENT')) return 'BSENTREP';
  return base;
};

const termOrder = (t) => {
  const v = normalizeTermLabel(t);
  if (v === '1st') return 1;
  if (v === 'Sem') return 2;
  if (v === '2nd') return 3;
  if (v === '3rd') return 4;
  return 9;
};

const normalizeRemoteCourse = (row) => {
  const code = row.code ?? row.courseName ?? row.course_name ?? row.courseCode ?? '';
  const title = row.title ?? row.courseTitle ?? row.course_title ?? row.name ?? '';
  const section = row.section ?? row.blockCode ?? row.block_code ?? row.blockcode ?? row.block ?? '';
  const unit = row.unit ?? row.hours ?? row.creditHours ?? row.credits ?? '';
  const term = row.term ?? row.term_name ?? row.termName ?? row.term_value ?? '';
  const semester = row.semester ?? row.sem ?? row.semester_name ?? row.semesterName ?? '';
  const schoolyear = row.sy ?? row.schoolyear ?? row.school_year ?? row.schoolYear ?? '';
  const programcode = row.programcode ?? row.program_code ?? row.programCode ?? row.program ?? '';
  const department = row.department ?? row.dept ?? '';
  const schedule = String(row.schedule ?? row.time ?? '').trim();
  const tr = parseTimeBlockToMinutes(schedule);
  const f2fSched = row.f2fSched ?? row.f2fsched ?? row.f2f_sched ?? row.f2f ?? '';
  const f2fDays = Array.isArray(row.f2fDays) ? row.f2fDays : parseF2FDays(f2fSched || row.day || '');
  return {
    ...row,
    code,
    title,
    section,
    unit,
    term,
    semester,
    schoolyear,
    programcode,
    department,
    schedule,
    time: row.time ?? row.schedule ?? schedule,
    day: row.day ?? '',
    room: row.room ?? row.location ?? '',
    session: row.session ?? '',
    f2fSched,
    f2fsched: row.f2fsched ?? row.f2fSched ?? f2fSched,
    f2fDays,
    facultyName: row.facultyName ?? row.faculty ?? row.instructor ?? row.instructorName ?? '',
    facultyId: row.facultyId ?? row.faculty_id ?? null,
    timeStartMinutes: Number.isFinite(tr.start) ? tr.start : undefined,
    timeEndMinutes: Number.isFinite(tr.end) ? tr.end : undefined,
    scheduleKey: Number.isFinite(tr.start) && Number.isFinite(tr.end) ? `${tr.start}-${tr.end}` : schedule,
    termOrder: termOrder(term),
  };
};

const mergeCourses = (list) => {
  const toDayCodes = (src) => {
    const s = String(src || '').trim().toUpperCase();
    if (!s) return [];
    const map = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' };
    const parts = s.split(/[\/,;&\s]+/).filter(Boolean);
    const out = new Set();
    for (const p0 of parts) {
      const p = p0.toUpperCase();
      if (p.includes('-')) {
        const [a, b] = p.split('-').map(t => t.trim());
        const order = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai !== -1 && bi !== -1) {
          for (let i = ai; i <= bi; i += 1) out.add(map[order[i]]);
        }
      } else if (map[p]) {
        out.add(map[p]);
      }
    }
    const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return order.filter(d => out.has(d));
  };

  const startOf = (c) => {
    if (Number.isFinite(c?.timeStartMinutes)) return c.timeStartMinutes;
    const tStr = String(c?.scheduleKey || c?.schedule || c?.time || '').trim();
    const tr = parseTimeBlockToMinutes(tStr);
    if (Number.isFinite(tr.start)) return tr.start;
    const m = tStr.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (m) {
      const sh = parseInt(m[1], 10);
      const sm = parseInt(m[2], 10);
      if (!Number.isNaN(sh) && !Number.isNaN(sm)) return sh * 60 + sm;
    }
    return Infinity;
  };

  const keyOfTime = (c) => {
    const s = startOf(c);
    return Number.isFinite(s) ? s : Infinity;
  };

  const keyOf = (c) => [
    String(c.code || c.courseName || '').toUpperCase().trim(),
    String(c.section || '').toUpperCase().trim(),
    String(c.term || '').toUpperCase().trim(),
    String(c.schedule || c.time || '').toUpperCase().trim(),
  ].join('|');

  const map = new Map();
  (list || []).forEach((c) => {
    const k = keyOf(c);
    const prev = map.get(k);
    const f2fFromC = Array.isArray(c.f2fDays) && c.f2fDays.length
      ? c.f2fDays
      : toDayCodes(c.f2fSched || c.f2fsched || c.day);
    const dayCodes = toDayCodes(c.day);
    const rooms = new Set();
    if (c.room) rooms.add(String(c.room).trim());
    if (prev) {
      const roomSet = new Set(prev._rooms || []);
      rooms.forEach(r => roomSet.add(r));
      prev._rooms = Array.from(roomSet);
      const fset = new Set(prev.f2fDays || []);
      f2fFromC.forEach(d => fset.add(d));
      prev.f2fDays = Array.from(fset);
      const dset = new Set(prev._days || []);
      dayCodes.forEach(d => dset.add(d));
      prev._days = Array.from(dset);
    } else {
      map.set(k, {
        ...c,
        _rooms: Array.from(rooms),
        f2fDays: f2fFromC.slice(),
        _days: dayCodes.slice(),
      });
    }
  });

  const merged = Array.from(map.values()).map((x) => {
    const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const daysJoined = (x._days && x._days.length)
      ? order.filter(d => new Set(x._days).has(d)).join(',')
      : (x.day || '');
    const f2fJoined = (x.f2fDays && x.f2fDays.length)
      ? order.filter(d => new Set(x.f2fDays).has(d)).join(',')
      : (x.f2fSched || '');
    return {
      ...x,
      day: daysJoined,
      f2fSched: f2fJoined,
      f2fsched: f2fJoined,
      room: (x._rooms || []).filter(Boolean).join(', '),
    };
  });

  return merged.sort((a, b) => {
    const oa = Number.isFinite(a.termOrder) ? a.termOrder : termOrder(a.term);
    const ob = Number.isFinite(b.termOrder) ? b.termOrder : termOrder(b.term);
    if (oa !== ob) return oa - ob;
    const ta = keyOfTime(a);
    const tb = keyOfTime(b);
    if (ta !== tb) return ta - tb;
    return String(a.scheduleKey || '').localeCompare(String(b.scheduleKey || ''));
  });
};

export default function FacultyPublicCode() {
  const { id } = useParams();
  const code = String(id || '').trim();
  const codeKey = code.toUpperCase();
  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector(s => s.data.loading);

  const localMatch = React.useMemo(() => {
    const out = { courses: [], facultyId: null, facultyName: '', department: '' };
    if (!codeKey) return out;
    const matchByCode = (c, value) => {
      const fid = c.facultyId ?? c.faculty_id ?? c.facultyID ?? '';
      if (fid == null || String(fid).trim() === '') return false;
      const enc = encodeFacultyPublicCode(fid);
      return enc && enc.toUpperCase() === value;
    };
    const byCodeCourses = (allCourses || []).filter(c => matchByCode(c, codeKey));
    if (!byCodeCourses.length) return out;
    const sample = byCodeCourses[0] || {};
    return {
      courses: byCodeCourses,
      facultyId: sample.facultyId ?? sample.faculty_id ?? null,
      facultyName: sample.facultyName || sample.faculty || sample.instructor || '',
      department: sample.department || sample.dept || '',
    };
  }, [allCourses, codeKey]);

  const targetSyNorm = React.useMemo(() => normalizeSy(TARGET_SY), []);
  const targetSemNorm = React.useMemo(() => normalizeSem(TARGET_SEM), []);
  const targetTermSet = React.useMemo(() => new Set(TARGET_TERMS), []);

  const matchesTarget = React.useCallback((row) => {
    const syVal = normalizeSy(row?.schoolyear ?? row?.schoolYear ?? row?.school_year ?? row?.sy ?? '');
    if (targetSyNorm && syVal && syVal !== targetSyNorm) return false;
    const semVal = normalizeSem(row?.semester ?? row?.sem ?? row?.semester_name ?? row?.semesterName ?? '');
    if (targetSemNorm && semVal && semVal !== targetSemNorm) return false;
    const termVal = normalizeTermLabel(row?.term ?? row?.term_name ?? row?.termName ?? row?.term_value ?? '');
    if (!termVal || !targetTermSet.has(termVal)) return false;
    return true;
  }, [targetSyNorm, targetSemNorm, targetTermSet]);

  const localFiltered = React.useMemo(() => {
    return (localMatch.courses || []).filter(matchesTarget);
  }, [localMatch.courses, matchesTarget]);

  const [remoteCourses, setRemoteCourses] = React.useState(null);
  const [remoteLoading, setRemoteLoading] = React.useState(false);

  React.useEffect(() => {
    if (!code || !CODE_RE.test(code)) return;
    if (localFiltered.length > 0) {
      setRemoteCourses(null);
      return;
    }
    let alive = true;
    const fetchById = async (fid) => {
      const sy = TARGET_SY;
      const sem = TARGET_SEM;
      let url = `/?_ts=${Date.now()}&facultyId=${encodeURIComponent(fid)}`;
      if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
      if (sem) url += `&semester=${encodeURIComponent(sem)}`;
      const res = await api.request(url);
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
      return (items || []).map(normalizeRemoteCourse);
    };
    const fetchByName = async (name) => {
      const sy = TARGET_SY;
      const sem = TARGET_SEM;
      let url = `/instructor/${encodeURIComponent(name)}?_ts=${Date.now()}`;
      if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
      if (sem) url += `&semester=${encodeURIComponent(sem)}`;
      const res = await api.request(url);
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
      return (items || []).map(normalizeRemoteCourse);
    };
    (async () => {
      try {
        setRemoteLoading(true);
        let list = [];
        const fid = localMatch.facultyId;
        if (fid != null && String(fid).trim() !== '') {
          try { list = await fetchById(fid); } catch {}
        }
        if (!list.length && localMatch.facultyName) {
          try { list = await fetchByName(localMatch.facultyName); } catch {}
        }
        if (!alive) return;
        setRemoteCourses(list);
      } catch {
        if (!alive) return;
        setRemoteCourses([]);
      } finally {
        if (alive) setRemoteLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [code, localFiltered.length, localMatch.facultyId, localMatch.facultyName]);

  const baseCourses = remoteCourses != null ? remoteCourses : localMatch.courses;
  const [facultyMeta, setFacultyMeta] = React.useState({ dept: '' });

  React.useEffect(() => {
    const fid = localMatch.facultyId;
    if (fid == null || String(fid).trim() === '') {
      setFacultyMeta({ dept: '' });
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await api.getFaculty(fid);
        const info = res?.data || res || {};
        if (!alive) return;
        setFacultyMeta({
          dept: info.dept ?? info.department ?? '',
        });
      } catch {
        if (!alive) return;
        setFacultyMeta({ dept: '' });
      }
    })();
    return () => { alive = false; };
  }, [localMatch.facultyId]);

  const facultyDept = React.useMemo(() => {
    if (facultyMeta.dept) return facultyMeta.dept;
    if (localMatch.department) return localMatch.department;
    const list = Array.isArray(baseCourses) ? baseCourses : [];
    const counts = new Map();
    list.forEach((row) => {
      const d = row?.department ?? row?.dept ?? '';
      if (!d) return;
      counts.set(d, (counts.get(d) || 0) + 1);
    });
    let best = '';
    let bestCount = 0;
    counts.forEach((count, name) => {
      if (count > bestCount) {
        bestCount = count;
        best = name;
      }
    });
    return best;
  }, [facultyMeta.dept, localMatch.department, baseCourses]);
  const deptKey = React.useMemo(() => {
    if (isDeptExempt(facultyDept)) return '';
    return deptGroupKey(facultyDept);
  }, [facultyDept]);
  const matchesDeptProgram = React.useCallback((row) => {
    if (!deptKey) return true;
    const progKey = programGroupKey(
      row?.programcode
        ?? row?.program
        ?? row?.program_code
        ?? row?.programCode
        ?? row?.prospectus?.programcode
        ?? ''
    );
    if (progKey) return progKey === deptKey;
    const rowDeptKey = deptGroupKey(row?.dept ?? '');
    if (rowDeptKey) return rowDeptKey === deptKey;
    return false;
  }, [deptKey]);
  const filteredCourses = React.useMemo(() => {
    return (baseCourses || []).filter(c => matchesTarget(c) && matchesDeptProgram(c));
  }, [baseCourses, matchesTarget, matchesDeptProgram]);

  const sortedCourses = React.useMemo(() => mergeCourses(filteredCourses), [filteredCourses]);

  const sample = sortedCourses[0] || {};
  const facultyName = localMatch.facultyName || sample.facultyName || sample.faculty || sample.instructor || '';
  const department = facultyDept || sample.department || sample.dept || '';

  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');

  if ((loading || remoteLoading) && sortedCourses.length === 0) {
    return <LoadingState label="Loading faculty schedules..." />;
  }

  if (!facultyName && sortedCourses.length === 0) {
    return (
      <VStack align="center" spacing={4} py={10}>
        <Heading size="md">Faculty not found</Heading>
        <Text color={muted} fontSize="sm" textAlign="center">
          The public code may be invalid or does not have schedules for this term.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack spacing={4} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack spacing={4}>
          <Avatar size="lg" name={facultyName} />
          <Box>
            <Heading size="md">{facultyName || 'Faculty'}</Heading>
            <VStack align="start" spacing={1} mt={2}>
              <HStack spacing={2}>
                {department && <Badge colorScheme="blue">{department}</Badge>}
                <Badge colorScheme="green">Public View</Badge>
              </HStack>
              <Text fontSize="sm" color={muted}>
                School Year {TARGET_SY} | {TARGET_SEM} Semester 
              </Text>
            </VStack>
          </Box>
        </HStack>
      </HStack>

      {sortedCourses.length === 0 ? (
        <VStack align="center" spacing={3} py={12} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg}>
          <Heading size="sm">No schedules found</Heading>
          <Text color={muted} fontSize="sm" textAlign="center">
            There are no assigned schedules for this faculty in the selected terms.
          </Text>
        </VStack>
      ) : (
        <Box>
          <Box className="responsive-table table-fac-detail" borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
            <Table size={{ base: 'sm', md: 'md' }}>
              <Thead>
                <Tr>
                  <Th>Code</Th>
                  <Th>Title</Th>
                  <Th>Section</Th>
                  <Th>Units</Th>
                  <Th>Day</Th>
                  <Th>Time</Th>
                  <Th>Term</Th>
                  <Th>Room</Th>
                  <Th>Session</Th>
                  <Th>F2F</Th>
                </Tr>
              </Thead>
              <Tbody>
                {sortedCourses.map((c, idx) => (
                  <Tr key={`${c.id || c.scheduleKey || idx}`}>
                    <Td>{c.code || ''}</Td>
                    <Td>
                      <Text maxW="420px" noOfLines={2} whiteSpace="normal">
                        {c.title || ''}
                      </Text>
                    </Td>
                    <Td>{c.section || ''}</Td>
                    <Td>{c.unit ?? c.hours ?? ''}</Td>
                    <Td>{c.day || ''}</Td>
                    <Td>{c.schedule || c.time || ''}</Td>
                    <Td>{normalizeTermLabel(c.term) || c.term || ''}</Td>
                    <Td>{c.room || ''}</Td>
                    <Td>{c.session || ''}</Td>
                    <Td>{c.f2fSched || c.f2fsched || (Array.isArray(c.f2fDays) ? c.f2fDays.join(',') : '')}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}
    </VStack>
  );
}
