import React from 'react';
import { Box, Heading, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Input, IconButton, Button, Badge, Tooltip, chakra, Progress, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Spinner, Center, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Select, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import FacultySelect from '../components/FacultySelect';
import Pagination from '../components/Pagination';
import { selectAllCourses } from '../store/dataSlice';
import { selectAllFaculty } from '../store/facultySlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { loadAllSchedules, loadAcademicCalendar } from '../store/dataThunks';
import { FiEdit, FiChevronUp, FiChevronDown, FiX } from 'react-icons/fi';
import { updateScheduleThunk } from '../store/dataThunks';
import GradesSummaryCharts from '../components/GradesSummaryCharts';
import { selectSettings } from '../store/settingsSlice';
import { getUserDepartmentsByUserThunk } from '../store/userDeptThunks';
import { selectUserDeptItems } from '../store/userDeptSlice';
import { selectBlocks } from '../store/blockSlice';
import { loadBlocksThunk } from '../store/blockThunks';

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(d) {
  if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function sanitize(s) { return String(s ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '').replace(/\\/g,'').trim(); }
function findGradesDueDate(acadData, termLabel) {
  try {
    const cal = Array.isArray(acadData) ? acadData[0]?.academic_calendar : acadData?.[0]?.academic_calendar;
    if (!cal) return null;
    const isFirst = String(termLabel || '').toLowerCase().includes('1');
    const term = isFirst ? cal.first_semester?.first_term : cal.first_semester?.second_term;
    const acts = Array.isArray(term?.activities) ? term.activities : [];
    const hit = acts.find(a => {
      const ev = sanitize(a.event || '');
      return /submission of grades/i.test(ev) && (isFirst ? /1st/i.test(ev) : /2nd/i.test(ev));
    });
    const raw = hit?.date || hit?.date_range || null;
    if (!raw) return null;
    if (Array.isArray(raw)) return parseDate(raw[raw.length - 1]);
    if (typeof raw === 'string' && /\d+\s*-\s*\d+/.test(raw)) {
      const m = raw.match(/^(\w+)\s+(\d+)\s*-\s*(\d+),\s*(\d{4})$/);
      if (m) return parseDate(`${m[1]} ${m[3]}, ${m[4]}`);
    }
    return parseDate(raw);
  } catch { return null; }
}
function computeStatus(submitted, due) {
  if (!submitted) return null;
  if (!due) return 'ontime';
  const s = new Date(submitted); s.setHours(0,0,0,0);
  const d = new Date(due); d.setHours(23,59,59,999);
  if (s.getTime() < d.getTime() - 24*60*60*1000 + 1) return 'early';
  if (s.getTime() <= d.getTime()) return 'ontime';
  return 'late';
}
const statusColor = (st) => st === 'early' ? 'green' : st === 'ontime' ? 'blue' : st === 'late' ? 'red' : 'gray';
const statusLabel = (st) => st ? (st === 'ontime' ? 'On Time' : (st.charAt(0).toUpperCase() + st.slice(1))) : 'No Submission';
const toDateInput = (d) => { if (!d) return ''; const yy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
const fromDateInput = (s) => s ? new Date(`${s}T00:00:00`) : null;
const ALWAYS_ALLOW = new Set(['GENED','PARTTIME','KNP PARTTIME','KNP-PARTTIME']);
const programBase = (s) => {
  const txt = String(s || '').trim().toUpperCase();
  if (!txt) return '';
  const head = txt.split('-')[0] || txt;
  return head;
};
const blockBase = (s) => {
  const txt = String(s || '').trim().toUpperCase();
  if (!txt) return '';
  const token = (txt.split(/\s+/)[0] || txt).replace(/[^A-Z0-9-]/g, '');
  const m = token.match(/^([A-Z]+)(?:-[A-Z]+)?/); // grab leading program stem before digits/sections
  if (m && m[1]) return m[1];
  const head = token.split('-')[0] || token;
  return head.replace(/[^A-Z]/g, '');
};
const courseBlockBase = (c) => blockBase(c?.blockCode ?? c?.block_code ?? c?.blockcode ?? c?.block ?? c?.section ?? '');

export default function AdminGradesSubmission() {
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);
  const allCourses = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const loadingData = useSelector(s => s.data.loading);
  const blocks = useSelector(selectBlocks);
  // Source faculty profiles from Faculty API (not schedule-derived),
  // so department filtering uses faculty.dept as the source of truth
  const facultyList = useSelector(selectAllFaculty);
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const isAdmin = roleStr === 'admin' || roleStr === 'manager';
  const isRegistrar = roleStr === 'registrar';
  const isPrivileged = isAdmin || isRegistrar;
  const canEditDate = roleStr === 'admin' || roleStr === 'manager';
  const canConfirm = roleStr === 'admin' || roleStr === 'manager' || roleStr === 'registrar';
  const canClear = roleStr === 'admin';
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.300');
  const muted = subtle;
  const accordionExpandedBg = useColorModeValue('gray.50','whiteAlpha.100');
  const userDeptItems = useSelector(selectUserDeptItems);
  const normalizeDept = (s) => String(s || '').trim().toUpperCase();
  const baseDept = (s) => {
    const txt = normalizeDept(s);
    if (!txt) return '';
    const m = txt.split(/[\s-]/)[0] || txt;
    return m;
  };
  const ALL_DEPT = '__ALL__';
  const allowedDeptSet = React.useMemo(() => {
    try {
      return new Set((Array.isArray(userDeptItems) ? userDeptItems : [])
        .map((d) => normalizeDept(d.department || ''))
        .filter(Boolean));
    } catch {
      return new Set();
    }
  }, [userDeptItems]);
  const allowedDeptBaseSet = React.useMemo(() => {
    const set = new Set();
    allowedDeptSet.forEach((d) => { const b = baseDept(d); if (b) set.add(b); });
    return set;
  }, [allowedDeptSet]);
  const allowDept = React.useCallback((dept) => {
    if (isPrivileged) return true;
    const d = normalizeDept(dept);
    if (!d) return false;
    if (ALWAYS_ALLOW.has(d)) return true;
    const b = baseDept(d);
    if (allowedDeptSet.has(d)) return true;
    if (allowedDeptBaseSet.has(b)) return true;
    return false;
  }, [isPrivileged, allowedDeptSet, allowedDeptBaseSet]);

  const [selectedFaculty, setSelectedFaculty] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [tempDate, setTempDate] = React.useState('');
  const [sortBy, setSortBy] = React.useState('code');
  const [sortOrder, setSortOrder] = React.useState('asc'); // 'asc' | 'desc'
  const [expanded, setExpanded] = React.useState([]); // indices of expanded faculty accordions
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [groupSortBy, setGroupSortBy] = React.useState('faculty'); // 'faculty' | 'pct'
  const [groupSortOrder, setGroupSortOrder] = React.useState('asc'); // 'asc' | 'desc'
  const [deptFilter, setDeptFilter] = React.useState(ALL_DEPT);
  const [empFilter, setEmpFilter] = React.useState('');
  const confirmDisc = useDisclosure();
  const [confirmMode, setConfirmMode] = React.useState(null); // 'submit' | 'save'
  const [pendingCourse, setPendingCourse] = React.useState(null);
  const [pendingDate, setPendingDate] = React.useState('');
  const blockBaseFromCourse = React.useCallback((c) => {
    if (!c) return '';
    const bid = c.blockId ?? c.block_id ?? c.blockid;
    const codeRaw = c.blockCode ?? c.block_code ?? c.blockcode ?? c.block ?? c.section;
    let blk = null;
    if (bid != null) {
      blk = (blocks || []).find(b => String(b.id) === String(bid));
    }
    if (!blk && codeRaw) {
      const normCode = String(codeRaw).toUpperCase();
      blk = (blocks || []).find(b => String(b.blockCode || b.block_code || '').toUpperCase() === normCode);
    }
    const prog = blk?.programcode ?? blk?.program ?? '';
    if (prog) return programBase(prog);
    return blockBase(codeRaw || '');
  }, [blocks]);
  const normalizeSemLabel = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return '';
    if (s.startsWith('1')) return '1st Semester';
    if (s.startsWith('2')) return '2nd Semester';
    if (s.startsWith('s')) return 'Summer';
    if (s.includes('summer')) return 'Summer';
    return v;
  };
  const canonicalTerm = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return '';
    if (s.startsWith('1')) return '1st';
    if (s.startsWith('2')) return '2nd';
    if (s.startsWith('s')) return 'Sem';
    return v;
  };

  const defaultSy = settings?.schedulesView?.school_year || '';
  const defaultSem = normalizeSemLabel(settings?.schedulesView?.semester || '');
  const [summarySy, setSummarySy] = React.useState(defaultSy);
  const [summarySem, setSummarySem] = React.useState(defaultSem);
  const [summaryDept, setSummaryDept] = React.useState('');
  const [summaryTerm, setSummaryTerm] = React.useState('');
  const deptOptions = React.useMemo(() => {
    const set = new Set();
    (facultyList || []).forEach(f => {
      const d = String(f.dept ?? f.department ?? '').trim();
      if (d) set.add(d);
    });
    // Add base department codes for collapsed access (e.g., BSED-MATH -> BSED)
    if (!isPrivileged) {
      allowedDeptBaseSet.forEach((b) => { if (b) set.add(b); });
    }
    const arr = Array.from(set).filter(d => (isPrivileged ? true : allowDept(d))).sort((a,b)=>a.localeCompare(b));
    ALWAYS_ALLOW.forEach(v => { if (!arr.includes(v)) arr.push(v); });
    const withAll = [ALL_DEPT, ...arr];
    return withAll;
  }, [facultyList, isPrivileged, allowDept, allowedDeptBaseSet]);
  const viewDeptOptions = React.useMemo(() => deptOptions, [deptOptions]);
  const matchesDeptFilter = React.useCallback((dept, filter) => {
    if (!filter || filter === ALL_DEPT) return true;
    const nd = normalizeDept(dept);
    const nf = normalizeDept(filter);
    if (!nf) return true;
    if (nd === nf) return true;
    const bd = baseDept(dept);
    const bf = baseDept(filter);
    if (bd && bf && bd === bf) return true;
    return false;
  }, [normalizeDept, baseDept]);
  const matchesGroupDept = React.useCallback((group, filter) => {
    if (!filter || filter === ALL_DEPT) return true;
    const nf = normalizeDept(filter);
    const bf = baseDept(filter);
    const hasDept = (dept) => {
      if (!dept) return false;
      if (matchesDeptFilter(dept, filter)) return true;
      const nd = normalizeDept(dept);
      const bd = baseDept(dept);
      if (nf && nd && nf === nd) return true;
      if (bf && bd && bf === bd) return true;
      return false;
    };
    if (matchesDeptFilter(group?.department, filter)) {
      // For always-allowed buckets, ensure the group also teaches a user-allowed dept/program
      if (!isPrivileged && ALWAYS_ALLOW.has(nf || filter)) {
        const intersectsAllowed =
          (group?.deptSet instanceof Set && Array.from(group.deptSet).some(d => {
            const nd = normalizeDept(d);
            const bd = baseDept(d);
            return allowedDeptSet.has(nd) || allowedDeptBaseSet.has(bd);
          })) ||
          (group?.deptBaseSet instanceof Set && Array.from(group.deptBaseSet).some(b => allowedDeptBaseSet.has(b))) ||
          (group?.progBaseSet instanceof Set && Array.from(group.progBaseSet).some(p => allowedDeptBaseSet.has(p))) ||
          (group?.blockBaseSet instanceof Set && Array.from(group.blockBaseSet).some(b => allowedDeptBaseSet.has(b)));
        if (!intersectsAllowed) return false;
      }
      return true;
    }
    // Check schedule-derived dept sets
    if (nf && group?.deptSet instanceof Set && group.deptSet.has(nf)) {
      if (!isPrivileged && ALWAYS_ALLOW.has(nf)) {
        const intersectsAllowed =
          Array.from(group.deptBaseSet || []).some(b => allowedDeptBaseSet.has(b)) ||
          Array.from(group.progBaseSet || []).some(p => allowedDeptBaseSet.has(p)) ||
          Array.from(group.blockBaseSet || []).some(b => allowedDeptBaseSet.has(b));
        if (!intersectsAllowed) return false;
      }
      return true;
    }
    if (bf && group?.deptBaseSet instanceof Set && group.deptBaseSet.has(bf)) {
      if (!isPrivileged && ALWAYS_ALLOW.has(nf)) {
        const intersectsAllowed =
          Array.from(group.deptBaseSet || []).some(b => allowedDeptBaseSet.has(b)) ||
          Array.from(group.progBaseSet || []).some(p => allowedDeptBaseSet.has(p)) ||
          Array.from(group.blockBaseSet || []).some(b => allowedDeptBaseSet.has(b));
        if (!intersectsAllowed) return false;
      }
      return true;
    }
    // Fallback: scan items if present
    if (Array.isArray(group?.items)) {
      const hit = group.items.some(it => hasDept(it.dept) || (bf && programBase(it.programcode || it.program || '') === bf) || (bf && courseBlockBase(it) === bf));
      if (hit && !isPrivileged && ALWAYS_ALLOW.has(nf || filter)) {
        const intersectsAllowed = Array.isArray(group.items) && group.items.some(it => {
          const nd = normalizeDept(it.dept);
          const bd = baseDept(it.dept);
          const pb = programBase(it.programcode || it.program || '');
          const bb = courseBlockBase(it);
          return allowedDeptSet.has(nd) || allowedDeptBaseSet.has(bd) || allowedDeptBaseSet.has(pb) || allowedDeptBaseSet.has(bb);
        });
        if (!intersectsAllowed) return false;
      }
      if (hit) return true;
    }
    return false;
  }, [matchesDeptFilter, normalizeDept, baseDept, isPrivileged, allowedDeptSet, allowedDeptBaseSet, blockBase]);
  const renderDeptLabel = (v) => {
    if (v === ALL_DEPT) return isPrivileged ? 'All Departments' : 'All (My Departments)';
    return v;
  };

  React.useEffect(() => {
    if (!acadData) dispatch(loadAcademicCalendar());
    // schedules are loaded in App, but safe to refresh lightweight
    if (!allCourses || allCourses.length === 0) dispatch(loadAllSchedules());
    // ensure we have up-to-date faculty profiles for dept/employment filters
    dispatch(loadFacultiesThunk({ limit: 100000 }));
    // load blocks for reliable block-program mapping
    dispatch(loadBlocksThunk({}));
    // seed summary filters from settings when available
    setSummarySy(defaultSy);
    setSummarySem(defaultSem);
    if (!isPrivileged && authUser?.id) {
      dispatch(getUserDepartmentsByUserThunk(authUser.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!isPrivileged && viewDeptOptions.length > 0) {
      setDeptFilter((prev) => prev || ALL_DEPT);
      setSummaryDept((prev) => prev || ALL_DEPT);
    }
  }, [isPrivileged, viewDeptOptions]);

  const filteredCoursesAll = React.useMemo(() => {
    let list = Array.isArray(allCourses) ? allCourses : [];
    if (!isPrivileged) {
      list = list.filter(c => {
        const bb = courseBlockBase(c);
        const bblock = blockBaseFromCourse(c);
        if (allowedDeptBaseSet.has(bblock)) return true;
        if (allowedDeptBaseSet.has(bb)) return true;
        const pb = programBase(c.programcode || c.program || '');
        if (allowedDeptBaseSet.has(pb)) return true;
        const nd = normalizeDept(c.dept);
        // For always-allowed tags (GENED/PARTTIME), only allow if block/program intersects allowed base set
        if (ALWAYS_ALLOW.has(nd)) {
          return false;
        }
        if (allowDept(c.dept)) return true;
        return false;
      });
    }
    return list;
  }, [allCourses, isPrivileged, allowDept, allowedDeptBaseSet, normalizeDept, blockBaseFromCourse, courseBlockBase, programBase]);

  const rowsBase = React.useMemo(() => {
    const list = Array.isArray(filteredCoursesAll) ? filteredCoursesAll : [];
    if (!selectedFaculty) return list;
    const norm = (s) => String(s || '').toLowerCase().trim();
    return list.filter(c => norm(c.facultyName || c.faculty || '') === norm(selectedFaculty));
  }, [filteredCoursesAll, selectedFaculty]);

  const summaryFilteredCourses = React.useMemo(() => {
    const normSem = (v) => normalizeSemLabel(v);
    const targetSy = String(summarySy || '').trim();
    const targetSem = normSem(summarySem);
    const targetTerm = canonicalTerm(summaryTerm);
    const targetDept = String(summaryDept || '').trim();
    return (filteredCoursesAll || []).filter((c) => {
      if (targetSy) {
        const sy = String(c.sy || c.schoolyear || c.schoolYear || '').trim();
        if (sy !== targetSy) return false;
      }
      if (targetSem) {
        const sem = normSem(c.sem || c.semester);
        if (sem !== targetSem) return false;
      }
      if (targetTerm) {
        const term = canonicalTerm(c.term);
        if (term !== targetTerm) return false;
      }
      if (targetDept) {
        const d = String(c.dept || '').trim();
        if (!matchesDeptFilter(d, targetDept)) return false;
      }
      return true;
    });
  }, [filteredCoursesAll, summarySy, summarySem, summaryDept, summaryTerm, normalizeSemLabel, canonicalTerm, matchesDeptFilter]);

  // Smooth large updates without blocking UI
  const rows = React.useDeferredValue(rowsBase);

  // Order terms consistently (1st, 2nd, Sem)
  const termOrder = (label) => {
    const s = String(label || '').toLowerCase();
    if (s.startsWith('1')) return 1;
    if (s.startsWith('2')) return 2;
    if (s.includes('sem')) return 3;
    return 9;
  };

  const profileMap = React.useMemo(() => {
    const map = new Map();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    (facultyList || []).forEach(f => {
      const nameKey = norm(f.name || f.faculty);
      if (nameKey) map.set(nameKey, f);
      // Also index by ID as string for potential lookups
      if (f.id != null) map.set(String(f.id), f);
    });
    return map;
  }, [facultyList]);

  const facultyGroups = React.useMemo(() => {
    const map = new Map();
    rows.forEach((c) => {
      const key = c.facultyName || c.faculty || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const arr = Array.from(map.entries()).map(([faculty, items]) => {
      const submitted = items.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
      const total = items.length;
      const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
      // Build term groups per faculty here to avoid recomputing in render
      const termMap = new Map();
      // Track departments from schedules as fallback when profile lacks dept
      const deptSet = new Set();
      const deptBaseSet = new Set();
      const progBaseSet = new Set();
      const blockBaseSet = new Set();
      items.forEach((it) => {
        const t = String(it.term || 'N/A');
        if (!termMap.has(t)) termMap.set(t, []);
        termMap.get(t).push(it);
        const d = normalizeDept(it.dept || '');
        if (d) {
          deptSet.add(d);
          const b = baseDept(d);
          if (b) deptBaseSet.add(b);
        }
        const pb = programBase(it.programcode || it.program || '');
        if (pb) progBaseSet.add(pb);
        const bb = blockBaseFromCourse(it) || courseBlockBase(it);
        if (bb) blockBaseSet.add(bb);
      });
      // Pull department and employment from Faculty API profile (dept as source of truth)
      const prof = profileMap.get(norm(faculty));
      const dept = prof?.dept ?? prof?.department ?? '';
      const employment = prof?.employment || '';
      const terms = Array.from(termMap.entries()).map(([term, tItems]) => {
        const s = tItems.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
        const tot = tItems.length;
        const pp = tot > 0 ? Math.round((s / tot) * 100) : 0;
        return { term, items: tItems, submitted: s, total: tot, pct: pp };
      }).sort((a,b) => termOrder(a.term) - termOrder(b.term));
      return { faculty, items, submitted, total, pct, terms, department: dept, employment, deptSet, deptBaseSet, progBaseSet, blockBaseSet };
    });
    arr.sort((a,b) => a.faculty.localeCompare(b.faculty));
    return arr;
  }, [rows, normalizeDept, baseDept, programBase, blockBaseFromCourse, courseBlockBase]);



  const empOptions = React.useMemo(() => {
    const set = new Set();
    (facultyList || []).forEach(f => {
      const e = String(f.employment || '').trim();
      if (e) set.add(e);
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [facultyList]);
  const syOptions = React.useMemo(() => {
    const set = new Set();
    (filteredCoursesAll || []).forEach(c => {
      const sy = String(c.sy || c.schoolyear || c.schoolYear || '').trim();
      if (sy) set.add(sy);
    });
    if (defaultSy) set.add(defaultSy);
    return Array.from(set).sort();
  }, [allCourses, defaultSy]);
  const semOptions = ['1st Semester', '2nd Semester', 'Summer'];

  const filteredFacultyGroups = React.useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    return facultyGroups.filter(g => {
      if (deptFilter && !matchesGroupDept(g, deptFilter)) return false;
      if (empFilter && norm(g.employment) !== norm(empFilter)) return false;
      return true;
    });
  }, [facultyGroups, deptFilter, empFilter, matchesGroupDept]);

  const sortedFacultyGroups = React.useMemo(() => {
    const arr = filteredFacultyGroups.slice();
    arr.sort((a, b) => {
      let cmp;
      if (groupSortBy === 'pct') {
        cmp = (a.pct - b.pct);
      } else if (groupSortBy === 'dept') {
        cmp = String(a.department || '').localeCompare(String(b.department || ''));
      } else if (groupSortBy === 'employment') {
        cmp = String(a.employment || '').localeCompare(String(b.employment || ''));
      } else {
        cmp = String(a.faculty || '').localeCompare(String(b.faculty || ''));
      }
      return groupSortOrder === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredFacultyGroups, groupSortBy, groupSortOrder]);

  const filterGroupItems = React.useCallback((g) => {
    const nf = normalizeDept(deptFilter);
    const bf = baseDept(deptFilter);
    const filterIsAlways = ALWAYS_ALLOW.has(nf);
    let items = Array.isArray(g.items) ? g.items : [];
    if (!isPrivileged && filterIsAlways) {
      items = items.filter((it) => {
        const bd = baseDept(it.dept);
        const pb = programBase(it.programcode || it.program || '');
        const bb = blockBaseFromCourse(it) || courseBlockBase(it);
        return allowedDeptBaseSet.has(bd) || allowedDeptBaseSet.has(pb) || allowedDeptBaseSet.has(bb);
      });
    } else if (deptFilter && deptFilter !== ALL_DEPT) {
      items = items.filter((it) => {
        if (matchesDeptFilter(it.dept, deptFilter)) return true;
        const pb = programBase(it.programcode || it.program || '');
        const bb = blockBaseFromCourse(it) || courseBlockBase(it);
        if (bf && pb && bf === pb) return true;
        if (bf && bb && bf === bb) return true;
        return false;
      });
    }
    if (!isPrivileged && !filterIsAlways && (!deptFilter || deptFilter === ALL_DEPT)) {
      items = items.filter((it) => {
        const bd = baseDept(it.dept);
        const pb = programBase(it.programcode || it.program || '');
        const bb = blockBaseFromCourse(it) || courseBlockBase(it);
        return allowedDeptBaseSet.has(bd) || allowedDeptBaseSet.has(pb) || allowedDeptBaseSet.has(bb);
      });
    }
    const termMap = new Map();
    items.forEach((it) => {
      const t = String(it.term || 'N/A');
      if (!termMap.has(t)) termMap.set(t, []);
      termMap.get(t).push(it);
    });
    const terms = Array.from(termMap.entries()).map(([term, tItems]) => {
      const s = tItems.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
      const tot = tItems.length;
      const pp = tot > 0 ? Math.round((s / tot) * 100) : 0;
      return { term, items: tItems, submitted: s, total: tot, pct: pp };
    }).sort((a,b) => termOrder(a.term) - termOrder(b.term));
    const submitted = items.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
    const total = items.length;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    if (!isPrivileged && total === 0) return null;
    return { ...g, items, terms, submitted, total, pct };
  }, [deptFilter, isPrivileged, allowedDeptBaseSet, matchesDeptFilter, normalizeDept, baseDept, programBase, blockBaseFromCourse, courseBlockBase]);

  const groupsWithItems = React.useMemo(() => {
    return sortedFacultyGroups.map(filterGroupItems).filter(Boolean);
  }, [sortedFacultyGroups, filterGroupItems]);
  // Reset expansion when underlying filtered set size changes
  React.useEffect(() => { setExpanded([]); }, [groupsWithItems.length]);

  // Pagination of faculty groups to improve performance
  const pageCount = React.useMemo(() => Math.max(1, Math.ceil(groupsWithItems.length / pageSize)), [groupsWithItems.length, pageSize]);
  const pagedFacultyGroups = React.useMemo(() => {
    const p = Math.max(1, Math.min(page, pageCount));
    const start = (p - 1) * pageSize;
    return groupsWithItems.slice(start, start + pageSize);
  }, [groupsWithItems, page, pageSize, pageCount]);

  const displayedFacultyGroups = React.useMemo(() => pagedFacultyGroups, [pagedFacultyGroups]);
  React.useEffect(() => { setPage((prev) => Math.min(prev, pageCount)); }, [pageCount]);
  React.useEffect(() => { setPage(1); setExpanded([]); }, [groupSortBy, groupSortOrder, deptFilter, empFilter]);
  React.useEffect(() => { setExpanded([]); }, [page, pageSize]);
  const allIdx = React.useMemo(() => displayedFacultyGroups.map((_, i) => i), [displayedFacultyGroups]);
  const allExpanded = expanded.length === displayedFacultyGroups.length && displayedFacultyGroups.length > 0;
  const toggleAll = () => setExpanded(allExpanded ? [] : allIdx);

  const dayIndex = (d) => {
    if (!d) return 99;
    const str = String(d).toLowerCase();
    const map = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 };
    // pick earliest day present
    const tokens = str.split(/[\s,\/]+/).filter(Boolean);
    let best = 99;
    for (const t of tokens) {
      const key = t.slice(0,3);
      if (key in map) best = Math.min(best, map[key]);
    }
    return best;
  };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const statusOrder = { early: 0, ontime: 1, late: 2 };
  const valueForSort = (c, key) => {
    switch (key) {
      case 'code': return String(c.code || c.courseName || '').toLowerCase();
      case 'title': return String(c.title || c.courseTitle || '').toLowerCase();
      case 'section': return String(c.section || c.blockCode || '').toLowerCase();
      case 'time': {
        if (Number.isFinite(c.timeStartMinutes)) return c.timeStartMinutes;
        const m = String(c.scheduleKey || '').match(/^(\d+)-(\d+)$/);
        if (m) return parseInt(m[1], 10);
        return String(c.schedule || c.time || '').toLowerCase();
      }
      case 'day': return dayIndex(c.day);
      case 'gradesSubmitted': {
        const dt = parseDate(c.gradesSubmitted);
        return dt ? dt.getTime() : -Infinity;
      }
      case 'gradesStatus': {
        const due = findGradesDueDate(acadData, c.term);
        const submitted = parseDate(c.gradesSubmitted);
        const eff = c.gradesStatus || computeStatus(submitted, due) || null;
        return eff ? statusOrder[eff] ?? 99 : 99;
      }
      default: return '';
    }
  };
  const sortItems = React.useCallback((items) => {
    if (!Array.isArray(items) || !items.length) return items || [];
    const list = items.slice();
    list.sort((a, b) => {
      const va = valueForSort(a, sortBy);
      const vb = valueForSort(b, sortBy);
      const r = cmp(va, vb);
      return sortOrder === 'asc' ? r : -r;
    });
    return list;
  }, [sortBy, sortOrder, acadData]);

  // Confirmation helpers
  const askConfirmSubmit = (c) => {
    setPendingCourse(c);
    setPendingDate(toDateInput(new Date()));
    setConfirmMode('submit');
    confirmDisc.onOpen();
  };
  const askConfirmSaveDate = (c) => {
    setPendingCourse(c);
    setPendingDate(tempDate);
    setConfirmMode('save');
    confirmDisc.onOpen();
  };
  const askConfirmClear = (c) => {
    setPendingCourse(c);
    setPendingDate('');
    setConfirmMode('clear');
    confirmDisc.onOpen();
  };
  const handleConfirm = async () => {
    const c = pendingCourse;
    if (!c) { confirmDisc.onClose(); return; }
    try {
      if (confirmMode === 'submit') {
        const now = new Date();
        const due = findGradesDueDate(acadData, c.term);
        const status = computeStatus(now, due);
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: now.toISOString(), gradesStatus: status } }));
      } else if (confirmMode === 'save') {
        const d = fromDateInput(pendingDate);
        const due = findGradesDueDate(acadData, c.term);
        const status = computeStatus(d, due);
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: d ? d.toISOString() : null, gradesStatus: d ? status : null } }));
        setEditingId(null);
        setTempDate('');
      } else if (confirmMode === 'clear') {
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: null, gradesStatus: null } }));
      }
      dispatch(loadAllSchedules());
    } finally {
      confirmDisc.onClose();
      setPendingCourse(null);
      setConfirmMode(null);
    }
  };

  const onSort = (key) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('asc');
      return key;
    });
  };

  const SortableTh = ({ id, children }) => {
    const active = sortBy === id;
    const color = active ? 'brand.500' : subtle;
    return (
      <Th cursor="pointer" onClick={() => onSort(id)} userSelect="none">
        <HStack spacing={1}>
          <chakra.span color={color} fontWeight={active ? '800' : '600'}>{children}</chakra.span>
          {active && (sortOrder === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
        </HStack>
      </Th>
    );
  };

  const confirmSubmit = async (c) => {
    const now = new Date(); const due = findGradesDueDate(acadData, c.term); const status = computeStatus(now, due);
    await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: now.toISOString(), gradesStatus: status } }));
    dispatch(loadAllSchedules());
  };
  const saveEditedDate = async (c) => {
    const d = fromDateInput(tempDate); const due = findGradesDueDate(acadData, c.term); const status = computeStatus(d, due);
    await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: d ? d.toISOString() : null, gradesStatus: d ? status : null } }));
    setEditingId(null); setTempDate('');
    dispatch(loadAllSchedules());
  };

  if (!isPrivileged && allowedDeptSet.size === 0) {
    return (
      <Box borderWidth="1px" borderColor={border} rounded="xl" p={6} bg={bg}>
        <Heading size="md" mb={2}>Grades Submission</Heading>
        <Text color={subtle}>You need a department assignment to view this page.</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Tabs colorScheme="blue" isLazy>
        <TabList mb={3}>
          <Tab>Faculty</Tab>
          <Tab>Summary</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Grades Submission</Heading>
        <HStack spacing={2}>
          {isPrivileged && (
            <Box minW={{ base: '220px', md: '360px' }}>
              <FacultySelect value={selectedFaculty} onChange={setSelectedFaculty} allowClear placeholder="Filter by faculty" />
            </Box>
          )}
          <HStack spacing={1}>
            <Select
              size="sm"
              placeholder="Employment"
              value={empFilter}
              onChange={(e)=>setEmpFilter(e.target.value)}
              maxW="160px"
            >
              <option value="">All Employment</option>
              {empOptions.map(v => (<option key={v} value={v}>{v}</option>))}
            </Select>
            {isPrivileged && (
              <>
                <Select size="sm" value={groupSortBy} onChange={(e)=>setGroupSortBy(e.target.value)} maxW="160px">
                  <option value="faculty">Sort: Faculty Name</option>
                  <option value="pct">Sort: Percentage</option>
                  <option value="dept">Sort: Dept</option>
                  <option value="employment">Sort: Employment</option>
                </Select>
                <Select size="sm" value={groupSortOrder} onChange={(e)=>setGroupSortOrder(e.target.value)} maxW="120px">
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </Select>
              </>
            )}
          </HStack>
          <Button size="sm" variant="outline" onClick={toggleAll}>{allExpanded ? 'Collapse All' : 'Expand All'}</Button>
        </HStack>
      </HStack>

      {/* Faculty-level summary with progress + collapsible schedules */}
      {loadingData && (
        <Center py={10}>
          <Spinner mr={3} />
          <Text color={muted}>Loading grades submission…</Text>
        </Center>
      )}



      <Accordion allowMultiple index={expanded} onChange={(idx) => setExpanded(Array.isArray(idx) ? idx : [idx])}>
        {displayedFacultyGroups.map((g, idx) => (
          <AccordionItem key={g.faculty} border="none" mb={3}>
            <h2>
              <AccordionButton borderWidth="1px" borderColor={border} rounded="md" _expanded={{ bg: accordionExpandedBg }} px={{ base: 3, md: 4 }} py={{ base: 3, md: 3 }}>
                <VStack align="stretch" flex={1} spacing={1} pr={2}>
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <Heading size="sm" noOfLines={1}>{g.faculty}</Heading>
                    {g.department && (<Badge colorScheme="blue" variant="subtle">{g.department}</Badge>)}
                    {g.employment && (<Badge colorScheme="green" variant="subtle">{g.employment}</Badge>)}
                    <Badge colorScheme={g.pct >= 90 ? 'green' : g.pct >= 70 ? 'blue' : g.pct >= 40 ? 'orange' : 'red'} variant="subtle">{g.submitted}/{g.total} ({g.pct}%)</Badge>
                  </HStack>
                  <Progress value={g.pct} size="sm" rounded="md" colorScheme={g.pct >= 90 ? 'green' : g.pct >= 70 ? 'blue' : g.pct >= 40 ? 'orange' : 'red'} />
                </VStack>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              {(g.terms || []).map((tg) => (
                  <Box key={tg.term} mb={4}>
                    <HStack justify="space-between" px={2} mb={2}>
                      <HStack>
                        <Heading size="sm">Term: {tg.term}</Heading>
                        <Badge colorScheme={tg.pct >= 90 ? 'green' : tg.pct >= 70 ? 'blue' : tg.pct >= 40 ? 'orange' : 'red'} variant="subtle">{tg.submitted}/{tg.total} ({tg.pct}%)</Badge>
                      </HStack>
                    </HStack>
                    <Progress value={tg.pct} size="xs" rounded="md" mb={2} colorScheme={tg.pct >= 90 ? 'green' : tg.pct >= 70 ? 'blue' : tg.pct >= 40 ? 'orange' : 'red'} />
                    <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} overflowX="auto">
                      <Table size={{ base: 'sm', md: 'md' }}>
                        <Thead>
                          <Tr>
                            <SortableTh id="code">Code</SortableTh>
                            <SortableTh id="title">Title</SortableTh>
                            <SortableTh id="section">Section</SortableTh>
                            <SortableTh id="time">Time</SortableTh>
                            <SortableTh id="day">Day</SortableTh>
                            <SortableTh id="gradesSubmitted">Grade Submitted</SortableTh>
                            <SortableTh id="gradesStatus">Grade Status</SortableTh>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {sortItems(tg.items).map((c) => {
                            const submitted = parseDate(c.gradesSubmitted);
                            const due = findGradesDueDate(acadData, c.term);
                            const computed = computeStatus(submitted, due);
                            const effective = c.gradesStatus || computed || null;
                            return (
                              <Tr key={c.id}>
                                <Td>{c.code || c.courseName || '—'}</Td>
                                <Td>
                                  <Text maxW={{ base: 'unset', md: '380px' }} noOfLines={{ base: 2, md: 1 }} whiteSpace="normal" wordBreak="break-word">{c.title || c.courseTitle || '—'}</Text>
                                </Td>
                                <Td>{c.section || c.blockCode || '—'}</Td>
                                <Td>{c.schedule || c.time || '—'}</Td>
                                <Td>{c.day || '—'}</Td>
                                <Td>
                                  {editingId === c.id ? (
                                    canEditDate ? (
                                      <HStack>
                                        <Input type="date" size="sm" value={tempDate} onChange={(e)=>setTempDate(e.target.value)} />
                                  <Button size="xs" colorScheme="blue" onClick={()=>askConfirmSaveDate(c)}>Save</Button>
                                        <Button size="xs" variant="ghost" onClick={()=>{ setEditingId(null); setTempDate(''); }}>Cancel</Button>
                                      </HStack>
                                    ) : (
                                      <Text>{submitted ? formatDate(submitted) : '—'}</Text>
                                    )
                                  ) : (
                                    <HStack>
                                      <Text>{submitted ? formatDate(submitted) : '—'}</Text>
                                      {canEditDate && (
                                        <Tooltip label={submitted ? 'Edit submitted date' : 'Set submitted date'}>
                                          <IconButton aria-label="Edit Grade Date" icon={<FiEdit />} size="xs" variant="ghost" onClick={()=>{ setEditingId(c.id); setTempDate(toDateInput(submitted || new Date())); }} />
                                        </Tooltip>
                                      )}
                                      {canClear && submitted && (
                                        <Tooltip label="Clear submitted date">
                                          <IconButton aria-label="Clear" icon={<FiX />} size="xs" variant="ghost" colorScheme="red" onClick={()=>askConfirmClear(c)} />
                                        </Tooltip>
                                      )}
                                      {!submitted && canConfirm && (
                                         <Button size="xs" colorScheme="green" onClick={()=>askConfirmSubmit(c)}>Confirm Submit</Button>
                                      )}
                                    </HStack>
                                  )}
                                </Td>
                                <Td>
                                  <Badge colorScheme={statusColor(effective)} variant="subtle">{statusLabel(effective)}</Badge>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                ))}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Bottom pagination */}
      <Box mt={3}>
        <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
      </Box>

      {/* Confirmation Dialog */}
      <AlertDialog isOpen={confirmDisc.isOpen} onClose={confirmDisc.onClose} leastDestructiveRef={undefined} isCentered>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>
            {confirmMode === 'submit' ? 'Confirm Grade Submission' : confirmMode === 'save' ? 'Confirm Save Date' : 'Clear Submitted Date'}
          </AlertDialogHeader>
          <AlertDialogBody>
            {confirmMode === 'submit' ? (
              <VStack align="stretch" spacing={1}>
                <Text>Proceed to mark this schedule as submitted?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={muted}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            ) : confirmMode === 'save' ? (
              <VStack align="stretch" spacing={1}>
                <Text>Save the selected submitted date for this schedule?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={muted}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            ) : (
              <VStack align="stretch" spacing={1}>
                <Text>Remove the submitted date and status for this schedule?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={muted}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            )}
          </AlertDialogBody>
      <AlertDialogFooter>
        <Button variant="ghost" onClick={confirmDisc.onClose}>Cancel</Button>
        <Button colorScheme="blue" onClick={handleConfirm} ml={3}>Confirm</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

          </TabPanel>
          <TabPanel px={0}>
            <VStack align="stretch" spacing={3} mb={4}>
              <HStack spacing={2} flexWrap="wrap">
                <Select
                  placeholder={isPrivileged ? "School Year (All)" : undefined}
                  value={summarySy}
                  onChange={(e)=>setSummarySy(e.target.value)}
                  maxW="180px"
                  size="sm"
                >
                  {syOptions.map(sy => <option key={sy} value={sy}>{sy}</option>)}
                </Select>
                <Select
                  placeholder={isPrivileged ? "Semester (All)" : undefined}
                  value={summarySem}
                  onChange={(e)=>setSummarySem(e.target.value)}
                  maxW="200px"
                  size="sm"
                >
                  {semOptions.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                </Select>
                <Select
              placeholder={isPrivileged ? "Department (All)" : undefined}
              value={summaryDept}
              onChange={(e)=>setSummaryDept(e.target.value)}
              maxW="200px"
              size="sm"
            >
                  {viewDeptOptions.map(d => <option key={d} value={d}>{renderDeptLabel(d)}</option>)}
                </Select>
                <Select
                  placeholder={isPrivileged ? "Term (All)" : undefined}
                  value={summaryTerm}
                  onChange={(e)=>setSummaryTerm(e.target.value)}
                  maxW="160px"
                  size="sm"
                >
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="Sem">Sem</option>
                </Select>
                {isPrivileged && (
                  <Button size="sm" variant="ghost" onClick={()=>{ setSummarySy(''); setSummarySem(''); setSummaryDept(''); setSummaryTerm(''); }}>Clear Filters</Button>
                )}
              </HStack>
            </VStack>
            <GradesSummaryCharts courses={summaryFilteredCourses} facultyList={facultyList || []} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
