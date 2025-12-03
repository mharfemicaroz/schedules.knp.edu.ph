import React from 'react';
import { Fade,
  Box, HStack, VStack, Heading, Text, Input, Select, Button, Badge,
  useColorModeValue, Divider, Checkbox, useToast, Skeleton,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter
} from '@chakra-ui/react';
import { FiUpload, FiSearch, FiRefreshCw, FiPrinter } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { loadAllSchedules } from '../store/dataThunks';
// Using a local, unfiltered Prospectus dataset for independence from other views
// import { loadProspectusThunk } from '../store/prospectusThunks';
// import { selectAllProspectus, selectProspectusFilterOptions } from '../store/prospectusSlice';
import { selectBlocks } from '../store/blockSlice';
import { selectAllCourses } from '../store/dataSlice';
import { selectSettings } from '../store/settingsSlice';
import FacultySelect from './FacultySelect';
import AssignFacultyModal from './AssignFacultyModal';
import ScheduleHistoryModal from './ScheduleHistoryModal';
import AssignmentRow from './AssignmentRow';
import useFaculties from '../hooks/useFaculties';
import api from '../services/apiService';
import { buildTable, printContent } from '../utils/printDesign';

function parseBlockMeta(blockCode) {
  const s = String(blockCode || '').trim();
  if (!s) return { programcode: '', yearlevel: '', section: '' };
  let m = s.match(/^([A-Z0-9-]+)\s+(\d+)(?:[^\d]*)/i);
  if (m) {
    const programcode = (m[1] || '').toUpperCase();
    const yearlevel = m[2] || '';
    const secM = s.substring(m[0].length - (m[2]?.length || 0)).match(/\d+[-\s]*([A-Z0-9]+)$/i);
    const section = secM ? (secM[1] || '') : '';
    return { programcode, yearlevel, section };
  }
  const [head, rest] = s.split('-');
  if (rest) {
    const m2 = rest.match(/(\d+)(.*)/);
    const programcode = (head || '').toUpperCase();
    const yearlevel = m2 ? (m2[1] || '') : '';
    const section = m2 ? (m2[2] || '').trim() : '';
    return { programcode, yearlevel, section };
  }
  const m3 = s.match(/^(\D+?)(\d+)/);
  if (m3) {
    return { programcode: (m3[1] || '').replace(/[-\s]+$/,'').toUpperCase(), yearlevel: m3[2] || '', section: '' };
  }
  return { programcode: s.toUpperCase(), yearlevel: '', section: '' };
}

const termOptions = ['1st', '2nd', 'Sem'];
const dayOptions = ['MON-FRI', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const normalizeProgramCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const extractYearDigits = (val) => {
  const m = String(val ?? '').match(/(\d+)/);
  return m ? m[1] : '';
};
const toShortTerm = (s) => {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('1')) return '1st';
  if (v.startsWith('2')) return '2nd';
  if (v.startsWith('s')) return 'Sem';
  if (v.includes('summer')) return 'Sem';
  if (v.includes('1st semester')) return '1st';
  if (v.includes('2nd semester')) return '2nd';
  return s;
};
const toFullSemester = (t) => {
  const v = String(t || '').trim().toLowerCase();
  if (v.startsWith('1')) return '1st Semester';
  if (v.startsWith('2')) return '2nd Semester';
  if (v.startsWith('s')) return 'Summer';
  return t;
};

export default function CoursesView() {
  const toast = useToast();
  const dispatch = useDispatch();
  const bg = useColorModeValue('white','gray.800');
  const border = useColorModeValue('gray.200','gray.700');
  const subtle = useColorModeValue('gray.600','gray.300');
  const hoverBg = useColorModeValue('gray.50','whiteAlpha.100');
  const dividerBorder = useColorModeValue('gray.100','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const skStart = useColorModeValue('gray.100','gray.700');
  const skEnd = useColorModeValue('gray.200','gray.600');
  const overlayBg = useColorModeValue('whiteAlpha.600','blackAlpha.500');

  const settings = useSelector(selectSettings);
  const authUser = useSelector(s => s.auth && s.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const isAdmin = (role === 'admin' || role === 'manager');
  const settingsLoad = settings?.schedulesLoad || { school_year: '', semester: '' };
  const [attendanceStatsMap, setAttendanceStatsMap] = React.useState(new Map());
  const [allowedDepts, setAllowedDepts] = React.useState(null); // null=unknown, []=none
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!authUser?.id || isAdmin) { if (alive) setAllowedDepts(null); return; }
        const rows = await api.getUserDepartmentsByUser(authUser.id);
        const list = Array.isArray(rows) ? rows : [];
        const codes = Array.from(new Set(list.map(r => String(r.department || '').toUpperCase()).filter(Boolean)));
        if (alive) setAllowedDepts(codes);
      } catch {
        if (alive) setAllowedDepts([]);
      }
    })();
    return () => { alive = false; };
  }, [authUser?.id, isAdmin]);
  // Local prospectus cache (unfiltered)
  const [allProspectus, setAllProspectus] = React.useState([]);
  const blocks = useSelector(selectBlocks);
  const existing = useSelector(selectAllCourses);
  const { data: facultyOptions } = useFaculties();

  const [program, setProgram] = React.useState('');
  const [year, setYear] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [selectedCourse, setSelectedCourse] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const canLoad = (isAdmin || role === 'registrar' || (Array.isArray(allowedDepts) && allowedDepts.length > 0));

  // Load full Prospectus list once (independent from other views)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.getProspectus({});
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
        if (alive) setAllProspectus(items);
      } catch {
        if (alive) setAllProspectus([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const normalizeSem = (s) => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('1')) return '1st';
    if (v.startsWith('2')) return '2nd';
    if (v.startsWith('s')) return 'Sem';
    return s;
  };

  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
  const normCode = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim();

  const courseOptions = React.useMemo(() => {
    const wantSem = normalizeSem(settingsLoad?.semester || '');
    let list = (allProspectus || []).filter(p => {
      const progStr = String(p.programcode || p.program || '');
      const okProg = !program || progStr.toUpperCase().includes(String(program).toUpperCase());
      const okYear = !year || String(p.yearlevel || '').includes(String(year));
      const okSem = !wantSem || normalizeSem(p.semester) === wantSem;
      if (!okProg || !okYear || !okSem) return false;
      if (!query) return true;
      const hay = norm(p.courseName || p.course_name || p.courseTitle || p.course_title || '');
      return hay.includes(norm(query));
    });
    // Restrict to allowed departments for non-admin users
    try {
      if (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
        const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
        list = list.filter(p => allow.has(String(p.programcode || p.program || '').toUpperCase()));
      }
    } catch {}
    // Unique by code+title
    const keyOf = (p) => `${normCode(p.courseName || p.course_name)}|${norm(p.courseTitle || p.course_title)}`;
    const map = new Map();
    list.forEach(p => { const k = keyOf(p); if (!map.has(k)) map.set(k, p); });
    return Array.from(map.values()).sort((a,b) => String(a.courseName || '').localeCompare(String(b.courseName || '')));
  }, [allProspectus, program, year, query, settingsLoad?.semester, allowedDepts, isAdmin]);

  const scopedCourses = React.useMemo(() => {
    const sy = String(settingsLoad?.school_year || '').trim();
    const semShort = normalizeSem(settingsLoad?.semester || '');
    let out = Array.isArray(existing) ? existing : [];
    if (sy) out = out.filter(c => String(c.schoolyear || c.schoolYear || c.school_year || '') === sy);
    if (semShort) out = out.filter(c => normalizeSem(c.semester || c.term || c.sem || '') === semShort);
    return out;
  }, [existing, settingsLoad?.school_year, settingsLoad?.semester]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await api.getAttendanceStatsByFaculty();
        const map = new Map();
        (Array.isArray(rows) ? rows : []).forEach(r => {
          const fid = r.facultyId != null ? String(r.facultyId) : null;
          if (fid) map.set(fid, { total: Number(r.total || 0) || 0, byStatus: r.byStatus || r.by_status || {} });
        });
        if (alive) setAttendanceStatsMap(map);
      } catch (e) {
        if (alive) setAttendanceStatsMap(new Map());
      }
    })();
    return () => { alive = false; };
  }, [settingsLoad?.school_year, settingsLoad?.semester]);

  // Options for Program and Year (independent)
  const programOptions = React.useMemo(() => {
    const fromPros = Array.from(new Set((allProspectus || [])
      .map(p => String(p.programcode || p.program || '').toUpperCase())
      .filter(Boolean)));
    let out = fromPros;
    if (out.length === 0) {
      // Fallback to programs derived from blocks if Prospectus is unavailable
      const fromBlocks = Array.from(new Set((blocks || [])
        .map(b => parseBlockMeta(b.blockCode).programcode)
        .filter(Boolean)));
      out = fromBlocks;
    }
    try {
      if (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
        const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
        out = out.filter(p => allow.has(String(p || '').toUpperCase()));
      }
    } catch {}
    return out.slice().sort();
  }, [allProspectus, blocks, allowedDepts, isAdmin]);

  const yearOptions = React.useMemo(() => [
    { value: '1', label: '1st Year' },
    { value: '2', label: '2nd Year' },
    { value: '3', label: '3rd Year' },
    { value: '4', label: '4th Year' },
  ], []);

  // Build block rows for the selected course
  const [rows, setRows] = React.useState([]);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      if (!selectedCourse) { setRows([]); return; }
      const codeKey = normCode(selectedCourse.courseName || selectedCourse.course_name || selectedCourse.code);
      const titleKey = norm(selectedCourse.courseTitle || selectedCourse.course_title || selectedCourse.title);
      const courseProgRaw = normalizeProgramCode(selectedCourse.programcode || selectedCourse.program || program);
      const courseProgBase = normalizeProgramCode((courseProgRaw.split('-')[0] || courseProgRaw));
      const courseYear = extractYearDigits(selectedCourse.yearlevel || year);
      const blocksFor = (blocks || [])
        .filter(b => {
          const meta = parseBlockMeta(b.blockCode);
          const metaProg = normalizeProgramCode(meta.programcode || '');
          const metaProgBase = normalizeProgramCode((meta.programcode || '').split('-')[0] || '');
          const progMatch = (
            (!!courseProgRaw && (metaProg === courseProgRaw || metaProgBase === courseProgRaw || metaProg === courseProgBase || metaProgBase === courseProgBase)) ||
            (!courseProgRaw && (!!program ? metaProg.includes(normalizeProgramCode(program)) : true))
          );
          const metaYear = extractYearDigits(meta.yearlevel || '');
          const yearMatch = courseYear ? (metaYear === courseYear) : (!!year ? String(meta.yearlevel || '').includes(String(year)) : true);
          return progMatch && yearMatch;
        })
        .sort((a,b) => String(a.blockCode).localeCompare(String(b.blockCode)));

      // Try server-provided mapping if available
      let serverMap = null;
      try {
        serverMap = await api.getCourseMapping({ programcode: program, yearlevel: year, course: selectedCourse.courseName || selectedCourse.code });
      } catch {}

      const findExisting = (blockCode) => {
        // Prefer server map if provided
        if (serverMap && Array.isArray(serverMap.items)) {
          const hit = serverMap.items.find(x => String(x.blockCode) === String(blockCode));
          if (hit) return {
            id: hit.id,
            semester: hit.term || hit.semester,
            day: hit.day,
            schedule: hit.time || hit.schedule,
            time: hit.time || hit.schedule,
            faculty: hit.faculty || hit.instructor,
            facultyId: hit.facultyId || hit.faculty_id,
          };
        }
        const match = (existing || []).find(s => {
          const b = String(s.blockCode || s.block || '').trim();
          const cc = normCode(s.courseName || s.code || '');
          const tt = norm(s.title || s.courseTitle || '');
          return b === String(blockCode) && (cc === codeKey || tt === titleKey);
        });
        return match || null;
      };

      const initRows = blocksFor.map(b => {
        const e = findExisting(b.blockCode);
        const assigned = !!(e && e.id);
        const locked = String(e?.lock || '').toLowerCase();
        const baseTerm = toShortTerm(e?.term) || toShortTerm(e?.sem) || toShortTerm(e?.semester) || '';
        const baseTime = e?.schedule || e?.time || '';
        const baseDay = e?.day || 'MON-FRI';
        const baseFac = e?.faculty || e?.instructor || e?.facultyName || '';
        const baseFacId = e?.facultyId || e?.faculty_id || null;
        return {
          id: e?.id || `new:${b.id}:${codeKey}`,
          _existingId: e?.id || null,
          _status: assigned ? 'Assigned' : 'Unassigned',
          _locked: locked === 'yes' || locked === 'true' || locked === '1',
          blockId: b.id,
          blockCode: b.blockCode,
          courseName: selectedCourse.courseName || selectedCourse.code,
          courseTitle: selectedCourse.courseTitle || selectedCourse.title || '',
          unit: selectedCourse.unit,
          programcode: selectedCourse.programcode || selectedCourse.program || program,
          yearlevel: selectedCourse.yearlevel || year,
          session: b.session || null,
          _selected: false,
          _term: baseTerm,
          _day: baseDay,
          _time: baseTime,
          _faculty: baseFac,
          _facultyId: baseFacId,
          _baseTerm: baseTerm,
          _baseTime: baseTime,
          _baseDay: baseDay,
          _baseFaculty: baseFac,
          _baseFacultyId: baseFacId,
        };
      });
      if (!ignore) setRows(initRows);
    })();
    return () => { ignore = true; };
  }, [selectedCourse, program, year, blocks, existing, settings?.semester]);

  const anySelected = rows.some(r => r._selected);
  const canSave = anySelected && rows.filter(r => r._selected).every(r => r._term && r._time && (r._faculty || r._facultyId) && !r._checking && !r._conflict);
  const [saving, setSaving] = React.useState(false);
  const [lockTarget, setLockTarget] = React.useState(null); // true=lock, false=unlock
  const [lockIdxs, setLockIdxs] = React.useState([]);

  // ---------------------------- Load Limit Guard (non-admin) ----------------------------
  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const findFacultyById = (id) => {
    try { return (facultyOptions || []).find(f => String(f.id) === String(id)) || null; } catch (e) { return null; }
  };
  const findFacultyByName = (name) => {
    const key = normalizeName(name);
    try { return (facultyOptions || []).find(f => normalizeName(f.name || f.faculty || f.label) === key) || null; } catch (e) { return null; }
  };
  const employmentOf = (fac) => {
    const v = String(fac?.employment || '').toLowerCase();
    return v.includes('part') ? 'part-time' : 'full-time';
  };
  const maxUnitsFor = (fac) => employmentOf(fac) === 'part-time' ? 12 : 36;

  const ensureFacultyLoadLimitsForRows = async (rowsToApply) => {
    const nonAdminMapped = (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0);
    if (!nonAdminMapped) return true;
    const incByFaculty = new Map();
    for (const r of rowsToApply) {
      const targetId = r._facultyId != null ? r._facultyId : null;
      let targetName = r._faculty || '';
      if (!targetName && targetId != null) {
        const meta = findFacultyById(targetId);
        targetName = meta?.name || meta?.faculty || meta?.label || '';
      }
      if (!(targetId || targetName)) continue;
      const existingRow = r._existingId ? (existing || []).find(s => String(s.id) === String(r._existingId)) : null;
      const existingName = existingRow ? (existingRow.instructor || existingRow.faculty || '') : '';
      const same = existingRow ? (targetId != null ? String(existingRow.facultyId || existingRow.faculty_id || '') === String(targetId)
                                   : normalizeName(targetName) === normalizeName(existingName)) : false;
      const inc = same ? 0 : (Number(r.unit || 0) || 0);
      if (inc <= 0) continue;
      const key = targetId != null ? `id:${targetId}` : `nm:${normalizeName(targetName)}`;
      incByFaculty.set(key, (incByFaculty.get(key) || 0) + inc);
    }
    for (const [key, addUnits] of incByFaculty.entries()) {
      try {
        const isId = key.startsWith('id:');
        const ident = key.slice(3);
        const meta = isId ? findFacultyById(ident) : findFacultyByName(ident);
        const name = meta?.name || meta?.faculty || meta?.label || '';
        const max = maxUnitsFor(meta);
        let current = 0;
        const sy = settingsLoad?.school_year || '';
        const sem = settingsLoad?.semester || '';
        if (meta?.id != null) {
          try { const lr = await api.getInstructorLoadById(meta.id, { schoolyear: sy, semester: sem }); current = Number(lr?.loadUnits || 0); } catch (e) { current = 0; }
        } else if (name) {
          try {
            const qs = new URLSearchParams();
            if (sy) qs.set('schoolyear', sy); if (sem) qs.set('semester', sem);
            const resp = await api.request(`/instructor/${encodeURIComponent(name)}/load${qs.toString()?`?${qs.toString()}`:''}`);
            current = Number(resp?.loadUnits || 0);
          } catch (e) { current = 0; }
        }
        const proposed = current + Number(addUnits || 0);
        if (proposed > max) {
          toast({ title: 'Load limit exceeded', description: `${name}: ${employmentOf(meta)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addUnits} → ${proposed}.`, status: 'warning' });
          return false;
        }
      } catch (e) {
        toast({ title: 'Load check failed', description: 'Could not verify faculty load.', status: 'error' });
        return false;
      }
    }
    return true;
  };
  const checkRowConflict = async (i, candRow) => {
    const row = candRow || rows[i];
    if (!row) return;
    const term = String(row._term || '').trim();
    const timeStr = String(row._time || '').trim();
    const hasFaculty = (row._facultyId != null) || (String(row._faculty || '').trim() !== '');
    if (!term || !timeStr || !hasFaculty) {
      setRows(prev => prev.map((r,idx) => idx===i ? { ...r, _checking: false } : r));
      return;
    }
    setRows(prev => prev.map((r,idx) => idx===i ? { ...r, _checking: true } : r));
    try {
      const payload = {
        term,
        time: timeStr,
        day: row._day || undefined,
        faculty: row._faculty || undefined,
        facultyId: row._facultyId || undefined,
        schoolyear: settingsLoad?.school_year,
        semester: toFullSemester(settingsLoad?.semester),
        blockCode: row.blockCode,
        courseName: row.courseName,
      };
      const idForCheck = row._existingId || 0;
      const res = await api.checkScheduleConflict(idForCheck, payload);
      const conflict = !!res?.conflict;
      const details = Array.isArray(res?.details) ? res.details.slice() : [];
      setRows(prev => prev.map((r,idx) => idx===i ? { ...r, _checking: false, _conflict: conflict, _conflictDetails: details, _status: conflict ? 'Conflict' : (r._existingId ? 'Assigned' : 'Unassigned') } : r));
    } catch (e) {
      setRows(prev => prev.map((r,idx) => idx===i ? { ...r, _checking: false } : r));
      toast({ title: 'Conflict check failed', description: e?.message || 'Could not check conflicts.', status: 'error' });
    }
  };

  const handleChange = (i, patch) => {
    const merged = { ...rows[i], ...patch };
    setRows(prev => prev.map((r,idx) => idx===i ? merged : r));
    if (['_term','_time','_day','_faculty','_facultyId'].some(k => Object.prototype.hasOwnProperty.call(patch, k))) {
      setTimeout(() => checkRowConflict(i, merged), 0);
    }
  };

  // Suggestions modal state
  const [suggOpen, setSuggOpen] = React.useState(false);
  const [suggIndex, setSuggIndex] = React.useState(null);
  const [suggBusy, setSuggBusy] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);
  const openSuggestions = async (i) => {
    const row = rows[i];
    if (!row) return;
    setSuggIndex(i);
    setSuggOpen(true);
    setSuggBusy(true);
    try {
      const payload = {
        term: row._term,
        time: row._time,
        day: row._day,
        faculty: row._faculty || undefined,
        facultyId: row._facultyId || undefined,
        schoolyear: settingsLoad?.school_year,
        semester: toFullSemester(settingsLoad?.semester),
        blockCode: row.blockCode,
        courseName: row.courseName,
      };
      const idFor = row._existingId || 0;
      const res = await api.getScheduleSuggestions(idFor, payload, { maxDepth: 3 });
      const plans = Array.isArray(res?.plans) ? res.plans : (Array.isArray(res) ? res : []);
      setSuggestions(plans);
    } catch (e) {
      setSuggestions([]);
      toast({ status: 'error', title: 'Failed to load suggestions', description: e?.message });
    } finally {
      setSuggBusy(false);
    }
  };

  // Conflict details modal state
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [conflictIndex, setConflictIndex] = React.useState(null);

  // Assign faculty modal state
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignIndex, setAssignIndex] = React.useState(null);
  const scheduleForAssign = React.useMemo(() => {
    const r = assignIndex != null ? rows[assignIndex] : null;
    if (!r) return null;
    return {
      id: r._existingId || null,
      code: r.courseName,
      courseName: r.courseName,
      title: r.courseTitle,
      courseTitle: r.courseTitle,
      section: r.blockCode,
      blockCode: r.blockCode,
      program: r.programcode || '',
      term: r._term,
      schedule: r._time,
      time: r._time,
      day: r._day,
      session: r.session,
      unit: r.unit,
      programcode: r.programcode,
      yearlevel: r.yearlevel,
      facultyId: r._facultyId,
      faculty: r._faculty,
    };
  }, [assignIndex, rows]);
  const handleAssignFromModal = async (fac) => {
    if (assignIndex == null) return;
    const facultyId = fac?.facultyId ?? fac?.id ?? fac?.value ?? null;
    const facultyName = fac?.facultyName ?? fac?.name ?? fac?.faculty ?? fac?.full_name ?? fac?.label ?? '';
    handleChange(assignIndex, { _facultyId: facultyId, _faculty: facultyName });
    setAssignOpen(false);
    setAssignIndex(null);
  };
  // Swap helpers (mirror Blocks/Faculty)
  const labelOfRow = (r) => {
    const code = r.courseName || '';
    const sec = r.blockCode || '';
    const t = r._term || '';
    const tm = r._time || '';
    return `${code} ${sec} • ${t} ${tm}`.trim();
  };
  const clearSwapSlot = (slot) => { if (slot === 'A') setSwapA(null); else setSwapB(null); };
  const addToSwap = (i) => {
    const r = rows[i];
    if (!r || !r._existingId) { toast({ status: 'info', title: 'Only existing schedules', description: 'Save a schedule before adding to swap.' }); return; }
    if (r._locked) { toast({ status: 'warning', title: 'Locked', description: 'Unlock the schedule before adding to swap.' }); return; }
    if (r._status === 'Conflict' || r._conflict) { toast({ status: 'warning', title: 'Resolve conflicts first' }); return; }
    const item = { id: r._existingId, label: labelOfRow(r) };
    if (!swapA) setSwapA(item); else if (!swapB) setSwapB(item); else { setSwapA(item); setSwapB(null); }
    toast({ status: 'success', title: 'Added to swap', description: item.label });
  };
  const swapNow = async () => {
    if (!swapA || !swapB || swapBusy) return;
    setSwapBusy(true);
    try {
      await api.swapSchedules(swapA.id, swapB.id);
      setSwapA(null); setSwapB(null);
      await reloadMapping();
      toast({ status: 'success', title: 'Swapped' });
    } catch (e) {
      toast({ status: 'error', title: 'Swap failed', description: e?.message });
    } finally { setSwapBusy(false); }
  };

  // Resolve conflict state
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [resolveBusy, setResolveBusy] = React.useState(false);
  const [resolveIndex, setResolveIndex] = React.useState(null);
  const [resolveConflictId, setResolveConflictId] = React.useState(null);
  const [resolveLabel, setResolveLabel] = React.useState('');
  const cancelRef = React.useRef();
  // Delete confirm state
  const [delOpen, setDelOpen] = React.useState(false);
  const [delBusy, setDelBusy] = React.useState(false);
  const [delIndex, setDelIndex] = React.useState(null);
  // Lock/Unlock confirm state
  const [lockOpen, setLockOpen] = React.useState(false);
  const [lockBusy, setLockBusy] = React.useState(false);
  const [lockIndex, setLockIndex] = React.useState(null);
  const [lockNext, setLockNext] = React.useState(false);
  // Mapping loader
  const [mapLoading, setMapLoading] = React.useState(false);
  // History modal state
  const [histOpen, setHistOpen] = React.useState(false);
  const [histScheduleId, setHistScheduleId] = React.useState(null);
  // Swap tray
  const [swapA, setSwapA] = React.useState(null);
  const [swapB, setSwapB] = React.useState(null);
  const [swapBusy, setSwapBusy] = React.useState(false);

  // Helper: reload schedules + remap current course rows
  const reloadMapping = React.useCallback(async () => {
    setMapLoading(true);
    try { await dispatch(loadAllSchedules()); } catch {}
    try {
      const serverMap = await api.getCourseMapping({ programcode: program || (selectedCourse?.programcode || selectedCourse?.program), yearlevel: year || selectedCourse?.yearlevel, course: selectedCourse?.courseName || selectedCourse?.code });
      const codeKey = normCode(selectedCourse.courseName || selectedCourse.course_name || selectedCourse.code);
      const titleKey = norm(selectedCourse.courseTitle || selectedCourse.course_title || selectedCourse.title);
      const courseProgRaw = normalizeProgramCode(selectedCourse.programcode || selectedCourse.program || program);
      const courseProgBase = normalizeProgramCode((courseProgRaw.split('-')[0] || courseProgRaw));
      const courseYear = extractYearDigits(selectedCourse.yearlevel || year);
      const blocksFor = (blocks || [])
        .filter(b => {
          const meta = parseBlockMeta(b.blockCode);
          const metaProg = normalizeProgramCode(meta.programcode || '');
          const metaProgBase = normalizeProgramCode((meta.programcode || '').split('-')[0] || '');
          const progMatch = ((metaProg === courseProgRaw) || (metaProgBase === courseProgRaw) || (metaProg === courseProgBase) || (metaProgBase === courseProgBase));
          const metaYear = extractYearDigits(meta.yearlevel || '');
          const yearMatch = courseYear ? (metaYear === courseYear) : true;
          return progMatch && yearMatch;
        })
        .sort((a,b) => String(a.blockCode).localeCompare(String(b.blockCode)));
      const findExistingFresh = (blockCode) => {
        if (serverMap && Array.isArray(serverMap.items)) {
          const hit = serverMap.items.find(x => String(x.blockCode) === String(blockCode));
          if (hit) return {
            id: hit.id,
            term: hit.term,
            semester: hit.semester || hit.sem,
            day: hit.day,
            schedule: hit.time || hit.schedule,
            time: hit.time || hit.schedule,
            faculty: hit.faculty || hit.instructor,
            facultyId: hit.facultyId || hit.faculty_id,
            lock: hit.lock,
          };
        }
        const match = (existing || []).find(s => {
          const b = String(s.blockCode || s.block || '').trim();
          const cc = normCode(s.courseName || s.code || '');
          const tt = norm(s.title || s.courseTitle || '');
          return b === String(blockCode) && (cc === codeKey || tt === titleKey);
        });
        return match || null;
      };
      const freshRows = blocksFor.map(b => {
        const e = findExistingFresh(b.blockCode);
        const assigned = !!(e && e.id);
        const locked = String(e?.lock || '').toLowerCase();
        const baseTerm = toShortTerm(e?.term) || toShortTerm(e?.sem) || toShortTerm(e?.semester) || '';
        const baseTime = e?.schedule || e?.time || '';
        const baseDay = e?.day || 'MON-FRI';
        const baseFac = e?.faculty || e?.instructor || e?.facultyName || '';
        const baseFacId = e?.facultyId || e?.faculty_id || null;
        return {
          id: e?.id || `new:${b.id}:${codeKey}`,
          _existingId: e?.id || null,
          _status: assigned ? 'Assigned' : 'Unassigned',
          _locked: locked === 'yes' || locked === 'true' || locked === '1',
          blockId: b.id,
          blockCode: b.blockCode,
          courseName: selectedCourse.courseName || selectedCourse.code,
          courseTitle: selectedCourse.courseTitle || selectedCourse.title || '',
          unit: selectedCourse.unit,
          programcode: selectedCourse.programcode || selectedCourse.program || program,
          yearlevel: selectedCourse.yearlevel || year,
          session: b.session || null,
          _selected: false,
          _term: baseTerm,
          _day: baseDay,
          _time: baseTime,
          _faculty: baseFac,
          _facultyId: baseFacId,
          _baseTerm: baseTerm,
          _baseTime: baseTime,
          _baseDay: baseDay,
          _baseFaculty: baseFac,
          _baseFacultyId: baseFacId,
        };
      });
      setRows(freshRows);
    } catch {}
    finally { setMapLoading(false); }
  }, [blocks, existing, program, selectedCourse, year, dispatch]);
  const openResolve = (i) => {
    const r = rows[i];
    if (!r || !Array.isArray(r._conflictDetails)) return;
    const withId = r._conflictDetails.find(d => d?.item && d.item.id);
    const cid = withId?.item?.id || null;
    const label = withId ? `${withId.item.code || ''} ${withId.item.section ? `(${withId.item.section})` : ''} ${withId.item.time || ''}` : (r.courseName || 'schedule');
    setResolveIndex(i);
    setResolveConflictId(cid);
    setResolveLabel(label);
    setResolveOpen(true);
  };
  const handleResolve = async () => {
    if (resolveIndex == null) return;
    const r = rows[resolveIndex];
    if (!r) return;
    setResolveBusy(true);
    try {
      const payload = {
        term: r._term,
        day: r._day,
        time: r._time,
        faculty: r._faculty || undefined,
        facultyId: r._facultyId || undefined,
        schoolyear: settingsLoad?.school_year,
        semester: toFullSemester(settingsLoad?.semester),
        blockCode: r.blockCode,
        block_id: r.blockId,
        programcode: r.programcode,
        courseName: r.courseName,
        courseTitle: r.courseTitle,
        unit: r.unit,
        yearlevel: r.yearlevel,
        session: r.session,
      };
      const idFor = r._existingId || 0;
      await reloadMapping();
      setResolveOpen(false);
      setResolveIndex(null);
      setResolveConflictId(null);
      setResolveLabel('');
      toast({ status: 'success', title: 'Resolved', description: 'Conflicting schedule replaced.' });
    } catch (e) {
      toast({ status: 'error', title: 'Resolve failed', description: e?.message || 'Could not resolve conflict.' });
    } finally {
      setResolveBusy(false);
    }
  };

  // Keep rows in sync when switching course/program/year or blocks list changes
  React.useEffect(() => {
    if (!selectedCourse) { setRows([]); return; }
    reloadMapping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, program, year, blocks]);

  const saveSelected = async () => {
    const chosen = rows.filter(r => r._selected && r._term && r._time && (r._faculty || r._facultyId) );
    if (chosen.length === 0) { toast({ title: 'Nothing to save', status: 'info' }); return; }
    setSaving(true);
    try {
      // Load limit guard for non-admin users
      const okLimit = await ensureFacultyLoadLimitsForRows(chosen);
      if (!okLimit) { setSaving(false); return; }
      let created = 0, updated = 0;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!(r._selected && r._term && r._time && (r._faculty || r._facultyId))) continue;
        const payload = {
          term: r._term,
          day: r._day,
          time: r._time,
          schedule: r._time,
          blockCode: r.blockCode,
          block_id: r.blockId,
          courseName: r.courseName,
          courseTitle: r.courseTitle,
          programcode: r.programcode,
          yearlevel: r.yearlevel,
          session: r.session,
          unit: r.unit,
          faculty: r._faculty || undefined,
          facultyId: r._facultyId || undefined,
          semester: toFullSemester(settingsLoad?.semester),
          schoolyear: settingsLoad?.school_year,
        };
        // Quick conflict check; skip conflicting rows
        try {
          const res = await api.checkScheduleConflict(r._existingId || 0, payload);
          if (res?.conflict) {
            toast({ status: 'error', title: 'Conflict detected', description: `${r.courseName} @ ${r.blockCode}` });
            continue;
          }
        } catch {}
        if (r._existingId) {
          await api.updateSchedule(r._existingId, payload);
          updated++;
          setRows(prev => prev.map((x, idx) => idx===i ? {
            ...x,
            _status: 'Assigned',
            _baseTerm: x._term || x._baseTerm || '',
            _baseTime: x._time || x._baseTime || '',
            _baseDay: x._day || x._baseDay || 'MON-FRI',
            _baseFaculty: x._faculty || x._baseFaculty || '',
            _baseFacultyId: x._facultyId != null ? x._facultyId : (x._baseFacultyId ?? null),
          } : x));
        } else {
          const res = await api.createSchedule(payload);
          const newId = (res && (res.id || res.data?.id)) || null;
          created++;
          setRows(prev => prev.map((x, idx) => idx===i ? {
            ...x,
            _existingId: newId,
            _status: 'Assigned',
            _baseTerm: x._term || x._baseTerm || '',
            _baseTime: x._time || x._baseTime || '',
            _baseDay: x._day || x._baseDay || 'MON-FRI',
            _baseFaculty: x._faculty || x._baseFaculty || '',
            _baseFacultyId: x._facultyId != null ? x._facultyId : (x._baseFacultyId ?? null),
          } : x));
        }
      }
      const msg = [`${updated} updated`, `${created} created`].filter(s => !/^0 /.test(s)).join(', ') || 'No changes';
      toast({ status: 'success', title: 'Saved', description: msg });
      await reloadMapping();
    } catch (e) {
      toast({ status: 'error', title: 'Save failed', description: e?.message || 'Could not save schedules.' });
    } finally {
      setSaving(false);
    }
  };

  const requestBulkLockChange = (nextLocked) => {
    const idxs = rows.map((r,i) => (r._selected && r._existingId ? i : -1)).filter(i => i >= 0);
    if (idxs.length === 0) return;
    setLockIdxs(idxs);
    setLockTarget(!!nextLocked);
    setLockOpen(true);
  };

  const confirmLockChange = async () => {
    if (!isAdmin && lockTarget === false) {
      setLockOpen(false);
      setLockIdxs([]);
      setLockTarget(null);
      toast({ title: 'Unauthorized', description: 'Only admin can unlock schedules.', status: 'warning' });
      return;
    }
    const idxs = lockIdxs.slice();
    if (idxs.length === 0) { setLockOpen(false); return; }
    const nextLocked = !!lockTarget;
    setLockBusy(true);
    try {
      let count = 0;
      for (const idx of idxs) {
        const r = rows[idx];
        if (!r || !r._existingId) continue;
        await api.updateSchedule(r._existingId, { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked });
        count++;
      }
      if (count > 0) await reloadMapping();
      setRows(prev => prev.map((r,i) => idxs.includes(i) ? { ...r, _locked: nextLocked } : r));
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', description: `${count} schedule(s) ${nextLocked ? 'locked' : 'unlocked'}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${nextLocked ? 'lock' : 'unlock'} schedules.`, status: 'error' });
    } finally {
      setLockBusy(false);
      setLockOpen(false);
      setLockIdxs([]);
      setLockTarget(null);
    }
  };

  const onPrintCourse = () => {
    if (!Array.isArray(rows) || rows.length === 0) { toast({ status: 'info', title: 'Nothing to print' }); return; }
    const code = selectedCourse?.courseName || selectedCourse?.code || '';
    const title = selectedCourse?.courseTitle || selectedCourse?.title || '';
    const prog = String(program || selectedCourse?.programcode || selectedCourse?.program || '').toUpperCase();
    const yr = String(year || selectedCourse?.yearlevel || '');
    const headers = ['Block', 'Term', 'Day', 'Time', 'Faculty'];
    const body = rows.map(r => [r.blockCode || '-', r._term || '-', r._day || '-', r._time || '-', r._faculty || '-']);
    const bodyHtml = buildTable(headers, body);
    const titleText = `Course Mapping: ${code} ${title ? `- ${title}` : ''}`.trim();
    const subtitle = [prog && `Program ${prog}`, yr && `Year ${yr}`, settingsLoad?.semester && `${settingsLoad.semester}`, settingsLoad?.school_year && `SY ${settingsLoad.school_year}`]
      .filter(Boolean).join(' • ');
    const prep = authUser?.username || authUser?.email || 'User';
    const preparedRole = (authUser?.role || '').toString();
    printContent({ title: titleText, subtitle, bodyHtml }, { pageSize: 'A4', orientation: 'landscape', compact: true, preparedBy: prep, preparedRole });
  };

  return (
    <HStack align="start" spacing={3}>
      <Box w={{ base: '100%', lg: '320px' }} borderWidth="1px" borderColor={border} rounded="lg" p={3} bg={bg}>
        <VStack align="stretch" spacing={3}>
          <Heading size="sm">Courses</Heading>
          <Select placeholder="Select program" value={program} onChange={(e)=>{ setProgram(e.target.value); setSelectedCourse(null); }}>
            {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select placeholder="Select year" value={year} onChange={(e)=>{ setYear(e.target.value); setSelectedCourse(null); }}>
            {yearOptions.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
          </Select>
          <HStack>
            <Input placeholder="Search course" value={query} onChange={(e)=>setQuery(e.target.value)} />
            <Button leftIcon={<FiSearch />} onClick={()=>{ /* no-op; live filter */ }}>
              Search
            </Button>
          </HStack>
          <Divider />
          <VStack align="stretch" spacing={2} maxH="45vh" overflowY="auto">
            {loading && Array.from({length:6}).map((_,i)=> <Skeleton key={i} height="18px" />)}
            {!loading && courseOptions.map((c, idx) => (
              <Box key={`${c.programcode}-${c.yearlevel}-${idx}`} role="button" borderWidth="1px" borderColor={border} rounded="md" p={2}
                   onClick={()=> setSelectedCourse(c)} _hover={{ bg: hoverBg }}>
                <HStack justify="space-between">
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="600">{c.courseName || c.code}</Text>
                    <Text fontSize="sm" color={subtle}>{c.courseTitle}</Text>
                  </VStack>
                  <HStack>
                    <Badge colorScheme="blue">{c.programcode}</Badge>
                    <Badge>{c.yearlevel}</Badge>
                  </HStack>
                </HStack>
              </Box>
            ))}
            {!loading && courseOptions.length === 0 && (
              <Text fontSize="sm" color={subtle}>No courses match filters.</Text>
            )}
          </VStack>
        </VStack>
      </Box>

      <Box flex="1" borderWidth="1px" borderColor={border} rounded="lg" p={3} bg={bg} position="relative">
        {!selectedCourse && (
          <VStack py={10} spacing={2}>
            <Heading size="sm">Select a course</Heading>
            <Text color={subtle}>Filter by program and year, then pick a course.</Text>
          </VStack>
        )}
        {selectedCourse && (
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between">
              <HStack>
                <Heading size="sm">{selectedCourse.courseName}</Heading>
                <Text color={subtle}>({selectedCourse.courseTitle})</Text>
              </HStack>
              <HStack>
                <Badge colorScheme="blue">{program || selectedCourse.programcode}</Badge>
                <Badge>Year {year || selectedCourse.yearlevel}</Badge>
                <Badge colorScheme="purple">{settingsLoad?.semester}</Badge>
              </HStack>
            </HStack>
            <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
              <HStack spacing={3} align="center" flexWrap="wrap">
                <Checkbox isChecked={rows.length>0 && rows.every(r => r._selected)}
                          isIndeterminate={rows.some(r => r._selected) && !rows.every(r => r._selected)}
                          onChange={(e)=> setRows(prev => prev.map(r => ({ ...r, _selected: !!e.target.checked })))}>
                  Select all
                </Checkbox>
                <Badge colorScheme={rows.some(r=>r._selected)?'blue':'gray'}>{rows.filter(r=>r._selected).length} selected</Badge>
                <Button size="sm" leftIcon={<FiUpload />} colorScheme="blue" onClick={saveSelected} isDisabled={!canSave || saving} isLoading={saving}>
                  Save Selected
                </Button>
                <Button size="sm" leftIcon={<FiPrinter />} variant="outline" onClick={onPrintCourse} isDisabled={loading || rows.length === 0}>Print</Button>
                <Divider orientation="vertical" />
                <Badge colorScheme={swapA ? 'blue' : 'gray'}>A</Badge>
                <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapA ? swapA.label : 'Add a schedule to slot A'}</Text>
                {swapA && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('A')}>Clear</Button>}
                <Divider orientation="vertical" />
                <Badge colorScheme={swapB ? 'purple' : 'gray'}>B</Badge>
                <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapB ? swapB.label : 'Add a schedule to slot B'}</Text>
                {swapB && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('B')}>Clear</Button>}
                <Button size="sm" leftIcon={<FiRefreshCw />} colorScheme="blue" onClick={swapNow} isDisabled={!swapA || !swapB || swapBusy} isLoading={swapBusy}>Swap Now</Button>
                <Divider orientation="vertical" />
                <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(true)} isDisabled={!canLoad || rows.every(r => !r._selected || !r._existingId || r._locked)}>
                  Lock Selected
                </Button>
                <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(false)} isDisabled={!isAdmin || rows.every(r => !r._selected || !r._existingId || !r._locked)}>
                  Unlock Selected
                </Button>
              </HStack>
            </Box>
            <VStack align="stretch" spacing={0} divider={<Divider borderColor={border} />}>
              {rows.map((r, i) => (
                <AssignmentRow
                  key={`${r.blockCode}-${i}`}
                  row={r}
                  faculties={facultyOptions || []}
                  schedulesSource={existing || []}
                  allCourses={existing || []}
                  statsCourses={scopedCourses || []}
                  blockCode={r.blockCode}
                  blockSession={r.session || ''}
                  attendanceStats={attendanceStatsMap}
                  disabled={false}
                  isAdmin={isAdmin}
                  variant="courses"
                  onChange={(patch)=>handleChange(i, patch)}
                  onToggle={(ck)=>handleChange(i, { _selected: !!ck })}
                  onRequestLockChange={(next)=>{ if (r._existingId) { setLockIndex(i); setLockNext(!!next); setLockOpen(true); } }}
                  onRequestAssign={() => { setAssignIndex(i); setAssignOpen(true); }}
                  onRequestDelete={async () => {
                    if (!r._existingId) return;
                    setDelIndex(i);
                    setDelOpen(true);
                  }}
                  onRequestAddToSwap={() => addToSwap(i)}
                  onRequestResolve={() => openResolve(i)}
                  onRequestHistory={() => { if (r._existingId) { setHistScheduleId(r._existingId); setHistOpen(true); } }}
                  onRequestConflictInfo={() => { setConflictIndex(i); setConflictOpen(true); }}
                  onRequestSuggest={() => openSuggestions(i)}
                />
              ))}
              {rows.length === 0 && (
                <Box py={6}><Text color={subtle}>No blocks found for selected program and year.</Text></Box>
              )}
            </VStack>
            {/* Overlay skeleton while mapping loads */}
            <Fade in={mapLoading} unmountOnExit>
              <Box position="absolute" inset={0} bg={overlayBg} backdropFilter="blur(1.5px)" zIndex={1}>
                <VStack align="stretch" spacing={2} p={3}>
                  {Array.from({ length: Math.max(6, Math.min(12, rows.length || 8)) }).map((_, i) => (
                    <HStack key={`sk-${i}`} py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '56px', md: '64px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '80px', md: '96px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '82px', md: '92px' }} height="16px" rounded="sm" />
                      <Box flex="1 1 auto" minW={0}>
                        <HStack spacing={2} align="center">
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="120px" rounded="sm" />
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="28px" rounded="full" />
                        </HStack>
                        <Skeleton startColor={skStart} endColor={skEnd} height="12px" mt={1} width="60%" rounded="sm" />
                      </Box>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '120px', md: '160px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '180px', md: '240px' }} height="16px" rounded="sm" />
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </Fade>
          </VStack>
        )}
      </Box>
      {/* Resolve conflict dialog */}
      <AlertDialog isOpen={resolveOpen} onClose={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveIndex(null); setResolveConflictId(null); setResolveLabel(''); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Resolve conflict?</AlertDialogHeader>
            <AlertDialogBody>
              This will delete the existing conflicting schedule <b>{resolveLabel || 'schedule'}</b> and save your new assignment for this course. This action cannot be undone. Proceed?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveIndex(null); setResolveConflictId(null); setResolveLabel(''); } }}>Cancel</Button>
              <Button colorScheme="purple" ml={3} isLoading={resolveBusy} onClick={handleResolve}>Resolve</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* History modal */}
      <ScheduleHistoryModal scheduleId={histScheduleId} isOpen={histOpen} onClose={()=>{ setHistOpen(false); setHistScheduleId(null); }} />

      {/* Lock/Unlock confirmation (supports single row and bulk) */}
      <AlertDialog isOpen={lockOpen} onClose={()=>{ if (!lockBusy) { setLockOpen(false); setLockIndex(null); setLockIdxs([]); setLockTarget(null); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{(Array.isArray(lockIdxs) && lockIdxs.length>0 ? lockTarget : lockNext) ? (Array.isArray(lockIdxs) && lockIdxs.length>0 ? 'Lock selected schedule(s)?' : 'Lock schedule?') : (Array.isArray(lockIdxs) && lockIdxs.length>0 ? 'Unlock selected schedule(s)?' : 'Unlock schedule?')}</AlertDialogHeader>
            <AlertDialogBody>
              {(Array.isArray(lockIdxs) && lockIdxs.length>0 ? lockTarget : lockNext)
                ? 'This will lock the schedule(s) to prevent further edits.'
                : 'This will unlock the schedule(s) for editing.'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!lockBusy) { setLockOpen(false); setLockIndex(null); setLockIdxs([]); setLockTarget(null); } }}>Cancel</Button>
              <Button colorScheme={(Array.isArray(lockIdxs) && lockIdxs.length>0 ? lockTarget : lockNext) ? 'blue' : 'gray'} ml={3} isLoading={lockBusy}
                onClick={async ()=>{
                  if (Array.isArray(lockIdxs) && lockIdxs.length>0) {
                    await confirmLockChange();
                    return;
                  }
                  if (lockIndex == null) return;
                  const r = rows[lockIndex];
                  if (!r || !r._existingId) { setLockOpen(false); setLockIndex(null); return; }
                  setLockBusy(true);
                  try {
                    await api.updateSchedule(r._existingId, { lock: lockNext ? 'yes' : 'no' });
                    await reloadMapping();
                    toast({ status: 'success', title: lockNext ? 'Locked' : 'Unlocked' });
                  } catch (e) {
                    toast({ status: 'error', title: 'Update failed', description: e?.message });
                  } finally {
                    setLockBusy(false);
                    setLockOpen(false);
                    setLockIndex(null);
                  }
                }}
              >{(Array.isArray(lockIdxs) && lockIdxs.length>0 ? lockTarget : lockNext) ? 'Lock' : 'Unlock'}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={delOpen} onClose={()=>{ if (!delBusy) { setDelOpen(false); setDelIndex(null); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete schedule?</AlertDialogHeader>
            <AlertDialogBody>
              This will permanently delete the selected schedule assignment. Proceed?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!delBusy) { setDelOpen(false); setDelIndex(null); } }}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={delBusy} onClick={async ()=>{
                if (delIndex == null) return;
                const r = rows[delIndex];
                if (!r || !r._existingId) { setDelOpen(false); setDelIndex(null); return; }
                setDelBusy(true);
                try {
                  await api.deleteSchedule(r._existingId);
                  try { await dispatch(loadAllSchedules()); } catch {}
                  try {
                    const serverMap = await api.getCourseMapping({ programcode: program || (selectedCourse?.programcode || selectedCourse?.program), yearlevel: year || selectedCourse?.yearlevel, course: selectedCourse?.courseName || selectedCourse?.code });
                    const codeKey = normCode(selectedCourse.courseName || selectedCourse.course_name || selectedCourse.code);
                    const titleKey = norm(selectedCourse.courseTitle || selectedCourse.course_title || selectedCourse.title);
                    const courseProgRaw = normalizeProgramCode(selectedCourse.programcode || selectedCourse.program || program);
                    const courseProgBase = normalizeProgramCode((courseProgRaw.split('-')[0] || courseProgRaw));
                    const courseYear = extractYearDigits(selectedCourse.yearlevel || year);
                    const blocksFor = (blocks || [])
                      .filter(b => {
                        const meta = parseBlockMeta(b.blockCode);
                        const metaProg = normalizeProgramCode(meta.programcode || '');
                        const metaProgBase = normalizeProgramCode((meta.programcode || '').split('-')[0] || '');
                        const progMatch = ((metaProg === courseProgRaw) || (metaProgBase === courseProgRaw) || (metaProg === courseProgBase) || (metaProgBase === courseProgBase));
                        const metaYear = extractYearDigits(meta.yearlevel || '');
                        const yearMatch = courseYear ? (metaYear === courseYear) : true;
                        return progMatch && yearMatch;
                      })
                      .sort((a,b) => String(a.blockCode).localeCompare(String(b.blockCode)));
                    const findExistingFresh = (blockCode) => {
                      if (serverMap && Array.isArray(serverMap.items)) {
                        const hit = serverMap.items.find(x => String(x.blockCode) === String(blockCode));
                        if (hit) return {
                          id: hit.id,
                          term: hit.term,
                          semester: hit.semester || hit.sem,
                          day: hit.day,
                          schedule: hit.time || hit.schedule,
                          time: hit.time || hit.schedule,
                          faculty: hit.faculty || hit.instructor,
                          facultyId: hit.facultyId || hit.faculty_id,
                          lock: hit.lock,
                        };
                      }
                      const match = (existing || []).find(s => {
                        const b = String(s.blockCode || s.block || '').trim();
                        const cc = normCode(s.courseName || s.code || '');
                        const tt = norm(s.title || s.courseTitle || '');
                        return b === String(blockCode) && (cc === codeKey || tt === titleKey);
                      });
                      return match || null;
                    };
                    const freshRows = blocksFor.map(b => {
                      const e = findExistingFresh(b.blockCode);
                      const assigned = !!(e && e.id);
                      const locked = String(e?.lock || '').toLowerCase();
                      return {
                        id: e?.id || `new:${b.id}:${codeKey}`,
                        _existingId: e?.id || null,
                        _status: assigned ? 'Assigned' : 'Unassigned',
                        _locked: locked === 'yes' || locked === 'true' || locked === '1',
                        blockId: b.id,
                        blockCode: b.blockCode,
                        courseName: selectedCourse.courseName || selectedCourse.code,
                        courseTitle: selectedCourse.courseTitle || selectedCourse.title || '',
                        unit: selectedCourse.unit,
                        programcode: selectedCourse.programcode || selectedCourse.program || program,
                        yearlevel: selectedCourse.yearlevel || year,
                        session: b.session || null,
                        _selected: false,
                        _term: toShortTerm(e?.term) || toShortTerm(e?.sem) || toShortTerm(e?.semester) || '',
                        _day: e?.day || 'MON-FRI',
                        _time: e?.schedule || e?.time || '',
                        _faculty: e?.faculty || e?.instructor || e?.facultyName || '',
                        _facultyId: e?.facultyId || e?.faculty_id || null,
                      };
                    });
                    setRows(freshRows);
                  } catch {}
                  toast({ status: 'success', title: 'Deleted', description: 'Schedule removed.' });
                } catch (e) {
                  toast({ status: 'error', title: 'Delete failed', description: e?.message });
                } finally {
                  setDelBusy(false);
                  setDelOpen(false);
                  setDelIndex(null);
                }
              }}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
      {/* Conflict details modal */}
      <Modal isOpen={conflictOpen} onClose={()=>{ setConflictOpen(false); setConflictIndex(null); }} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Conflict details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {conflictIndex != null && Array.isArray(rows[conflictIndex]?._conflictDetails) && rows[conflictIndex]._conflictDetails.length > 0 ? (
              <VStack align="stretch" spacing={2}>
                {rows[conflictIndex]._conflictDetails.map((d, idx) => (
                  <Box key={`cd-${idx}`} borderWidth="1px" rounded="md" p={2}>
                    <Text fontWeight="600">{d.reason || 'Conflict'}</Text>
                    {d.item && (
                      <Text fontSize="sm" color={subtle}>
                        {d.item.code || ''} • {d.item.section || ''} • {d.item.time || ''}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text fontSize="sm" color={subtle}>No conflict details.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Suggestions modal */}
      <Modal isOpen={suggOpen} onClose={()=>{ if (!suggBusy) { setSuggOpen(false); setSuggIndex(null); setSuggestions([]); } }} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Suggestions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {suggBusy ? (
              <VStack align="stretch" spacing={2}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <HStack key={`sg-skel-${i}`} py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                    <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="40%" rounded="sm" />
                    <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="12px" width="30%" rounded="sm" />
                  </HStack>
                ))}
              </VStack>
            ) : (
              <VStack align="stretch" spacing={2}>
                {(suggestions || []).map((p, idx) => (
                  <Box key={`sg-${idx}`} borderWidth="1px" rounded="md" p={2}>
                    <Text fontWeight="600">{p.label || 'Plan'}</Text>
                    {Array.isArray(p.steps) && p.steps.length > 0 && (
                      <VStack align="start" spacing={1} mt={1}>
                        {p.steps.map((s, i2) => (
                          <Text key={`st-${idx}-${i2}`} fontSize="sm" color={subtle}>• {s.course} {s.section ? `(${s.section})` : ''}: {s.from} → {s.to}</Text>
                        ))}
                      </VStack>
                    )}
                  </Box>
                ))}
                {(!suggestions || suggestions.length === 0) && <Text fontSize="sm" color={subtle}>No suggestions available.</Text>}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Assign Faculty modal */}
      <AssignFacultyModal
        isOpen={assignOpen}
        onClose={()=>{ setAssignOpen(false); setAssignIndex(null); }}
        schedule={scheduleForAssign}
        onAssign={handleAssignFromModal}
        schoolyear={settingsLoad?.school_year}
        semester={settingsLoad?.semester}
        attendanceStats={attendanceStatsMap}
      />
      {/* Bulk Lock/Unlock confirmation (reuses lockOpen/lockBusy dialog; single-lock dialog handles idx flows) */}
    </HStack>
  );
}
