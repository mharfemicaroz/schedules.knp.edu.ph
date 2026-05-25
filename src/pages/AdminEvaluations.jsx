import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Select,
  Button,
  Badge,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Divider,
  Skeleton,
  Wrap,
  WrapItem,
  InputGroup,
  InputLeftElement,
  Stack,
  ButtonGroup,
  TableContainer,
} from '@chakra-ui/react';
import { FiBarChart2, FiEye, FiSearch, FiRefreshCw, FiFilter, FiUsers, FiBookOpen, FiClipboard } from 'react-icons/fi';
import apiService from '../services/apiService';
import { printEvaluationSummary } from '../utils/printEvaluation';
import { useDispatch, useSelector } from 'react-redux';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectProspectusFilterOptions, selectAllProspectus } from '../store/prospectusSlice';
import { selectSettings } from '../store/settingsSlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { selectAllFaculty } from '../store/facultySlice';

const QUESTIONS = [
  'Lessons are presented in a clear, structured, and organized manner.',
  'Concepts and ideas are explained in an understandable and meaningful way.',
  'Feedback on activities and assessments is timely and helpful for improvement.',
  'Class discussions and learning activities reflect strong subject-matter expertise.',
  'Teaching methods used in class effectively support student engagement.',
  'Opportunities to ask questions and express ideas are openly encouraged.',
  'Students are treated with fairness, respect, and professionalism at all times.',
  'Assessments and grading practices are aligned with the learning objectives.',
  'Support and assistance outside regular class hours are accessible when needed.',
  'The overall classroom atmosphere promotes a positive and supportive learning environment.',
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizeSearchValue = (value) => normalizeText(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const levenshteinDistance = (source, target) => {
  const a = String(source || '');
  const b = String(target || '');

  if (!a) return b.length;
  if (!b) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};
const matchesSmartSearch = (values, query) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const haystacks = values
    .map((value) => normalizeSearchValue(value))
    .filter(Boolean);

  if (haystacks.some((value) => value.includes(normalizedQuery))) return true;

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (!queryTokens.length) return false;

  const haystackTokens = haystacks.flatMap((value) => value.split(' ').filter(Boolean));

  return queryTokens.every((queryToken) => {
    const maxDistance = queryToken.length >= 8 ? 2 : queryToken.length >= 5 ? 1 : 0;
    return haystackTokens.some((candidateToken) => {
      if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return true;
      if (Math.abs(candidateToken.length - queryToken.length) > maxDistance) return false;
      return levenshteinDistance(candidateToken, queryToken) <= maxDistance;
    });
  });
};
const isFacultyActive = (row) => {
  const raw = row?.isActive ?? row?.is_active;
  if (typeof raw === 'boolean') return raw;
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return true;
  return ['true', '1', 'yes', 'active'].includes(value);
};
const getFacultyName = (row) => String(
  row?.faculty ||
  row?.name ||
  row?.full_name ||
  row?.fullName ||
  row?.instructor ||
  ''
).trim();
const getFacultyDept = (row) => String(
  row?.dept ||
  row?.department ||
  row?.department_name ||
  row?.departmentName ||
  ''
).trim();
const getFacultyEmployment = (row) => String(row?.employment || '').trim();
const getFacultyKey = (row, fallback = '') => {
  const id = row?.faculty_id ?? row?.facultyId ?? row?.id ?? null;
  if (id != null && String(id).trim() !== '') return `id:${id}`;
  const name = normalizeText(getFacultyName(row));
  if (name) return `name:${name}`;
  return fallback;
};

export default function AdminEvaluations() {
  const panel = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const feedbackBg = useColorModeValue('gray.50','gray.700');
  const heroBg = useColorModeValue('linear(to-r, blue.50, cyan.50)', 'linear(to-r, gray.800, blue.900)');
  const tableHeadBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const rowHover = useColorModeValue('blue.50', 'whiteAlpha.50');
  const mutedPanel = useColorModeValue('gray.50', 'gray.900');

  const dispatch = useDispatch();
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const isOsas = roleStr === 'osas';
  const settings = useSelector(selectSettings);
  const opts = useSelector(selectProspectusFilterOptions);
  const allPros = useSelector(selectAllProspectus);
  const allFaculty = useSelector(selectAllFaculty);
  const defaultFilters = React.useMemo(() => {
    const defaultSy = settings?.evaluations?.school_year || settings?.schedulesView?.school_year || settings?.schedulesLoad?.school_year || '';
    const defaultSem = settings?.evaluations?.semester || settings?.schedulesView?.semester || settings?.schedulesLoad?.semester || '';
    return { programcode: '', coursecode: '', faculty: '', dept: '', employment: '', term: '', student: '', sy: defaultSy, sem: defaultSem, q: '' };
  }, [settings]);
  const [view, setView] = React.useState(isOsas ? 'student' : 'course'); // 'course' | 'faculty' | 'student'
  const [filters, setFilters] = React.useState({ programcode: '', coursecode: '', faculty: '', dept: '', employment: '', term: '', student: '', sy: '', sem: '', q: '' });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]);

  const summaryDisc = useDisclosure();
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summaryTitle, setSummaryTitle] = React.useState('');
  const [summary, setSummary] = React.useState(null);
  const [summaryMode, setSummaryMode] = React.useState('schedule'); // schedule|faculty
  const [summaryId, setSummaryId] = React.useState(null);
  const [summaryCtx, setSummaryCtx] = React.useState({});
  const requestSeq = React.useRef(0);
  const changeView = (next) => {
    setFilters(defaultFilters);
    setRows([]);
    setPage(1);
    setView(next);
  };

  const fetchData = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const search = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        const val = String(v).trim();
        if (!val) return;
        search.set(k, val);
      });
      const path = view === 'course'
        ? '/evaluations/aggregate/schedule'
        : view === 'faculty'
        ? '/evaluations/aggregate/faculty'
        : '/evaluations/aggregate/student';
      const data = await apiService.requestAbs(`${path}${search.toString() ? `?${search.toString()}` : ''}`, { method: 'GET' });
      if (requestSeq.current === seq) {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch {
      if (requestSeq.current === seq) {
        setRows([]);
      }
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }, [view, filters]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Clear previous rows immediately when switching view to avoid carry-over display
  React.useEffect(() => {
    setRows([]);
  }, [view]);

  // OSAS role is limited to the student view
  React.useEffect(() => {
    if (isOsas && view !== 'student') setView('student');
  }, [isOsas, view]);

  // Reset pagination on filter/view changes
  React.useEffect(() => { setPage(1); }, [view, filters]);

  // Initialize school year / semester defaults from settings
  React.useEffect(() => {
    setFilters(prev => ({
      ...defaultFilters,
      sy: prev.sy || defaultFilters.sy,
      sem: prev.sem || defaultFilters.sem,
    }));
  }, [defaultFilters]);
  React.useEffect(() => { dispatch(loadProspectusThunk({})); }, [dispatch]);
  React.useEffect(() => { dispatch(loadFacultiesThunk({ limit: 100000 })); }, [dispatch]);

  const mergedFacultyRows = React.useMemo(() => {
    const aggregateMap = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row, idx) => {
      const key = getFacultyKey(
        { faculty_id: row?.faculty_id, facultyId: row?.facultyId, faculty: row?.faculty, instructor: row?.instructor },
        `aggregate:${idx}`
      );
      const existing = aggregateMap.get(key);
      const mergedFaculty = { ...(existing?.faculty || {}), ...(row?.faculty || {}) };
      aggregateMap.set(key, {
        ...(existing || {}),
        ...row,
        faculty: mergedFaculty,
        faculty_id: existing?.faculty_id ?? row?.faculty_id ?? row?.facultyId ?? row?.faculty?.id ?? null,
        instructor: existing?.instructor || row?.instructor || getFacultyName(mergedFaculty),
        dept: getFacultyDept(mergedFaculty) || existing?.dept || row?.dept || '',
        employment: getFacultyEmployment(mergedFaculty) || existing?.employment || row?.employment || '',
        total: (Number(existing?.total) || 0) + (Number(row?.total) || 0),
        schedules: existing?.schedules || row?.schedules || [],
      });
    });

    const consumed = new Set();
    const masterRows = (Array.isArray(allFaculty) ? allFaculty : []).map((faculty, idx) => {
      const key = getFacultyKey(faculty, `master:${idx}`);
      consumed.add(key);
      const aggregate = aggregateMap.get(key);
      return {
        ...(aggregate || {}),
        faculty: { ...(aggregate?.faculty || {}), ...faculty },
        faculty_id: aggregate?.faculty_id ?? faculty?.id ?? null,
        instructor: aggregate?.instructor || getFacultyName(faculty),
        dept: getFacultyDept(faculty) || aggregate?.dept || '',
        employment: getFacultyEmployment(faculty) || aggregate?.employment || '',
        total: Number(aggregate?.total) || 0,
        schedules: aggregate?.schedules || [],
        _isActive: isFacultyActive(faculty),
      };
    });

    const aggregateOnlyRows = Array.from(aggregateMap.entries())
      .filter(([key]) => !consumed.has(key))
      .map(([, row]) => ({
        ...row,
        faculty: row?.faculty || {},
        faculty_id: row?.faculty_id ?? null,
        instructor: row?.instructor || getFacultyName(row?.faculty),
        dept: row?.dept || getFacultyDept(row?.faculty),
        employment: row?.employment || getFacultyEmployment(row?.faculty),
        total: Number(row?.total) || 0,
        schedules: row?.schedules || [],
        _isActive: isFacultyActive(row?.faculty || row),
      }));

    return [...masterRows, ...aggregateOnlyRows];
  }, [allFaculty, rows]);

  const filteredRows = React.useMemo(() => {
    const query = String(filters.q || '').trim();
    let list = view === 'faculty' ? mergedFacultyRows.slice() : (Array.isArray(rows) ? rows.slice() : []);

    if (view === 'faculty') {
      if (filters.faculty) {
        const target = normalizeText(filters.faculty);
        list = list.filter((row) => {
          const facultyName = normalizeText(getFacultyName(row?.faculty) || row?.instructor);
          return facultyName === target;
        });
      }
      if (filters.dept) {
        const target = normalizeText(filters.dept);
        list = list.filter((row) => normalizeText(getFacultyDept(row?.faculty) || row?.dept) === target);
      }
      if (filters.employment) {
        const target = normalizeText(filters.employment);
        list = list.filter((row) => normalizeText(getFacultyEmployment(row?.faculty) || row?.employment) === target);
      }
    }

    if (!query) return list;

    return list.filter((row) => {
      if (view === 'course') {
        return matchesSmartSearch([
          row?.schedule?.programcode,
          row?.schedule?.course_name,
          row?.schedule?.course_title,
          row?.schedule?.instructor,
          row?.faculty?.faculty,
        ], query);
      }
      if (view === 'faculty') {
        return matchesSmartSearch([
          getFacultyName(row?.faculty),
          row?.instructor,
          getFacultyDept(row?.faculty) || row?.dept,
          getFacultyEmployment(row?.faculty) || row?.employment,
        ], query);
      }
      return matchesSmartSearch([
        row?.student_name,
        row?.student?.name,
        row?.student_id,
        row?.student?.id,
        row?.program,
        row?.programcode,
      ], query);
    });
  }, [filters.dept, filters.employment, filters.faculty, filters.q, mergedFacultyRows, rows, view]);

  const sortedRows = React.useMemo(() => {
    const list = filteredRows.slice();
    const norm = (v) => String(v || '').trim();
    if (view === 'course') {
      return list.sort((a, b) => {
        const ap = norm(a?.schedule?.programcode);
        const bp = norm(b?.schedule?.programcode);
        if (ap !== bp) return ap.localeCompare(bp);
        const ac = norm(a?.schedule?.course_name);
        const bc = norm(b?.schedule?.course_name);
        if (ac !== bc) return ac.localeCompare(bc);
        const ai = norm(a?.schedule?.instructor || a?.faculty?.faculty || a?.faculty?.name || a?.instructor);
        const bi = norm(b?.schedule?.instructor || b?.faculty?.faculty || b?.faculty?.name || b?.instructor);
        return ai.localeCompare(bi);
      });
    }
    if (view === 'faculty') {
      return list.sort((a, b) => {
        const af = norm(a?.faculty?.faculty || a?.faculty?.name || a?.instructor);
        const bf = norm(b?.faculty?.faculty || b?.faculty?.name || b?.instructor);
        if (af !== bf) return af.localeCompare(bf);
        const ad = norm(a?.faculty?.dept || a?.faculty?.department || a?.dept);
        const bd = norm(b?.faculty?.dept || b?.faculty?.department || b?.dept);
        return ad.localeCompare(bd);
      });
    }
    if (view === 'student') {
      return list.sort((a, b) => {
        const an = norm(a?.student_name || a?.student?.name || a?.name);
        const bn = norm(b?.student_name || b?.student?.name || b?.name);
        if (an !== bn) return an.localeCompare(bn);
        const aid = norm(a?.student_id || a?.student?.id || a?.id);
        const bid = norm(b?.student_id || b?.student?.id || b?.id);
        return aid.localeCompare(bid);
      });
    }
    return list;
  }, [filteredRows, view]);

  // Clamp page when data or size changes
  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil((sortedRows?.length || 0) / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [sortedRows, pageSize, page]);

  const pagedRows = React.useMemo(() => {
    const list = sortedRows;
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const pageCount = Math.max(1, Math.ceil((sortedRows?.length || 0) / pageSize));

  const programOptions = React.useMemo(() => (opts?.programs || []).map(v => String(v)).filter(Boolean), [opts]);
  const courseOptions = React.useMemo(() => {
    const list = (allPros || []).filter(p => !filters.programcode || String(p.programcode || p.program || '') === filters.programcode)
      .map(p => String(p.course_name || p.courseName || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [allPros, filters.programcode]);
  const facultyOptions = React.useMemo(() => {
    const names = new Set();
    (Array.isArray(allFaculty) ? allFaculty : []).forEach((faculty) => {
      const name = getFacultyName(faculty);
      if (name) names.add(name);
    });
    return Array.from(names).sort((a,b)=>a.localeCompare(b));
  }, [allFaculty]);
  const deptOptions = React.useMemo(() => {
    const names = new Set();
    (Array.isArray(allFaculty) ? allFaculty : []).forEach((faculty) => {
      const dept = getFacultyDept(faculty);
      if (dept) names.add(dept);
    });
    return Array.from(names).sort((a,b)=>a.localeCompare(b));
  }, [allFaculty]);
  const employmentOptions = React.useMemo(() => {
    const names = new Set();
    (Array.isArray(allFaculty) ? allFaculty : []).forEach((faculty) => {
      const emp = getFacultyEmployment(faculty);
      if (emp) names.add(emp);
    });
    return Array.from(names).sort((a,b)=>a.localeCompare(b));
  }, [allFaculty]);

  const termOptions = [
    { value: '', label: 'All terms' },
    { value: '1st', label: '1st' },
    { value: '2nd', label: '2nd' },
    { value: 'Sem', label: 'Sem' },
  ];
  const semOptions = [
    { value: '', label: 'All semesters' },
    { value: '1st', label: '1st Semester' },
    { value: '2nd', label: '2nd Semester' },
    { value: 'Summer', label: 'Summer' },
  ];
  const schoolYearOptions = React.useMemo(() => {
    const list = new Set();
    const pick = settings?.schedulesView?.school_year || settings?.schedulesLoad?.school_year;
    const baseYear = (() => {
      if (pick && /^\d{4}-\d{4}$/.test(pick)) return Number(pick.slice(0,4));
      const now = new Date();
      return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1; // school year start heuristic
    })();
    for (let offset = -3; offset <= 3; offset++) {
      const start = baseYear + offset;
      const end = start + 1;
      list.add(`${start}-${end}`);
    }
    if (pick) list.add(pick);
    return Array.from(list).sort();
  }, [settings]);
  const totalEvaluations = React.useMemo(() => (
    sortedRows.reduce((sum, row) => sum + (Number(row?.total) || 0), 0)
  ), [sortedRows]);
  const zeroEvaluationFacultyCount = React.useMemo(() => (
    view === 'faculty' ? sortedRows.filter((row) => (Number(row?.total) || 0) === 0).length : 0
  ), [sortedRows, view]);
  const activeFacultyCount = React.useMemo(() => (
    view === 'faculty' ? sortedRows.filter((row) => row?._isActive !== false).length : 0
  ), [sortedRows, view]);
  const appliedFilterCount = React.useMemo(() => (
    Object.entries(filters).filter(([, value]) => String(value || '').trim()).length
  ), [filters]);

  const appendActiveSummaryFilters = React.useCallback((search, mode) => {
    const add = (key, value) => {
      if (value === undefined || value === null) return;
      const trimmed = String(value).trim();
      if (!trimmed) return;
      search.set(key, trimmed);
    };

    add('sy', filters?.sy);
    add('schoolyear', filters?.sy);
    add('sem', filters?.sem);
    add('semester', filters?.sem);
    add('term', filters?.term);

    if (mode === 'student') {
      add('programcode', filters?.programcode);
      return search;
    }

    if (mode === 'schedule') {
      add('programcode', filters?.programcode);
      add('coursecode', filters?.coursecode);
      add('faculty', filters?.faculty);
      return search;
    }

    if (mode === 'faculty') {
      add('faculty', filters?.faculty);
      add('dept', filters?.dept);
      add('employment', filters?.employment);
    }

    return search;
  }, [filters]);

  const openSummary = React.useCallback(async (mode, id, title, ctx = {}) => {
    setSummaryMode(mode);
    setSummaryId(id);
    setSummaryTitle(title || 'Summary');
    setSummaryCtx(ctx || {});
    setSummary(null);
    setSummaryLoading(true);
    summaryDisc.onOpen();
    try {
      // If faculty view, enrich context with faculty details and current SY/Sem
      if (mode === 'faculty' && id) {
        try {
          const fac = await apiService.getFaculty(id);
          if (fac) {
            ctx = { ...ctx, 
              designation: fac.designation, employment: fac.employment, 
              load_release_units: fac.load_release_units ?? fac.loadReleaseUnits,
              dept: ctx.dept || fac.dept || fac.department,
            };
          }
        } catch {}
        ctx = {
          ...ctx,
          sy: ctx?.sy || String(filters?.sy || '').trim(),
          sem: ctx?.sem || String(filters?.sem || '').trim(),
          term: ctx?.term || String(filters?.term || '').trim(),
        };
        setSummaryCtx(ctx);
      }
      if (mode === 'schedule') {
        try {
          const sched = await apiService.getScheduleById(id);
          const fid = ctx.faculty_id || ctx.facultyId || sched?.facultyId || sched?.faculty_id;
          ctx = {
            ...ctx,
            faculty_id: fid || ctx.faculty_id,
            dept: ctx.dept || sched?.dept || sched?.department,
            instructor: ctx.instructor || sched?.instructor || sched?.faculty,
            course_title: ctx.course_title || sched?.course_title || sched?.courseTitle,
            course_name: ctx.course_name || sched?.course_name || sched?.courseName,
          };
          if (fid) {
            try {
              const fac = await apiService.getFaculty(fid);
              if (fac) {
                ctx = {
                  ...ctx,
                  designation: ctx.designation ?? fac.designation,
                  employment: ctx.employment ?? fac.employment,
                  load_release_units: ctx.load_release_units ?? (fac.load_release_units ?? fac.loadReleaseUnits),
                  dept: ctx.dept || fac.dept || fac.department,
                  faculty: ctx.instructor || ctx.faculty || fac.faculty || fac.name,
                  email: ctx.email || fac.email,
                  rank: ctx.rank || fac.rank,
                };
              }
            } catch {}
          }
          setSummaryCtx(ctx);
        } catch {}
      }
      const search = new URLSearchParams();
      search.set('mode', String(mode));
      if (mode === 'student') {
        const studentName = String(ctx?.student || ctx?.student_name || title || '').trim();
        if (studentName) search.set('student', studentName);
        if (filters?.q) search.set('q', filters.q);
      } else {
        search.set('id', String(id));
      }
      appendActiveSummaryFilters(search, mode);
      const data = await apiService.requestAbs(`/evaluations/summary?${search.toString()}`, { method: 'GET' });
      setSummary(data || null);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [appendActiveSummaryFilters, filters, summaryDisc]);

  const onPrint = () => {
    if (summaryMode === 'student') {
      printEvaluationSummary({
        title: 'Student Evaluation - Courses',
        subtitle: summaryTitle || '',
        context: { ...summaryCtx, courses: Array.isArray(summary?.courses) ? summary.courses : [] },
        mode: 'student',
      });
      return;
    }
    const title = `Evaluation Summary`;
    const subtitle = summaryTitle;
    printEvaluationSummary({
      title,
      subtitle,
      stats: summary?.stats || {},
      feedbacks: summary?.feedbacks || [],
      questions: QUESTIONS,
      context: summaryCtx,
      mode: summaryMode,
    });
  };

  const currentViewMeta = React.useMemo(() => {
    if (view === 'faculty') {
      return {
        title: 'Faculty Evaluation Monitoring',
        description: 'Track evaluation coverage by faculty, including inactive records and faculty with no submitted evaluations yet.',
        icon: FiUsers,
        accent: 'orange',
        searchPlaceholder: 'Search faculty, department, or employment',
        emptyText: 'No faculty matched the current filters.',
        countLabel: 'Faculty shown',
      };
    }
    if (view === 'student') {
      return {
        title: 'Student Evaluation Activity',
        description: 'Review which students have submitted evaluations and inspect the courses they evaluated.',
        icon: FiClipboard,
        accent: 'teal',
        searchPlaceholder: 'Search student ID, name, or program',
        emptyText: 'No student evaluation records matched the current filters.',
        countLabel: 'Students shown',
      };
    }
    return {
      title: 'Course Evaluation Coverage',
      description: 'Review course sections, assigned faculty, and evaluation totals by program and schedule.',
      icon: FiBookOpen,
      accent: 'blue',
      searchPlaceholder: 'Search program, course, or faculty',
      emptyText: 'No course evaluation records matched the current filters.',
      countLabel: 'Courses shown',
    };
  }, [view]);

  const HeroIcon = currentViewMeta.icon;
  const showProgramFilter = !isOsas && view !== 'faculty';
  const showFacultyFilter = !isOsas;
  const showFacultySpecificFilters = !isOsas && view === 'faculty';
  const showCourseFilter = !isOsas && view === 'course';
  const filtersSummary = [
    filters.sy && `SY ${filters.sy}`,
    filters.sem && filters.sem,
    filters.term && `Term ${filters.term}`,
    filters.programcode && filters.programcode,
    filters.coursecode && filters.coursecode,
    filters.faculty && filters.faculty,
    filters.dept && filters.dept,
    filters.employment && filters.employment,
  ].filter(Boolean);

  const viewSwitch = isOsas ? (
    <Button size="sm" variant="solid" colorScheme="blue" leftIcon={<FiClipboard />} isDisabled>
      Students
    </Button>
  ) : (
    <ButtonGroup size="sm" isAttached variant="outline">
      <Button leftIcon={<FiBookOpen />} variant={view==='course'?'solid':'outline'} colorScheme="blue" onClick={()=>changeView('course')}>Courses</Button>
      <Button leftIcon={<FiUsers />} variant={view==='faculty'?'solid':'outline'} colorScheme="blue" onClick={()=>changeView('faculty')}>Faculty</Button>
      <Button leftIcon={<FiClipboard />} variant={view==='student'?'solid':'outline'} colorScheme="blue" onClick={()=>changeView('student')}>Students</Button>
    </ButtonGroup>
  );

  return (
    <VStack align="stretch" spacing={5}>
      <Box
        bgGradient={heroBg}
        borderWidth="1px"
        borderColor={border}
        rounded="2xl"
        p={{ base: 5, md: 6 }}
        boxShadow="sm"
      >
        <Stack
          direction={{ base: 'column', lg: 'row' }}
          justify="space-between"
          align={{ base: 'stretch', lg: 'center' }}
          spacing={5}
        >
          <HStack align="start" spacing={4}>
            <Box
              bg="whiteAlpha.700"
              color={`${currentViewMeta.accent}.600`}
              rounded="2xl"
              p={3}
              borderWidth="1px"
              borderColor="whiteAlpha.500"
            >
              <HeroIcon size={24} />
            </Box>
            <VStack align="start" spacing={1}>
              <Heading size="lg">{currentViewMeta.title}</Heading>
              <Text color={subtle} maxW="3xl">
                {currentViewMeta.description}
              </Text>
              {filtersSummary.length > 0 && (
                <Wrap spacing={2} pt={1}>
                  {filtersSummary.map((item) => (
                    <WrapItem key={item}>
                      <Badge variant="subtle" colorScheme="gray" px={2} py={1} rounded="full">
                        {item}
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
            </VStack>
          </HStack>

          <VStack align={{ base: 'stretch', lg: 'end' }} spacing={3}>
            {viewSwitch}
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={fetchData}
              colorScheme={currentViewMeta.accent}
              variant="solid"
            >
              Refresh Data
            </Button>
          </VStack>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Stat>
            <StatLabel>{currentViewMeta.countLabel}</StatLabel>
            <StatNumber>{sortedRows.length}</StatNumber>
            <StatHelpText>Current result set</StatHelpText>
          </Stat>
        </Box>
        <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Stat>
            <StatLabel>Total evaluations</StatLabel>
            <StatNumber>{totalEvaluations}</StatNumber>
            <StatHelpText>Across visible rows</StatHelpText>
          </Stat>
        </Box>
        <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Stat>
            <StatLabel>{view === 'faculty' ? 'Zero evaluation faculty' : 'Active filters'}</StatLabel>
            <StatNumber>{view === 'faculty' ? zeroEvaluationFacultyCount : appliedFilterCount}</StatNumber>
            <StatHelpText>
              {view === 'faculty' ? 'Included in the list' : 'Filters currently applied'}
            </StatHelpText>
          </Stat>
        </Box>
        <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
          <Stat>
            <StatLabel>{view === 'faculty' ? 'Active faculty' : 'Pages'}</StatLabel>
            <StatNumber>{view === 'faculty' ? activeFacultyCount : pageCount}</StatNumber>
            <StatHelpText>
              {view === 'faculty' ? 'Inactive faculty are still shown' : `${pageSize} rows per page`}
            </StatHelpText>
          </Stat>
        </Box>
      </SimpleGrid>

      <Box bg={panel} borderWidth="1px" borderColor={border} rounded="2xl" p={{ base: 4, md: 5 }}>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" align="start" flexWrap="wrap" spacing={3}>
            <VStack align="start" spacing={1}>
              <HStack spacing={2}>
                <FiFilter />
                <Heading size="sm">Filters</Heading>
              </HStack>
              <Text color={subtle} fontSize="sm">
                Narrow the view quickly, then refresh to pull the latest evaluation aggregates.
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Button
                leftIcon={<FiRefreshCw />}
                variant="outline"
                onClick={() => {
                  setFilters(defaultFilters);
                  setPage(1);
                }}
              >
                Reset
              </Button>
              <Button leftIcon={<FiBarChart2 />} colorScheme="blue" onClick={fetchData}>
                Apply
              </Button>
            </HStack>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
            <Select value={filters.sy} onChange={(e)=>setFilters(s=>({...s, sy: e.target.value }))} placeholder="School year" isDisabled={isOsas}>
              {schoolYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select value={filters.sem} onChange={(e)=>setFilters(s=>({...s, sem: e.target.value }))} isDisabled={isOsas}>
              {semOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Select value={filters.term} onChange={(e)=>setFilters(s=>({...s, term: e.target.value }))}>
              {termOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {showProgramFilter ? (
              <Select value={filters.programcode} onChange={(e)=>setFilters(s=>({...s, programcode: e.target.value, coursecode: '' }))}>
                <option value="">All programs</option>
                {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            ) : (
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="currentColor" />
                </InputLeftElement>
                <Input value={filters.q} onChange={(e)=>setFilters(s=>({...s, q: e.target.value }))} placeholder={currentViewMeta.searchPlaceholder} pl={10} />
              </InputGroup>
            )}

            {showCourseFilter && (
              <Select value={filters.coursecode} onChange={(e)=>setFilters(s=>({...s, coursecode: e.target.value }))} isDisabled={courseOptions.length===0}>
                <option value="">{courseOptions.length ? 'All courses' : 'No courses available'}</option>
                {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}

            {showFacultyFilter && (
              <Select value={filters.faculty} onChange={(e)=>setFilters(s=>({...s, faculty: e.target.value }))}>
                <option value="">All faculty</option>
                {facultyOptions.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            )}

            {showFacultySpecificFilters && (
              <Select value={filters.dept} onChange={(e)=>setFilters(s=>({...s, dept: e.target.value }))} isDisabled={deptOptions.length===0}>
                <option value="">All departments</option>
                {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            )}

            {showFacultySpecificFilters && (
              <Select value={filters.employment} onChange={(e)=>setFilters(s=>({...s, employment: e.target.value }))} isDisabled={employmentOptions.length===0}>
                <option value="">All employment types</option>
                {employmentOptions.map(emp => <option key={emp} value={emp}>{emp}</option>)}
              </Select>
            )}

            {showProgramFilter && (
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="currentColor" />
                </InputLeftElement>
                <Input value={filters.q} onChange={(e)=>setFilters(s=>({...s, q: e.target.value }))} placeholder={currentViewMeta.searchPlaceholder} pl={10} />
              </InputGroup>
            )}
          </SimpleGrid>
        </VStack>
      </Box>

      <Box bg={panel} borderWidth="1px" borderColor={border} rounded="2xl" overflow="hidden">
        <HStack justify="space-between" align="center" px={{ base: 4, md: 5 }} py={4} bg={mutedPanel} borderBottomWidth="1px" borderColor={border} flexWrap="wrap" spacing={3}>
          <VStack align="start" spacing={0}>
            <Heading size="sm">{currentViewMeta.title}</Heading>
            <Text color={subtle} fontSize="sm">
              {sortedRows.length} result{sortedRows.length === 1 ? '' : 's'} across {pageCount} page{pageCount === 1 ? '' : 's'}
            </Text>
          </VStack>
          <Badge colorScheme={currentViewMeta.accent} variant="subtle" px={3} py={1} rounded="full">
            {totalEvaluations} evaluations
          </Badge>
        </HStack>
        <TableContainer>
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead bg={tableHeadBg}>
            <Tr>
              {view==='course' ? (
                <>
                  <Th>Program</Th>
                  <Th>Course</Th>
                  <Th>Faculty</Th>
                  <Th>Term</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              ) : view==='faculty' ? (
                <>
                  <Th>Faculty</Th>
                  <Th>Details</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              ) : (
                <>
                  <Th>Student</Th>
                  <Th>Program</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              )}
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Tr key={i}><Td colSpan={6}><Skeleton height="20px" /></Td></Tr>
              ))
            ) : sortedRows.length === 0 ? (
              <Tr><Td colSpan={6}><Text color={subtle} p={5}>{currentViewMeta.emptyText}</Text></Td></Tr>
            ) : view==='course' ? (
              pagedRows.map((r) => (
                <Tr key={`${r.schedule_id}-${r.accesscode}`} _hover={{ bg: rowHover }}>
                  <Td><Tag colorScheme="blue" variant="subtle"><TagLabel>{r.schedule?.programcode || '-'}</TagLabel></Tag></Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="700">{r.schedule?.course_name || '-'}</Text>
                      <Text fontSize="sm" color={subtle} noOfLines={1}>{r.schedule?.course_title || ''}</Text>
                    </VStack>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="600">{r.faculty?.faculty || r.schedule?.instructor || '-'}</Text>
                      {r.schedule?.dept && <Badge variant="subtle">{r.schedule.dept}</Badge>}
                    </VStack>
                  </Td>
                  <Td><Text>{[r.schedule?.term, r.schedule?.sy && `SY ${r.schedule.sy}`, r.schedule?.sem].filter(Boolean).join(' | ') || '-'}</Text></Td>
                  <Td isNumeric><Text fontWeight="700">{r.total}</Text></Td>
                  <Td>
                    <Button size="sm" leftIcon={<FiEye />} onClick={()=>openSummary('schedule', r.schedule_id, `${r.schedule?.course_name} | ${r.schedule?.instructor || ''}`,
                      { programcode: r.schedule?.programcode, course_name: r.schedule?.course_name, course_title: r.schedule?.course_title, instructor: r.schedule?.instructor, term: r.schedule?.term, sy: r.schedule?.sy, sem: r.schedule?.sem, dept: r.schedule?.dept, faculty_id: r.schedule?.faculty_id }
                    )}>View</Button>
                  </Td>
                </Tr>
              ))
            ) : view==='faculty' ? (
              pagedRows.map((r, idx) => {
                const facultyName = r.faculty?.faculty || r.instructor || 'Unassigned';
                const facultyDept = r.faculty?.dept || r.dept || '-';
                const facultyEmployment = r.faculty?.employment || r.employment || '';
                const facultyDesignation = r.faculty?.designation || '';
                const isActive = r?._isActive !== false;

                return (
                  <Tr key={`${r.faculty_id || 'x'}-${idx}`} _hover={{ bg: rowHover }}>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="700">{facultyName}</Text>
                        <HStack spacing={2} flexWrap="wrap">
                          <Badge colorScheme={isActive ? 'green' : 'red'} variant="subtle">
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {r.faculty_id && (
                            <Badge variant="subtle" colorScheme="blue">
                              ID #{r.faculty_id}
                            </Badge>
                          )}
                        </HStack>
                      </VStack>
                    </Td>
                    <Td>
                      <VStack align="start" spacing={1}>
                        <Text>{facultyDept}</Text>
                        <HStack spacing={2} flexWrap="wrap">
                          {facultyEmployment && <Badge variant="subtle" colorScheme="green">{facultyEmployment}</Badge>}
                          {facultyDesignation && <Badge variant="subtle" colorScheme="purple">{facultyDesignation}</Badge>}
                        </HStack>
                      </VStack>
                    </Td>
                    <Td isNumeric>
                      <VStack align="end" spacing={0}>
                        <Text fontWeight="700">{r.total}</Text>
                        <Text fontSize="xs" color={subtle}>
                          {(Number(r.total) || 0) === 0 ? 'No evaluations yet' : 'Submitted'}
                        </Text>
                      </VStack>
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        leftIcon={<FiEye />}
                        isDisabled={!r.faculty_id}
                        onClick={()=>openSummary('faculty', r.faculty_id, facultyName, { instructor: facultyName, dept: facultyDept, faculty: r.faculty?.faculty, designation: r.faculty?.designation, employment: r.faculty?.employment, load_release_units: r.faculty?.loadReleaseUnits, email: r.faculty?.email, rank: r.faculty?.rank })}
                      >
                        View
                      </Button>
                    </Td>
                  </Tr>
                );
              })
            ) : view==='student' ? (
              pagedRows.map((r, idx) => {
                const sid = r.student_id || r.student?.id || r.id || idx;
                const sname = r.student_name || r.student?.name || r.name || 'Student';
                const program = r.program || r.student?.program || r.programcode || '-';
                return (
                  <Tr key={`stu-${sid}`} _hover={{ bg: rowHover }}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="700">{sname}</Text>
                        <Text fontSize="sm" color={subtle}>{sid ? `ID #${sid}` : ''}</Text>
                      </VStack>
                    </Td>
                    <Td><Tag variant="subtle" colorScheme="teal"><TagLabel>{program}</TagLabel></Tag></Td>
                    <Td isNumeric><Text fontWeight="700">{r.total}</Text></Td>
                    <Td>
                      <Button size="sm" leftIcon={<FiEye />} onClick={()=>openSummary('student', sid, sname, { program })}>View</Button>
                    </Td>
                  </Tr>
                );
              })
            ) : null}
          </Tbody>
        </Table>
        </TableContainer>
      </Box>

      <HStack justify="space-between" align={{ base: 'start', md: 'center' }} flexDirection={{ base: 'column', md: 'row' }} spacing={3} bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
        <Text fontSize="sm" color={subtle}>Page {page} of {pageCount}</Text>
        <HStack spacing={2} flexWrap="wrap">
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value) || 10); setPage(1); }} maxW="110px">
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={()=>setPage(p=>Math.max(1, p-1))} isDisabled={page <= 1}>Prev</Button>
          <Button size="sm" variant="solid" colorScheme="blue" onClick={()=>setPage(p=>Math.min(pageCount, p+1))} isDisabled={page >= pageCount}>Next</Button>
        </HStack>
      </HStack>

      <Modal isOpen={summaryDisc.isOpen} onClose={summaryDisc.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{summaryTitle || 'Summary'} {summaryCtx.course_title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {summaryMode !== 'faculty' && summaryCtx && (summaryCtx.faculty_id || summaryCtx.faculty) && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  {summaryCtx.faculty && (
                    <Text fontWeight="700">{summaryCtx.faculty}</Text>
                  )}

                  <HStack spacing={3} wrap="wrap">
                    {summaryCtx.faculty_id && (
                      <Badge colorScheme="blue" variant="subtle">ID #{summaryCtx.faculty_id}</Badge>
                    )}
                    {summaryCtx.dept && <Badge variant="subtle">{summaryCtx.dept}</Badge>}
                    {summaryCtx.designation && <Badge variant="subtle" colorScheme="purple">{summaryCtx.designation}</Badge>}
                    {summaryCtx.employment && <Badge variant="subtle" colorScheme="green">{summaryCtx.employment}</Badge>}
                    {summaryCtx.load_release_units != null && (
                      <Badge variant="subtle" colorScheme="orange">LRU: {summaryCtx.load_release_units}</Badge>
                    )}
                  </HStack>
                  {summaryCtx.email && (
                    <Text fontSize="sm" color={subtle}>Email: {summaryCtx.email}</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryMode === 'faculty' && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  <HStack spacing={3} wrap="wrap">
                    <Badge colorScheme="blue" variant="subtle">ID #{summaryId}</Badge>
                    {summaryCtx.dept && <Badge variant="subtle">{summaryCtx.dept}</Badge>}
                    {summaryCtx.designation && <Badge variant="subtle" colorScheme="purple">{summaryCtx.designation}</Badge>}
                    {summaryCtx.employment && <Badge variant="subtle" colorScheme="green">{summaryCtx.employment}</Badge>}
                    {summaryCtx.load_release_units != null && (
                      <Badge variant="subtle" colorScheme="orange">LRU: {summaryCtx.load_release_units}</Badge>
                    )}
                    {(summaryCtx.sy || summaryCtx.sem) && (
                      <Badge variant="subtle" colorScheme="gray">{[summaryCtx.sy && `SY ${summaryCtx.sy}`, summaryCtx.sem].filter(Boolean).join(' | ')}</Badge>
                    )}
                  </HStack>
                  {summaryCtx.email && (
                    <Text fontSize="sm" color={subtle}>Email: {summaryCtx.email}</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryMode === 'student' && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  <HStack spacing={3} wrap="wrap">
                    <Badge colorScheme="blue" variant="subtle">ID #{summaryId}</Badge>
                    {summaryCtx.program && <Badge variant="subtle">{summaryCtx.program}</Badge>}
                    {(summaryCtx.sy || summaryCtx.sem) && (
                      <Badge variant="subtle" colorScheme="gray">{[summaryCtx.sy && `SY ${summaryCtx.sy}`, summaryCtx.sem].filter(Boolean).join(' �?� ')}</Badge>
                    )}
                  </HStack>
                </VStack>
              </Box>
            )}
            {summaryMode === 'student' && summary && (
              <Box>
                <Heading size="sm" mb={2}>Evaluated Courses</Heading>
                <VStack align="stretch" spacing={2}>
                  {(summary.courses || []).map((c) => (
                    <Box key={c.id} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={feedbackBg}>
                      <HStack justify="space-between" align="start">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="600">{c.course_name || '-'}</Text>
                          <Text fontSize="sm" color={subtle} noOfLines={2}>{c.course_title || ''}</Text>
                          <HStack spacing={2} pt={1}>
                            {c.programcode && <Badge variant="subtle">{c.programcode}</Badge>}
                            {(c.term || c.sy || c.sem) && (
                              <Badge variant="subtle" colorScheme="gray">{[c.term, c.sy && `SY ${c.sy}`, c.sem].filter(Boolean).join(' · ')}</Badge>
                            )}
                          </HStack>
                        </VStack>
                        <VStack align="end" spacing={0}>
                          <Text fontSize="sm" color={subtle}>Faculty</Text>
                          <Text fontWeight="600">{c.instructor || '-'}</Text>
                        </VStack>
                      </HStack>
                    </Box>
                  ))}
                  {(summary.courses || []).length === 0 && (
                    <Text color={subtle}>No courses found for this student.</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryLoading ? (
              <VStack align="stretch" spacing={3}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="24px" />)}
              </VStack>
            ) : !summary ? (
              <Text color={subtle}>No summary available.</Text>
            ) : summaryMode === 'student' ? null : (
              <VStack align="stretch" spacing={5}>
                <Box>
                  <Heading size="sm" mb={2}>Averages</Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {QUESTIONS.map((q, idx) => {
                      const key = `q${idx+1}`;
                      const val = summary?.stats?.[key];
                      const avg = val != null ? Number(val).toFixed(2) : '-';
                      return (
                        <Stat key={key} p={2} borderWidth="1px" borderColor={border} rounded="md">
                          <StatLabel noOfLines={2}>{idx+1}. {q}</StatLabel>
                          <StatNumber fontSize="lg">{avg}</StatNumber>
                          <StatHelpText>Scale 1-5</StatHelpText>
                        </Stat>
                      );
                    })}
                  </SimpleGrid>
                </Box>
                <Divider />
                <Box>
                  <Heading size="sm" mb={2}>Top Feedback</Heading>
                  <VStack align="stretch" spacing={3}>
                    {(summary.feedbacks || []).map((f) => (
                      <Box key={f.id} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={feedbackBg}>
                        <Text fontSize="sm">{f.feedback}</Text>
                      </Box>
                    ))}
                    {(summary.feedbacks || []).length === 0 && (
                      <Text color={subtle}>No feedback yet.</Text>
                    )}
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" onClick={onPrint}>Print</Button>
              <Button onClick={summaryDisc.onClose}>Close</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
