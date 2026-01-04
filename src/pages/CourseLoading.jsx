// full component file - drop in place of your previous CourseLoading component
import React from 'react';
import {
  Box, HStack, VStack, Stack, Heading, Text, Input, IconButton, Button, Select, Divider,
  useColorModeValue, Spinner, Badge, Tag, Wrap, WrapItem, useToast, Checkbox, Switch,
  SimpleGrid, Tooltip, Menu, MenuButton, MenuList, MenuItem,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody
} from '@chakra-ui/react';
import { Skeleton, SkeletonText, Fade } from '@chakra-ui/react';
import { FiRefreshCw, FiUpload, FiSearch, FiLock, FiInfo, FiHelpCircle, FiTrash, FiUserPlus, FiPrinter, FiClock, FiChevronDown, FiShuffle } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadBlocksThunk } from '../store/blockThunks';
import { selectBlocks } from '../store/blockSlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { selectAllFaculty, selectFacultyFilterOptions } from '../store/facultySlice';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectAllProspectus } from '../store/prospectusSlice';
import { selectSettings } from '../store/settingsSlice';
import { selectAllCourses } from '../store/dataSlice';
import api from '../services/apiService';
import FacultySelect from '../components/FacultySelect';
import AssignFacultyModal from '../components/AssignFacultyModal';
import AssignSchedulesModal from '../components/AssignSchedulesModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { getTimeOptions } from '../utils/timeOptions';
import { normalizeTimeBlock } from '../utils/timeNormalize';
import { parseTimeBlockToMinutes, parseF2FDays } from '../utils/conflicts';
import { buildIndexes, buildFacultyStats, buildFacultyScoreMap, normalizeSem } from '../utils/facultyScoring';
import { allowedSessionsForCourse, isPEorNSTP } from '../utils/courseRules';
import { buildTable, printContent } from '../utils/printDesign';
import ScheduleHistoryModal from '../components/ScheduleHistoryModal';
import AssignmentRow from '../components/AssignmentRow';
import CoursesView from '../components/CoursesView';
import CourseSummaryView from '../components/CourseSummaryView';
import CourseLoadingSupport from '../components/CourseLoadingSupport';


function pickSchedules(rows = [], limit = 40) {
  return rows.slice(0, limit).map((r) => ({
    id: r.id ?? r.schedule_id ?? null,
    course: r.courseName ?? r.code ?? r.course ?? null,
    title: r.courseTitle ?? r.title ?? null,
    faculty: r.faculty ?? r.instructor ?? r.facultyName ?? null,
    dept: r.dept ?? r.department ?? null,
    room: r.room ?? null,
    day: r.day ?? r.session ?? null,
    time: r.time ?? r.schedule ?? null,
    term: r.term ?? r.sem ?? r.semester ?? null,
    sy: r.sy ?? r.schoolyear ?? r.school_year ?? null,
    block: r.block ?? r.blockCode ?? r.section ?? null,
    program: r.programcode ?? r.program ?? null,
    units: r.unit ?? null,
  }));
}

function pickBlocks(rows = [], limit = 20) {
  return rows.slice(0, limit).map((r) => ({
    id: r.id ?? null,
    block: r.block ?? r.blockCode ?? r.code ?? null,
    programcode: r.programcode ?? r.program ?? null,
    yearlevel: r.yearlevel ?? r.year ?? null,
    section: r.section ?? null,
    size: r.size ?? r.capacity ?? null,
  }));
}

function pickProspectus(items = [], limit = 30) {
  return items.slice(0, limit).map((r) => ({
    id: r.id ?? null,
    courseName: r.courseName ?? r.code ?? null,
    courseTitle: r.courseTitle ?? r.title ?? null,
    programcode: r.programcode ?? r.program ?? null,
    semester: r.semester ?? r.sem ?? r.term ?? null,
    yearlevel: r.yearlevel ?? r.year ?? null,
    unit: r.unit ?? null,
  }));
}

function pickFaculty(items = [], limit = 25) {
  return items.slice(0, limit).map((f) => ({
    id: f.id ?? null,
    faculty: f.faculty ?? f.name ?? null,
    dept: f.dept ?? f.department ?? null,
    designation: f.designation ?? null,
    employment: f.employment ?? null,
    loadReleaseUnits: f.loadReleaseUnits ?? f.load_release_units ?? null,
  }));
}

// --- helpers (same as previous) ---
function VirtualBlockList({ items, renderRow, estimatedRowHeight = 76, overscan = 6, maxHeight = '50vh', border, dividerBorder }) {
  const containerRef = React.useRef(null);
  const [viewportH, setViewportH] = React.useState(400);
  const [scrollTop, setScrollTop] = React.useState(0);
  const list = Array.isArray(items) ? items : [];
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      try { setViewportH(el.clientHeight || 400); } catch {}
    });
    try { ro.observe(el); } catch {}
    setViewportH(el.clientHeight || 400);
    return () => { try { ro.disconnect(); } catch {} };
  }, []);
  const onScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop || 0);
  };
  const rowH = Math.max(40, Number(estimatedRowHeight) || 76);
  const total = list.length;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + viewportH) / rowH) + overscan);
  const padTop = start * rowH;
  const padBottom = Math.max(0, (total - end) * rowH);
  const slice = list.slice(start, end);
  return (
    <Box ref={containerRef} maxH={maxHeight} overflowY="auto" borderWidth="0px" onScroll={onScroll}>
      <Box style={{ paddingTop: padTop + 'px', paddingBottom: padBottom + 'px' }}>
        <VStack align="stretch" spacing={3} divider={<Divider borderColor={dividerBorder} />}>
          {slice.map((r, i) => renderRow(r, start + i))}
        </VStack>
      </Box>
    </Box>
  );
}
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
function normalizeProgramCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function extractYearDigits(val) { const m = String(val ?? '').match(/(\d+)/); return m ? m[1] : ''; }
// function normalizeSem(s) { const v = String(s || '').trim().toLowerCase(); if (!v) return ''; if (v.startsWith('1')) return '1st'; if (v.startsWith('2')) return '2nd'; if (v.startsWith('s')) return 'Sem'; return s; }
function canonicalTerm(s) {
  const norm = normalizeSem(s);
  if (norm) return norm;
  const raw = String(s || '').trim();
  // Treat semestral/sem as "Sem" for UI consistency
  if (/sem/i.test(raw)) return 'Sem';
  return '';
}
function formatUnits(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}
function mapSemesterLabel(raw) {
  const txt = String(raw || '').trim();
  const v = txt.toLowerCase();
  if (!v) return '';
  if (/(^|[^a-z])1(st)?([^a-z]|$)|\bfirst\b/.test(v)) return '1st Semester';
  if (/(^|[^a-z])2(nd)?([^a-z]|$)|\bsecond\b/.test(v)) return '2nd Semester';
  if (/summer|mid\s*year|midyear|(^|[^a-z])3(rd)?([^a-z]|$)/.test(v)) return 'Summer';
  if (v.includes('semester')) return txt;
  return txt;
}
function resolveSemesterLabel(term, fallback) {
  const primary = mapSemesterLabel(term);
  if (primary) return primary;
  const secondary = mapSemesterLabel(fallback);
  if (secondary) return secondary;
  return term || fallback || '';
}
// Keep faculty schedules sorted by block (then time/code) for consistent listing and print order
function sortFacultyScheduleItems(list = []) {
  const collatorOpts = { numeric: true, sensitivity: 'base' };
  const cmpText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, collatorOpts);
  const termRank = (t) => {
    const v = String(t || '').trim().toLowerCase();
    if (v.startsWith('1')) return 1;
    if (v.startsWith('2')) return 2;
    if (v.startsWith('s')) return 3;
    return 9;
  };
  const blockMeta = (row) => {
    const raw = String(row.blockCode || row.section || '').trim();
    const meta = parseBlockMeta(raw);
    const yr = parseInt(meta.yearlevel, 10);
    return {
      program: meta.programcode || '',
      year: Number.isFinite(yr) ? yr : Number.POSITIVE_INFINITY,
      section: meta.section || '',
      raw,
    };
  };
  const startMinutes = (row) => {
    const parsed = parseTimeBlockToMinutes(String(row.scheduleKey || row.schedule || row.time || '').trim());
    const val = Number.isFinite(row.timeStartMinutes) ? row.timeStartMinutes : parsed.start;
    return Number.isFinite(val) ? val : 99999;
  };
  return (Array.isArray(list) ? list : []).slice().sort((a, b) => {
    const ta = termRank(a.term);
    const tb = termRank(b.term);
    if (ta !== tb) return ta - tb;

    const ba = blockMeta(a);
    const bb = blockMeta(b);
    const blockCmp = cmpText(ba.raw || '\uffff', bb.raw || '\uffff');
    if (blockCmp !== 0) return blockCmp;

    const progCmp = cmpText(ba.program, bb.program);
    if (progCmp !== 0) return progCmp;
    if (ba.year !== bb.year) return ba.year - bb.year;
    const secCmp = cmpText(ba.section, bb.section);
    if (secCmp !== 0) return secCmp;

    const startCmp = startMinutes(a) - startMinutes(b);
    if (startCmp !== 0) return startCmp;

    return cmpText(a.courseName || a.code, b.courseName || b.code);
  });
}

// Identify courses that should be Semestral by rule (NSTP/PE/Defense Tactics)
function isSemestralCourseLike(row) {
  const text = [row?.course_name, row?.courseName, row?.code, row?.course_title, row?.courseTitle, row?.title]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toUpperCase();
  if (!text) return false;
  if (text.includes('NSTP')) return true;
  if (text.includes('PHYSICAL EDUCATION')) return true;
  if (text.includes(' PE') || text.startsWith('PE') || text.includes('(PE')) return true;
  if (text.includes('DEF TACT') || text.includes('DEFENSE TACT') || text.includes('DEFENSE TACTICS')) return true;
  return false;
}

// --- UI subcomponents (unchanged structure) ---
function BlockList({ items, selectedId, onSelect, loading, onProgramChange, hideFilters = false }) {
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const skStart = useColorModeValue('gray.100','gray.700');
  const skEnd = useColorModeValue('gray.200','gray.600');
  const [q, setQ] = React.useState('');
  const [prog, setProg] = React.useState('');
  const [yr, setYr] = React.useState('');

  const metaList = React.useMemo(() => {
    return (items || []).map(b => {
      const m = parseBlockMeta(b.blockCode || '');
      return { ref: b, prog: String(m.programcode || '').toUpperCase(), yr: String(m.yearlevel || '').trim() };
    });
  }, [items]);

  const programOptions = React.useMemo(() => {
    const set = new Set(metaList.map(m => m.prog).filter(Boolean));
    return Array.from(set).sort();
  }, [metaList]);

  const yearOptions = React.useMemo(() => {
    const list = metaList.filter(m => !prog || m.prog === prog).map(m => m.yr).filter(Boolean);
    const set = new Set(list);
    return Array.from(set).sort((a,b) => Number(a) - Number(b));
  }, [metaList, prog]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const arr = metaList.filter(m => (!prog || m.prog === prog) && (!yr || m.yr === yr)).map(m => m.ref);
    if (!needle) return arr;
    return arr.filter(b => String(b.blockCode || '').toLowerCase().includes(needle));
  }, [metaList, prog, yr, q]);
  const sorted = React.useMemo(() => {
    const arr = (filtered || []).slice();
    const keyOf = (b) => {
      const { programcode, yearlevel, section } = parseBlockMeta(b.blockCode || '');
      const yr = parseInt(yearlevel || '0', 10) || 0;
      const sec = String(section || '').padStart(3, '0');
      return [programcode, yr.toString().padStart(2,'0'), sec, (b.blockCode || '')].join('|');
    };
    return arr.sort((a,b) => keyOf(a).localeCompare(keyOf(b)));
  }, [filtered]);
  return (
    
    <VStack align="stretch" spacing={3} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={bg} minH="calc(100vh - 210px)">
      {!hideFilters && (
        <HStack spacing={2} flexWrap="wrap">
          <Select size="sm" placeholder="Program" value={prog} onChange={(e)=>{ const v=e.target.value; setProg(v); setYr(''); try { onProgramChange && onProgramChange(v); } catch {} }} maxW="180px">
            {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select size="sm" placeholder="Year" value={yr} onChange={(e)=>setYr(e.target.value)} maxW="120px">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search blocks" size="sm" maxW="220px" />
          <IconButton aria-label="Search" icon={<FiSearch />} size="sm" variant="outline" />
        </HStack>
      )}
      <VStack align="stretch" spacing={2} overflowY="auto">
        {loading && (
          <VStack align="stretch" spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={`blk-skel-${i}`} p={2} borderWidth="1px" borderColor={border} rounded="md" bg={bg}>
                <HStack justify="space-between">
                  <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="60%" rounded="sm" />
                  <Skeleton startColor={skStart} endColor={skEnd} height="16px" width="70px" rounded="sm" />
                </HStack>
                <Wrap mt={2} spacing={1}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={`room-${i}-${j}`} startColor={skStart} endColor={skEnd} height="14px" width="60px" rounded="md" />
                  ))}
                </Wrap>
              </Box>
            ))}
          </VStack>
        )}
        {!loading && sorted.map(b => (
          <Box key={b.id}
            onClick={()=>onSelect(b)}
            cursor="pointer"
            p={2}
            borderWidth="1px"
            borderColor={String(selectedId)===String(b.id)?'blue.400':border}
            rounded="md"
            _hover={{ borderColor: 'blue.400' }}
          >
            <HStack justify="space-between">
              <Text fontWeight="600">{b.blockCode}</Text>
              {b.isActive ? <Badge colorScheme="green">Active</Badge> : <Badge>Inactive</Badge>}
            </HStack>
            <Wrap mt={1} spacing={1}>
              {(String(b.room || '').split(',').map(x=>x.trim()).filter(Boolean)).slice(0,3).map((r, i)=>( 
                <WrapItem key={`r-${b.id}-${i}`}><Tag size="sm" variant="subtle" colorScheme="blue">{r}</Tag></WrapItem>
              ))}
            </Wrap>
            {b.session && <Text fontSize="xs" color={muted} mt={1}>{b.session}</Text>}
          </Box>
        ))}
        {!loading && sorted.length === 0 && (
          <Text fontSize="sm" color={muted}>No blocks match.</Text>
        )}
      </VStack>
    </VStack>
  );
}

// --- main component ---

/* moved to components/AssignmentRow.jsx */
function AssignmentRowOld({
  row,
  faculties,
  schedulesSource,
  allCourses,
  statsCourses,
  blockCode,
  attendanceStats,
  disabled,
  onChange,
  onToggle,
  onRequestLockChange,
  onRequestConflictInfo,
  onRequestSuggest,
  onRequestDelete,
  onRequestAssign,
  onRequestResolve,
  onRequestAddToSwap,
  onRequestHistory,
  isAdmin,
}) {
  const timeOpts = getTimeOptions();
  const dayOpts = ['MON-FRI', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'MWF', 'TTH', 'TBA'];
  const semOpts = ['1st', '2nd', 'Sem'];

  const rowBorder = useColorModeValue('gray.100', 'gray.700');
  const mutedText = useColorModeValue('gray.600', 'gray.300');

  const isLocked =
    !!row?._locked ||
    (function (v) {
      if (typeof v === 'boolean') return v;
      const s = String(v || '').toLowerCase();
      return s === 'yes' || s === 'true' || s === '1';
    })(row?.lock);

  const hasDoubleBooked =
    Array.isArray(row?._conflictDetails) &&
    row._conflictDetails.some(d =>
      String(d?.reason || '').toLowerCase().includes('double-booked: same faculty')
    );

  const normTerm = (v) => normalizeSem(v);
  const timeKey = (t) => normalizeTimeBlock(t || '')?.key || String(t || '').trim();
  const sectionOf = (s) => String(s?.section ?? s?.blockCode ?? '').trim().toLowerCase();
  const facultyKey = (s) =>
    s.facultyId != null
      ? `id:${s.facultyId}`
      : `nm:${String(s.instructor || s.faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  const currFacKey =
    row?._facultyId != null
      ? `id:${row._facultyId}`
      : `nm:${String(row._faculty || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  // ---------------------------------------------------------------------------
  // Shared scoring: indexes + stats + score map, same engine as AssignFacultyModal
  // ---------------------------------------------------------------------------

  const indexesAll = React.useMemo(
    () => buildIndexes(allCourses || []),
    [allCourses]
  );

  const stats = React.useMemo(
    () => buildFacultyStats(faculties || [], statsCourses || allCourses || []),
    [faculties, statsCourses, allCourses]
  );

  const scheduleForScoring = React.useMemo(
    () => ({
      id: row?._existingId || row?.id,
      code: row?.course_name || row?.courseName || row?.code,
      title: row?.course_title || row?.courseTitle || row?.title,
      section: blockCode || row?.section || row?.blockCode,
      term: row?._term || row?.semester || row?.term,
      schedule: row?._time || row?.time || row?.schedule,
      day: row?._day || row?.day,
      program: row?.program,
      programcode: row?.programcode,
      dept: row?.dept,
      session: row?.session,
      f2fDays: row?.f2fDays || row?.f2fSched || row?.f2fsched || row?.day,
    }),
    [row, blockCode]
  );

  const scoreOf = React.useMemo(
    () =>
      buildFacultyScoreMap({
        faculties: faculties || [],
        stats,
        indexesAll,
        schedule: scheduleForScoring,
        attendanceStats: attendanceStats,
      }),
    [faculties, stats, indexesAll, scheduleForScoring, attendanceStats]
  );

  // ---------------------------------------------------------------------------
  // Eligible options (with shared scores, no extra rounding)
  // ---------------------------------------------------------------------------

const eligibleOptions = React.useMemo(() => {
  const base = faculties || [];
  if (!row) return base;

  const noTermOrTime = !row?._term || !row?._time;

  const sect = String(blockCode || '').trim().toLowerCase();
  const tKey = timeKey(row._time);
  const term = normTerm(row._term);
  const busy = new Set();

  if (!noTermOrTime) {
    for (const s of schedulesSource || []) {
      if (row._existingId && String(s.id) === String(row._existingId)) continue;
      if (normTerm(s.term) !== term) continue;

      const sSect = sectionOf(s);
      if (sSect !== sect) continue;

      const sKey = timeKey(s.schedule || s.time || '');
      if (!sKey || !tKey) continue;

      if (sKey === tKey) {
        busy.add(facultyKey(s));
      } else {
        const a = normalizeTimeBlock(sKey);
        const b = normalizeTimeBlock(tKey);
        if (
          a &&
          b &&
          Number.isFinite(a.start) &&
          Number.isFinite(a.end) &&
          Number.isFinite(b.start) &&
          Number.isFinite(b.end)
        ) {
          if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) {
            busy.add(facultyKey(s));
          }
        }
      }
    }
  }

  const filtered = base.filter(o => {
    const key =
      o.id != null
        ? `id:${o.id}`
        : `nm:${String(o.label || o.name || o.faculty || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')}`;
    // Always include current selection
    if (key === currFacKey) return true;
    // Exclude time/term busy conflicts unless missing context
    if (!noTermOrTime && busy.has(key)) return false;
    // Dept filter: only show faculty whose dept matches programcode, with whitelist
    const prog = String(row?.programcode || row?.program || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const deptRaw = String(o.dept || '')
      .toUpperCase();
    const deptStripped = deptRaw.replace(/[^A-Z0-9]/g, '');
    const always = ['GENED', 'KNP PARTTIME', 'PARTTIME', 'PE'];
    const whitelisted = always.includes(deptRaw.trim());
    const deptMatches = prog ? (deptStripped.includes(prog)) : true;
    return whitelisted || deptMatches;
  });

  const scored = filtered.map(o => {
    const entry = scoreOf.get(String(o.id)) || { score: 0, parts: {} };
    const rawScore = entry.score ?? 0;

    return {
      ...o,
      // raw numeric score (full precision, for matching the modal)
      score: rawScore,
      // formatted score for display – ALWAYS two decimal places
      scoreLabel: Number(rawScore).toFixed(2),
      parts: entry.parts || {},
    };
  });

  scored.sort((a, b) => {
    const sa = typeof a.score === 'number' ? a.score : -1;
    const sb = typeof b.score === 'number' ? b.score : -1;
    // Match AssignFacultyModal: sort by displayed precision (2 decimals)
    const ra = Math.round(sa * 100) / 100;
    const rb = Math.round(sb * 100) / 100;
    if (rb !== ra) return rb - ra;
    const la = String(a.label || a.name || a.faculty || '');
    const lb = String(b.label || b.name || b.faculty || '');
    return la.localeCompare(lb);
  });

  return scored;
}, [
  faculties,
  schedulesSource,
  blockCode,
  row?._term,
  row?._time,
  row?._existingId,
  row?._facultyId,
  row?._faculty,
  scoreOf,
]);


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // (Draft badge removed in block view per request)

  return (
    <HStack spacing={2} py={2} borderBottomWidth="1px" borderColor={rowBorder}>
      <Checkbox
        isChecked={!!row._selected}
        onChange={(e) => onToggle(e.target.checked)}
        isDisabled={disabled}
      />
      <Box flex="1 1 auto">
        <Text fontWeight="600">
          {row.course_name || row.courseName}{' '}
          <Text as="span" fontWeight="400" color={mutedText}>
            ({row.course_title || row.courseTitle})
          </Text>
        </Text>
        <HStack spacing={3} fontSize="sm" color={mutedText}>
          <Text>Units: {row.unit ?? '-'}</Text>
          <Text>Year: {row.yearlevel ?? '-'}</Text>
          <Text>Sem: {row.semester ?? '-'}</Text>
        </HStack>
      </Box>

      {row._existingId && (
        isLocked ? (
          <Tooltip label={isAdmin ? 'Locked. Click to unlock.' : 'Locked. Only admin can unlock.'}>
            <IconButton
              aria-label="Unlock"
              icon={<FiLock />}
              size="sm"
              colorScheme="red"
              variant="ghost"
              onClick={() => onRequestLockChange(false)}
              isDisabled={disabled || !isAdmin}
            />
          </Tooltip>
        ) : (
          <Tooltip label="Unlocked. Click to lock.">
            <IconButton
              aria-label="Lock"
              icon={<FiLock />}
              size="sm"
              variant="ghost"
              onClick={() => onRequestLockChange(true)}
              isDisabled={disabled}
            />
          </Tooltip>
        )
      )}

      <Select
        size="sm"
        value={row._term || ''}
        onChange={(e) => onChange({ _term: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="130px"
      >
        <option value="">Term</option>
        {semOpts.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        size="sm"
        value={row._day || 'MON-FRI'}
        onChange={(e) => onChange({ _day: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="140px"
      >
        {dayOpts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select
        size="sm"
        value={row._time || ''}
        onChange={(e) => onChange({ _time: e.target.value })}
        isDisabled={disabled || row._locked}
        maxW="160px"
      >
        {timeOpts.map((t) => (
          <option key={t} value={t}>
            {t || 'Time'}
          </option>
        ))}
      </Select>

      <Box minW="220px" maxW="260px">
        <FacultySelect
          value={row._faculty || ''}
          onChange={(name) => onChange({ _faculty: name })}
          onChangeId={(fid) => onChange({ _facultyId: fid })}
          options={eligibleOptions}
          allowClear
          disabled={disabled || row._locked}
          placeholder="Faculty"
        />
      </Box>

      <HStack spacing={1}>
        {row._checking ? (
          <HStack spacing={1}>
            <Spinner size="xs" />
            <Text fontSize="xs" color={mutedText}>
              Checking...
            </Text>
          </HStack>
        ) : (
          <Badge
            colorScheme={
              row._status === 'Assigned'
                ? 'green'
                : row._status === 'Conflict'
                ? 'red'
                : 'gray'
            }
          >
            {row._status || 'Unassigned'}
          </Badge>
        )}

        {/* Draft badge removed */}

        {row._status === 'Conflict' && (
          <>
            <Tooltip label="Explain conflict">
              <IconButton
                aria-label="Conflict details"
                icon={<FiInfo />}
                size="xs"
                variant="ghost"
                onClick={onRequestConflictInfo}
              />
            </Tooltip>
            <Tooltip label="Suggestions">
              <IconButton
                aria-label="Suggestions"
                icon={<FiHelpCircle />}
                size="xs"
                variant="ghost"
                onClick={onRequestSuggest}
              />
            </Tooltip>
            {!isLocked && hasDoubleBooked && (
              <Tooltip label="Resolve by replacing conflicting schedule">
                <Button
                  size="xs"
                  colorScheme="purple"
                  variant="solid"
                  onClick={onRequestResolve}
                >
                  Resolve
                </Button>
              </Tooltip>
            )}
          </>
        )}

        {!isLocked && row._existingId && (
          <Tooltip label="Add to Swap">
            <IconButton
              aria-label="Add to Swap"
              icon={<FiRefreshCw />}
              size="xs"
              variant="ghost"
              onClick={onRequestAddToSwap}
            />
          </Tooltip>
        )}

        <Tooltip label={isLocked ? 'Locked. Unlock to assign.' : 'Assign faculty (scored)'}>
          <IconButton
            aria-label="Assign faculty"
            icon={<FiUserPlus />}
            size="sm"
            colorScheme="blue"
            variant="ghost"
            onClick={onRequestAssign}
            isDisabled={disabled || isLocked}
          />
        </Tooltip>

        {row._existingId && (
          <>
            <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
              <IconButton
                aria-label="Delete assignment"
                icon={<FiTrash />}
                size="sm"
                colorScheme="red"
                variant="ghost"
                onClick={onRequestDelete}
                isDisabled={disabled || isLocked}
              />
            </Tooltip>

            {isAdmin && (
              <Tooltip label="View history">
                <IconButton
                  aria-label="View history"
                  icon={<FiInfo />}
                  size="sm"
                  variant="ghost"
                  onClick={() => onRequestHistory && onRequestHistory(row)}
                  isDisabled={!(row?._existingId || row?.id)}
                />
              </Tooltip>
            )}
          </>
        )}

      </HStack>
      {/* Admin-only history button is wired by parent via onRequestHistory */}
    </HStack>
  );
}

export default function CourseLoading() {
  const dispatch = useDispatch();
  const toast = useToast();
  
  // ---------------------------- Load Limit Guard (non-admin) ----------------------------
  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const findFacultyById = (id) => {
    try { return (facultyAll || []).find(f => String(f.id) === String(id)) || null; } catch { return null; }
  };
  const findFacultyByName = (name) => {
    const key = normalizeName(name);
    try { return (facultyAll || []).find(f => normalizeName(f.name || f.faculty) === key) || null; } catch { return null; }
  };
  const employmentOf = (fac) => {
    const v = String(fac?.employment || '').toLowerCase();
    return v.includes('part') ? 'part-time' : 'full-time';
  };
  // Enforce 12 units for part-time, 24 units for full-time
  const maxUnitsFor = (fac) => employmentOf(fac) === 'part-time' ? 12 : 36;
  const getIntendedFacultyName = (r) => {
    if (r._facultyId != null) {
      const fac = findFacultyById(r._facultyId);
      if (fac?.name || fac?.faculty) return fac.name || fac.faculty;
    }
    return r._faculty || r.faculty || r.instructor || '';
  };
  const getIntendedFacultyId = (r) => {
    if (r._facultyId != null) return r._facultyId;
    const fac = findFacultyByName(getIntendedFacultyName(r));
    return fac?.id ?? null;
  };
  const getExistingFacultyName = (r) => String(r.instructor || r.faculty || '').trim();
  const getExistingFacultyId = (r) => (r.facultyId != null ? r.facultyId : (r.faculty_id != null ? r.faculty_id : null));
  const parseUnits = (r) => { const u = Number(r.unit); return Number.isFinite(u) ? u : 0; };
  const ensureFacultyLoadLimitsForRows = async (rowsToApply) => {
    const nonAdminMapped = (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0);
    if (!nonAdminMapped) return true;
    const incByFaculty = new Map();
    for (const r of rowsToApply) {
      const targetId = getIntendedFacultyId(r);
      const targetName = getIntendedFacultyName(r);
      if (!(targetId || targetName)) continue;
      const existingName = getExistingFacultyName(r);
      const existingId = getExistingFacultyId(r);
      const creating = !r._existingId;
      const changingFac = creating || (targetId != null ? String(targetId) !== String(existingId) : (normalizeName(targetName) !== normalizeName(existingName)));
      if (!changingFac) continue;
      const inc = parseUnits(r);
      if (inc <= 0) continue;
      const key = targetId != null ? `id:${targetId}` : `nm:${normalizeName(targetName)}`;
      incByFaculty.set(key, (incByFaculty.get(key) || 0) + inc);
    }
    for (const [key, addUnits] of incByFaculty.entries()) {
      try {
        const meta = key.startsWith('id:') ? findFacultyById(key.slice(3)) : findFacultyByName(key.slice(3));
        const name = meta?.name || meta?.faculty || '';
        const max = maxUnitsFor(meta);
        const current = await (async () => { try { const sy = settingsLoad?.school_year || ""; const sem = settingsLoad?.semester || ""; const qs = new URLSearchParams(); if (meta?.id != null) { qs.set("facultyId", String(meta.id)); } else { qs.set("instructor", name); } if (sy) qs.set("schoolyear", sy); if (sem) qs.set("semester", sem); const res = await api.request(`/?${qs.toString()}&_ts=${Date.now()}`); const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || [])); return (list || []).reduce((s,c)=> s + (Number(c.unit)||0), 0); } catch { return 0; } })();
        const proposed = current + Number(addUnits || 0);
        if (proposed > max) {
          toast({ title: 'Load limit exceeded', description: `${name}: ${employmentOf(meta)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addUnits} ⇒ ${proposed}. Only admin can exceed.`, status: 'warning' });
          return false;
        }
      } catch (e) {
        toast({ title: 'Load check failed', description: `Could not verify load for ${name}.`, status: 'error' });
        return false;
      }
    }
    return true;
  };
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.300');
  const dividerBorder = useColorModeValue('gray.100','gray.700');
  const savedBg = useColorModeValue('green.50','green.900');
  const draftBg = useColorModeValue('orange.50','orange.900');
  const totalBg = useColorModeValue('blue.50','blue.900');
  const savedBorder = useColorModeValue('green.200','green.700');
  const draftBorder = useColorModeValue('orange.200','orange.700');
  const totalBorder = useColorModeValue('blue.200','blue.700');
  const savedTone = useColorModeValue('green.700','green.200');
  const draftTone = useColorModeValue('orange.700','orange.200');
  const totalTone = useColorModeValue('blue.700','blue.200');
  const termBgFirst = useColorModeValue('blue.50','blue.900');
  const termBgSecond = useColorModeValue('green.50','green.900');
  const termBgSem = useColorModeValue('orange.50','orange.900');
  const termBgOther = useColorModeValue('gray.50','gray.900');
  const termBorderFirst = useColorModeValue('blue.200','blue.700');
  const termBorderSecond = useColorModeValue('green.200','green.700');
  const termBorderSem = useColorModeValue('orange.200','orange.700');
  const termBorderOther = useColorModeValue('gray.200','gray.700');
  // Skeleton shared colors and overlay
  const skStart = useColorModeValue('gray.100','gray.700');
  const skEnd = useColorModeValue('gray.200','gray.600');
  const overlayBg = useColorModeValue('whiteAlpha.600','blackAlpha.500');

  const blocksAll = useSelector(selectBlocks);
  const facultyAll = useSelector(selectAllFaculty);
  const facultyOpts = useSelector(selectFacultyFilterOptions);
  const blocksLoading = useSelector(s => s.blocks.loading);
  const settings = useSelector(selectSettings);
  const prospectus = useSelector(selectAllProspectus);
  const existing = useSelector(selectAllCourses);
  const dataFaculties = useSelector(s => s.data.faculties);
  const accessToken = useSelector(s => s.auth.accessToken);
  const authUser = useSelector(s => s.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const isAdmin = (role === 'admin' || role === 'manager');
  const isRegistrar = role === 'registrar';
  const registrarViewOnly = isRegistrar && !isAdmin;
  const [allowedDepts, setAllowedDepts] = React.useState(null);
  const [userDeptRows, setUserDeptRows] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!authUser?.id || isAdmin || isRegistrar) { if (alive) { setAllowedDepts(null); setUserDeptRows(null); } return; }
      try {
        const rows = await api.getUserDepartmentsByUser(authUser.id);
        const list = Array.isArray(rows) ? rows : [];
        const codes = Array.from(new Set(list.map(r => String(r.department || '').toUpperCase()).filter(Boolean)));
        if (alive) { setAllowedDepts(codes); setUserDeptRows(list); }
      } catch { if (alive) { setAllowedDepts([]); setUserDeptRows([]); } }
    })();
    return () => { alive = false; };
  }, [authUser?.id, isAdmin, isRegistrar]);
  const canLoad = (!registrarViewOnly) && (isAdmin || (Array.isArray(allowedDepts) && allowedDepts.length > 0));
  const allowedDeptSet = React.useMemo(() => new Set((Array.isArray(allowedDepts) ? allowedDepts : []).map((s) => normalizeProgramCode(s))), [allowedDepts]);
  const canEditFacultyItem = React.useCallback((it) => {
    if (registrarViewOnly) return false;
    if (isAdmin) return true;
    if (!Array.isArray(allowedDepts) || allowedDepts.length === 0) return false;
    const code = normalizeProgramCode(it?.programcode || it?.program || '');
    return code && allowedDeptSet.has(code);
  }, [registrarViewOnly, isAdmin, allowedDepts, allowedDeptSet]);

  const allowedViews = React.useMemo(
    () => (registrarViewOnly ? ['blocks', 'summary'] : ['blocks', 'faculty', 'courses', 'summary']),
    [registrarViewOnly]
  );
  const [viewMode, setViewMode] = React.useState('blocks'); // 'blocks' | 'faculty' | 'courses' | 'summary'
  React.useEffect(() => {
    if (registrarViewOnly && !allowedViews.includes(viewMode)) {
      setViewMode('blocks');
    }
  }, [registrarViewOnly, allowedViews, viewMode]);
  const [selectedBlock, setSelectedBlock] = React.useState(null);
  const [selectedProgram, setSelectedProgram] = React.useState('');
  const [progBlocksLimit, setProgBlocksLimit] = React.useState(6);
  const progSentinelRef = React.useRef(null);
  const blockSkelWrapRef = React.useRef(null);
  const [blockSkelCount, setBlockSkelCount] = React.useState(8);
  const facSkelWrapRef = React.useRef(null);
  const [facSkelCount, setFacSkelCount] = React.useState(8);
  const [yearOrder, setYearOrder] = React.useState([]);
  const [loadedYears, setLoadedYears] = React.useState([]);
  const [loadingYear, setLoadingYear] = React.useState(false);
  const progYearSentinelRef = React.useRef(null);
  const [selectedFaculty, setSelectedFaculty] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [facLoading, setFacLoading] = React.useState(false);
  const [facOptions, setFacOptions] = React.useState([]);
  const [rows, setRows] = React.useState([]);
  // track schedule ids recently deleted so mapping won't re-prefill from stale fetch
  const excludeDeletedIdsRef = React.useRef(new Set());
  // cache freshly fetched schedules for the currently selected block (scoped by SY/Sem)
  const [freshCache, setFreshCache] = React.useState([]);
  // removed bulk assign state (deprecated)
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [conflictIndex, setConflictIndex] = React.useState(null);
  const [suggOpen, setSuggOpen] = React.useState(false);
  const [suggIndex, setSuggIndex] = React.useState(null);
  const [suggBusy, setSuggBusy] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);
  // Attendance stats by faculty for current SY/Sem
  const [attendanceStatsMap, setAttendanceStatsMap] = React.useState(new Map());
  // Faculty-view suggestions
  const [facSuggOpen, setFacSuggOpen] = React.useState(false);
  const [schedAssignOpen, setSchedAssignOpen] = React.useState(false);
  React.useEffect(() => {
    if (accessToken) {
      try { api.setAuthToken(accessToken); } catch {}
    }
  }, [accessToken]);
  const handleCreateFromAssignModal = React.useCallback(async (payload) => {
    try {
      const blk = String(payload?.blockCode || '').trim();
      const fid = payload?.facultyId ?? (selectedFaculty?.id ?? null);
      const fname = payload?.facultyName ?? (selectedFaculty?.name || selectedFaculty?.faculty || '');
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if (!blk || !fname || items.length === 0) return;
      const allAllowed = items.every((r) => canEditFacultyItem({ programcode: r.programcode }));
      if (!isAdmin && !allAllowed) {
        toast({ title: 'View-only', description: 'You can only create schedules for your department.', status: 'warning' });
        return;
      }
      const now = Date.now();
      const makeId = (i) => `tmp:${now}:${i}`;
      const newRows = items.map((r, i) => ({
        id: makeId(i),
        code: r.courseName,
        courseName: r.courseName,
        title: r.courseTitle,
        courseTitle: r.courseTitle,
        unit: r.unit,
        programcode: r.programcode,
        yearlevel: r.yearlevel,
        semester: r.semester,
        prospectusId: r.id,
        section: blk,
        blockCode: blk,
        term: '',
        schedule: '',
        time: '',
        day: 'MON-FRI',
        facultyId: fid,
        faculty: fname,
        instructor: fname,
        lock: false,
        _locked: false,
        _draft: true,
      }));
      setFacultySchedules((prev) => ({
        ...prev,
        items: sortFacultyScheduleItems([...(prev?.items || []), ...newRows]),
        loading: false,
      }));
    } finally {
      setSchedAssignOpen(false);
    }
  }, [selectedFaculty, canEditFacultyItem, isAdmin]);
  const [facSuggBusy, setFacSuggBusy] = React.useState(false);
  const [facSuggPlans, setFacSuggPlans] = React.useState([]);
  const [facSuggTargetId, setFacSuggTargetId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [lockDialogBusy, setLockDialogBusy] = React.useState(false);
  const [lockDialogIndex, setLockDialogIndex] = React.useState(null);
  const [lockDialogBulkIdxs, setLockDialogBulkIdxs] = React.useState([]);
  const [lockDialogTarget, setLockDialogTarget] = React.useState(null);
  const [lockDialogOpen, setLockDialogOpen] = React.useState(false);
  const cancelRef = React.useRef();
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [resolveBusy, setResolveBusy] = React.useState(false);
  const [resolveRowIndex, setResolveRowIndex] = React.useState(null);
  const [resolveConflictId, setResolveConflictId] = React.useState(null);
  const [resolveLabel, setResolveLabel] = React.useState('');
  // Faculty-view resolve dialog
  const [facResolveOpen, setFacResolveOpen] = React.useState(false);
  const [facResolveBusy, setFacResolveBusy] = React.useState(false);
  const [facResolveIndex, setFacResolveIndex] = React.useState(null);
  const [facResolveConflictId, setFacResolveConflictId] = React.useState(null);
  const [facResolveLabel, setFacResolveLabel] = React.useState('');
  // Swap tray selections (persist across block/program changes)
  const [swapA, setSwapA] = React.useState(null);
  const [swapB, setSwapB] = React.useState(null);
  // History modal state
  const [histOpen, setHistOpen] = React.useState(false);
  const [histScheduleId, setHistScheduleId] = React.useState(null);

  // Shared indexes/stats for faculty-view scoring (mirrors block view engine)

  React.useEffect(() => { dispatch(loadBlocksThunk({})); }, [dispatch]);
  const blocks = React.useMemo(() => {
    try {
      if (isAdmin) return blocksAll;
      if (!Array.isArray(blocksAll)) return blocksAll;
      if (!Array.isArray(allowedDepts) || allowedDepts.length === 0) return blocksAll;
      const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
      return blocksAll.filter(b => {
        const meta = parseBlockMeta(b.blockCode || b.section || '');
        const prog = String(meta.programcode || '').toUpperCase();
        return allow.has(prog);
      });
    } catch { return blocksAll; }
  }, [blocksAll, allowedDepts, isAdmin]);
  React.useEffect(() => { dispatch(loadFacultiesThunk({})); }, [dispatch]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.getFaculties({});
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
        // Build maps from Redux full faculty list for enrichment
        const byId = new Map();
        const byName = new Map();
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        (facultyAll || []).forEach(ff => {
          if (ff?.id != null) byId.set(String(ff.id), ff);
          const nm = ff?.name || ff?.faculty || ff?.full_name;
          if (nm) byName.set(norm(nm), ff);
        });
        const enrich = (base) => {
          const out = { ...base };
          const src = (base.id != null && byId.get(String(base.id))) || byName.get(norm(base.label));
          if (src) {
            out.name = src.name || src.faculty || src.full_name || out.label;
            out.faculty = src.faculty || undefined;
            out.full_name = src.full_name || undefined;
            out.credentials = src.credentials || src.credential || undefined;
            out.degree = src.degree || undefined;
            out.degrees = src.degrees || undefined;
            out.qualification = src.qualification || undefined;
            out.qualifications = src.qualifications || undefined;
            out.title = src.title || undefined;
            out.designation = src.designation || undefined;
            out.rank = src.rank || undefined;
            out.facultyProfile = src.facultyProfile || undefined;
            out.dept = out.dept || src.dept || src.department || '';
            out.employment = out.employment || src.employment || '';
            out.loadReleaseUnits = out.loadReleaseUnits ?? (src.load_release_units ?? src.loadReleaseUnits ?? null);
          }
          return out;
        };
        const optsRaw = (data || []).map(f => ({
          id: f.id,
          label: f.faculty || f.name || f.full_name || String(f.id),
          value: f.faculty || f.name || f.full_name || String(f.id),
          dept: f.dept || f.department || '',
          employment: f.employment || '',
          loadReleaseUnits: f.load_release_units ?? f.loadReleaseUnits ?? null,
          // pass-through known fields if API provides them
          name: f.name || f.faculty || f.full_name,
          faculty: f.faculty,
          full_name: f.full_name,
          credentials: f.credentials || f.credential,
          degree: f.degree,
          degrees: f.degrees,
          qualification: f.qualification,
          qualifications: f.qualifications,
          title: f.title,
          designation: f.designation,
          rank: f.rank,
          facultyProfile: f.facultyProfile,
        }));
        const opts = optsRaw.map(enrich);
        setFacOptions(opts);
      } catch (e) {
        setFacOptions([]);
      }
    })();
  }, [facultyAll]);

  const settingsLoad = settings?.schedulesLoad || { school_year: '', semester: '' };

  // --- Printing helpers ---
  const esc = (val) => String(val ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;').replace(/'/g,'&#039;');

  const termOrder = (t) => {
    const v = String(t || '').trim().toLowerCase();
    if (v.startsWith('1')) return 1; if (v.startsWith('2')) return 2; if (v.startsWith('s')) return 3; return 9;
  };
  const timeStart = (tStr) => {
    const tr = parseTimeBlockToMinutes(String(tStr || '').trim());
    return Number.isFinite(tr.start) ? tr.start : 99999;
  };

  const onPrintBlock = () => {
    if (!selectedBlock) return;
    const title = `Block: ${selectedBlock.blockCode || ''}`;
    const subtitle = [`School Year: ${settingsLoad?.school_year || ''}`, `Semester: ${settingsLoad?.semester || ''}`].filter(Boolean).join('  |  ');
    const headers = ['#','Course','Title','Units','Term','Time','Day','Room','Faculty'];
    const sorted = (rows || []).slice().sort((a,b) => {
      // Sort by explicit term only; do not fall back to semester
      const ta = termOrder(a._term || a.term);
      const tb = termOrder(b._term || b.term);
      if (ta !== tb) return ta - tb;
      const sa = timeStart(a._time || a.time || a.schedule);
      const sb = timeStart(b._time || b.time || b.schedule);
      if (sa !== sb) return sa - sb;
      return String(a.course_name || a.courseName || a.code || '').localeCompare(String(b.course_name || b.courseName || b.code || ''));
    });
    const bodyRows = sorted.map((r,i) => [
      String(i+1),
      String(r.course_name || r.courseName || r.code || ''),
      String(r.course_title || r.courseTitle || r.title || ''),
      String(r.unit ?? ''),
      // Display only the short term label if explicitly set; otherwise blank
      String(r._term || r.term || ''),
      String(r._time || r.time || r.schedule || ''),
      String(r._day || r.day || ''),
      // Prefer per-row room; if empty, fallback to selected block's room aggregation
      String(r.room || selectedBlock?.room || ''),
      String(r._faculty || r.faculty || r.instructor || ''),
    ]);
    const totalUnits = sorted.reduce((sum, r) => {
      const v = Number(r.unit ?? r.units ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    // Term-wise unit subtotals (1st / 2nd / Sem)
    const normShort = (t) => {
      const v = String(t || '').trim().toLowerCase();
      if (!v) return '';
      if (v.startsWith('1')) return '1st';
      if (v.startsWith('2')) return '2nd';
      if (v.startsWith('s')) return 'Sem';
      return '';
    };
    const termSums = { '1st': 0, '2nd': 0, 'Sem': 0 };
    sorted.forEach(r => {
      const k = normShort(r._term || r.term);
      if (k && Object.prototype.hasOwnProperty.call(termSums, k)) {
        const u = Number(r.unit ?? r.units ?? 0);
        if (Number.isFinite(u)) termSums[k] += u;
      }
    });
    const summaryPairs = [];
    if (termSums['1st'] > 0) summaryPairs.push(['1st Term Units', termSums['1st']]);
    if (termSums['2nd'] > 0) summaryPairs.push(['2nd Term Units', termSums['2nd']]);
    if (termSums['Sem'] > 0) summaryPairs.push(['Sem Units', termSums['Sem']]);
    summaryPairs.push(['Total Units', totalUnits]);
    const summaryRowsHtml = [];
    for (let i = 0; i < summaryPairs.length; i += 2) {
      const [l1, v1] = summaryPairs[i];
      const p2 = summaryPairs[i + 1] || ['', ''];
      const l2 = p2[0], v2 = p2[1];
      summaryRowsHtml.push(`<tr><th>${esc(l1)}</th><td>${esc(String(v1))}</td><th>${esc(l2)}</th><td>${v2 === '' ? '' : esc(String(v2))}</td></tr>`);
    }
    const termSummaryHtml = `<table class="prt-table"><tbody>${summaryRowsHtml.join('')}</tbody></table>`;
    const bodyHtml = [
      `<table class="prt-table"><tbody>
        <tr><th>Block Code</th><td>${esc(selectedBlock.blockCode || '')}</td><th>Session</th><td>${esc(selectedBlock.session || '')}</td></tr>
        <tr><th>Rooms</th><td colspan="3">${esc(String(selectedBlock.room || ''))}</td></tr>
        <tr><th>Total Units</th><td>${esc(String(totalUnits))}</td><th>Courses</th><td>${esc(String(sorted.length))}</td></tr>
      </tbody></table>`,
      buildTable(headers, bodyRows),
      termSummaryHtml
    ].join('');
    const prep = [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ').trim();
    const preparedRole = (() => {
      try {
        const list = Array.isArray(userDeptRows) ? userDeptRows : [];
        const primary = list.find(r => r && r.isPrimary && String(r.position || '').trim());
        const any = list.find(r => String(r?.position || '').trim());
        return String(primary?.position || any?.position || 'Academic Head');
      } catch { return 'Academic Head'; }
    })();
    // Faculty view: print in portrait for better per-faculty listing
    printContent({ title, subtitle, bodyHtml }, { pageSize: 'A4', orientation: 'portrait', compact: true, preparedBy: prep, preparedRole });
  };

  const onPrintProgram = () => {
    if (!selectedProgram) return;
    const title = `Program: ${selectedProgram}`;
    const subtitle = [`School Year: ${settingsLoad?.school_year || ''}`, `Semester: ${settingsLoad?.semester || ''}`]
      .filter(Boolean)
      .join('  |  ');
    const headers = ['Code', 'Title', 'Units', 'Term', 'Time', 'Day', 'Room', 'Faculty'];
    const list = Array.isArray(rows) ? rows.slice() : [];
    // Focus only on the currently viewed program
    const normProgram = (p) => String(p || '').trim().toLowerCase();
    const currentProgramNorm = normProgram(selectedProgram);
    const listForPrint = list.filter((r) => normProgram(r.program || r.programcode) === currentProgramNorm);
    if (listForPrint.length === 0) {
      toast({ title: 'Nothing to print', description: 'No schedules for the selected program.', status: 'info' });
      return;
    }
    // Hierarchy: Year Level -> Block/Section -> Courses
    const groups = new Map();
    const yearLabelOf = (r) => String(r.yearlevel || '').trim() || `Year ${extractYearDigits(r.yearlevel) || ''}`;
    listForPrint.forEach((r) => {
      const yl = yearLabelOf(r) || 'N/A';
      const sec = String(r.blockCode || r.section || 'N/A').toUpperCase();
      if (!groups.has(yl)) groups.set(yl, new Map());
      const byBlock = groups.get(yl);
      const arr = byBlock.get(sec) || [];
      arr.push(r);
      byBlock.set(sec, arr);
    });
    const sectionHtml = Array.from(groups.entries())
      .sort((a, b) => {
        const [ylA] = a;
        const [ylB] = b;
        const oA = Number(extractYearDigits(ylA) || 99);
        const oB = Number(extractYearDigits(ylB) || 99);
        if (oA !== oB) return oA - oB;
        return ylA.localeCompare(ylB, undefined, { numeric: true });
      })
      .map(([yl, byBlock]) => {
        const blocksHtml = Array.from(byBlock.entries())
          .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
          .map(([sec, arr]) => {
            const sorted = arr.slice().sort((a, b) => {
              const ta = termOrder(a._term || a.term);
              const tb = termOrder(b._term || b.term);
              if (ta !== tb) return ta - tb;
              const sa = timeStart(a._time || a.time || a.schedule);
              const sb = timeStart(b._time || b.time || b.schedule);
              if (sa !== sb) return sa - sb;
              return String(a.course_name || a.courseName || a.code || '').localeCompare(String(b.course_name || b.courseName || b.code || ''));
            });
            const blkMeta = (() => {
              try {
                return (blocks || []).find(b => String(b.blockCode || '').trim().toUpperCase() === sec);
              } catch { return null; }
            })();
            const blkRoom = blkMeta?.room || sorted.find(r => r.room)?.room || '';
            const blkSession = blkMeta?.session || sorted.find(r => r.session || r._session)?.session || '';
            const tableRows = sorted.map((r) => [
              String(r.course_name || r.courseName || r.code || ''),
              String(r.course_title || r.courseTitle || r.title || ''),
              String(r.unit ?? ''),
              String(r._term || r.term || ''),
              String(r._time || r.time || r.schedule || ''),
              String(r._day || r.day || ''),
              String(r.room || blkRoom || ''),
              String(r._faculty || r.faculty || r.instructor || ''),
            ]);
            const metaLine = [
              `<span style="font-weight:800;font-size:13px;">${esc(sec)}</span>`,
              blkSession ? `<span style="color:#2563eb;font-size:11px;text-transform:uppercase;">${esc(blkSession)}</span>` : '',
              blkRoom ? `<span style="color:#4a5568;font-size:11px;">Room: ${esc(String(blkRoom))}</span>` : '',
              `<span style="color:#4a5568;font-size:11px;">${sorted.length} course(s)</span>`,
            ].filter(Boolean).join(' | ');
            return `
              <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-top:8px;">
                <div style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div>${metaLine}</div>
                </div>
                ${buildTable(headers, tableRows)}
              </div>
            `;
          })
          .join('');
        return `
          <div style="margin:12px 0 16px 0;">
            <div style="font-weight:900;font-size:15px;letter-spacing:0.3px;color:#1f2937;margin-bottom:6px;">Year Level: ${esc(yl)}</div>
            ${blocksHtml}
          </div>
        `;
      })
      .join('');
    const noteHtml = `
      <div style="margin-top:12px;padding:10px;border:1px dashed #CBD5E0;border-radius:10px;background:#F7FAFC;">
        <div style="font-weight:700;color:#2D3748;">Tentative Load</div>
        <div style="font-size:12px;color:#4A5568;">
          This load is subject to changes and does not represent the final teaching assignment.
        </div>
      </div>
    `;
    const bodyHtml = sectionHtml + noteHtml;
    const prep = [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ').trim();
    const preparedRole = (() => {
      try {
        const list = Array.isArray(userDeptRows) ? userDeptRows : [];
        const primary = list.find(r => r && r.isPrimary && String(r.position || '').trim());
        const any = list.find(r => String(r?.position || '').trim());
        return String(primary?.position || any?.position || 'Academic Head');
      } catch { return 'Academic Head'; }
    })();
    printContent({ title, subtitle, bodyHtml }, { pageSize: 'A4', orientation: 'portrait', compact: true, preparedBy: prep, preparedRole });
  };

  const onPrintFaculty = () => {
    if (!selectedFaculty) return;
    const f = selectedFaculty;
    const title = `Faculty: ${f.name || f.faculty || ''}`;
    const headers = ['#','Code','Title','Units','Term','Time','Day','Room','Section'];
    const list = Array.isArray(facultySchedules?.items) ? facultySchedules.items : [];
    const sorted = sortFacultyScheduleItems(list);
    const bodyRows = sorted.map((r,i) => [
      String(i+1),
      String(r.code || r.courseName || ''),
      String(r.title || r.courseTitle || ''),
      String(r.unit ?? ''),
      String(r.term || ''),
      String(r.schedule || r.time || ''),
      String(r.day || ''),
      String(r.room || ''),
      String(r.section || r.blockCode || ''),
    ]);
    const totalUnits = sorted.reduce((sum, r) => {
      const v = Number(r.unit ?? r.units ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    // Term-wise unit subtotals for faculty
    const normShortF = (t) => {
      const v = String(t || '').trim().toLowerCase();
      if (!v) return '';
      if (v.startsWith('1')) return '1st';
      if (v.startsWith('2')) return '2nd';
      if (v.startsWith('s')) return 'Sem';
      return '';
    };
    const termSumsF = { '1st': 0, '2nd': 0, 'Sem': 0 };
    sorted.forEach(r => {
      const k = normShortF(r.term);
      if (k && Object.prototype.hasOwnProperty.call(termSumsF, k)) {
        const u = Number(r.unit ?? r.units ?? 0);
        if (Number.isFinite(u)) termSumsF[k] += u;
      }
    });
    const summaryPairsF = [];
    if (termSumsF['1st'] > 0) summaryPairsF.push(['1st Term Units', termSumsF['1st']]);
    if (termSumsF['2nd'] > 0) summaryPairsF.push(['2nd Term Units', termSumsF['2nd']]);
    if (termSumsF['Sem'] > 0) summaryPairsF.push(['Sem Units', termSumsF['Sem']]);
    summaryPairsF.push(['Total Units', totalUnits]);
    const summaryRowsHtmlF = [];
    for (let i = 0; i < summaryPairsF.length; i += 2) {
      const [l1, v1] = summaryPairsF[i];
      const p2 = summaryPairsF[i + 1] || ['', ''];
      const l2 = p2[0], v2 = p2[1];
      summaryRowsHtmlF.push(`<tr><th>${esc(l1)}</th><td>${esc(String(v1))}</td><th>${esc(l2)}</th><td>${v2 === '' ? '' : esc(String(v2))}</td></tr>`);
    }
    const termSummaryHtmlF = `<table class=\"prt-table\"><tbody>${summaryRowsHtmlF.join('')}</tbody></table>`;

    const metaHtml = `<table class="prt-table"><tbody>
      <tr><th>Faculty</th><td colspan="3"><span style="font-size:15px;font-weight:700;">${esc(f.name || f.faculty || '')}</span></td></tr>
      <tr><th>Department</th><td>${esc(f.department || f.dept || '')}</td><th>Employment</th><td>${esc(f.employment || '')}</td></tr>
      <tr><th>Designation</th><td colspan="3">${esc(f.designation || f.rank || '')}</td></tr>
      <tr><th>Load Release Units</th><td>${esc(String(f.loadReleaseUnits ?? f.load_release_units ?? 0))}</td><th>Schedules</th><td>${esc(String(list.length))}</td></tr>
      <tr><th>Total Units</th><td>${esc(String(totalUnits))}</td><th></th><td></td></tr>
    </tbody></table>`;
    const tentativeNoteHtml = `
      <div class="prt-banner">
        <div class="prt-banner-title">Tentative Load</div>
        <p class="prt-banner-text">This is a tentative teaching load and not final. Assignments may change after validations and approvals.</p>
      </div>`;
    const bodyHtml = [metaHtml, tentativeNoteHtml, buildTable(headers, bodyRows), termSummaryHtmlF].join('');
    // FacultyDetail-style layout triggers conforme signature block (based on title prefix)
    const prep = [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ').trim();
    const preparedRole = (() => {
      try {
        const list = Array.isArray(userDeptRows) ? userDeptRows : [];
        const primary = list.find(r => r && r.isPrimary && String(r.position || '').trim());
        const any = list.find(r => String(r?.position || '').trim());
        return String(primary?.position || any?.position || 'Academic Head');
      } catch { return 'Academic Head'; }
    })();
    printContent({ title, subtitle: '', bodyHtml }, { pageSize: 'A4', orientation: 'portrait', compact: true, preparedBy: prep, preparedRole });
  };

  // Limit load/overload scoring to current load SY/Sem defaults
  const scopedCourses = React.useMemo(() => {
    const list = Array.isArray(existing) ? existing : [];
    const sy = String(settingsLoad?.school_year || '').trim();
    const sem = normalizeSem(settingsLoad?.semester || '');
    let out = list;
    if (sy) out = out.filter(c => String(c.schoolyear || c.schoolYear || c.school_year || '') === sy);
    if (sem) out = out.filter(c => normalizeSem(c.semester || c.term || c.sem || '') === sem);
    return out;
  }, [existing, settingsLoad]);
  const facIndexesAllFull = React.useMemo(() => buildIndexes(existing || []), [existing]);
  const facStatsScoped = React.useMemo(() => buildFacultyStats(facOptions || [], scopedCourses || []), [facOptions, scopedCourses]);
  const facLoadCache = React.useRef(new Map());
  const [, forceFacLoad] = React.useState(0);
  const [facBulkStats, setFacBulkStats] = React.useState(new Map());
  const calcUnitsForFaculty = React.useCallback((fac) => {
    const norm = (s) => String(s || '').trim().toLowerCase();
    const fid = fac?.id != null ? String(fac.id) : '';
    const nameKey = norm(fac?.name || fac?.faculty || fac?.full_name || '');
    return (scopedCourses || []).reduce((sum, c) => {
      const cid = c.facultyId != null ? String(c.facultyId) : (c.faculty_id != null ? String(c.faculty_id) : '');
      const cname = norm(c.facultyName || c.faculty || c.instructor || '');
      if ((fid && cid && fid === cid) || (nameKey && cname === nameKey)) {
        return sum + (Number(c.unit ?? c.units ?? c.hours ?? 0) || 0);
      }
      return sum;
    }, 0);
  }, [scopedCourses]);

  // Bulk fetch instructor stats for unit badges (per SY/Sem)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await api.getInstructorStatsBulk({
          schoolyear: settingsLoad?.school_year,
          semester: settingsLoad?.semester,
        });
        const map = new Map();
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          const fidRaw = r.facultyId ?? r.faculty_id ?? r.facultyid;
          if (fidRaw == null || fidRaw === '') return;
          const fid = String(fidRaw);
          const units = Number(r.totalUnits ?? r.total_units ?? r.units ?? r.loadUnits ?? r.load_units ?? 0) || 0;
          const count = Number(r.countSchedules ?? r.countschedules ?? r.scheduleCount ?? r.count ?? 0) || 0;
          map.set(fid, { units, count });
        });
        if (!alive) return;
        setFacBulkStats(map);
        let changed = false;
        map.forEach((val, fid) => {
          const cur = facLoadCache.current.get(fid);
          if (cur !== val.units) {
            facLoadCache.current.set(fid, val.units);
            changed = true;
          }
        });
        if (changed) forceFacLoad((v) => v + 1);
      } catch (e) {
        if (alive) setFacBulkStats(new Map());
      }
    })();
    return () => { alive = false; };
  }, [settingsLoad?.school_year, settingsLoad?.semester]);

  const unitsForFaculty = React.useCallback((fac) => {
    const key = String(fac?.id ?? '');
    const bulk = key ? facBulkStats.get(key) : null;
    const bulkUnits = bulk ? Number(bulk.units) : null;
    const cached = key ? facLoadCache.current.get(key) : null;
    const stats = key ? facStatsScoped.get(key) || {} : {};
    const candidate =
      (Number.isFinite(bulkUnits) ? bulkUnits : null) ??
      (cached != null && Number.isFinite(Number(cached)) ? Number(cached) : null) ??
      (Number.isFinite(Number(stats.load)) ? Number(stats.load) : null);
    if (Number.isFinite(candidate)) {
      if (key && (!facLoadCache.current.has(key) || facLoadCache.current.get(key) !== candidate)) {
        facLoadCache.current.set(key, candidate);
      }
      return candidate;
    }
    const fallback = calcUnitsForFaculty(fac);
    if (key && Number.isFinite(fallback)) facLoadCache.current.set(key, fallback);
    return fallback;
  }, [facBulkStats, facStatsScoped, calcUnitsForFaculty]);

  // Fetch attendance stats per faculty (all-time, regardless of SY/Sem)
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

  // Helper: reload currently selected block using the same path as the Reload button
  const reloadCurrentBlock = async () => {
    if (!selectedBlock) return;
    try {
      // Find a fresh instance from the blocks list to mimic a real click
      const byId = (blocks || []).find(b => String(b.id) === String(selectedBlock.id));
      const byCode = (blocks || []).find(b => !byId && String(b.blockCode) === String(selectedBlock.blockCode));
      const ref = byId || byCode || selectedBlock;
      await onSelectBlock(ref);
    } catch {}
  };

  // Quick retry wrapper for reload to handle eventual consistency (up to 3 tries)
  const retryReloadCurrentBlock = async (maxTries = 3, delayMs = 400) => {
    for (let i = 0; i < maxTries; i++) {
      try {
        await reloadCurrentBlock();
        return true;
      } catch {}
      await new Promise(res => setTimeout(res, delayMs));
    }
    return false;
  };

  const onSelectBlock = async (b) => {
    // Clear program view state and existing rows immediately for a snappy switch
    try { setSelectedProgram(''); } catch {}
    setRows([]);
    setFreshCache([]);
    setSelectedBlock(b);
    const meta = parseBlockMeta(b.blockCode);
    setLoading(true);
    try {
      const action = await dispatch(loadProspectusThunk({ programcode: meta.programcode, yearlevel: meta.yearlevel, semester: settingsLoad?.semester || undefined }));
      let items = Array.isArray(action?.payload?.items) ? action.payload.items : (Array.isArray(prospectus) ? prospectus : []);
      const wantProgNorm = normalizeProgramCode(meta.programcode);
      const wantBaseNorm = normalizeProgramCode(meta.programcode.split('-')[0] || meta.programcode);
      const wantYear = extractYearDigits(meta.yearlevel);
      const tryExact = items.filter(p => normalizeProgramCode(p.programcode || p.program) === wantProgNorm);
      const dataset = tryExact.length > 0 ? tryExact : items.filter(p => normalizeProgramCode(p.programcode || p.program) === wantBaseNorm);
      let narrowed = dataset.filter(p => {
        if (!wantYear) return true;
        const y = extractYearDigits(p.yearlevel);
        return y === wantYear;
      });
      if (wantYear && narrowed.length === 0) narrowed = dataset;
      const loadSem = normalizeSem(settingsLoad?.semester || '');
      if (loadSem) {
        const bySem = narrowed.filter(p => normalizeSem(p.semester) === loadSem);
        if (bySem.length > 0) narrowed = bySem;
      }
      items = narrowed;
      const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
      const blockCode = String(b.blockCode || '').trim();
      // Fresh schedules from API for this block + current load SY/Sem
      let fresh = [];
      try {
        const q = new URLSearchParams();
        if (blockCode) q.set('blockCode', blockCode);
        if (settingsLoad?.school_year) q.set('sy', settingsLoad.school_year);
        if (settingsLoad?.semester) q.set('sem', settingsLoad.semester);
        const resp = await api.request(`/?${q.toString()}`);
        fresh = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      } catch {}
      // Keep a local cache of fresh schedules so re-marking uses the same source
      setFreshCache(Array.isArray(fresh) ? fresh : []);
      const exRowsBase = fresh.length ? fresh : (existing || []);
      const exRows = exRowsBase.filter(c => !excludeDeletedIdsRef.current.has(c.id));
      const findExistingFor = (pros) => {
        const pid = pros?.id != null ? String(pros.id) : null;
        const pCode = norm(pros.course_name || pros.courseName || pros.code);
        const pTitle = norm(pros.course_title || pros.courseTitle || pros.title);
        const matches = exRows.filter(c => {
          const sectionVal = c.section != null ? c.section : (c.blockCode != null ? c.blockCode : '');
          const sameBlock = norm(sectionVal) === norm(blockCode);
          if (!sameBlock) return false;
          if (pid && String(c.prospectusId || '') === pid) return true;
          const cCode = norm(c.code || c.courseName);
          const cTitle = norm(c.title || c.courseTitle);
          const codeMatch = pCode && cCode && pCode === cCode;
          const titleMatch = pTitle && cTitle && pTitle === cTitle;
          return codeMatch || titleMatch;
        });
        return matches[0] || null;
      };

      const mapped = items.map(p => {
        const hit = findExistingFor(p);
        const locked = (() => {
          const v = hit?.lock;
          if (typeof v === 'boolean') return v;
          const s = String(v || '').trim().toLowerCase();
          return s === 'yes' || s === 'true' || s === '1';
        })();
const prefill = hit ? {                                                                                                                               
             _term: canonicalTerm(hit.term || ''),                                                                                                               
              _time: hit.schedule || hit.time || '',                                                                                                              
            _faculty: hit.facultyName || hit.faculty || hit.instructor || '',
             _day: hit.day || 'MON-FRI',                                                                                                                         
             room: hit.room || '',                                                                                                                               
          } : { _term: '', _time: '', _faculty: '', _day: 'MON-FRI' };
        return {
          ...p,
          ...prefill,
          _existingId: hit?.id || null,
          _locked: !!(hit && locked),
          _selected: false,
          _baseTerm: prefill._term || '',
          _baseTime: prefill._time || '',
          _baseDay: prefill._day || 'MON-FRI',
          _baseFaculty: prefill._faculty || '',
          _baseFacultyId: hit?.facultyId ?? hit?.faculty_id ?? null,
          _status: hit ? 'Assigned' : 'Unassigned',
        };
      });
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  // When existing schedules load/refresh, re-mark current block rows as Assigned/Unassigned
  React.useEffect(() => {
    if (!selectedBlock || !Array.isArray(rows) || rows.length === 0) return;
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
    const blockCode = String(selectedBlock.blockCode || '').trim();
    const findExistingForName = (name, title, pid) => {
      const pCode = norm(name);
      const pTitle = norm(title);
      const source = (freshCache && freshCache.length) ? freshCache : (existing || []);
      const matches = source.filter(c => {
        if (excludeDeletedIdsRef.current && excludeDeletedIdsRef.current.has(c.id)) return false;
        const sectionVal = c.section != null ? c.section : (c.blockCode != null ? c.blockCode : '');
        const sameBlock = norm(sectionVal) === norm(blockCode);
        if (!sameBlock) return false;
        if (pid && String(c.prospectusId || '') === String(pid)) return true;
        const cCode = norm(c.code || c.courseName);
        const cTitle = norm(c.title || c.courseTitle);
        const codeMatch = pCode && cCode && pCode === cCode;
        const titleMatch = pTitle && cTitle && pTitle === cTitle;
        return codeMatch || titleMatch;
      });
      return matches[0] || null;
    };
    const next = rows.map(r => {
      const hit = findExistingForName(r.course_name || r.courseName || r.code, r.course_title || r.courseTitle || r.title, r.id);
      const locked = (() => {
        const v = hit?.lock; if (typeof v === 'boolean') return v; const s = String(v || '').trim().toLowerCase(); return s === 'yes' || s === 'true' || s === '1';
      })();
      const prefillTerm = r._term || (hit ? canonicalTerm(hit.term || '') : '');
      const prefillTime = r._time || (hit ? (hit.schedule || hit.time || '') : '');
      const prefillFac = r._faculty || (hit ? (hit.facultyName || hit.faculty || hit.instructor || '') : '');
      const prefillDay = r._day || (hit ? (hit.day || 'MON-FRI') : 'MON-FRI');
      const prefillRoom = r.room || (hit ? (hit.room || '') : '');
      return {
        ...r,
        _existingId: hit?.id || null,
        _locked: !!(hit && locked),
        _status: hit ? 'Assigned' : 'Unassigned',
        _term: prefillTerm,
        _time: prefillTime,
        _faculty: prefillFac,
        _day: prefillDay,
        room: prefillRoom,
        _baseTerm: hit ? canonicalTerm(hit.term || '') : (r._baseTerm || prefillTerm || ''),
        _baseTime: hit ? (hit.schedule || hit.time || '') : (r._baseTime || prefillTime || ''),
        _baseDay: hit ? (hit.day || 'MON-FRI') : (r._baseDay || prefillDay || 'MON-FRI'),
        _baseFaculty: hit ? (hit.facultyName || hit.faculty || hit.instructor || '') : (r._baseFaculty || prefillFac || ''),
        _baseFacultyId: hit ? (hit.facultyId ?? hit.faculty_id ?? null) : (r._baseFacultyId ?? null),
      };
    });
    setRows(next);
  }, [existing, selectedBlock, freshCache]);

  // Program-level view (no block selected): stage 1 fetch prospectus and determine year order
  React.useEffect(() => {
    (async () => {
      if (selectedBlock) return;
      const prog = String(selectedProgram || '').trim();
      if (!prog) { setRows([]); setYearOrder([]); setLoadedYears([]); return; }
      setLoading(true);
      try {
        const sem = settingsLoad?.semester || '';
        const prosp = await api.getProspectus({ programcode: prog, semester: sem || undefined });
        const items = Array.isArray(prosp) ? prosp : (Array.isArray(prosp?.data) ? prosp.data : []);
        const loadSem = normalizeSem(sem || '');
        const narrowed = loadSem ? items.filter(p => normalizeSem(p.semester) === loadSem) : items;
        const yrs = Array.from(new Set(narrowed.map(p => extractYearDigits(p.yearlevel)).filter(Boolean)))
          .sort((a,b) => Number(a) - Number(b));
        setYearOrder(yrs);
        setRows([]);
        setLoadedYears([]);
      } catch {
        setYearOrder([]);
        setRows([]);
        setLoadedYears([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedProgram, selectedBlock, settingsLoad?.semester]);

  // Reset progressive block limit when program changes
  React.useEffect(() => {
    setProgBlocksLimit(6);
  }, [selectedProgram, settingsLoad?.school_year, settingsLoad?.semester]);

  // Stage 2: progressive per-year loading (on demand)
  const loadProgramYear = React.useCallback(async (yearDigit) => {
    if (!yearDigit) return;
    const prog = String(selectedProgram || '').trim();
    if (!prog) return;
    if (loadingYear) return;
    setLoadingYear(true);
    try {
      const sy = String(settingsLoad?.school_year || '').trim();
      const sem = settingsLoad?.semester || '';
      // Fetch fresh schedules for program + yearlevel
      const q = new URLSearchParams();
      q.set('programCode', prog);
      if (sy) q.set('sy', sy);
      if (sem) q.set('sem', sem);
      q.set('yearlevel', String(yearDigit));
      const resp = await api.request(`/?${q.toString()}`);
      const fresh = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      // Prospectus for program (already used to compute years), but refetch to keep simple
      const prosp = await api.getProspectus({ programcode: prog, semester: sem || undefined });
      const items = Array.isArray(prosp) ? prosp : (Array.isArray(prosp?.data) ? prosp.data : []);
      const loadSem = normalizeSem(sem || '');
      const narrowedAll = loadSem ? items.filter(p => normalizeSem(p.semester) === loadSem) : items;
      const narrowed = narrowedAll.filter(p => extractYearDigits(p.yearlevel) === String(yearDigit));
      const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
      const exRows = (fresh || []).filter(c => !excludeDeletedIdsRef.current.has(c.id));
      // Index by block
      const secOf = (c) => norm(c.blockCode || c.section || '');
      const yearOf = (s) => extractYearDigits(s.yearlevel);
      const codeOf = (s) => norm(s.code || s.courseName);
      const titleOf = (s) => norm(s.title || s.courseTitle);
      const pidOf = (s) => (s?.prospectusId != null ? String(s.prospectusId) : null);
      const exByBlockPid = new Map();
      const exByBlockCode = new Map();
      const exByBlockTitle = new Map();
      const blockSet = new Set();
      for (const s of exRows) {
        const sec = secOf(s);
        if (!sec) continue;
        blockSet.add(sec);
        const pid = pidOf(s);
        const cN = codeOf(s);
        const tN = titleOf(s);
        if (pid) {
          if (!exByBlockPid.has(sec)) exByBlockPid.set(sec, new Map());
          const m = exByBlockPid.get(sec);
          if (!m.has(pid)) m.set(pid, s);
        }
        if (cN) {
          if (!exByBlockCode.has(sec)) exByBlockCode.set(sec, new Map());
          const m = exByBlockCode.get(sec);
          if (!m.has(cN)) m.set(cN, s);
        }
        if (tN) {
          if (!exByBlockTitle.has(sec)) exByBlockTitle.set(sec, new Map());
          const m = exByBlockTitle.get(sec);
          if (!m.has(tN)) m.set(tN, s);
        }
      }
      const findExistingForBlock = (pros, blockCode) => {
        const pid = pros?.id != null ? String(pros.id) : null;
        const pCode = norm(pros.course_name || pros.courseName || pros.code);
        const pTitle = norm(pros.course_title || pros.courseTitle || pros.title);
        const wantYear = extractYearDigits(pros.yearlevel);
        const sec = norm(blockCode || '');
        let hit = null;
        if (pid && exByBlockPid.get(sec)?.has(pid)) hit = exByBlockPid.get(sec).get(pid);
        if (!hit && pCode && exByBlockCode.get(sec)?.has(pCode)) hit = exByBlockCode.get(sec).get(pCode);
        if (!hit && pTitle && exByBlockTitle.get(sec)?.has(pTitle)) hit = exByBlockTitle.get(sec).get(pTitle);
        if (hit && wantYear) {
          const y = yearOf(hit);
          if (y && y !== wantYear) hit = null;
        }
        return hit;
      };
      // Also include available blocks from the Blocks dataset that match this program + year
      try {
        const progNorm = normalizeProgramCode(prog);
        const fromList = (blocks || [])
          .filter(b => {
            const meta = parseBlockMeta(b.blockCode || '');
            const codeNorm = normalizeProgramCode(meta.programcode || '');
            const yr = extractYearDigits(meta.yearlevel || '');
            return codeNorm === progNorm && String(yr) === String(yearDigit);
          })
          .map(b => String(b.blockCode || '').trim())
          .filter(Boolean);
        for (const sec of fromList) {
          const s = norm(sec);
          if (s) blockSet.add(s);
        }
      } catch {}

      const rowsByBlock = [];
      const blockSections = Array.from(blockSet).sort((a,b) => a.localeCompare(b));
      if (blockSections.length) {
        for (const sec of blockSections) {
          for (const p of narrowed) {
            const hit = findExistingForBlock(p, sec);
            const locked = (() => {
              const v = hit?.lock; if (typeof v === 'boolean') return v; const s = String(v || '').trim().toLowerCase(); return s === 'yes' || s === 'true' || s === '1';
            })();
            const prefill = hit
              ? {
                  _term: canonicalTerm(hit.term || ''),
                  _time: hit.schedule || hit.time || '',
                  _faculty: hit.facultyName || hit.faculty || hit.instructor || '',
                  _facultyId: hit.facultyId ?? hit.faculty_id ?? null,
                  _day: hit.day || 'MON-FRI',
                  room: hit.room || '',
                }
              : { _term: '', _time: '', _faculty: '', _facultyId: null, _day: 'MON-FRI', room: '' };
            const baseTerm = prefill._term || '';
            const baseTime = prefill._time || '';
            const baseDay = prefill._day || 'MON-FRI';
            const baseFac = prefill._faculty || '';
            const baseFacId = prefill._facultyId ?? null;
            rowsByBlock.push({
              ...p,
              programcode: p.programcode || prog,
              section: sec,
              blockCode: sec,
              _existingId: hit?.id || null,
              _locked: !!(hit && locked),
              _selected: false,
              _status: hit ? 'Assigned' : 'Unassigned',
              _term: prefill._term,
              _time: prefill._time,
              _faculty: prefill._faculty,
              _facultyId: prefill._facultyId,
              _day: prefill._day,
              room: prefill.room,
              _baseTerm: baseTerm,
              _baseTime: baseTime,
              _baseDay: baseDay,
              _baseFaculty: baseFac,
              _baseFacultyId: baseFacId,
            });
          }
        }
      } else {
        for (const p of narrowed) {
          rowsByBlock.push({
            ...p,
            programcode: p.programcode || prog,
            section: '',
            blockCode: '',
            _existingId: null,
            _locked: false,
            _selected: false,
            _status: 'Unassigned',
            _term: '',
            _time: '',
            _faculty: '',
            _facultyId: null,
            _day: 'MON-FRI',
            room: '',
            _baseTerm: '',
            _baseTime: '',
            _baseDay: 'MON-FRI',
            _baseFaculty: '',
            _baseFacultyId: null,
          });
        }
      }
      setRows(prev => prev.concat(rowsByBlock));
      setLoadedYears(prev => prev.concat(String(yearDigit)));
    } catch {}
    setLoadingYear(false);
  }, [selectedProgram, settingsLoad?.school_year, settingsLoad?.semester, loadingYear]);

  // Auto-load first available year when order is known
  React.useEffect(() => {
    if (!selectedBlock && selectedProgram && yearOrder && yearOrder.length && loadedYears.length === 0) {
      loadProgramYear(yearOrder[0]);
    }
  }, [yearOrder, selectedProgram, selectedBlock]);

  // Infinite year loader sentinel
  React.useEffect(() => {
    const el = progYearSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          const remaining = (yearOrder || []).filter(y => !loadedYears.includes(String(y)));
          if (remaining.length && !loadingYear) {
            loadProgramYear(remaining[0]);
          }
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    try { io.observe(el); } catch {}
    return () => { try { io.disconnect(); } catch {} };
  }, [progYearSentinelRef, yearOrder, loadedYears, loadingYear]);

  // Infinite scroll style: when sentinel enters view, increase block rendering limit
  React.useEffect(() => {
    const el = progSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          setProgBlocksLimit((n) => n + 6);
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });
    try { io.observe(el); } catch {}
    return () => { try { io.disconnect(); } catch {} };
  }, [progSentinelRef, selectedProgram]);

  // Dynamic block overlay skeleton count based on container height
  React.useEffect(() => {
    const el = blockSkelWrapRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const h = el.clientHeight || 480;
        const rowH = 80; // approximate AssignmentRow height
        const count = Math.max(4, Math.min(24, Math.ceil(h / rowH) + 2));
        setBlockSkelCount(count);
      } catch {}
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    try { ro.observe(el); } catch {}
    return () => { try { ro.disconnect(); } catch {} };
  }, [blockSkelWrapRef, selectedBlock]);

  // Dynamic faculty overlay skeleton count based on container height
  React.useEffect(() => {
    const el = facSkelWrapRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const h = el.clientHeight || 480;
        const rowH = 80;
        const count = Math.max(4, Math.min(24, Math.ceil(h / rowH) + 2));
        setFacSkelCount(count);
      } catch {}
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    try { ro.observe(el); } catch {}
    return () => { try { ro.disconnect(); } catch {} };
  }, [facSkelWrapRef, selectedFaculty]);

  // Assign Faculty Modal (Blocks view)
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignIndex, setAssignIndex] = React.useState(null);
  const openAssignForRow = (idx) => { setAssignIndex(idx); setAssignOpen(true); };
  const openHistoryForRow = (row) => {
    const id = row?._existingId || row?.id || null;
    if (!id) {
      toast({ title: 'No history', description: 'Save this schedule first to track changes.', status: 'info' });
      return;
    }
    setHistScheduleId(id);
    setHistOpen(true);
  };
  const scheduleForAssign = React.useMemo(() => {
    if (assignIndex == null) return null;
    const r = rows[assignIndex];
    if (!r) return null;
    return {
      id: r._existingId || r.id || undefined,
      code: r.course_name || r.courseName || r.code,
      title: r.course_title || r.courseTitle || r.title,
      section: selectedBlock?.blockCode || r.section || '',
      term: r._term || r.term || r.semester || '',
      time: r._time || r.time || r.schedule || '',
      schedule: r._time || r.time || r.schedule || '',
      day: r._day || r.day || '',
      f2fDays: r._day || r.f2fDays || r.f2fSched || r.f2fsched || r.day || '',
      room: '',
      program: selectedBlock?.program || undefined,
      programcode: parseBlockMeta(selectedBlock?.blockCode || '').programcode || undefined,
      session: selectedBlock?.session || '',
    };
  }, [assignIndex, rows, selectedBlock]);
  const handleAssignFromModal = async (fac) => {
    const idx = assignIndex;
    if (idx == null || !rows[idx]) { setAssignOpen(false); setAssignIndex(null); return; }
    const name = fac?.name || fac?.faculty || fac?.full_name || '';
    setRows(prev => prev.map((r,i) => i===idx ? { ...r, _faculty: name, _facultyId: fac?.id || null } : r));
    setTimeout(() => { try { checkRowConflictFresh(idx, { ...rows[idx], _faculty: name }); } catch {} }, 0);
    setAssignOpen(false); setAssignIndex(null);
  };

  // --- Faculty view helpers ---
  const [facDeptFilter, setFacDeptFilter] = React.useState('');
  const [facEmpFilter, setFacEmpFilter] = React.useState('');
  const [facQ, setFacQ] = React.useState('');
  const [facSort, setFacSort] = React.useState('name'); // name|dept|employment|units
  const [facSortDir, setFacSortDir] = React.useState('asc'); // asc|desc
  const filteredFaculty = React.useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    const q = norm(facQ);
    const ALWAYS = new Set(['GENED','KNP PARTTIME','PARTTIME','PE']);
    // Build allowed programcode bases (e.g., BSED-MATH -> BSED, BSBA-FM -> BSBA)
    const allowSet = (!isAdmin && Array.isArray(allowedDepts))
      ? new Set(
          allowedDepts
            .map(s => String(s || '').toUpperCase())
            .map(s => (s.split('-')[0] || s).replace(/[^A-Z0-9]/g, ''))
            .filter(Boolean)
        )
      : null;
    const matchesAllowed = (deptRaw) => {
      const U = String(deptRaw || '').toUpperCase().trim();
      if (ALWAYS.has(U)) return true;
      if (!allowSet) return false;
      if (allowSet.size === 0) return false;
      const stripped = U.replace(/[^A-Z0-9]/g, '');
      const head = (U.split('-')[0] || U).replace(/[^A-Z0-9]/g, '');
      for (const code of allowSet) {
        const C = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!C) continue;
        if (head === C) return true;
        if (stripped.includes(C)) return true;
      }
      return false;
    };
    return (facultyAll || []).filter(f => {
      const name = norm(f.name || f.faculty || f.instructorName || f.instructor || f.full_name);
      const deptRaw = String(f.department || f.dept || f.department_name || f.departmentName || '').toUpperCase();
      const dept = deptRaw.toLowerCase();
      const emp = norm(f.employment);
      // Role-based: non-admins see only assigned programcodes and whitelist
      if (!isAdmin) {
        if (allowSet === null) {
          if (!ALWAYS.has(deptRaw.trim())) return false;
        } else if (allowSet.size === 0) {
          if (!ALWAYS.has(deptRaw.trim())) return false;
        } else if (!matchesAllowed(deptRaw)) {
          return false;
        }
      }
      if (facDeptFilter && dept !== norm(facDeptFilter)) return false;
      if (facEmpFilter && emp !== norm(facEmpFilter)) return false;
        if (q && !(name.includes(q) || dept.includes(q))) return false;
        return true;
      });
  }, [facultyAll, facDeptFilter, facEmpFilter, facQ, isAdmin, allowedDepts]);

  const sortedFaculty = React.useMemo(() => {
    const list = [...(filteredFaculty || [])];
    const norm = (s) => String(s || '').trim().toLowerCase();
    const cmp = {
      name: (a, b) => norm(a.name || a.faculty).localeCompare(norm(b.name || b.faculty)),
      dept: (a, b) => norm(a.dept || a.department).localeCompare(norm(b.dept || b.department)),
      employment: (a, b) => norm(a.employment).localeCompare(norm(b.employment)),
      units: (a, b) => unitsForFaculty(b) - unitsForFaculty(a),
    }[facSort] || ((a, b) => norm(a.name || a.faculty).localeCompare(norm(b.name || b.faculty)));
    list.sort(cmp);
    if (facSortDir === 'desc') list.reverse();
    return list;
  }, [filteredFaculty, facSort, facSortDir, unitsForFaculty]);

  // Prefetch load stats for visible faculty using local schedules (avoid per-faculty stats API)
  React.useEffect(() => {
    const list = filteredFaculty || [];
    let updated = false;
    list.forEach((f) => {
      const key = String(f.id || '');
      if (!key || facLoadCache.current.has(key)) return;
      const u = calcUnitsForFaculty(f);
      facLoadCache.current.set(key, u);
      updated = true;
    });
    if (updated) forceFacLoad((v) => v + 1);
  }, [filteredFaculty, calcUnitsForFaculty]);

  // Prefetch load stats for broader faculty pool on initial load using local schedules
  React.useEffect(() => {
    const list = facOptions || [];
    let updated = false;
    list.forEach((f) => {
      const key = String(f.id || '');
      if (!key || facLoadCache.current.has(key)) return;
      const u = calcUnitsForFaculty(f);
      facLoadCache.current.set(key, u);
      updated = true;
    });
    if (updated) forceFacLoad((v) => v + 1);
  }, [facOptions, calcUnitsForFaculty]);

  const [facultySchedules, setFacultySchedules] = React.useState({ items: [], loading: false });
  const [facSelected, setFacSelected] = React.useState(new Set());
  const [facEdits, setFacEdits] = React.useState({}); // id -> { term,time,faculty,facultyId,_checking,_conflict,_details }
  const [facSavingIds, setFacSavingIds] = React.useState(new Set());
  const markFacSaving = React.useCallback((id, saving) => {
    if (id == null) return;
    const key = String(id);
    setFacSavingIds(prev => {
      const next = new Set(prev);
      if (saving) next.add(key); else next.delete(key);
      return next;
    });
  }, []);
  const isFacSaving = React.useCallback((id) => {
    if (id == null) return false;
    return facSavingIds.has(String(id));
  }, [facSavingIds]);
  const facCheckTimers = React.useRef(new Map());
  const fetchFacultySchedules = async (fac) => {
    if (!fac) return setFacultySchedules({ items: [], loading: false });
    setFacultySchedules(prev => ({ ...prev, loading: true }));
    try {
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';

      let list = [];
      // Fresh API fetch by facultyId if available
      if (fac.id != null) {
        try {
          let url = `/?_ts=${Date.now()}&facultyId=${encodeURIComponent(fac.id)}`;
          if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
          if (sem) url += `&semester=${encodeURIComponent(sem)}`;
          const res = await api.request(url);
          const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
          if (Array.isArray(items) && items.length) list = items;
        } catch {}
      }
      // If still empty, fresh API by instructor name
      if (!list.length) {
        const name = fac.faculty || fac.name || fac.instructor || fac.full_name || '';
        if (name) {
          try {
            let url = `/instructor/${encodeURIComponent(name)}?_ts=${Date.now()}`;
            if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
            if (sem) url += `&semester=${encodeURIComponent(sem)}`;
            const res = await api.request(url);
            const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
            if (Array.isArray(items) && items.length) list = items;
          } catch {}
        }
      }
      // If still empty, try Redux data.faculties (same as FacultyDetail)
      if (!list.length) {
        try {
          const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const ref = fac?.id != null
            ? (dataFaculties || []).find(x => String(x?.id) === String(fac.id))
            : (dataFaculties || []).find(x => normName(x?.name || x?.faculty) === normName(fac?.name || fac?.faculty || fac?.instructor || fac?.full_name));
          if (ref && Array.isArray(ref.courses)) list = ref.courses.slice();
        } catch {}
      }
      // Last resort: derive from selectAllCourses by id or normalized name
      if (!list.length) {
        const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchesId = fac?.id != null ? (allCourses || []).filter(s => String(s.facultyId ?? s.faculty_id ?? '') === String(fac.id)) : [];
        let filtered = matchesId;
        if (filtered.length === 0) {
          const target = norm(fac.faculty || fac.name || fac.instructor || fac.full_name);
          if (target) {
            filtered = (allCourses || []).filter(s => {
              const n = norm(s.facultyName || s.faculty || s.instructor || s.instructorName || s.full_name);
              return !!n && n === target;
            });
          }
        }
        list = filtered;
      }

      // Optional SY/Semester filter for any source
      if (list.length && (sy || sem)) {
        list = list.filter(s => {
          const syMatch = sy ? (String(s.sy || s.schoolyear || s.school_year || '').trim() === String(sy).trim()) : true;
          const semMatch = sem ? (normalizeSem(s.sem || s.semester || s.term) === normalizeSem(sem)) : true;
          return syMatch && semMatch;
        });
      }

      const sorted = sortFacultyScheduleItems(list);

      setFacultySchedules({ items: sorted, loading: false });
      setFacSelected(new Set());
      // Seed edit state for quick inline changes
      setFacEdits(() => {
        const init = {};
        sorted.forEach(s => {
          init[s.id] = {
            term: s.term || '',
            time: String(s.schedule || s.time || '').trim(),
            faculty: s.faculty || s.instructor || '',
            facultyId: s.facultyId || s.faculty_id || null,
            day: s.day || 'MON-FRI',
            _checking: false,
            _conflict: false,
            _details: [],
            _ver: 0,
          };
        });
        return init;
      });
    } catch {
      setFacultySchedules({ items: [], loading: false });
    }
  };

  const updateFacEdit = (id, patch) => {
    const item = (facultySchedules.items || []).find((x) => String(x.id) === String(id));
    if (!item || !canEditFacultyItem(item)) return;
    let nextVer;
    setFacEdits(prev => {
      const curr = prev[id] || { _ver: 0 };
      const merged = { ...curr, ...patch, _ver: (curr._ver || 0) + 1 };
      nextVer = merged._ver;
      return { ...prev, [id]: merged };
    });
    try {
      // debounce per-row to ensure latest state is used and avoid rapid duplicate calls
      const map = facCheckTimers.current;
      if (map.has(id)) { clearTimeout(map.get(id)); map.delete(id); }
      const t = setTimeout(() => {
        const eCur = (facEdits[id] ? { ...facEdits[id], ...patch, _ver: nextVer } : { ...patch, _ver: nextVer });
        checkFacultyConflict(id, eCur, nextVer);
      }, 30);
      map.set(id, t);
    } catch {}
  };

  const checkFacultyConflict = async (id, editOverride, verToken) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    const e = editOverride || facEdits[id];
    if (!base || !e) return;
    const term = String(e.term || '').trim();
    const timeStr = String(e.time || '').trim();
    const facName = String((e.faculty ?? base.instructor ?? base.faculty ?? '')).trim();
    if (!term || !timeStr || !facName) {
      setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: false, _conflict: false, _details: [] } }));
      return;
    }
    setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: true } }));
    try {
      const parsedId = (() => { const n = Number(e.facultyId ?? base.facultyId ?? base.faculty_id); return Number.isFinite(n) ? n : undefined; })();
      const payload = {
        term,
        time: timeStr,
        faculty: facName,
        facultyId: parsedId,
        day: e.day || base.day || undefined,
        schoolyear: settingsLoad.school_year || undefined,
        semester: settingsLoad.semester || undefined,
        blockCode: base.blockCode || base.section || '',
        courseName: base.courseName || base.code || '',
        courseTitle: base.courseTitle || base.course_title || '',
        session: base.session || '',
      };
      const res = await api.checkScheduleConflict(id, payload);
      let conflict = !!res?.conflict;
      let details = Array.isArray(res?.details) ? res.details.slice() : [];

      // Department-agnostic fallback using instructor schedules
      if (!conflict) {
        const fb = await detectConflictViaInstructor({
          facultyName: payload.faculty,
          term,
          timeStr,
          excludeId: id,
          courseName: payload.courseName,
          courseTitle: base.courseTitle || base.course_title || '',
          day: payload.day,
        });
        if (fb.conflict) { conflict = true; details = details.concat(fb.details); }
      }
      // Inline load limit check for non-admin
      let loadExceeded = false;
      if (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
        try {
          const targetName = e.faculty || '';
          if (targetName) {
            const meta = findFacultyById(e.facultyId) || findFacultyByName(targetName);
            const max = maxUnitsFor(meta);
            const lr = (meta?.id!=null) ? await api.getInstructorLoadById(meta.id, { schoolyear: settingsLoad?.school_year, semester: settingsLoad?.semester }) : await api.getInstructorLoad(targetName); const current = Number(lr?.loadUnits || 0);
            const same = normalizeName(targetName) === normalizeName(base.instructor || base.faculty || '');
            const addU = same ? 0 : Number(base.unit || 0);
            if (current + addU > max) {
              loadExceeded = true;
              toast({ title: 'Load limit exceeded', description: `${targetName}: ${employmentOf(meta)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addU} ⇒ ${current+addU}.`, status: 'warning' });
            }
          }
        } catch {}
      }
      setFacEdits(prev => {
        const curr = prev[id];
        if (verToken != null && curr && curr._ver !== verToken) return prev; // stale result
        return { ...prev, [id]: { ...curr, _checking: false, _conflict: conflict, _details: details, _loadExceeded: loadExceeded } };
      });
    } catch {
      setFacEdits(prev => ({ ...prev, [id]: { ...prev[id], _checking: false } }));
    }
  };

  const runServerConflictCheck = async (idForCheck, payload, { label } = {}) => {
    try {
      const res = await api.checkScheduleConflict(idForCheck || 0, payload);
      if (res?.conflict) {
        const detail = Array.isArray(res?.details) && res.details.length > 0 ? res.details[0].reason : null;
        toast({
          title: 'Conflict detected',
          description: detail || label || 'Schedule conflicts with an existing record.',
          status: 'error',
        });
        return true;
      }
    } catch (e) {
      toast({ title: 'Conflict check failed', description: e?.message || 'Could not verify conflicts.', status: 'error' });
      return true;
    }
    return false;
  };

  const saveFacultyEdit = async (id) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    if (!base || !canEditFacultyItem(base)) return;
    const e = facEdits[id];
    if (!e) return;
    if (isFacSaving(id)) return;
    markFacSaving(id, true);
    try {
      const isDraft = String(base.id || '').startsWith('tmp:') || !!base._draft;
      if (isDraft) {
        const okLimit = await ensureFacultyLoadLimitForFacultyView([base]);
        if (!okLimit) return;
        try {
          const yrLabel = (() => {
            const raw = String(base.yearlevel ?? '').trim();
            if (!raw) return '';
            const m = raw.match(/(\d+)/);
            const n = m ? parseInt(m[1], 10) : NaN;
            if (!Number.isFinite(n)) return raw; // already labeled
            const ord = (k) => {
              const sfx = (k % 10 === 1 && k % 100 !== 11) ? 'st' : (k % 10 === 2 && k % 100 !== 12) ? 'nd' : (k % 10 === 3 && k % 100 !== 13) ? 'rd' : 'th';
              return `${k}${sfx}`;
            };
            return `${ord(n)} Year`;
          })();
          const termLabel = e.term;
          const semLabel = resolveSemesterLabel(settingsLoad?.semester);
          const blkCode = base.blockCode || base.section || '';
          const blkMeta = (blocksAll || []).find(b => String(b.blockCode || '').trim().toLowerCase() === String(blkCode).trim().toLowerCase());
          const session = blkMeta?.session || '';
          const payload = {
            programcode: base.programcode,
            courseName: base.courseName || base.code,
            courseTitle: base.courseTitle || base.title,
            unit: base.unit,
            day: e.day || base.day || 'MON-FRI',
            time: e.time,
            term: termLabel || e.term,
            schoolyear: settingsLoad?.school_year || '',
            sem: semLabel || '',
            semester: semLabel || '',
            yearlevel: yrLabel || base.yearlevel,
            blockCode: blkCode,
            session: session,
            facultyId: (e.facultyId != null ? e.facultyId : (base.facultyId ?? null)),
            faculty: base.faculty || base.instructor || selectedFaculty?.name || selectedFaculty?.faculty || '',
            prospectusId: base.prospectusId || base.prospectus_id || undefined,
          };
          const hit = await runServerConflictCheck(0, payload, { label: `${payload.courseName || 'Schedule'} (${blkCode})` });
          if (hit) return;
          await api.createSchedule(payload);
          await fetchFacultySchedules(selectedFaculty);
          dispatch(loadAllSchedules());
          toast({ title: 'Saved', description: `${payload.courseName} created.`, status: 'success' });
        } catch (e2) {
          toast({ title: 'Save failed', description: e2?.message || 'Could not create schedule.', status: 'error' });
        }
        return;
      }
      const changes = {};
      // Always align sem/semester with the Schedules Load settings, not ad-hoc edits
      const settingsSemLabel = resolveSemesterLabel(settingsLoad?.semester);
      const nextTerm = canonicalTerm(e.term || base.term || settingsSemLabel || '');
      if (nextTerm) { changes.term = nextTerm; }
      const semLabel = settingsSemLabel || resolveSemesterLabel(settingsLoad?.semester);
      const baseTime = String(base.schedule || base.time || '').trim();
      if (baseTime !== e.time) changes.time = e.time;
      if (String(base.day || '').trim() !== String(e.day || '').trim()) changes.day = e.day || '';
      if (semLabel) { changes.semester = semLabel; changes.sem = semLabel; }
      // In faculty view, faculty is implicit; do not change faculty assignment inline
      if (Object.keys(changes).length === 0) return;
      const checkPayload = {
        term: changes.term ?? base.term,
        time: changes.time ?? base.time ?? base.schedule,
        day: changes.day ?? base.day,
        faculty: base.faculty || base.instructor || '',
        facultyId: base.facultyId || base.faculty_id || null,
        schoolyear: settingsLoad?.school_year || undefined,
        semester: semLabel || settingsLoad?.semester || undefined,
        blockCode: base.blockCode || base.section || '',
        courseName: base.courseName || base.code || '',
        courseTitle: base.courseTitle || base.title || '',
        session: base.session || '',
      };
      const hit = await runServerConflictCheck(id, checkPayload, { label: `${checkPayload.courseName || 'Schedule'} (${checkPayload.blockCode || 'N/A'})` });
      if (hit) return;
      try {
        if ((!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) && changes.faculty_id != null) {
          const targetFac = findFacultyById(changes.faculty_id);
          const targetName = targetFac?.name || targetFac?.faculty || '';
          const max = maxUnitsFor(targetFac);
          const current = await (async () => { try { const sy = settingsLoad?.school_year || ""; const sem = settingsLoad?.semester || ""; const qs = new URLSearchParams(); qs.set("instructor", targetName); if (sy) qs.set("schoolyear", sy); if (sem) qs.set("semester", sem); const res = await api.request(`/?${qs.toString()}&_ts=${Date.now()}`); const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || [])); return (list || []).reduce((s,c)=> s + (Number(c.unit)||0), 0); } catch { return 0; } })();
          const same = normalizeName(targetName) === normalizeName(base.faculty || base.instructor || '');
          const addU = same ? 0 : Number(base.unit || 0);
          if (current + addU > max) {
            toast({ title: 'Load limit exceeded', description: `${targetName}: ${employmentOf(targetFac)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addU} ? ${current+addU}. Only admin can exceed.`, status: 'warning' });
            return;
          }
        }
        await dispatch(updateScheduleThunk({ id, changes }));
        // Refresh schedule list to reflect persisted data
        await fetchFacultySchedules(selectedFaculty);
        dispatch(loadAllSchedules());
      } catch {}
    } finally {
      markFacSaving(id, false);
    }
  };

  const openFacultySuggestions = (id) => {
    const base = facultySchedules.items.find(x => String(x.id) === String(id));
    const e = facEdits[id];
    if (!base || !e) return;
    setFacSuggTargetId(id);
    setFacSuggOpen(true);
    setFacSuggBusy(true);
    setFacSuggPlans([]);
    setTimeout(async () => {
      try {
        const payload = {
          term: e.term,
          time: e.time,
          faculty: base.faculty || base.instructor || '',
          facultyId: base.facultyId || base.faculty_id || null,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: base.blockCode || base.section || '',
          courseName: base.courseName || base.code || '',
          session: base.session || '',
        };
        const plans = await api.getScheduleSuggestions(id, payload, { maxDepth: 3 });
        setFacSuggPlans(Array.isArray(plans) ? plans : []);
      } catch {
        setFacSuggPlans([]);
      } finally {
        setFacSuggBusy(false);
      }
    }, 30);
  };

  // Faculty-view lock/unlock and delete handlers
  const toggleFacultyLock = async (id, nextLocked) => {
    const item = (facultySchedules.items || []).find((x) => String(x.id) === String(id));
    if (!item || !canEditFacultyItem(item)) return;
    try {
      await dispatch(updateScheduleThunk({ id, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
      await fetchFacultySchedules(selectedFaculty);
      // Refresh block mapping if a block is selected
      try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
      dispatch(loadAllSchedules());
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${nextLocked ? 'lock' : 'unlock'} schedule.`, status: 'error' });
    }
  };

  const [facDelOpen, setFacDelOpen] = React.useState(false);
  const [facDelBusy, setFacDelBusy] = React.useState(false);
  const [facDelIndex, setFacDelIndex] = React.useState(null);
  const facDelCancelRef = React.useRef();
  const requestFacultyDelete = (idx) => {
    const item = facultySchedules.items[idx];
    if (!item || !canEditFacultyItem(item)) return;
    const isDraft = !!item._draft || String(item.id || '').startsWith('tmp:');
    if (isDraft) {
      // Remove draft locally without confirmation or API call
      setFacultySchedules(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== idx),
      }));
      setFacEdits(prev => {
        const next = { ...prev };
        try { delete next[item.id]; } catch {}
        return next;
      });
      setFacSelected(prev => {
        const next = new Set(prev);
        try { next.delete(item.id); } catch {}
        return next;
      });
      try { toast({ title: 'Removed draft', description: `${item.code || item.courseName} removed.`, status: 'success' }); } catch {}
      return;
    }
    setFacDelIndex(idx);
    setFacDelOpen(true);
  };

  // Re-apply programcode filter when user departments load/change for non-admins
  React.useEffect(() => {
    try {
      if (isAdmin) return;
      if (!selectedFaculty) return;
      if (allowedDepts === null) return; // wait until loaded
      fetchFacultySchedules(selectedFaculty);
    } catch {}
  }, [allowedDepts, isAdmin, selectedFaculty]);
  const confirmFacultyDelete = async () => {
    const idx = facDelIndex;
    const item = facultySchedules.items[idx];
    if (idx == null || !item) { setFacDelOpen(false); setFacDelIndex(null); return; }
    const isLocked = (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(item?._locked ?? item?.lock ?? item?.is_locked ?? item?.locked);
    if (isLocked) { toast({ title: 'Locked schedule', description: 'Unlock the schedule before deleting.', status: 'warning' }); setFacDelOpen(false); setFacDelIndex(null); return; }
    setFacDelBusy(true);
    try {
      await dispatch(deleteScheduleThunk(item.id));
      await fetchFacultySchedules(selectedFaculty);
      // Also refresh block view mapping if a block is selected
      try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Deleted', description: `${item.code || item.courseName} removed.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete schedule.', status: 'error' });
    } finally {
      setFacDelBusy(false);
      setFacDelOpen(false);
      setFacDelIndex(null);
    }
  };

  // Faculty bulk lock/unlock selection helpers
  const facSelectedIds = React.useMemo(() => Array.from(facSelected || new Set()), [facSelected]);
  const facSelectedItems = React.useMemo(() => (facultySchedules.items || []).filter(it => facSelectedIds.includes(it.id)), [facSelectedIds, facultySchedules.items]);
  const isItemLocked = (it) => (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(it?._locked ?? it?.lock ?? it?.is_locked ?? it?.locked);
  const allSelectedLocked = facSelectedItems.length > 0 && facSelectedItems.every(isItemLocked);
  const allSelectedUnlocked = facSelectedItems.length > 0 && facSelectedItems.every(it => !isItemLocked(it));
  const facCanSaveSelected = React.useMemo(() => {
    if (facSelectedItems.length === 0) return false;
    return facSelectedItems.every(it => {
      if (isItemLocked(it)) return false;
      const e = facEdits[it.id] || { term: canonicalTerm(it.term || ''), time: String(it.schedule || it.time || '').trim(), day: it.day || 'MON-FRI' };
      const dirty =
        canonicalTerm(it.term || '') !== e.term ||
        String(it.schedule || it.time || '').trim() !== e.time ||
        String(it.day || '').trim() !== String(e.day || '').trim();
      const termFilled = String(e.term || '').trim().length > 0;
      const timeFilled = String(e.time || '').trim().length > 0;
      return dirty && termFilled && timeFilled && !e._checking && !e._conflict;
    });
  }, [facSelectedItems, facEdits]);
  const facultyUnitStats = React.useMemo(() => {
    const items = Array.isArray(facultySchedules?.items) ? facultySchedules.items : [];
    const totals = items.reduce((acc, it) => {
      const unitVal = Number(it.unit ?? 0);
      const unit = Number.isFinite(unitVal) ? unitVal : 0;
      const isDraft = !!it._draft || String(it.id || '').startsWith('tmp:');
      if (isDraft) {
        acc.draftUnits += unit;
        acc.draftCount += 1;
      } else {
        acc.savedUnits += unit;
        acc.savedCount += 1;
      }
      return acc;
    }, { savedUnits: 0, draftUnits: 0, savedCount: 0, draftCount: 0 });
    return { ...totals, totalUnits: totals.savedUnits + totals.draftUnits };
  }, [facultySchedules]);


  const toggleFacSelect = (id, checked) => {
    const item = (facultySchedules.items || []).find((x) => String(x.id) === String(id));
    if (!item || !canEditFacultyItem(item)) return;
    setFacSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // Assign Faculty Modal (Faculty view reassign)
  const [facAssignOpen, setFacAssignOpen] = React.useState(false);
  const [facAssignIndex, setFacAssignIndex] = React.useState(null);
  const openFacAssign = (idx) => { setFacAssignIndex(idx); setFacAssignOpen(true); };
  const scheduleForFacAssign = React.useMemo(() => {
    if (facAssignIndex == null) return null;
    const it = facultySchedules.items[facAssignIndex];
    if (!it) return null;
    return {
      id: it.id,
      code: it.code || it.courseName,
      title: it.title || it.courseTitle,
      section: it.section || it.blockCode || '',
      term: it.term || it.semester || '',
      time: it.schedule || it.time || '',
      schedule: it.schedule || it.time || '',
      day: it.day || '',
      f2fDays: it.f2fDays || it.f2fSched || it.f2fsched || it.day || '',
      room: it.room || '',
      program: it.program || it.programcode || '',
      programcode: it.programcode || it.program || '',
      session: it.session || '',
    };
  }, [facAssignIndex, facultySchedules.items]);
  const handleFacAssign = async (fac) => {
    const idx = facAssignIndex;
    const it = facultySchedules.items[idx];
    if (idx == null || !it) { setFacAssignOpen(false); setFacAssignIndex(null); return; }
    try {
      // Enforce load limit for non-admin: adding this course to target faculty
      if ((!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0)) {
        const targetName = fac?.name || fac?.faculty || '';
        const meta = findFacultyById(fac?.id) || findFacultyByName(targetName);
        const max = maxUnitsFor(meta);
        const current = await (async () => { try { const sy = settingsLoad?.school_year || ""; const sem = settingsLoad?.semester || ""; const qs = new URLSearchParams(); qs.set("instructor", targetName); if (sy) qs.set("schoolyear", sy); if (sem) qs.set("semester", sem); const res = await api.request(`/?${qs.toString()}&_ts=${Date.now()}`); const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || [])); return (list || []).reduce((s,c)=> s + (Number(c.unit)||0), 0); } catch { return 0; } })();
        const same = normalizeName(targetName) === normalizeName(it.faculty || it.instructor || '');
        const addU = same ? 0 : Number(it.unit || 0);
        if (current + addU > max) {
          toast({ title: 'Load limit exceeded', description: `${targetName}: ${employmentOf(meta)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addU} ⇒ ${current+addU}. Only admin can exceed.`, status: 'warning' });
          setFacAssignOpen(false); setFacAssignIndex(null);
          return;
        }
      }
      await dispatch(updateScheduleThunk({ id: it.id, changes: { faculty_id: fac?.id || null } }));
      await fetchFacultySchedules(selectedFaculty);
      dispatch(loadAllSchedules());
      toast({ title: 'Assigned', description: `Assigned ${fac?.name || fac?.faculty || 'faculty'} to ${it.code || it.courseName}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Assign failed', description: e?.message || 'Could not assign faculty.', status: 'error' });
    } finally {
      setFacAssignOpen(false);
      setFacAssignIndex(null);
    }
  };

  // Bulk lock dialog state
  const [facLockOpen, setFacLockOpen] = React.useState(false);
  const [facLockBusy, setFacLockBusy] = React.useState(false);
  const [facLockTarget, setFacLockTarget] = React.useState(null); // true = lock, false = unlock
  const facLockCancelRef = React.useRef();
  const requestFacultyBulkLockChange = (nextLocked) => {
    if (facSelectedIds.length === 0) return;
    setFacLockTarget(!!nextLocked);
    setFacLockOpen(true);
  };
  const confirmFacultyBulkLockChange = async () => {
    if (!isAdmin && !facLockTarget) {
      setFacLockOpen(false);
      setFacLockTarget(null);
      toast({ title: 'Unauthorized', description: 'Only admin can unlock schedules.', status: 'warning' });
      return;
    }
    const nextLocked = !!facLockTarget;
    setFacLockBusy(true);
    try {
      let count = 0;
      for (const it of facSelectedItems) {
        const curLocked = isItemLocked(it);
        if (curLocked === nextLocked) continue;
        await dispatch(updateScheduleThunk({ id: it.id, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
        count++;
      }
      if (count > 0) {
        await fetchFacultySchedules(selectedFaculty);
        try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
        dispatch(loadAllSchedules());
      }
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', description: `${count} schedule(s) ${nextLocked ? 'locked' : 'unlocked'}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${facLockTarget ? 'lock' : 'unlock'} selected schedules.`, status: 'error' });
    } finally {
      setFacLockBusy(false);
      setFacLockOpen(false);
      setFacLockTarget(null);
      setFacSelected(new Set());
    }
  };

  // Non-admin guard: prevent creating new schedules that exceed faculty load limits in Faculty view
  const ensureFacultyLoadLimitForFacultyView = async (rowsToCheck = []) => {
    const nonAdminMapped = (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0);
    if (!nonAdminMapped) return true;
    if (!selectedFaculty) return true;
    const rows = Array.isArray(rowsToCheck) ? rowsToCheck : [];
    const addUnits = rows.reduce((sum, it) => {
      const isDraft = !!it?._draft || String(it?.id || '').startsWith('tmp:');
      if (!isDraft) return sum;
      const u = Number(it?.unit ?? 0);
      return sum + (Number.isFinite(u) ? u : 0);
    }, 0);
    if (addUnits <= 0) return true;
    const meta = selectedFaculty;
    const name = meta?.name || meta?.faculty || '';
    const max = maxUnitsFor(meta);
    const sy = settingsLoad?.school_year || '';
    const sem = settingsLoad?.semester || '';
    let current = 0;
    try {
      if (meta?.id != null) {
        const lr = await api.getInstructorLoadById(meta.id, { schoolyear: sy, semester: sem });
        current = Number(lr?.loadUnits || 0);
      } else if (name) {
        const qs = new URLSearchParams();
        if (sy) qs.set('schoolyear', sy);
        if (sem) qs.set('semester', sem);
        const resp = await api.request(`/instructor/${encodeURIComponent(name)}/load${qs.toString() ? `?${qs.toString()}` : ''}`);
        current = Number(resp?.loadUnits || 0);
      }
    } catch {}
    const proposed = current + addUnits;
    if (proposed > max) {
      const maxLabel = employmentOf(meta) === 'part-time' ? 'Part-time max 12' : 'Full-time max 36';
      toast({ title: 'Load limit exceeded', description: `${name || 'Faculty'}: ${maxLabel} units. Current ${current}, adding ${addUnits} -> ${proposed}. Only admin can exceed.`, status: 'warning' });
      return false;
    }
    return true;
  };

  // Bulk save selected faculty schedules (inline edits)
  const saveSelectedFacultyRows = async () => {
    if (!readyToLoad) {
      toast({ title: 'Loading disabled', description: 'Set Schedules Load in Settings and ensure you have permission.', status: 'warning' });
      return;
    }
    if (facSelectedIds.length === 0) return;
    if (!facCanSaveSelected) {
      toast({ title: 'Nothing to save', description: 'Select editable rows with term and time filled, and resolve conflicts first.', status: 'info' });
      return;
    }
    const okLimit = await ensureFacultyLoadLimitForFacultyView(facSelectedItems);
    if (!okLimit) return;
    const semFallback = resolveSemesterLabel(settingsLoad?.semester);
    setSaving(true);
    try {
      let created = 0;
      let updated = 0;
      let conflicts = 0;
      for (const it of facSelectedItems) {
        const e = facEdits[it.id];
        if (!e) continue;
        if (isItemLocked(it)) continue;
        if (e._checking || e._conflict) continue;
        const term = String(e.term || '').trim();
        const time = String(e.time || '').trim();
        if (!term || !time) continue;
        const termLabel = canonicalTerm(term) || term || '';
        const nextTerm = termLabel || term;
        const baseTermNorm = normalizeTermForCompare(it.term || it.semester || it.sem || '');
        const nextTermNorm = normalizeTermForCompare(nextTerm);
        const termChanged = !!nextTerm && baseTermNorm !== nextTermNorm;
        const existingSemLabel = resolveSemesterLabel(it.semester || it.sem || it.term || '');
        const semLabel = resolveSemesterLabel(settingsLoad?.semester) || existingSemLabel || semFallback;
        const day = e.day || it.day || 'MON-FRI';
        const isDraft = String(it.id || '').startsWith('tmp:') || !!it._draft;
        if (isDraft) {
          try {
            const yrLabel = (() => {
              const raw = String(it.yearlevel ?? '').trim();
              if (!raw) return '';
              const m = raw.match(/(\d+)/);
              const n = m ? parseInt(m[1], 10) : NaN;
              if (!Number.isFinite(n)) return raw;
              const ord = (k) => {
                const sfx = (k % 10 === 1 && k % 100 !== 11) ? 'st' : (k % 10 === 2 && k % 100 !== 12) ? 'nd' : (k % 10 === 3 && k % 100 !== 13) ? 'rd' : 'th';
                return `${k}${sfx}`;
              };
              return `${ord(n)} Year`;
            })();
            const blkCode = it.blockCode || it.section || '';
            const blkMeta = (blocksAll || []).find(b => String(b.blockCode || '').trim().toLowerCase() === String(blkCode).trim().toLowerCase());
            const session = blkMeta?.session || '';
            const payload = {
              programcode: it.programcode,
              courseName: it.courseName || it.code,
              courseTitle: it.courseTitle || it.title,
              unit: it.unit,
              day: day,
              time: time,
              term: nextTerm,
              schoolyear: settingsLoad?.school_year || '',
              sem: semLabel,
              semester: semLabel,
              yearlevel: yrLabel || it.yearlevel,
              blockCode: blkCode,
              session: session,
              facultyId: (e.facultyId != null ? e.facultyId : (it.facultyId ?? null)),
              faculty: it.faculty || it.instructor || selectedFaculty?.name || selectedFaculty?.faculty || '',
              prospectusId: it.prospectusId || it.prospectus_id || undefined,
            };
            const hit = await runServerConflictCheck(0, payload, { label: `${payload.courseName || 'Schedule'} (${blkCode || 'N/A'})` });
            if (hit) { conflicts++; continue; }
            await api.createSchedule(payload);
            created++;
          } catch {}
          continue;
        }
        const changes = {};
        if (termChanged) changes.term = nextTerm;
        const baseTime = String(it.schedule || it.time || '').trim();
        if (baseTime !== time) changes.time = time;
        if (String(it.day || '').trim() !== String(day || '').trim()) changes.day = day || '';
        const semChanged = termChanged && semLabel && normalizeTermForCompare(existingSemLabel) !== normalizeTermForCompare(semLabel);
        if (semChanged) { changes.semester = semLabel; changes.sem = semLabel; }
        if (Object.keys(changes).length === 0) continue;
        try {
          const semesterForCheck = changes.semester ?? existingSemLabel ?? semLabel ?? settingsLoad?.semester;
          const payloadForCheck = {
            term: changes.term ?? it.term,
            time: changes.time ?? it.time ?? it.schedule,
            day: changes.day ?? it.day ?? 'MON-FRI',
            faculty: it.faculty || it.instructor || '',
            facultyId: it.facultyId || it.faculty_id || e.facultyId || null,
            schoolyear: settingsLoad?.school_year || undefined,
            semester: semesterForCheck || undefined,
            blockCode: it.blockCode || it.section || '',
            courseName: it.courseName || it.code || '',
            courseTitle: it.courseTitle || it.title || '',
            session: it.session || '',
          };
          const hit = await runServerConflictCheck(it.id, payloadForCheck, { label: `${payloadForCheck.courseName || 'Schedule'} (${payloadForCheck.blockCode || 'N/A'})` });
          if (hit) { conflicts++; continue; }
          await dispatch(updateScheduleThunk({ id: it.id, changes }));
          updated++;
        } catch {}
      }
      if (created || updated) {
        await fetchFacultySchedules(selectedFaculty);
        try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
        dispatch(loadAllSchedules());
      }
      const msg = [`${updated} updated`, `${created} created`].filter(s => !s.startsWith('0 ')).join(', ') || 'No changes';
      const conflictNote = conflicts ? ` (${conflicts} blocked by conflicts)` : '';
      toast({ title: 'Saved', description: msg + conflictNote, status: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save selected schedules.', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const applyFacultySuggestion = (plan) => {
    if (!plan || !plan.candidateChange || facSuggTargetId == null) return;
    const cc = plan.candidateChange;
    updateFacEdit(facSuggTargetId, { term: cc.toTerm || (facEdits[facSuggTargetId]?.term || ''), time: cc.toTime || (facEdits[facSuggTargetId]?.time || '') });
    setFacSuggOpen(false);
    setFacSuggTargetId(null);
  };

  // Fast lookup of row index to avoid O(n) rows.indexOf during render
  const rowIndexMap = React.useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r, i) => m.set(r, i));
    return m;
  }, [rows]);

  const grouped = React.useMemo(() => {
    const map = new Map();
    (rows || []).forEach(r => {
      const prog = String(r.programcode || r.program || '').toUpperCase();
      const yr = String(r.yearlevel || '').trim();
      const key = prog + '|' + yr;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    });
    const termOrder = (t) => {
      const v = String(t || '').trim().toLowerCase();
      if (v.startsWith('1')) return 1;
      if (v.startsWith('2')) return 2;
      if (v.startsWith('s')) return 3;
      return 9;
    };
    const out = [];
    map.forEach((arr, key) => {
      arr.sort((a, b) => {
        const oaKey = Number.isFinite(a?._orderKey) ? a._orderKey : null;
        const obKey = Number.isFinite(b?._orderKey) ? b._orderKey : null;
        const oa = termOrder(a._term);
        const ob = termOrder(b._term);
        if (oa !== ob) return oa - ob;
        const ta = normalizeTimeBlock(a._time);
        const tb = normalizeTimeBlock(b._time);
        const sa = Number.isFinite(ta?.start) ? ta.start : null;
        const sb = Number.isFinite(tb?.start) ? tb.start : null;
        if (sa != null && sb != null && sa !== sb) return sa - sb;
        if (oaKey != null && obKey != null) return oaKey - obKey;
        const ia = rowIndexMap.get(a) ?? 0;
        const ib = rowIndexMap.get(b) ?? 0;
        return ia - ib;
      });
      const [prog, yr] = key.split('|');
      out.push({ programcode: prog, yearlevel: yr, items: arr });
    });
    return out.sort((a,b) => a.programcode.localeCompare(b.programcode) || String(a.yearlevel).localeCompare(String(b.yearlevel)));
  }, [rows, rowIndexMap]);

  const requestLockChange = (idx, nextLocked) => {
    setLockDialogIndex(idx);
    setLockDialogBulkIdxs([]);
    setLockDialogTarget(!!nextLocked);
    setLockDialogOpen(true);
  };

  // Delete confirmation dialog state
  const [delDialogOpen, setDelDialogOpen] = React.useState(false);
  const [delDialogBusy, setDelDialogBusy] = React.useState(false);
  const [delDialogIndex, setDelDialogIndex] = React.useState(null);
  const delCancelRef = React.useRef();

  const requestDelete = (idx) => {
    setDelDialogIndex(idx);
    setDelDialogOpen(true);
  };

  const confirmDelete = async () => {
    const idx = delDialogIndex;
    if (idx == null) { setDelDialogOpen(false); return; }
    const row = rows[idx];
    if (!row || !row._existingId) { setDelDialogOpen(false); return; }
    // Prevent deleting locked schedules
    const isLocked = !!row?._locked || (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(row?.lock);
    if (isLocked) {
      toast({ title: 'Locked schedule', description: 'Unlock the schedule before deleting.', status: 'warning' });
      setDelDialogOpen(false);
      setDelDialogIndex(null);
      return;
    }
    setDelDialogBusy(true);
    try {
      await dispatch(deleteScheduleThunk(row._existingId));
      // prevent immediate re-prefill from stale fetch by excluding this id once
      try { excludeDeletedIdsRef.current.add(row._existingId); } catch {}
      // Reset this row's editable fields immediately in UI
      setRows(prev => prev.map((r,i) => (
        i === idx
          ? { ...r, _existingId: null, _locked: false, _status: 'Unassigned', _term: '', _time: '', _faculty: '', _day: 'MON-FRI', _selected: false }
          : r
      )));
      // Immediately refresh block prospectus + schedules to remap UI accurately
      try { await onSelectBlock(selectedBlock); } catch {}
      // Also refresh global cache for other views
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Deleted', description: `${row.course_name || row.courseName || row.code} removed from assignments.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.message || 'Could not delete schedule.', status: 'error' });
    } finally {
      setDelDialogBusy(false);
      setDelDialogOpen(false);
      setDelDialogIndex(null);
    }
  };

  const requestBulkLockChange = (nextLocked) => {
    const idxs = rows.map((r,i) => (r._selected && r._existingId ? i : -1)).filter(i => i >= 0);
    if (idxs.length === 0) return;
    setLockDialogIndex(null);
    setLockDialogBulkIdxs(idxs);
    setLockDialogTarget(!!nextLocked);
    setLockDialogOpen(true);
  };

  const confirmLockChange = async () => {
    if (!isAdmin && !lockDialogTarget) {
      setLockDialogOpen(false);
      setLockDialogIndex(null);
      setLockDialogBulkIdxs([]);
      setLockDialogTarget(null);
      toast({ title: 'Unauthorized', description: 'Only admin can unlock schedules.', status: 'warning' });
      return;
    }
    const idxs = lockDialogBulkIdxs.length ? lockDialogBulkIdxs : (lockDialogIndex != null ? [lockDialogIndex] : []);
    if (idxs.length === 0) { setLockDialogOpen(false); return; }
    const nextLocked = !!lockDialogTarget;
    setLockDialogBusy(true);
    try {
      let count = 0;
      for (const idx of idxs) {
        const row = rows[idx];
        if (!row || !row._existingId) continue;
        await dispatch(updateScheduleThunk({ id: row._existingId, changes: { lock: nextLocked ? 'yes' : 'no', is_locked: nextLocked } }));
        count++;
      }
      if (count > 0) {
        try { if (selectedBlock) await onSelectBlock(selectedBlock); } catch {}
        dispatch(loadAllSchedules());
      }
      setRows(prev => prev.map((r,i) => idxs.includes(i) ? { ...r, _locked: nextLocked } : r));
      toast({ title: nextLocked ? 'Locked' : 'Unlocked', description: `${count} schedule(s) ${nextLocked ? 'locked' : 'unlocked'}.`, status: 'success' });
    } catch (e) {
      toast({ title: 'Action failed', description: e?.message || `Could not ${nextLocked ? 'lock' : 'unlock'} schedules.`, status: 'error' });
    } finally {
      setLockDialogBusy(false);
      setLockDialogOpen(false);
      setLockDialogIndex(null);
      setLockDialogBulkIdxs([]);
      setLockDialogTarget(null);
    }
  };

  const readyToLoad = canLoad && !!settingsLoad.school_year && !!settingsLoad.semester;

  const updateRow = (idx, patch) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, ...patch } : r));
  const toggleRow = (idx, checked) => setRows(prev => prev.map((r,i) => i===idx ? { ...r, _selected: !!checked } : r));
  // removed bulk apply (deprecated)

  // ---------- enhanced conflict logic (now fetches ALL schedules + instructor schedules) ----------
  const normalizeTermForCompare = (t) => {
    const v = String(t || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('1')) return '1st';
    if (v.startsWith('2')) return '2nd';
    if (v.startsWith('s')) return 'Sem';
    return v;
  };
  const normFaculty = (f) => String(f || '').trim().toLowerCase();
  const normSection = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normCode = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  const getTimeRange = (timeStr) => {
    if (!timeStr) return null;
    try {
      const rn = parseTimeBlockToMinutes(String(timeStr).trim());
      if (rn && (Number.isFinite(rn.start) || Number.isFinite(rn.end) || rn.key)) return rn;
    } catch (e) {}
    try {
      const s = String(timeStr).trim();
      const m = s.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (m) {
        const parsePart = (p) => {
          let ss = p.trim().toLowerCase();
          const parts = ss.replace(/\s*(am|pm)$/,'').split(':');
          let hour = Number(parts[0]);
          let min = parts.length > 1 ? Number(parts[1]) : 0;
          if (ss.includes('pm') && hour < 12) hour += 12;
          if (ss.includes('am') && hour === 12) hour = 0;
          return hour * 60 + min;
        };
        const start = parsePart(m[1]);
        const end = parsePart(m[2]);
        return { start, end, key: `${start}-${end}` };
      }
    } catch (e) {}
    return { start: NaN, end: NaN, key: String(timeStr).trim() };
  };

  const timeRangesOverlap = (a, b) => {
    if (!a || !b) return false;
    const aStart = a.start, aEnd = a.end, bStart = b.start, bEnd = b.end;
    if (Number.isFinite(aStart) && Number.isFinite(aEnd) && Number.isFinite(bStart) && Number.isFinite(bEnd)) {
      return Math.max(aStart, bStart) < Math.min(aEnd, bEnd) || (aStart === bStart && aEnd === bEnd);
    }
    if (a.key && b.key) return String(a.key).trim() === String(b.key).trim();
    return false;
  };

  // fetch instructor schedules trying multiple identifiers (label/value) with optional filters
  const fetchInstructorSchedulesTry = async (candidates, { sy, sem } = {}) => {
    for (const cand of candidates) {
      if (!cand) continue;
      try {
        let url = `/instructor/${encodeURIComponent(String(cand))}?_ts=${Date.now()}`;
        if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
        if (sem) url += `&semester=${encodeURIComponent(sem)}`;
        const res = await api.request(url);
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
        if (Array.isArray(list) && list.length > 0) return list;
      } catch (e) {
        // continue to next candidate
      }
    }
    return [];
  };

  // fetch ALL saved schedules (non-cached) filtered to current load SY/semester if available
  const fetchAllSavedSchedules = async () => {
    try {
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';
      let url = `/?_ts=${Date.now()}`;
      if (sy) url += `&schoolyear=${encodeURIComponent(sy)}`;
      if (sem) url += `&semester=${encodeURIComponent(sem)}`;
      const res = await api.request(url);
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
    } catch (e) {
      return [];
    }
  };

  // Fallback: department-agnostic conflict detection via instructor schedules
  const detectConflictViaInstructor = async ({ facultyName, term, timeStr, excludeId, courseName, courseTitle, day }) => {
    const isTBA = (v) => String(v || '').trim().toUpperCase() === 'TBA';
    const isPELike = () => {
      const txt = [courseName, courseTitle].filter(Boolean).map(String).join(' ').toUpperCase();
      return /\b(PE|NSTP|DEF\s*TACT)\b/.test(txt);
    };
    if (isPELike() && (isTBA(timeStr) || isTBA(term) || isTBA(day))) {
      return { conflict: false, details: [] };
    }
    try {
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';
      const list = await fetchInstructorSchedulesTry([facultyName], { sy, sem });
      if (!Array.isArray(list) || list.length === 0) return { conflict: false, details: [] };
      const candRange = getTimeRange(timeStr) || {};
      const termN = normalizeTermForCompare(term).toLowerCase();
      const candDays = (() => {
        const parsed = parseF2FDays(day);
        return parsed.length ? parsed : ['ANY'];
      })();
      const details = [];
      let conflict = false;
      for (const s of list) {
        const sid = s?.id;
        if (excludeId != null && String(sid) === String(excludeId)) continue;
        const sTerm = normalizeTermForCompare(s.term || s.sem || s.semester).toLowerCase();
        if (sTerm !== termN) continue;
        const schedDays = (() => {
          const parsed = parseF2FDays(s.day || s.f2fSched || s.f2fsched);
          return parsed.length ? parsed : ['ANY'];
        })();
        const hasDayOverlap = candDays.includes('ANY') || schedDays.includes('ANY') || candDays.some(d => schedDays.includes(d));
        if (!hasDayOverlap) continue;
        const sRange = getTimeRange(String(s.schedule || s.time || s.scheduleKey || ''));
        if (!sRange) continue;
        if (timeRangesOverlap(candRange, sRange)) {
          conflict = true;
          details.push({
            reason: 'Double-booked: same faculty (other section/department)',
            item: {
              id: s.id,
              code: s.courseName || s.code || '-',
              title: s.title || s.courseTitle || '-',
              section: s.section || s.blockCode || s.block || '-',
              term: s.term || s.sem || s.semester || '-',
              time: s.schedule || s.time || '-',
              room: s.room || '-',
              lock: s.lock,
            },
          });
        }
      }
      return { conflict, details };
    } catch {
      return { conflict: false, details: [] };
    }
  };

  // Per-row conflict check sequence guard to avoid stale overwrites
  const rowCheckSeqRef = React.useRef(new Map());

  const checkRowConflictFresh = async (idx, candRow) => {
    const row = candRow || rows[idx];
    if (!row) return;
    const term = String(row._term || '').trim();
    const timeStr = String(row._time || '').trim();
    const dayStr = String(row._day || '').trim();

    // build faculty identifiers to try (label, value, facultyName)
    const opt = (facOptions || []).find(o => String(o.value) === String(row._faculty));
    const optByLabel = (facOptions || []).find(o => String(o.label) === String(row._faculty));
    const candidateIdentifiers = [];
    if (opt?.label) candidateIdentifiers.push(opt.label);
    if (opt?.value) candidateIdentifiers.push(opt.value);
    if (optByLabel && !candidateIdentifiers.includes(optByLabel.label)) candidateIdentifiers.push(optByLabel.label);
    if (row._faculty && !candidateIdentifiers.includes(row._faculty)) candidateIdentifiers.push(row._faculty);
    if (row.facultyName && !candidateIdentifiers.includes(row.facultyName)) candidateIdentifiers.push(row.facultyName);
    const uniqCandidates = Array.from(new Set(candidateIdentifiers.filter(Boolean)));

    if (!term || !timeStr || uniqCandidates.length === 0) {
      // Do not clear previous conflict state on incomplete context; just stop checking
      setRows(prev => prev.map((r,i) => i===idx ? { ...r, _checking: false } : r));
      return;
    }

    // bump sequence token for this row index
    const seqMap = rowCheckSeqRef.current; const prevSeq = Number(seqMap.get(idx) || 0); const mySeq = prevSeq + 1; seqMap.set(idx, mySeq);
    setRows(prev => prev.map((r,i) => i===idx ? { ...r, _checking: true } : r));
    try {
      // prepare candidate norms and filters
      const candRange = getTimeRange(timeStr) || {};
      const candTermN = normalizeTermForCompare(term).toLowerCase();
      const candFacNorms = uniqCandidates.map(x => normFaculty(x));
      const candidateCodeNorm = normCode(row.course_name || row.courseName || row.code);
      const candidateSectionNorm = normSection(selectedBlock?.blockCode || '');
      const sy = settingsLoad.school_year || '';
      const sem = settingsLoad.semester || '';

      // Server-side conflict check
      const numericFid = (() => { const n = Number(opt?.value); return Number.isFinite(n) ? n : undefined; })();
      const payload = {
        term,
        time: timeStr,
        day: row._day || undefined,
        faculty: opt?.label || row._faculty || row.faculty || '',
        facultyId: numericFid,
        schoolyear: sy || undefined,
        semester: sem || undefined,
        blockCode: selectedBlock?.blockCode || '',
        courseName: row.course_name || row.courseName || row.code || '',
        courseTitle: row.course_title || row.courseTitle || row.title || ''
      };
      const idForCheck = row._existingId || 0;
      const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
      let conflict = !!(res?.conflict);
      let details = Array.isArray(res?.details) ? res.details.slice() : [];

      // Department-agnostic fallback using instructor schedules
      const timeIsPlaceholder = isBlankTime(timeStr);
      const dayIsPlaceholder = isBlankTime(dayStr);
      if (!conflict && !timeIsPlaceholder && !dayIsPlaceholder) {
        const fb = await detectConflictViaInstructor({
          facultyName: payload.faculty,
          term,
          timeStr,
          excludeId: idForCheck,
          courseName: payload.courseName,
          courseTitle: payload.courseTitle,
          day: payload.day,
        });
        if (fb.conflict) { conflict = true; details = details.concat(fb.details); }
      } else if (!conflict && (timeIsPlaceholder || dayIsPlaceholder)) {
        // Do not flag conflicts when placeholders like TBA are used; trust server result
        details = [];
      }
      // Inline load limit check for non-admin
      let loadExceeded = false;
      if (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
        try {
          const targetName = payload.faculty || '';
          if (targetName) {
            const meta = findFacultyById(payload.facultyId) || findFacultyByName(targetName);
            const max = maxUnitsFor(meta);
            const lr = (meta?.id!=null) ? await api.getInstructorLoadById(meta.id, { schoolyear: settingsLoad?.school_year, semester: settingsLoad?.semester }) : await api.getInstructorLoad(targetName); const current = Number(lr?.loadUnits || 0);
            const same = normalizeName(targetName) === normalizeName(row.instructor || row.faculty || '');
            const addU = same ? 0 : Number(row.unit || 0);
            if (current + addU > max) {
              loadExceeded = true;
              toast({ title: 'Load limit exceeded', description: `${targetName}: ${employmentOf(meta)==='part-time'?'Part-time max 12':'Full-time max 36'} units. Current ${current}, adding ${addU} ⇒ ${current+addU}.`, status: 'warning' });
            }
          }
        } catch {}
      }
      // Only apply result if this is the latest check for the row
      const stillLatest = rowCheckSeqRef.current.get(idx) === mySeq;
      if (stillLatest) {
        setRows(prev => prev.map((r,i) => i===idx ? { ...r, _status: conflict ? 'Conflict' : (r._existingId ? 'Assigned' : 'Unassigned'), _conflict: conflict, _conflictNote: conflict ? 'Conflicts with an existing schedule for this faculty.' : '', _conflictDetails: details, _checking: false, _loadExceeded: loadExceeded } : r));
      }
    } catch (e) {
      // Do not overwrite with stale error if a newer check is in-flight
      const seqOk = rowCheckSeqRef.current.get(idx);
      if (seqOk) setRows(prev => prev.map((r,i) => i===idx ? { ...r, _checking: false } : r));
      toast({ title: 'Conflict check failed', description: e?.message || 'Could not check conflicts.', status: 'error' });
    }
  };

  // when a row changes, do fresh check immediately
  const handleRowChange = (idx, patch) => {
    const base = rows[idx];
    const merged = { ...base, ...patch };
    setRows(prev => prev.map((r,i) => i===idx ? merged : r));
    setTimeout(() => { checkRowConflictFresh(idx, merged); }, 0);
  };

  const openSuggestions = (idx) => {
    setSuggIndex(idx);
    setSuggOpen(true);
    setSuggBusy(true);
    setSuggestions([]);
    setTimeout(async () => {
      try {
        const row = rows[idx];
        if (!row) { setSuggestions([]); return; }
        const payload = {
          term: row._term,
          time: row._time,
          day: row._day || undefined,
          faculty: row._faculty,
          blockCode: selectedBlock?.blockCode || '',
          courseName: row.course_name || row.courseName || row.code,
          schoolyear: settingsLoad?.school_year,
          semester: settingsLoad?.semester,
          session: selectedBlock?.session || '',
        };
        const id = row._existingId || 'new';
        const serverPlans = await api.getScheduleSuggestions(id, payload, { maxDepth: 3 });
        setSuggestions(Array.isArray(serverPlans) ? serverPlans : []);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSuggBusy(false);
      }
    }, 0);
  };

  const applySuggestion = (sugg) => {
    if (suggIndex == null) return;
    const idx = suggIndex;
    if (!rows[idx]) return;
    const cc = sugg && sugg.candidateChange;
    if (!cc) return; // only auto-apply simple candidate moves
    const next = rows.slice();
    next[idx] = { ...next[idx], _term: cc.toTerm || next[idx]._term, _time: cc.toTime || next[idx]._time };
    setRows(next);
    setSuggOpen(false);
    setSuggIndex(null);
    // Re-run conflict check on the updated row
    setTimeout(() => { try { checkRowConflictFresh(idx, next[idx]); } catch {} }, 0);
  };

  const preparePayload = (rowsToSave) => {
    const blockCode = selectedBlock?.blockCode || '';
    const toYearLabel = (yl) => {
      const n = parseInt(String(yl||'').trim(), 10);
      if (!Number.isFinite(n) || n <= 0) return String(yl||'');
      const suffix = (v) => (v===1?'st':v===2?'nd':v===3?'rd':'th');
      return `${n}${suffix(n)} Year`;
    };
    const facIdOf = (row) => {
      // Prefer explicit id tracked in row edits
      if (row._facultyId != null) return row._facultyId;
      // Try to find by label from known faculty list
      try {
        const name = String(row._faculty || '').trim().toLowerCase();
        const f = (facultyAll || []).find(x => String(x.name||x.faculty||'').trim().toLowerCase() === name);
        if (f && f.id != null) return f.id;
      } catch {}
      return null;
    };
    const findFaculty = (row, fid) => {
      try {
        if (fid != null) {
          const f = (facultyAll || []).find(x => String(x.id) === String(fid));
          if (f) return f;
        }
        const name = String(row._faculty || '').trim().toLowerCase();
        const f2 = (facultyAll || []).find(x => String(x.name||x.faculty||'').trim().toLowerCase() === name);
        if (f2) return f2;
      } catch {}
      return undefined;
    };
    return rowsToSave.map(r => {
      const yrLbl = toYearLabel(r.yearlevel);
      const facultyId = facIdOf(r);
      const facRec = findFaculty(r, facultyId);
      const deptVal = facRec ? (facRec.department || facRec.dept || facRec.department_name || facRec.departmentName) : undefined;
      const termVal = r._term;
      // Always use Schedules Load Defaults for semester labels
      const semLong = mapSemesterLabel(settingsLoad.semester) || settingsLoad.semester || '';
      const instr = facRec ? String(facRec.faculty || facRec.name || r._faculty || '').trim() : String(r._faculty || '').trim();
      // include _existingId so caller can decide update vs create
      return {
        _existingId: r._existingId || null,
        programcode: r.programcode || r.program,
        courseName: r.course_name || r.courseName,
        courseTitle: r.course_title || r.courseTitle,
        unit: r.unit,
        ...(termVal ? { term: termVal } : {}),
        ...(semLong ? { sem: semLong, semester: semLong } : {}),
        time: r._time,
        day: r._day || 'MON-FRI',
        faculty: instr,
        ...(facultyId != null ? { facultyId } : {}),
        ...(deptVal ? { dept: deptVal } : {}),
        // Explicitly link saved schedule to its prospectus row
        ...(r?.id != null ? { prospectusId: r.id } : {}),
        blockCode,
        schoolyear: settingsLoad.school_year,
        sy: settingsLoad.school_year,
        session: selectedBlock?.session || undefined,
        yearlevel: yrLbl,
        ...(authUser?.id != null ? { user_id_created: authUser.id, user_id_lastmodified: authUser.id } : {}),
      };
    });
  };

  const [swapBusy, setSwapBusy] = React.useState(false);
  const [autoArrange, setAutoArrange] = React.useState(false);
  const [autoArrangeOriginalTerms, setAutoArrangeOriginalTerms] = React.useState(new Map()); // key -> previous _term
  const [termViewMode, setTermViewMode] = React.useState('regular'); // 'regular' | 'tiles'
  

  // Seamless tab switching: clear transient schedule state before switching views
  const clearTransientState = React.useCallback(() => {
    // Common schedule state
    setRows([]);
    setFreshCache([]);
    setSelectedBlock(null);
    setSelectedProgram('');
    setYearOrder([]);
    setLoadedYears([]);
    setLoadingYear(false);
    setAttendanceStatsMap(new Map());
    setSaving(false);
    setSwapBusy(false);
    setSwapA(null);
    setSwapB(null);

    // Close program/block modals/dialogs
    setSuggOpen(false); setSuggIndex(null); setSuggBusy(false); setSuggestions([]);
    setConflictOpen(false); setConflictIndex(null);
    setResolveOpen(false); setResolveBusy(false); setResolveRowIndex(null); setResolveConflictId(null); setResolveLabel('');
    setLockDialogOpen(false); setLockDialogBusy(false); setLockDialogIndex(null); setLockDialogBulkIdxs([]); setLockDialogTarget(null);

    // Faculty-specific state
    setSelectedFaculty(null);
    setFacLoading(false);
    setFacultySchedules({ items: [], loading: false });
    setFacSelected(new Set());
    setFacEdits({});
    setFacSuggOpen(false); setFacSuggBusy(false); setFacSuggPlans([]); setFacSuggTargetId(null);
    setFacResolveOpen(false); setFacResolveBusy(false); setFacResolveIndex(null); setFacResolveConflictId(null); setFacResolveLabel('');
    setFacLockOpen(false); setFacLockBusy(false); setFacLockTarget(null);
    setAssignOpen(false); setAssignIndex(null);
    setSchedAssignOpen(false);
    setDragFromIdx(null); setDragOverIdx(null);
  }, []);

  const switchViewMode = React.useCallback((next) => {
    if (registrarViewOnly && !allowedViews.includes(next)) return;
    try { clearTransientState(); } catch {}
    setAutoArrange(false);
    setViewMode(next);
  }, [registrarViewOnly, allowedViews, clearTransientState]);
  const viewOnlyGridTemplate = '3fr 1fr 1fr 1.2fr 1fr 1.5fr 1fr';
  React.useEffect(() => {
    if (registrarViewOnly && termViewMode !== 'regular') {
      setTermViewMode('regular');
    }
  }, [registrarViewOnly, termViewMode]);

  // compute a stable identity for a row within a block
  const rowIdentity = React.useCallback((r) => {
    const code = r?.course_name || r?.courseName || r?.code || '';
    const title = r?.course_title || r?.courseTitle || r?.title || '';
    const sec = r?.blockCode || r?.section || '';
    const id = r?.id || r?._existingId || '';
    return [String(id), String(code), String(title), String(sec)].join('|');
  }, []);

  const arrangeBlockTerms = React.useCallback(() => {
    if (viewMode !== 'blocks' || !selectedBlock) return;
    setRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const blockCode = String(selectedBlock?.blockCode || '');
      const next = prev.slice();
      const semFixed = new Set();
      let fixedFirst = 0;
      let fixedSecond = 0;
      const eligible = [];

      // First pass: respect already assigned terms; collect stats
      for (let i = 0; i < next.length; i++) {
        const r = next[i];
        const rowBlock = String(r.blockCode || r.section || '');
        if (blockCode && rowBlock && rowBlock !== blockCode) continue;
        if (r?._locked) continue; // skip locked
        const termNow = String(r?._term || '').trim();
        if (termNow) {
          const t = normalizeSem(termNow);
          if (t === 'Sem') semFixed.add(i); else if (t === '1st') fixedFirst++; else if (t === '2nd') fixedSecond++;
          continue; // do not change already-assigned term rows
        }
        // Unassigned term: classify
        if (isSemestralCourseLike(r)) {
          eligible.push({ i, force: 'Sem' });
        } else {
          eligible.push({ i, force: null });
        }
      }

      // Assign forced Sem for NSTP/PE/Defense Tactics (only for unassigned)
      for (const e of eligible) {
        if (e.force === 'Sem') {
          const idx = e.i;
          const before = next[idx]._term;
          if (!before) {
            const key = rowIdentity(next[idx]);
            setAutoArrangeOriginalTerms((mapPrev) => {
              const m = new Map(mapPrev);
              if (!m.has(key)) m.set(key, before || '');
              return m;
            });
            next[idx] = { ...next[idx], _term: 'Sem' };
            semFixed.add(idx);
          }
        }
      }

      // Determine distribution for remaining non-Sem unassigned
      const remaining = eligible
        .filter(e => e.force !== 'Sem')
        .map(e => {
          const row = next[e.i];
          const orderKey = Number.isFinite(row?._orderKey) ? row._orderKey : null;
          return { ...e, orderKey };
        })
        .sort((a, b) => {
          const oa = Number.isFinite(a.orderKey) ? a.orderKey : a.i;
          const ob = Number.isFinite(b.orderKey) ? b.orderKey : b.i;
          return oa - ob;
        });
      const totalNonSem = fixedFirst + fixedSecond + remaining.length;
      const targetFirst = Math.ceil(totalNonSem / 2);
      let needFirst = Math.max(0, targetFirst - fixedFirst);
      // Assign remaining: first then second
      for (let k = 0; k < remaining.length; k++) {
        const idx = remaining[k].i;
        const before = next[idx]._term;
        if (before) continue; // already set somehow
        const assign = needFirst > 0 ? '1st' : '2nd';
        const key = rowIdentity(next[idx]);
        setAutoArrangeOriginalTerms((mapPrev) => {
          const m = new Map(mapPrev);
          if (!m.has(key)) m.set(key, before || '');
          return m;
        });
        next[idx] = { ...next[idx], _term: assign };
        if (assign === '1st') needFirst--;
      }
      return next;
    });
  }, [viewMode, selectedBlock, rowIdentity]);

  // When turning on auto arrange, clear terms for eligible unsaved/unlocked rows in the current block
  React.useEffect(() => {
    if (!autoArrange || viewMode !== 'blocks' || !selectedBlock) return;
    setRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const blockCode = String(selectedBlock.blockCode || selectedBlock.section || '');
      const next = prev.map(r => {
        const blk = String(r.blockCode || r.section || '').trim();
        if (blk !== blockCode) return r;
        if (r._locked) return r;
        if (r._existingId) return r;
        const termNow = String(r._term || '').trim();
        if (!termNow) return r;
        const key = rowIdentity(r);
        setAutoArrangeOriginalTerms(mapPrev => {
          const m = new Map(mapPrev);
          if (!m.has(key)) m.set(key, termNow);
          return m;
        });
        return { ...r, _term: '' };
      });
      return next;
    });
  }, [autoArrange, viewMode, selectedBlock, rowIdentity]);

  // ---- Auto-assign time within a session (Morning/Afternoon/Evening)
  const normalizeBlockCode = React.useCallback((v) => String(v || '').trim().toLowerCase(), []);
  const normalizeSessionKey = React.useCallback((v) => {
    const txt = String(v || '').trim().toLowerCase();
    if (!txt) return '';
    if (txt.includes('morning') || txt.startsWith('m')) return 'morning';
    if (txt.includes('afternoon') || txt.startsWith('a')) return 'afternoon';
    if (txt.includes('evening') || txt.startsWith('e')) return 'evening';
    return '';
  }, []);
  const blockSessionMap = React.useMemo(() => {
    const map = new Map();
    (blocksAll || []).forEach(b => {
      const key = normalizeBlockCode(b.blockCode || b.section || '');
      if (key) map.set(key, b.session || '');
    });
    return map;
  }, [blocksAll, normalizeBlockCode]);
  const isBlankTime = React.useCallback((t) => {
    const v = String(t ?? '').trim();
    if (!v) return true;
    const up = v.toUpperCase();
    // Treat common placeholder values as empty
    return up === 'TBA' || up === '-' || up === 'NA' || up === 'N/A' || up === 'NONE' || up === 'NULL' || up === '0' || up === 'TBD';
  }, []);
  const hasMissingTermInBlock = React.useMemo(() => {
    if (!selectedBlock) return false;
    const key = normalizeBlockCode(selectedBlock.blockCode || selectedBlock.section || '');
    return rows.some(r => {
      const blk = normalizeBlockCode(r.blockCode || r.section || selectedBlock.blockCode || selectedBlock.section || '');
      if (blk !== key) return false;
      if (r._existingId) return false; // allow existing saved schedules even if term is blank
      const termVal = normalizeTermForCompare(r._term);
      return !termVal;
    });
  }, [rows, selectedBlock, normalizeBlockCode]);
  const autoAssignTimeDisabled = React.useMemo(() => {
    if (!selectedBlock) return true;
    if (!Array.isArray(rows) || rows.length === 0) return true;
    if (hasMissingTermInBlock) return true;
    return false;
  }, [selectedBlock, rows, hasMissingTermInBlock]);
  const sessionSlotsMap = React.useMemo(() => ({
    morning: ['8-9AM', '9-10AM', '10-11AM', '11-12NN'],
    afternoon: ['1-2PM', '2-3PM', '3-4PM', '4-5PM'],
    evening: ['5-6PM', '6-7PM', '7-8PM', '8-9PM'],
  }), []);
  const sessionLabels = React.useMemo(() => ({
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
  }), []);
  const timeOptionsBySession = React.useMemo(() => {
    const base = getTimeOptions();
    const parsed = base.map(opt => ({ opt, range: parseTimeBlockToMinutes(String(opt || '').trim().toUpperCase()) }));
    const filterRange = (start, end) => parsed.filter(({ opt, range }) => {
      if (!opt) return true;
      const val = String(opt).trim().toUpperCase();
      if (val === 'TBA') return true;
      const s = range.start, e = range.end;
      if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
      return s >= start && e <= end;
    }).map(({ opt }) => opt);
    return {
      morning: filterRange(8 * 60, 12 * 60),
      afternoon: filterRange(13 * 60, 17 * 60),
      evening: filterRange(17 * 60, 21 * 60),
      all: base,
    };
  }, []);
  const timeOptionsForSession = React.useCallback((sessionKey, currentValue, course, day) => {
    const key = normalizeSessionKey(sessionKey);
    const allowed = allowedSessionsForCourse(course || {}, key, day);
    const sessions = allowed && allowed.length ? allowed : (key ? [key] : []);
    const srcKeys = sessions.length ? sessions : ['morning', 'afternoon', 'evening'];
    const seen = new Set();
    let opts = [];
    srcKeys.forEach(k => {
      const base = (k && timeOptionsBySession[k]) ? timeOptionsBySession[k] : timeOptionsBySession.all;
      base.forEach(opt => { if (!seen.has(opt)) { seen.add(opt); opts.push(opt); } });
    });
    if (isPEorNSTP(course)) {
      opts = opts.filter(opt => {
        if (!opt) return true;
        const val = String(opt).trim().toUpperCase();
        if (val === 'TBA') return true;
        const { start, end } = parseTimeBlockToMinutes(val);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
        return end - start > 60;
      });
    }
    if (currentValue && !opts.includes(currentValue)) {
      opts = [...opts, currentValue];
    }
    return opts;
  }, [normalizeSessionKey, timeOptionsBySession]);
  const sessionMenuLabels = React.useMemo(() => ({
    morning: 'Morning (8-12NN)',
    afternoon: 'Afternoon (1-5PM)',
    evening: 'Evening (5-9PM)',
  }), []);
  const selectedBlockSessionKey = React.useMemo(() => normalizeSessionKey(selectedBlock?.session), [normalizeSessionKey, selectedBlock]);
  const allowedAutoAssignSessions = React.useMemo(() => {
    if (selectedBlockSessionKey) return [selectedBlockSessionKey];
    return ['morning', 'afternoon', 'evening'];
  }, [selectedBlockSessionKey]);
  const autoAssignTimeForSession = React.useCallback((sessionKey) => {
    const slots = sessionSlotsMap[sessionKey];
    if (!slots || slots.length === 0) return;
    if (viewMode !== 'blocks' || !selectedBlock) {
      toast({ title: 'Select a block', description: 'Auto-assign time is available in Block view.', status: 'info' });
      return;
    }
    if (selectedBlockSessionKey && sessionKey !== selectedBlockSessionKey) {
      toast({ title: 'Session locked', description: `This block is set to ${sessionLabels[selectedBlockSessionKey] || 'a single'} session.`, status: 'info' });
      return;
    }
    if (hasMissingTermInBlock) {
      toast({ title: 'Set terms first', description: 'Auto time assignment requires all rows in the block to have a term (1st, 2nd, or Sem).', status: 'warning' });
      return;
    }
    const blockKey = normalizeBlockCode(selectedBlock.blockCode || selectedBlock.section || '');
    // Reset unsaved, unlocked rows in this block before re-populating
    const clearedRows = rows.map(r => {
      const sameBlock = normalizeBlockCode(r.blockCode || r.section || selectedBlock.blockCode || selectedBlock.section || '') === blockKey;
      if (!sameBlock || r._existingId || r._locked) return r;
      if (isBlankTime(r._time || r.time || r.schedule)) return r;
      return { ...r, _time: '' };
    });
    setRows(clearedRows);
    const busyRangesByTerm = new Map(); // termKey -> ranges
    const matchesLoad = (rec) => {
      const syWant = String(settingsLoad?.school_year || '').trim().toLowerCase();
      const semWant = String(normalizeSem(settingsLoad?.semester || '')).toLowerCase();
      const syVal = String(rec?.sy || rec?.schoolyear || rec?.schoolYear || rec?.school_year || '').trim().toLowerCase();
      const semVal = String(normalizeSem(rec?.semester || rec?.term || '')).toLowerCase();
      if (syWant && syVal && syWant !== syVal) return false;
      if (semWant && semVal && semWant !== semVal) return false;
      return true;
    };
    const pushBusy = (timeStr) => {
      if (isBlankTime(timeStr)) return;
      const rng = getTimeRange(timeStr);
      if (!rng) return;
      if (Number.isFinite(rng.start) || Number.isFinite(rng.end) || rng.key) busyRanges.push(rng);
    };
    const rowBlockKey = (r) => normalizeBlockCode(r.blockCode || r.section || selectedBlock.blockCode || selectedBlock.section || '');
    const termKey = (t) => normalizeSem(t || '') || '';
    clearedRows.forEach((r) => {
      if (rowBlockKey(r) !== blockKey) return;
      const tk = termKey(r._term || r.term || r.semester);
      const t = r._time || r.time || r.schedule;
      if (!isBlankTime(t)) {
        if (tk) {
          if (!busyRangesByTerm.has(tk)) busyRangesByTerm.set(tk, []);
          const rng = getTimeRange(t);
          if (rng) busyRangesByTerm.get(tk).push(rng);
        }
      }
    });
    const sourceBase = (freshCache && freshCache.length) ? freshCache : (existing || []);
    sourceBase.forEach((s) => {
      if (!matchesLoad(s)) return;
      if (normalizeBlockCode(s.blockCode || s.section || selectedBlock.blockCode || selectedBlock.section || '') !== blockKey) return;
      const tk = termKey(s.term || s.semester);
      const t = s._time || s.schedule || s.time;
      if (!isBlankTime(t)) {
        if (tk) {
          if (!busyRangesByTerm.has(tk)) busyRangesByTerm.set(tk, []);
          const rng = getTimeRange(t);
          if (rng) busyRangesByTerm.get(tk).push(rng);
        }
      }
    });
    const freeSlotsByTerm = new Map();
    ['1st','2nd'].forEach((tk) => {
      const baseBusy = (busyRangesByTerm.get(tk) || []).slice();
      const free = [];
      slots.forEach((label) => {
        const rng = getTimeRange(label);
        if (!rng) return;
        const busyList = baseBusy;
        const overlap = busyList.some((b) => timeRangesOverlap(b, rng));
        if (!overlap) {
          free.push({ label, range: rng });
          busyList.push(rng);
        }
      });
      busyRangesByTerm.set(tk, baseBusy);
      freeSlotsByTerm.set(tk, free);
    });
    const assignments = [];
    const orderVal = (row, idx) => Number.isFinite(row?._orderKey) ? row._orderKey : idx;
    const firstTermRows = [];
    const secondTermRows = [];
    const semRows = [];
    clearedRows.forEach((r, idx) => {
      if (rowBlockKey(r) !== blockKey) return;
      if (r._locked) return;
      const tk = termKey(r._term || r.term || r.semester);
      if (tk === 'Sem') { semRows.push({ row: r, idx, ord: orderVal(r, idx) }); return; }
      if (tk === '1st') { firstTermRows.push({ row: r, idx, ord: orderVal(r, idx) }); return; }
      if (tk === '2nd') { secondTermRows.push({ row: r, idx, ord: orderVal(r, idx) }); return; }
    });
    const assignTermList = (list, tk) => {
      const freeList = freeSlotsByTerm.get(tk) || [];
      if (!freeList.length) return;
      const sorted = list
        .filter(({ row }) => isBlankTime(row._time || row.time || row.schedule))
        .sort((a, b) => a.ord - b.ord);
      sorted.forEach(({ idx }) => {
        const slot = freeSlotsByTerm.get(tk)?.[0];
        if (!slot) return;
        assignments.push({ idx, time: slot.label });
        const nextFree = (freeSlotsByTerm.get(tk) || []).slice(1);
        freeSlotsByTerm.set(tk, nextFree);
      });
    };
    assignTermList(firstTermRows, '1st');
    assignTermList(secondTermRows, '2nd');
    semRows
      .filter(({ row }) => String(row._time || row.time || row.schedule || '').trim().toUpperCase() !== 'TBA')
      .sort((a, b) => a.ord - b.ord)
      .forEach(({ idx }) => assignments.push({ idx, time: 'TBA' }));
    if (assignments.length === 0) {
      toast({ title: 'Nothing to assign', description: 'No rows without time slots to fill for this session.', status: 'info' });
      return;
    }
    assignments.forEach(({ idx, time }) => handleRowChange(idx, { _time: time }));
    const remaining = Array.from(freeSlotsByTerm.values()).reduce((sum, list) => sum + (list ? list.length : 0), 0);
    toast({
      title: 'Times assigned',
      description: `${assignments.length} ${assignments.length === 1 ? 'slot' : 'slots'} set for ${sessionLabels[sessionKey] || 'session'}${remaining > 0 ? `; ${remaining} slot(s) left open` : ''}.`,
      status: 'success'
    });
  }, [sessionSlotsMap, sessionLabels, viewMode, selectedBlock, rows, freshCache, existing, normalizeBlockCode, handleRowChange, toast, isBlankTime, settingsLoad?.school_year, settingsLoad?.semester, hasMissingTermInBlock, selectedBlockSessionKey]);

  const clearAutoAssignedTimes = React.useCallback(() => {
    if (viewMode !== 'blocks' || !selectedBlock) {
      toast({ title: 'Select a block', description: 'Clear auto time is available in Block view.', status: 'info' });
      return;
    }
    let cleared = 0;
    setRows(prev => prev.map(r => {
      if (r._existingId || r._locked) return r; // keep saved schedules as-is
      const currentTime = r._time || r.time || r.schedule;
      if (!isBlankTime(currentTime)) {
        cleared++;
        return { ...r, _time: '' };
      }
      return r;
    }));
    toast({ title: cleared ? 'Auto times cleared' : 'Nothing to clear', description: cleared ? `${cleared} unsaved rows reset.` : 'No unsaved auto-assigned times found.', status: cleared ? 'success' : 'info' });
  }, [viewMode, selectedBlock, setRows, toast, isBlankTime]);

  const shuffleBlockRows = React.useCallback(() => {
    if (viewMode !== 'blocks' || !selectedBlock) {
      toast({ title: 'Select a block', description: 'Shuffle is available in Block view.', status: 'info' });
      return;
    }
    setRows(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const key = normalizeBlockCode(selectedBlock.blockCode || selectedBlock.section || '');
      const normalIdxs = [];
      const specialIdxs = [];
      prev.forEach((r, idx) => {
        const blk = normalizeBlockCode(r.blockCode || r.section || selectedBlock.blockCode || selectedBlock.section || '');
        if (blk === key && !r._existingId && !r._locked) {
          (isSemestralCourseLike(r) ? specialIdxs : normalIdxs).push(idx);
        }
      });
      const shuffleList = (list) => {
        const arr = list.slice();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      const order = [...shuffleList(normalIdxs), ...shuffleList(specialIdxs)];
      if (order.length <= 1) return prev;
      const rankMap = new Map(order.map((idx, i) => [idx, i]));
      return prev.map((r, idx) => {
        if (rankMap.has(idx)) return { ...r, _orderKey: rankMap.get(idx), _term: '', _time: '' };
        if (r._orderKey != null) {
          const { _orderKey, ...rest } = r;
          return rest;
        }
        return r;
      });
    });
    // Drop any remembered terms from Auto Arrange so we don't revert to stale term assignments after shuffle
    setAutoArrangeOriginalTerms(new Map());
    setAutoArrange(false);
    toast({ title: 'Order shuffled', description: 'Schedules reordered within this block.', status: 'success' });
  }, [viewMode, selectedBlock, normalizeBlockCode, toast]);

  // Drag-and-drop removed

  React.useEffect(() => {
    if (autoArrange && viewMode === 'blocks' && selectedBlock) {
      arrangeBlockTerms();
    }
    // re-run when number of rows changes (new loads)
  }, [autoArrange, viewMode, selectedBlock, rows.length, arrangeBlockTerms]);

  // When toggling off, revert only the terms Auto Arrange changed, unless already saved/committed
  React.useEffect(() => {
    const hasOriginals = !!(autoArrangeOriginalTerms && autoArrangeOriginalTerms.size);
    if (autoArrange || !hasOriginals) return;
    const map = autoArrangeOriginalTerms;
    setRows(prev => {
      if (!prev) return prev;
      const next = prev.slice();
      for (let i = 0; i < next.length; i++) {
        const r = next[i];
        const key = rowIdentity(r);
        if (!map.has(key)) continue;
        // skip if this row is now committed (has existing id)
        if (r && r._existingId) continue;
        // revert term
        const prevTerm = map.get(key) || '';
        next[i] = { ...next[i], _term: prevTerm };
      }
      return next;
    });
    // clear originals after revert (once)
    setAutoArrangeOriginalTerms(new Map());
  }, [autoArrange, autoArrangeOriginalTerms, rowIdentity]);
  const swapSelected = async () => {
    const idxs = rows.map((r,i) => (r._selected ? i : -1)).filter(i => i >= 0);
    if (idxs.length !== 2) { toast({ title: 'Select two rows', description: 'Pick exactly two schedules to swap faculty.', status: 'info' }); return; }
    const [i1, i2] = idxs;
    const r1 = rows[i1], r2 = rows[i2];
    if (!r1._existingId || !r2._existingId) { toast({ title: 'Swap unavailable', description: 'Swap applies only to existing schedules.', status: 'warning' }); return; }
    if (r1._locked || r2._locked) { toast({ title: 'Locked schedule', description: 'Unlock schedules before swapping.', status: 'warning' }); return; }
    if (r1._status === 'Conflict' || r2._status === 'Conflict') { toast({ title: 'Resolve conflicts first', description: 'Swap requires no conflicts on both schedules.', status: 'warning' }); return; }
    try {
      setSwapBusy(true);
      await api.swapSchedules(r1._existingId, r2._existingId);
      // Update UI immediately to reflect swapped faculty, then refresh
      setRows(prev => prev.map((r, idx) => {
        if (idx === i1) return { ...r, _faculty: (r2._faculty || ''), _facultyId: (r2._facultyId ?? null) };
        if (idx === i2) return { ...r, _faculty: (r1._faculty || ''), _facultyId: (r1._facultyId ?? null) };
        return r;
      }));
      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Swapped', description: 'Faculty swapped successfully.', status: 'success' });
    } catch (e) {
      toast({ title: 'Swap failed', description: e?.message || 'Could not swap faculty.', status: 'error' });
    } finally {
      setSwapBusy(false);
    }
  };

  const addToSwap = (row) => {
    if (!row || !row._existingId) { toast({ title: 'Only existing schedules', description: 'Save a schedule before adding to swap.', status: 'info' }); return; }
    if (row._locked) { toast({ title: 'Locked schedule', description: 'Unlock before swapping.', status: 'warning' }); return; }
    const label = `${row.course_name || row.courseName || row.code || 'Course'} • ${row._faculty || row.faculty || row.instructor || 'Faculty'} • ${(row._day || row.day || '').toString()} ${(row._time || row.time || '').toString()}`.trim();
    const entry = { id: row._existingId, label, blockCode: selectedBlock?.blockCode || row.blockCode || row.section || '' };
    if (!swapA || (swapA && swapA.id === entry.id)) { setSwapA(entry); return; }
    if (!swapB || (swapB && swapB.id === entry.id)) { setSwapB(entry); return; }
    // Replace A if both filled
    setSwapA(entry);
  };

  // Faculty-view: add to swap using current item state
  const addFacultyItemToSwap = (idx) => {
    const c = facultySchedules.items[idx]; if (!c) return;
    if (!canEditFacultyItem(c)) { toast({ title: 'View only', description: 'You do not have permission to modify this schedule.', status: 'info' }); return; }
    const e = facEdits[c.id] || {};
    const locked = (function(v){ if (typeof v==='boolean') return v; const s=String((v ?? c.lock ?? c.is_locked ?? c.locked ?? '')).toLowerCase(); return s==='yes'||s==='true'||s==='1';})();
    if (!c.id) { toast({ title: 'Only existing schedules', description: 'Save a schedule before adding to swap.', status: 'info' }); return; }
    if (locked) { toast({ title: 'Locked schedule', description: 'Unlock before swapping.', status: 'warning' }); return; }
    const proxy = {
      _existingId: c.id,
      _locked: locked,
      _faculty: e.faculty || c.faculty || c.instructor || '',
      _day: c.day || 'MON-FRI',
      _time: e.time || c.time || c.schedule || '',
      course_name: c.code || c.courseName || '',
      courseTitle: c.title || c.courseTitle || '',
      blockCode: c.blockCode || c.section || '',
      section: c.section || c.blockCode || ''
    };
    addToSwap(proxy);
  };

  // Faculty-view: resolve conflicting old schedule and keep this edit
  const openFacultyResolve = async (idx) => {
    const c = facultySchedules.items[idx]; if (!c) return;
    if (!canEditFacultyItem(c)) return;
    const e = facEdits[c.id] || {};
    const isLocked = (function(v){ if (typeof v==='boolean') return v; const s=String(v||c.lock||c.is_locked||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })();
    if (isLocked) { toast({ title: 'Locked schedule', description: 'Unlock the schedule before resolving.', status: 'warning' }); return; }
    let details = Array.isArray(e._details) ? e._details : [];
    let target = details.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
    if (!target) {
      try {
        const payload = {
          term: e.term || c.term,
          time: e.time || c.time || c.schedule,
          faculty: e.faculty || c.faculty || c.instructor,
          facultyId: e.facultyId || c.facultyId || c.faculty_id || null,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: c.blockCode || c.section || '',
          courseName: c.courseName || c.code || ''
        };
        const res = await api.request(`/${encodeURIComponent(c.id)}/check`, { method: 'POST', body: JSON.stringify(payload) });
        const arr = Array.isArray(res?.details) ? res.details : [];
        target = arr.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
      } catch {}
    }
    const confId = target?.item?.id;
    if (!confId) { toast({ title: 'Cannot resolve', description: 'No conflicting schedule found to replace.', status: 'warning' }); return; }
    try {
      const s = await api.getScheduleById(confId);
      const locked = (function(v){ if (typeof v==='boolean') return v; const st=String(v||'').toLowerCase(); return st==='yes'||st==='true'||st==='1'; })(s?._locked ?? s?.lock ?? s?.is_locked ?? s?.locked);
      if (locked) { toast({ title: 'Cannot resolve', description: 'Conflicting schedule is locked. Unlock it first.', status: 'warning' }); return; }
      const label = `${s?.code || s?.courseName || ''} ${s?.section ? '('+s.section+')' : ''}`.trim() || 'schedule';
      setFacResolveIndex(idx);
      setFacResolveConflictId(confId);
      setFacResolveLabel(label);
      setFacResolveOpen(true);
    } catch (e) {
      toast({ title: 'Cannot resolve', description: e?.message || 'Failed to load conflicting schedule.', status: 'error' });
    }
  };

  const confirmFacultyResolve = async () => {
    const idx = facResolveIndex; const confId = facResolveConflictId;
    if (idx == null || !confId) { setFacResolveOpen(false); return; }
    setFacResolveBusy(true);
    try {
      const c = facultySchedules.items[idx]; const e = facEdits[c.id] || {};
      const body = {
        term: e.term || c.term || '',
        time: e.time || c.time || c.schedule || '',
        day: c.day || undefined,
        faculty: e.faculty || c.faculty || c.instructor || '',
        facultyId: e.facultyId || c.facultyId || c.faculty_id || null,
        section: c.blockCode || c.section || '',
        courseName: c.courseName || c.code || '',
        courseTitle: c.courseTitle || c.title || '',
        schoolyear: settingsLoad.school_year || undefined,
        semester: settingsLoad.semester || undefined,
      };
      await api.resolveSchedule(c.id, body);
      try { await fetchFacultySchedules(selectedFaculty); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Resolved', description: 'Replaced conflicting schedule with your edit.', status: 'success' });
    } catch (e) {
      toast({ title: 'Resolve failed', description: e?.message || 'Could not resolve the conflict.', status: 'error' });
    } finally {
      setFacResolveBusy(false);
      setFacResolveOpen(false);
      setFacResolveIndex(null);
      setFacResolveConflictId(null);
      setFacResolveLabel('');
    }
  };

  const clearSwapSlot = (slot) => { if (slot === 'A') setSwapA(null); else setSwapB(null); };

  const swapNow = async () => {
    if (!swapA || !swapB) { toast({ title: 'Select two schedules', status: 'info' }); return; }
    setSwapBusy(true);
    try {
      await api.swapSchedules(swapA.id, swapB.id);
      // Retry reload quickly to reflect persisted swap
      try { await retryReloadCurrentBlock(3, 400); } catch {}
      // Refresh other affected block(s) by temporarily selecting and reloading them, then restore current
      try {
        const prev = selectedBlock;
        const otherCodes = Array.from(new Set([swapA.blockCode, swapB.blockCode].filter(Boolean)));
        for (const code of otherCodes) {
          if (!prev || (prev && String(prev.blockCode) === String(code))) continue;
          const other = (blocks || []).find(b => String(b.blockCode) === String(code));
          if (other) {
            await onSelectBlock(other);
          }
        }
        if (prev) await onSelectBlock(prev);
      } catch {}

      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}

      toast({ title: 'Swapped', description: 'Faculty swapped successfully.', status: 'success' });
      setSwapA(null); setSwapB(null);
    } catch (e) {
      toast({ title: 'Swap failed', description: e?.message || 'Could not swap faculty.', status: 'error' });
    } finally {
      setSwapBusy(false);
    }
  };

  // Resolve conflict: delete conflicting old schedule and save current row
  const requestResolve = async (idx) => {
    const row = rows[idx]; if (!row) return;
    const isLocked = !!row?._locked || (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(row?.lock);
    if (isLocked) { toast({ title: 'Locked schedule', description: 'Unlock the schedule before resolving.', status: 'warning' }); return; }
    let details = Array.isArray(row._conflictDetails) ? row._conflictDetails : [];
    let target = details.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
    // If not present, perform a fresh server-side check to obtain conflict id and lock state
    if (!target) {
      try {
        const payload = {
          term: row._term,
          time: row._time,
          faculty: row._faculty,
          facultyId: row._facultyId || null,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: selectedBlock?.blockCode || '',
          courseName: row.course_name || row.courseName || row.code || ''
        };
        const idForCheck = row._existingId || 0;
        const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
        details = Array.isArray(res?.details) ? res.details : [];
        target = details.find(d => String(d?.reason||'').toLowerCase().includes('double-booked: same faculty'));
      } catch (e) {}
    }
    const confId = target?.item?.id;
    if (!confId) { toast({ title: 'Cannot resolve', description: 'No conflicting schedule found to replace.', status: 'warning' }); return; }
    const lockedFlag = (v) => { if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; };
    if (lockedFlag(target?.item?._locked ?? target?.item?.lock ?? target?.item?.is_locked ?? target?.item?.locked)) { toast({ title: 'Cannot resolve', description: 'Conflicting schedule is locked. Unlock it first.', status: 'warning' }); return; }
    try {
      const s = await api.getScheduleById(confId);
      const locked = (function(v){ if (typeof v==='boolean') return v; const st=String(v||'').toLowerCase(); return st==='yes'||st==='true'||st==='1'; })(s?._locked ?? s?.lock ?? s?.is_locked ?? s?.locked);
      if (locked) { toast({ title: 'Cannot resolve', description: 'Conflicting schedule is locked. Unlock it first.', status: 'warning' }); return; }
      const label = `${s?.code || s?.courseName || ''} ${s?.section ? '('+s.section+')' : ''}`.trim() || 'schedule';
      setResolveRowIndex(idx);
      setResolveConflictId(confId);
      setResolveLabel(label);
      setResolveOpen(true);
    } catch (e) {
      toast({ title: 'Cannot resolve', description: e?.message || 'Failed to load conflicting schedule.', status: 'error' });
    }
  };

  const saveOneRow = async (idx) => {
    const r = rows[idx]; if (!r) return;
    const [item] = preparePayload([r]);
    const { _existingId, ...body } = item || {};
    const hit = await runServerConflictCheck(_existingId || 0, body, { label: `${body.courseName || 'Schedule'} (${body.blockCode || 'N/A'})` });
    if (hit) return;
    if (_existingId) await api.updateSchedule(_existingId, body); else await api.createSchedule(body);
  };

  const confirmResolve = async () => {
    const idx = resolveRowIndex; const confId = resolveConflictId;
    if (idx == null || !confId) { setResolveOpen(false); return; }
    setResolveBusy(true);
    try {
      // Perform resolve on server-side to ensure fresh checks and atomicity
      const row = rows[idx];
      const [item] = preparePayload([row]);
      const idForResolve = row?._existingId || 0;
      await api.resolveSchedule(idForResolve, item);
      // Refresh block cache and global list
      try { await onSelectBlock(selectedBlock); } catch {}
      try { dispatch(loadAllSchedules()); } catch {}
      toast({ title: 'Resolved', description: 'Replaced conflicting schedule with your new assignment.', status: 'success' });
    } catch (e) {
      toast({ title: 'Resolve failed', description: e?.message || 'Could not resolve the conflict.', status: 'error' });
    } finally {
      setResolveBusy(false);
      setResolveOpen(false);
      setResolveRowIndex(null);
      setResolveConflictId(null);
      setResolveLabel('');
    }
  };

  const computeConflicts = (pending) => {
    const timeKey = (t) => normalizeTimeBlock(t || '')?.key || '';
    const daysOf = (d) => {
      const v = String(d || '').trim().toUpperCase();
      if (!v || v === 'TBA') return [];
      const map = {
        'MON-FRI': ['MON','TUE','WED','THU','FRI'],
        'MWF': ['MON','WED','FRI'],
        'TTH': ['TUE','THU'],
        'MON': ['MON'], 'TUE': ['TUE'], 'WED': ['WED'], 'THU': ['THU'], 'FRI': ['FRI'], 'SAT': ['SAT'], 'SUN': ['SUN'],
      };
      if (map[v]) return map[v];
      return v.split(/[^A-Z]+/).filter(Boolean);
    };
    const matchLoad = (it) => {
      const syWant = String(settingsLoad?.school_year || '').trim().toLowerCase();
      const syHave = String(it.sy || it.schoolyear || it.schoolYear || '').trim().toLowerCase();
      if (syWant && syHave && syWant !== syHave) return false;
      const tWant = normalizeTermForCompare(settingsLoad?.semester || '').toLowerCase();
      const tHave = normalizeTermForCompare(it.term || it.semester || '').toLowerCase();
      if (tWant && tHave && tWant !== tHave) return false;
      return true;
    };
    const sourceBase = (freshCache && freshCache.length) ? freshCache : (existing || []);
    const source = sourceBase.filter(matchLoad);
    const seen = new Set();
    const errs = new Set();
    const dayKeys = (d) => {
      const list = daysOf(d);
      return list.length ? list : ['ANY'];
    };
    // Faculty-time-day conflicts within the same load term/SY
    pending.forEach((r) => {
      if (!r._faculty || !r._term || !r._time) return;
      const termN = String(normalizeTermForCompare(r._term)).toLowerCase();
      dayKeys(r._day).forEach((d) => {
        const k = [String(r._faculty).toLowerCase(), termN, d, timeKey(r._time)].join('|');
        if (seen.has(k)) errs.add(k);
        seen.add(k);
      });
    });
    source.forEach((c) => {
      const fac = String(c.faculty || c.instructor || '').toLowerCase();
      const term = String(normalizeTermForCompare(c.term || c.semester || '')).toLowerCase();
      dayKeys(c.day).forEach((d) => {
        const k = [fac, term, d, c.scheduleKey || timeKey(c.time)].join('|');
        if (seen.has(k)) errs.add(k);
      });
    });
    // Duplicate course detection within the same block (based on courseName/title) in the same load
    const dupSeen = new Set();
    const dupErrs = new Set();
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
    const blockCode = String(selectedBlock?.blockCode || '').trim().toLowerCase();
    pending.forEach((r) => {
      const code = norm(r.course_name || r.courseName || r.code);
      const title = norm(r.course_title || r.courseTitle || r.title);
      const key1 = blockCode + '|code:' + code;
      const key2 = blockCode + '|title:' + title;
      if (code) {
        if (dupSeen.has(key1)) dupErrs.add(key1);
        dupSeen.add(key1);
      }
      if (title) {
        if (dupSeen.has(key2)) dupErrs.add(key2);
        dupSeen.add(key2);
      }
    });
    source.forEach((c) => {
      const sect = norm(c.section != null ? c.section : (c.blockCode != null ? c.blockCode : ''));
      if (sect !== blockCode) return;
      const code = norm(c.code || c.courseName);
      const title = norm(c.title || c.courseTitle);
      const key1 = blockCode + '|code:' + code;
      const key2 = blockCode + '|title:' + title;
      if (code && dupSeen.has(key1)) dupErrs.add(key1);
      if (title && dupSeen.has(key2)) dupErrs.add(key2);
    });
    return (r) => {
      // Faculty/day/time conflict
      if (r._faculty && r._term && r._time) {
        const termN = String(normalizeTermForCompare(r._term)).toLowerCase();
        for (const d of dayKeys(r._day)) {
          const k = [String(r._faculty).toLowerCase(), termN, d, timeKey(r._time)].join('|');
          if (errs.has(k)) return true;
        }
      }
      // Duplicate course within block
      const code = norm(r.course_name || r.courseName || r.code);
      const title = norm(r.course_title || r.courseTitle || r.title);
      const k1 = blockCode + '|code:' + code;
      const k2 = blockCode + '|title:' + title;
      if ((code && dupErrs.has(k1)) || (title && dupErrs.has(k2))) return true;
      return false;
    };
  };

  const saveSelected = async () => {
    if (!readyToLoad) {
      toast({ title: 'Loading disabled', description: 'Set Schedules Load in Settings and ensure you have permission.', status: 'warning' });
      return;
    }
    const chosen = rows.filter(r => {
      const hasFaculty = (r._facultyId != null) || (String(r._faculty || '').trim() !== '');
      const hasTerm = String(r._term || '').trim() !== '';
      const hasTime = String(r._time || '').trim() !== '';
      return !!r._selected && hasFaculty && hasTerm && hasTime;
    });
    if (chosen.length === 0) {
      toast({ title: 'Nothing to save', status: 'info' });
      return;
    }
    // Prevent saving while any selected row is still checking for conflicts
    if (rows.some(r => r._selected && r._checking)) {
      toast({ title: 'Checking conflicts', description: 'Please wait for conflict checks to finish before saving.', status: 'info' });
      return;
    }
    // Do not rely on stale row._status; recompute consistently for current Load
    const isConflict = computeConflicts(chosen);
    let hasConflict = chosen.some(isConflict);
    if (hasConflict) {
      // Confirm with server: if server reports no conflict for all, proceed anyway
      let serverAnyConflict = false;
      try {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r._selected) continue;
          const term = String(r._term || '').trim();
          const timeStr = String(r._time || '').trim();
          if (!term || !timeStr) continue;
          const payload = {
            term,
            time: timeStr,
            day: r._day || undefined,
            faculty: r._faculty || undefined,
            facultyId: r._facultyId || undefined,
            schoolyear: settingsLoad.school_year || undefined,
            semester: settingsLoad.semester || undefined,
            blockCode: selectedBlock?.blockCode || '',
            courseName: r.course_name || r.courseName || r.code || '',
            courseTitle: r.course_title || r.courseTitle || r.title || '',
          };
          const idForCheck = r._existingId || 0;
          try {
            const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
            if (res && res.conflict) {
              serverAnyConflict = true;
              setRows(prev => prev.map((x,j) => j===i ? { ...x, _status: 'Conflict' } : x));
            }
          } catch {}
        }
      } catch {}
      if (serverAnyConflict) {
        toast({ title: 'Conflicts detected', description: 'Server reported conflicts. Please adjust assignment.', status: 'error' });
        return;
      }
      // Server says OK for all selected rows; continue with save despite local heuristic
    }
    // Load limit check for non-admin users (fresh server read)
    const okLimit = await ensureFacultyLoadLimitsForRows(chosen);
    if (!okLimit) return;

    // Server-side parity check per row to avoid false positives/negatives
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r._selected) continue;
        const term = String(r._term || '').trim();
        const timeStr = String(r._time || '').trim();
        if (!term || !timeStr) continue;
        const payload = {
          term,
          time: timeStr,
          day: r._day || undefined,
          faculty: r._faculty || undefined,
          facultyId: r._facultyId || undefined,
          schoolyear: settingsLoad.school_year || undefined,
          semester: settingsLoad.semester || undefined,
          blockCode: selectedBlock?.blockCode || '',
          courseName: r.course_name || r.courseName || r.code || '',
          courseTitle: r.course_title || r.courseTitle || r.title || '',
        };
        const idForCheck = r._existingId || 0;
        try {
          const res = await api.request(`/${encodeURIComponent(idForCheck)}/check`, { method: 'POST', body: JSON.stringify(payload) });
          if (res && res.conflict) {
            setRows(prev => prev.map((x,j) => j===i ? { ...x, _status: 'Conflict' } : x));
            toast({ title: 'Conflicts detected', description: 'Server reported a conflict. Please adjust assignment.', status: 'error' });
            return;
          }
        } catch {}
      }
    } catch {}
    const payload = preparePayload(chosen);
    setSaving(true);
    try {
      let createdCount = 0;
      let updatedCount = 0;
      for (const item of payload) {
        const { _existingId, ...body } = item || {};
        if (_existingId) {
          await api.updateSchedule(_existingId, body);
          updatedCount++;
        } else {
          await api.createSchedule(body);
          createdCount++;
        }
      }
      // Mark saved rows as assigned and clear their selection to avoid confusion
      setRows(prev => prev.map(r => r._selected ? {
        ...r,
        _status: 'Assigned',
        _existingId: (r._existingId || null),
        _selected: false,
        _baseTerm: r._term || r._baseTerm || '',
        _baseTime: r._time || r._baseTime || '',
        _baseDay: r._day || r._baseDay || 'MON-FRI',
        _baseFaculty: r._faculty || r._baseFaculty || '',
        _baseFacultyId: r._facultyId != null ? r._facultyId : (r._baseFacultyId ?? null),
      } : r));
      // Refresh local schedules cache for the current block so the UI persists
      try {
        const q = new URLSearchParams();
        const blockCode = String(selectedBlock?.blockCode || '').trim();
        if (blockCode) q.set('blockCode', blockCode);
        if (settingsLoad?.school_year) q.set('sy', settingsLoad.school_year);
        if (settingsLoad?.semester) q.set('sem', settingsLoad.semester);
        const resp = await api.request(`/?${q.toString()}`);
        const fresh = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
        setFreshCache(Array.isArray(fresh) ? fresh : []);
      } catch {}
      // Also refresh global cache for other views
      try { dispatch(loadAllSchedules()); } catch {}
      const parts = [];
      if (updatedCount) parts.push(`${updatedCount} updated`);
      if (createdCount) parts.push(`${createdCount} created`);
      const desc = parts.length ? parts.join(', ') : `${chosen.length} saved`;
      toast({ title: 'Schedules saved', description: desc, status: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save schedules.', status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // --- render (unchanged) ---
  return (
    <VStack align="stretch" spacing={4}>
      <HStack justify="space-between" align="center" position="sticky" top={0} zIndex={5} bg={panelBg} p={1} borderBottomWidth="1px" borderColor={border} rounded="md">
        <HStack>
          <Heading size="md">Course Loading</Heading>
          <HStack spacing={1} ml={3}>
            {allowedViews.map((view) => {
              const label = view === 'blocks' ? 'Blocks' : view === 'faculty' ? 'Faculty' : view === 'courses' ? 'Courses' : 'Summary';
              return (
                <Button key={view} size="sm" variant={viewMode===view?'solid':'ghost'} colorScheme="blue" onClick={()=>switchViewMode(view)}>
                  {label}
                </Button>
              );
            })}
          </HStack>
        </HStack>
        <HStack spacing={3}>
          <Tooltip label="Current Schedules Load Defaults">
            <Badge colorScheme={readyToLoad ? 'green' : 'red'}>
              SY {settingsLoad.school_year || '—'} / {settingsLoad.semester || '—'}
            </Badge>
          </Tooltip>
          <Tooltip label={(viewMode === 'faculty' && !isAdmin)
            ? 'You can edit schedules for your department; other departments are view-only.'
            : (canLoad ? 'You can assign and save.' : 'View-only: insufficient permissions')}>
            <Badge colorScheme={canLoad ? 'blue' : 'gray'}>{(viewMode === 'faculty' && !isAdmin) ? 'Dept-limited' : (canLoad ? 'Editable' : 'View-only')}</Badge>
          </Tooltip>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 5 }} gap={4} alignItems="start">
        {(viewMode === 'blocks' || viewMode === 'faculty') && (
        <Box gridColumn={{ base: 'auto', lg: '1 / span 1' }} maxW={{ base: '100%', lg: '340px' }} position="sticky" top="64px" zIndex={9}>
          {viewMode === 'blocks' && (
            <VStack align="stretch" spacing={3} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={panelBg} w="full">
              <HStack justify="space-between" align="center">
                <Heading size="sm">Blocks</Heading>
                <Badge colorScheme="gray">{(blocks || []).length}</Badge>
              </HStack>
              <Box h="calc(100dvh - 240px)" overflowY="auto" w="full">
                <BlockList
                  items={blocks}
                  selectedId={selectedBlock?.id}
                  onSelect={onSelectBlock}
                  loading={blocksLoading}
                  onProgramChange={(v)=>{ setSelectedProgram(v || ''); setSelectedBlock(null); setRows([]); setFreshCache([]); }}
                  hideFilters={registrarViewOnly}
                />
              </Box>
            </VStack>
          )}
          {viewMode === 'faculty' && (
            <VStack align="stretch" spacing={3} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={panelBg} minH="calc(100vh - 210px)">
              <HStack justify="space-between" align="center">
                <Heading size="sm">Faculty</Heading>
                <Badge colorScheme="gray">{(filteredFaculty||[]).length}</Badge>
              </HStack>
              <HStack spacing={2} flexWrap="wrap">
                <Input size="sm" placeholder="Search faculty" value={facQ} onChange={(e)=>setFacQ(e.target.value)} maxW="200px" />
                <Select size="sm" placeholder="Department" value={facDeptFilter} onChange={(e)=>setFacDeptFilter(e.target.value)} maxW="180px">
                  {(() => {
                    const list = facultyOpts.departments || [];
                    if (isAdmin) return list.map(opt => <option key={opt} value={opt.toLowerCase()}>{opt}</option>);
                    const ALWAYS = new Set(['GENED','KNP PARTTIME','PARTTIME','PE']);
                    const allowBases = Array.isArray(allowedDepts)
                      ? new Set(allowedDepts.map(s => (String(s||'').toUpperCase().split('-')[0]||'').replace(/[^A-Z0-9]/g,'')))
                      : null;
                    const filtered = list.filter(opt => {
                      const u = String(opt || '').toUpperCase().trim();
                      if (ALWAYS.has(u)) return true;
                      if (!allowBases) return false; // not loaded yet
                      const base = u.replace(/[^A-Z0-9]/g,'');
                      return allowBases.has(base);
                    });
                    return filtered.map(opt => <option key={opt} value={String(opt).toLowerCase()}>{opt}</option>);
                  })()}
                </Select>
                <Select size="sm" placeholder="Employment" value={facEmpFilter} onChange={(e)=>setFacEmpFilter(e.target.value)} maxW="160px">
                  {(facultyOpts.employments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </Select>
                <Select size="sm" value={facSort} onChange={(e)=>setFacSort(e.target.value)} maxW="180px">
                  <option value="name">Sort: Name</option>
                  <option value="dept">Sort: Department</option>
                  <option value="employment">Sort: Employment</option>
                  <option value="units">Sort: Units</option>
                </Select>
                <Select size="sm" value={facSortDir} onChange={(e)=>setFacSortDir(e.target.value)} maxW="140px">
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </Select>
              </HStack>
              <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                <Stack spacing={2}>
                  {/* Line for A */}
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge colorScheme={swapA ? 'blue' : 'gray'}>A</Badge>
                    <Text noOfLines={1} flex="1 1 220px" color={subtle}>
                      {swapA ? swapA.label : 'Add a schedule to slot A'}
                    </Text>
                    {swapA && (
                      <Button size="xs" variant="ghost" onClick={() => clearSwapSlot('A')}>
                        Clear
                      </Button>
                    )}
                  </HStack>

                  {/* Line for B */}
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge colorScheme={swapB ? 'purple' : 'gray'}>B</Badge>
                    <Text noOfLines={1} flex="1 1 220px" color={subtle}>
                      {swapB ? swapB.label : 'Add a schedule to slot B'}
                    </Text>
                    {swapB && (
                      <Button size="xs" variant="ghost" onClick={() => clearSwapSlot('B')}>
                        Clear
                      </Button>
                    )}

                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={swapNow}
                      isDisabled={!canLoad || !swapA || !swapB || swapBusy}
                      isLoading={swapBusy}
                    >
                      Swap Now
                    </Button>
                  </HStack>
                </Stack>

              </Box>
              <VStack align="stretch" spacing={1} maxH="calc(100vh - 300px)" overflowY="auto">
                {sortedFaculty.map(f => {
                    const isSel = selectedFaculty && String(selectedFaculty.id) === String(f.id);
                    const dept = f.department || f.dept || f.department_name || f.departmentName || '';
                    const units = unitsForFaculty(f);
                  return (
                    <Box key={f.id}
                      p={2}
                      rounded="md"
                      borderWidth="1px"
                      borderColor={isSel ? 'blue.300' : border}
                      bg={isSel ? 'blue.50' : undefined}
                      cursor="pointer"
                      onClick={()=>{ setSelectedFaculty(f); fetchFacultySchedules(f); }}
                        _hover={{ borderColor: 'blue.400' }}
                      >
                        <Text fontWeight="600" noOfLines={1}>{f.name || f.faculty || '–'}</Text>
                        <HStack spacing={2} mt={1} fontSize="xs" color={subtle}>
                          {dept && <Badge>{dept}</Badge>}
                          {f.employment && <Badge colorScheme="purple">{f.employment}</Badge>}
                          {Number.isFinite(units) && <Badge colorScheme="teal">{units} units</Badge>}
                          {!Number.isFinite(units) ? (
                            (() => {
                              const u = calcUnitsForFaculty(f);
                              return <Badge colorScheme="teal">{u} units</Badge>;
                            })()
                          ) : null}
                        </HStack>
                      </Box>
                    );
                  })}
                {filteredFaculty.length === 0 && (
                  <Text fontSize="sm" color={subtle}>No faculty match current filters.</Text>
                )}
              </VStack>
              </VStack>
          )}

        </Box>
        )}

        <Box gridColumn={{ base: 'auto', lg: ((viewMode==='courses' || viewMode==='summary') ? '1 / span 5' : '2 / span 4') }} borderWidth="1px" borderColor={border} rounded="xl" p={3} bg={panelBg}>
          {!selectedBlock && !selectedProgram && (viewMode === 'blocks' || viewMode === 'faculty') && (
            <VStack py={10} spacing={2}>
              {viewMode === 'blocks' ? (
                <>
                  <Heading size="sm">Select a block to begin</Heading>
                  <Text color={subtle}>All related prospectus courses will auto-load for assignment.</Text>
                </>
              ) : (
                <>
                  <Heading size="sm">Select a faculty to view schedules</Heading>
                  <Text color={subtle}>Filter by department and employment to narrow the list.</Text>
                </>
              )}
            </VStack>
          )}
          {viewMode === 'courses' && (
            <CoursesView />
          )}
          {viewMode === 'summary' && (
            <CourseSummaryView viewOnly={registrarViewOnly} />
          )}
          {viewMode === 'blocks' && !selectedBlock && !!selectedProgram && (
            <VStack align="stretch" spacing={3}>
              <Box position="sticky" top="64px" zIndex={10} bg={panelBg} borderBottomWidth="1px" borderColor={border} boxShadow="sm" px={2} py={2}>
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between" align="center">
                    <HStack>
                      <Heading size="sm">Program:</Heading>
                      <Badge colorScheme="blue">{selectedProgram}</Badge>
                    </HStack>
                    <HStack>
                      <Button leftIcon={<FiPrinter />} size="sm" variant="outline" onClick={onPrintProgram} isDisabled={loading || !rows.length}>Print</Button>
                    </HStack>
                  </HStack>
                  {!loading && !registrarViewOnly && (
                    <Box borderWidth="1px" borderColor={border} rounded="md" p={2} bg={panelBg}>
                      <HStack spacing={3} flexWrap="wrap" align="center">
                      {(() => {
                        const total = rows.length;
                        const selectedCount = rows.filter(r => r._selected).length;
                        const allChecked = total > 0 && selectedCount === total;
                        const indeterminate = selectedCount > 0 && selectedCount < total;
                        return (
                          <HStack>
                            <Checkbox
                              isChecked={allChecked}
                              isIndeterminate={indeterminate}
                              onChange={(e)=> setRows(prev => prev.map(r => ({ ...r, _selected: !!e.target.checked })))}
                            >
                              Select all
                            </Checkbox>
                            <Badge colorScheme={selectedCount ? 'blue' : 'gray'}>{selectedCount} selected</Badge>
                            <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: true })))}>
                              Select All
                            </Button>
                            <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: false })))}>
                              Deselect All
                            </Button>
                          </HStack>
                        );
                      })()}
                        <Button size="sm" colorScheme="blue" leftIcon={<FiUpload />} onClick={saveSelected} isDisabled={!canLoad || saving || rows.some(r => r._selected && (r._status === 'Conflict' || r._checking))} isLoading={saving}>Save Selected</Button>
                        <Button size="sm" variant="outline" leftIcon={<FiRefreshCw />} onClick={swapSelected} isDisabled={!canLoad || swapBusy} isLoading={swapBusy}>Swap Faculty</Button>
                        <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(true)} isDisabled={!canLoad || rows.every(r => !r._selected || !r._existingId || r._locked)}>
                          Lock Selected
                        </Button>
                        <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(false)} isDisabled={!isAdmin || rows.every(r => !r._selected || !r._existingId || !r._locked)}>
                          Unlock Selected
                        </Button>
                        <Button size="sm" variant="outline" leftIcon={<FiShuffle />} onClick={shuffleBlockRows}>Shuffle Order</Button>
                      </HStack>
                    </Box>
                  )}
                </VStack>
              </Box>
              {loading && (
                <VStack py={4} spacing={2}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <HStack key={`prg-skel-${i}`} py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="140px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="80px" rounded="sm" />
                    </HStack>
                  ))}
                </VStack>
              )}
              {!loading && (
              <>
              {grouped.map(group => (
                <Box key={`${group.programcode}-${group.yearlevel}`} borderWidth="1px" borderColor={border} rounded="md" p={2}>
                  <HStack justify="space-between" mb={2}>
                    <HStack>
                      <Badge colorScheme="blue">{group.programcode}</Badge>
                      <Badge colorScheme="orange">Year {group.yearlevel || 'N/A'}</Badge>
                    </HStack>
                    <Text fontSize="sm" color={subtle}>{group.items.length} course(s)</Text>
                  </HStack>
                  {(() => {
                    // group by block/section within this year level
                    const byBlock = new Map();
                    group.items.forEach((it) => {
                      const sec = String(it.blockCode || it.section || '').trim() || 'Unassigned';
                      if (!byBlock.has(sec)) byBlock.set(sec, []);
                      byBlock.get(sec).push(it);
                    });
                    const sections = Array.from(byBlock.keys()).sort((a,b) => a.localeCompare(b));
                    const limited = sections.slice(0, progBlocksLimit);
                    return (
                      <VStack align="stretch" spacing={3}>
                        {limited.map((sec) => (
                          <Box key={`${group.programcode}-${group.yearlevel}-${sec}`} borderWidth="1px" borderColor={border} rounded="md" p={2}>
                            <HStack mb={2}>
                              <Badge colorScheme={sec === 'Unassigned' ? 'gray' : 'purple'}>{sec}</Badge>
                              <Text fontSize="sm" color={subtle}>{byBlock.get(sec).length} course(s)</Text>
                            </HStack>
                            {registrarViewOnly && (
                              <Box
                                display="grid"
                                gridTemplateColumns={viewOnlyGridTemplate}
                                columnGap={3}
                                px={1}
                                py={1}
                                borderBottomWidth="1px"
                                borderColor={dividerBorder}
                                fontSize="sm"
                                fontWeight="700"
                                color={subtle}
                              >
                                <Text noOfLines={1}>Course</Text>
                                <Text noOfLines={1}>Term</Text>
                                <Text noOfLines={1}>Day</Text>
                                <Text noOfLines={1}>Time</Text>
                                <Text noOfLines={1}>Room</Text>
                                <Text noOfLines={1}>Faculty</Text>
                                <Text noOfLines={1} textAlign="right">Status</Text>
                              </Box>
                            )}
                            <VirtualBlockList
                              items={byBlock.get(sec)}
                              estimatedRowHeight={80}
                              overscan={8}
                              maxHeight="50vh"
                              border={border}
                              dividerBorder={dividerBorder}
                              renderRow={(r) => {
                                const idx = rowIndexMap.get(r) ?? -1;
                                return (
                                  <Box
                                    key={`${r._existingId || r.course_name}-${idx}`}
                                    borderWidth="0px"
                                  >
                                    <AssignmentRow
                                      row={r}
                                      faculties={facOptions}
                                      schedulesSource={(freshCache && freshCache.length) ? freshCache : (existing || [])}
                                      allCourses={(existing || [])}
                                      statsCourses={scopedCourses}
                                      blockCode={r.blockCode || r.section || ''}
                                      blockSession={selectedBlock?.session || ''}
                                      attendanceStats={attendanceStatsMap}
                                      disabled={!canLoad}
                                      onChange={(patch)=>handleRowChange(idx, patch)}
                                      onToggle={(ck)=>toggleRow(idx, ck)}
                                      onRequestLockChange={(next)=>requestLockChange(idx, next)}
                                      onRequestConflictInfo={()=>{ setConflictIndex(idx); setConflictOpen(true); }}
                                      onRequestSuggest={()=>openSuggestions(idx)}
                                      onRequestAssign={()=>openAssignForRow(idx)}
                                      onRequestAddToSwap={()=>addToSwap(rows[idx])}
                                      onRequestDelete={()=>requestDelete(idx)}
                                      onRequestResolve={()=>requestResolve(idx)}
                                      onRequestHistory={openHistoryForRow}
                                      isAdmin={role==='admin' || role==='manager'}
                                      viewOnly={registrarViewOnly}
                                    />
                                  </Box>
                                );
                              }}
                            />
                          </Box>
                        ))}
                        {sections.length > limited.length && (
                          <VStack ref={progSentinelRef} py={4} spacing={2}>
                            <HStack py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="120px" rounded="sm" />
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="60px" rounded="sm" />
                            </HStack>
                            <HStack py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '56px', md: '64px' }} height="16px" rounded="sm" />
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '80px', md: '96px' }} height="16px" rounded="sm" />
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '82px', md: '92px' }} height="16px" rounded="sm" />
                              <Box flex="1 1 auto" minW={0}>
                                <SkeletonText startColor={skStart} endColor={skEnd} noOfLines={1} spacing='2' skeletonHeight='12px' width="60%" />
                              </Box>
                              <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '120px', md: '160px' }} height="16px" rounded="sm" />
                            </HStack>
                            <Text fontSize="sm" color={subtle}>Loading more blocks…</Text>
                          </VStack>
                        )}
                      </VStack>
                    );
                  })()}
                </Box>
              ))}
              {grouped.length === 0 && (
                <VStack py={10}><Text color={subtle}>No schedules for this program.</Text></VStack>
              )}
              <VStack ref={progYearSentinelRef} py={4} spacing={2}>
                {(yearOrder.filter(y => !loadedYears.includes(String(y))).length > 0) && (
                  <>
                    <HStack py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="140px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="80px" rounded="sm" />
                    </HStack>
                    <HStack py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '56px', md: '64px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '80px', md: '96px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '82px', md: '92px' }} height="16px" rounded="sm" />
                      <Box flex="1 1 auto" minW={0}>
                        <SkeletonText startColor={skStart} endColor={skEnd} noOfLines={1} spacing='2' skeletonHeight='12px' width="65%" />
                      </Box>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '120px', md: '160px' }} height="16px" rounded="sm" />
                    </HStack>
                    <Text fontSize="sm" color={subtle}>{loadingYear ? 'Loading year…' : 'Scroll to load more years'}</Text>
                  </>
                )}
              </VStack>
              </>
              )}
            </VStack>
          )}
{viewMode === 'blocks' && selectedBlock && (
            <Box position="relative">
            <VStack align="stretch" spacing={3}>
              <Box position="sticky" top="64px" zIndex={10} bg={panelBg} borderBottomWidth="1px" borderColor={border} boxShadow="sm" px={2} py={2}>
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between" align="center">
                    <HStack>
                      <Heading size="sm">Block:</Heading>
                      <Badge colorScheme="purple">{selectedBlock.blockCode}</Badge>
                    </HStack>
                    <HStack>
                      <Button leftIcon={<FiPrinter />} size="sm" variant="outline" onClick={onPrintBlock} isDisabled={loading}>Print</Button>
                      <Button leftIcon={<FiRefreshCw />} size="sm" variant="outline" onClick={()=>onSelectBlock(selectedBlock)} isDisabled={loading}>Reload</Button>
                    </HStack>
                  </HStack>
                  {/* Quick swap tray kept compact within sticky */}
                  {!registrarViewOnly && (
                    <Box borderWidth="1px" borderColor={border} rounded="md" p={2} bg={panelBg}>
                      <HStack spacing={2} align="center" flexWrap="wrap">
                        <Badge colorScheme={swapA ? 'blue' : 'gray'}>A</Badge>
                        <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapA ? swapA.label : 'Add a schedule to slot A'}</Text>
                        {swapA && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('A')}>Clear</Button>}
                        <Divider orientation="vertical" />
                        <Badge colorScheme={swapB ? 'purple' : 'gray'}>B</Badge>
                        <Text noOfLines={1} flex="1 1 220px" color={subtle}>{swapB ? swapB.label : 'Add a schedule to slot B'}</Text>
                        {swapB && <Button size="xs" variant="ghost" onClick={()=>clearSwapSlot('B')}>Clear</Button>}
                        <Button size="sm" colorScheme="blue" onClick={swapNow} isDisabled={!canLoad || !swapA || !swapB || swapBusy} isLoading={swapBusy}>Swap Now</Button>
                      </HStack>
                    </Box>
                  )}

                  {!registrarViewOnly && (
                    <Box borderWidth="1px" borderColor={border} rounded="md" p={2} bg={panelBg}>
                      <HStack spacing={3} flexWrap="wrap" align="center">
                        {(() => {
                          const total = rows.length;
                          const selectedCount = rows.filter(r => r._selected).length;
                          const allChecked = total > 0 && selectedCount === total;
                          const indeterminate = selectedCount > 0 && selectedCount < total;
                          return (
                            <HStack>
                              <Checkbox
                                isChecked={allChecked}
                                isIndeterminate={indeterminate}
                                onChange={(e)=> setRows(prev => prev.map(r => ({ ...r, _selected: !!e.target.checked })))}
                              >
                                Select all
                              </Checkbox>
                              <Badge colorScheme={selectedCount ? 'blue' : 'gray'}>{selectedCount} selected</Badge>
                              <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: true })))}>
                                Select All
                              </Button>
                              <Button size="sm" variant="ghost" onClick={()=>setRows(prev => prev.map(r => ({ ...r, _selected: false })))}>
                                Deselect All
                              </Button>
                            </HStack>
                          );
                        })()}
                        <Button size="sm" colorScheme="blue" leftIcon={<FiUpload />} onClick={saveSelected} isDisabled={!canLoad || saving || rows.some(r => r._selected && (r._status === 'Conflict' || r._checking))} isLoading={saving}>Save Selected</Button>
                        <Button size="sm" variant="outline" leftIcon={<FiRefreshCw />} onClick={swapSelected} isDisabled={!canLoad || swapBusy} isLoading={swapBusy}>Swap Faculty</Button>
                        <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(true)} isDisabled={!canLoad || rows.every(r => !r._selected || !r._existingId || r._locked)}>
                          Lock Selected
                        </Button>
                        <Button size="sm" variant="outline" onClick={()=>requestBulkLockChange(false)} isDisabled={!isAdmin || rows.every(r => !r._selected || !r._existingId || !r._locked)}>
                          Unlock Selected
                        </Button>
                        <Button size="sm" variant="outline" leftIcon={<FiShuffle />} onClick={shuffleBlockRows}>Shuffle Order</Button>
                        <Tooltip label="Evenly distribute terms" hasArrow>
                          <HStack pl={2} spacing={2}>
                            <Switch size="sm" isChecked={autoArrange} onChange={(e)=>setAutoArrange(e.target.checked)} />
                            <Text fontSize="sm">Auto Arrange Term</Text>
                          </HStack>
                        </Tooltip>
                        <Menu>
                          <MenuButton as={Button} size="sm" variant="outline" leftIcon={<FiClock />} rightIcon={<FiChevronDown />} isDisabled={autoAssignTimeDisabled}>
                            Auto Assign Time
                          </MenuButton>
                          <MenuList>
                            {allowedAutoAssignSessions.map((ses) => (
                              <MenuItem key={ses} onClick={()=>autoAssignTimeForSession(ses)} isDisabled={autoAssignTimeDisabled}>
                                {sessionMenuLabels[ses] || sessionLabels[ses] || ses}
                              </MenuItem>
                            ))}
                            <MenuItem onClick={clearAutoAssignedTimes}>Clear Auto Times (unsaved rows)</MenuItem>
                          </MenuList>
                        </Menu>
                      <Tooltip label="Toggle tiled term cards" hasArrow>
                        <HStack pl={2} spacing={2}>
                          <Switch
                            size="sm"
                            isChecked={termViewMode === 'tiles'}
                            isDisabled={registrarViewOnly}
                            onChange={(e)=> {
                              if (registrarViewOnly) return;
                              setTermViewMode(e.target.checked ? 'tiles' : 'regular');
                            }}
                          />
                          <Text fontSize="sm">Tiles View</Text>
                        </HStack>
                      </Tooltip>
                    </HStack>
                  </Box>
                  )}
                </VStack>
              </Box>

              {/* Content continues below sticky header */}
              {grouped.map(group => (
                <Box key={`${group.programcode}-${group.yearlevel}`} borderWidth="1px" borderColor={border} rounded="md" p={2}>
                  <HStack justify="space-between" mb={2}>
                    <HStack>
                      <Badge colorScheme="blue">{group.programcode}</Badge>
                      <Badge colorScheme="orange">Year {group.yearlevel || 'N/A'}</Badge>
                    </HStack>
                    <Text fontSize="sm" color={subtle}>{group.items.length} course(s)</Text>
                  </HStack>
                  {registrarViewOnly && (
                    <Box
                      display="grid"
                      gridTemplateColumns={viewOnlyGridTemplate}
                      columnGap={3}
                      px={1}
                      py={1}
                      borderBottomWidth="1px"
                      borderColor={dividerBorder}
                      fontSize="sm"
                      fontWeight="700"
                      color={subtle}
                    >
                      <Text noOfLines={1}>Course</Text>
                      <Text noOfLines={1}>Term</Text>
                      <Text noOfLines={1}>Day</Text>
                      <Text noOfLines={1}>Time</Text>
                      <Text noOfLines={1}>Room</Text>
                      <Text noOfLines={1}>Faculty</Text>
                      <Text noOfLines={1} textAlign="right">Status</Text>
                    </Box>
                  )}
                  {termViewMode === 'regular' ? (
                    <VStack align="stretch" spacing={0} divider={<Divider borderColor={dividerBorder} />}>
                      {group.items.map((r) => {
                        const idx = rowIndexMap.get(r) ?? -1;
                        return (
                          <Box
                            key={`${r.id || r.course_name}-${idx}`}
                            borderWidth="0px"
                          >
                            <AssignmentRow
                              row={r}
                              faculties={facOptions}
                              schedulesSource={(freshCache && freshCache.length) ? freshCache : (existing || [])}
                              allCourses={(existing || [])}
                              statsCourses={scopedCourses}
                              blockCode={selectedBlock?.blockCode || ''}
                              blockSession={selectedBlock?.session || ''}
                              attendanceStats={attendanceStatsMap}
                              disabled={!canLoad}
                              onChange={(patch)=>handleRowChange(idx, patch)}
                              onToggle={(ck)=>toggleRow(idx, ck)}
                              onRequestLockChange={(next)=>requestLockChange(idx, next)}
                              onRequestConflictInfo={()=>{ setConflictIndex(idx); setConflictOpen(true); }}
                              onRequestSuggest={()=>openSuggestions(idx)}
                              onRequestAssign={()=>openAssignForRow(idx)}
                              onRequestAddToSwap={()=>addToSwap(rows[idx])}
                              onRequestDelete={()=>requestDelete(idx)}
                              onRequestResolve={()=>requestResolve(idx)}
                              onRequestHistory={openHistoryForRow}
                              isAdmin={role==='admin' || role==='manager'}
                              viewOnly={registrarViewOnly}
                            />
                          </Box>
                        );
                      })}
                    </VStack>
                  ) : (
                    (() => {
                      const palette = {
                        '1st': { label: '1st Term', badge: 'blue', bg: termBgFirst, border: termBorderFirst, accent: 'linear-gradient(120deg, rgba(59,130,246,0.18), transparent)' },
                        '2nd': { label: '2nd Term', badge: 'green', bg: termBgSecond, border: termBorderSecond, accent: 'linear-gradient(120deg, rgba(16,185,129,0.18), transparent)' },
                        'Sem': { label: 'Semestral', badge: 'orange', bg: termBgSem, border: termBorderSem, accent: 'linear-gradient(120deg, rgba(251,146,60,0.18), transparent)' },
                        Other: { label: 'Unassigned Term', badge: 'pink', bg: termBgOther, border: termBorderOther, accent: 'linear-gradient(135deg, rgba(236,72,153,0.16), rgba(255,255,255,0))' },
                      };
                      const order = ['1st', '2nd', 'Sem', 'Other'];
                      const bucketMap = new Map(order.map(k => [k, []]));
                      group.items.forEach((r) => {
                        // Only respect the explicitly set assignment term; missing terms fall into "Unassigned"
                        const norm = canonicalTerm(r._term);
                        const key = norm === '1st' ? '1st' : (norm === '2nd' ? '2nd' : (norm === 'Sem' ? 'Sem' : 'Other'));
                        bucketMap.get(key).push(r);
                      });
                      const buckets = order.map(key => ({ key, items: bucketMap.get(key) || [], ...palette[key] })).filter(b => b.items.length > 0);
                      return (
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                          {buckets.map(bucket => (
                            <Box
                              key={`${group.programcode}-${group.yearlevel}-${bucket.key}`}
                              position="relative"
                              borderWidth="1px"
                              borderColor={bucket.border}
                              rounded="lg"
                              p={4}
                              bg={bucket.bg}
                              boxShadow="lg"
                              overflow="hidden"
                              transition="all 0.2s ease"
                              _hover={{ boxShadow: 'xl', transform: 'translateY(-2px)' }}
                            >
                              <Box position="absolute" inset={0} opacity={0.7} pointerEvents="none" zIndex={0} style={{ backgroundImage: bucket.accent }} />
                              <VStack align="stretch" spacing={3} position="relative" zIndex={1}>
                                <HStack justify="space-between" align="center">
                                  <HStack spacing={2}>
                                    <Badge colorScheme={bucket.badge}>{bucket.label}</Badge>
                                    <Tag size="sm" variant="subtle" colorScheme={bucket.badge}>Chronological</Tag>
                                    {bucket.key === 'Other' && <Tag size="sm" colorScheme="pink" variant="solid">Needs term</Tag>}
                                  </HStack>
                                  <Tag size="sm" variant="solid" colorScheme={bucket.badge}>{bucket.items.length} course(s)</Tag>
                                </HStack>
                                {bucket.key === 'Other' && (
                                  <Text fontSize="xs" color={subtle} bg={panelBg} px={2} py={1} rounded="md">
                                    These courses have no term yet - assign 1st, 2nd, or Sem to place them in the proper lane.
                                  </Text>
                                )}
                                <VStack align="stretch" spacing={3} divider={<Divider borderColor={dividerBorder} />}>
                                  {bucket.items.map((r) => {
                                    const idx = rowIndexMap.get(r) ?? -1;
                                    return (
                                      <Box
                                        key={`${r.id || r.course_name}-${idx}`}
                                        borderWidth="0px"
                                      >
                                        <AssignmentRow
                                          row={r}
                                          faculties={facOptions}
                                          schedulesSource={(freshCache && freshCache.length) ? freshCache : (existing || [])}
                                          allCourses={(existing || [])}
                                          statsCourses={scopedCourses}
                                          blockCode={selectedBlock?.blockCode || ''}
                                          blockSession={selectedBlock?.session || ''}
                                          attendanceStats={attendanceStatsMap}
                                          disabled={!canLoad}
                                          onChange={(patch)=>handleRowChange(idx, patch)}
                                          onToggle={(ck)=>toggleRow(idx, ck)}
                                          onRequestLockChange={(next)=>requestLockChange(idx, next)}
                                          onRequestConflictInfo={()=>{ setConflictIndex(idx); setConflictOpen(true); }}
                                          onRequestSuggest={()=>openSuggestions(idx)}
                                          onRequestAssign={()=>openAssignForRow(idx)}
                                          onRequestAddToSwap={()=>addToSwap(rows[idx])}
                                          onRequestDelete={()=>requestDelete(idx)}
                                          onRequestResolve={()=>requestResolve(idx)}
                                          onRequestHistory={openHistoryForRow}
                                          isAdmin={role==='admin' || role==='manager'}
                                          variant="tile"
                                          viewOnly={registrarViewOnly}
                                        />
                                      </Box>
                                    );
                                  })}
                                </VStack>
                              </VStack>
                            </Box>
                          ))}
                        </SimpleGrid>
                      );
                    })()
                  )}
                </Box>
              ))}
              {grouped.length === 0 && (
                <VStack py={10}><Text color={subtle}>No prospectus courses for this block/program/year.</Text></VStack>
              )}
            </VStack>
            <Fade in={loading} unmountOnExit>
              <Box position="absolute" inset={0} bg={overlayBg} backdropFilter="blur(1.5px)" zIndex={1}>
                <VStack align="stretch" spacing={2} p={3} ref={blockSkelWrapRef}>
                  {Array.from({ length: blockSkelCount }).map((_, i) => (
                    <HStack key={`sk-${i}`} py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '56px', md: '64px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '80px', md: '96px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '82px', md: '92px' }} height="16px" rounded="sm" />
                      <Box flex="1 1 auto" minW={0}>
                        <HStack spacing={2} align="center">
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="120px" rounded="sm" />
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="28px" rounded="full" />
                        </HStack>
                        <SkeletonText startColor={skStart} endColor={skEnd} noOfLines={1} spacing='2' skeletonHeight='12px' mt={1} width="60%" />
                      </Box>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '120px', md: '160px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '180px', md: '240px' }} height="16px" rounded="sm" />
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </Fade>
            </Box>
          )}
          {viewMode === 'faculty' && selectedFaculty && (
            <Box position="relative">
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between" align="center">
                <HStack>
                  <Heading size="sm">Faculty:</Heading>
                  <Badge colorScheme="purple">{selectedFaculty.name || selectedFaculty.faculty}</Badge>
                </HStack>
                <HStack>
                  <Button leftIcon={<FiPrinter />} size="sm" variant="outline" onClick={onPrintFaculty} isDisabled={loading || (Array.isArray(facultySchedules.items) ? facultySchedules.items.length === 0 : true)}>Print</Button>
                  <Button leftIcon={<FiRefreshCw />} size="sm" variant="outline" onClick={()=>fetchFacultySchedules(selectedFaculty)} isDisabled={loading}>Reload</Button>
                  <Button size="sm" colorScheme="blue" variant="solid" onClick={()=>setSchedAssignOpen(true)}>Assign Schedules</Button>
                </HStack>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                <Box p={3} rounded="md" borderWidth="1px" borderColor={savedBorder} bg={savedBg} boxShadow="xs">
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={savedTone}>Saved load</Text>
                  <HStack justify="space-between" align="baseline" mt={1}>
                    <Heading size="lg" color={savedTone}>{formatUnits(facultyUnitStats.savedUnits)}</Heading>
                    <Badge colorScheme="green" variant="solid">{facultyUnitStats.savedCount} saved</Badge>
                  </HStack>
                  <Text fontSize="xs" color={subtle}>Already assigned schedules for this faculty</Text>
                </Box>
                <Box p={3} rounded="md" borderWidth="1px" borderColor={draftBorder} bg={draftBg} boxShadow="xs">
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={draftTone}>Unsaved drafts</Text>
                  <HStack justify="space-between" align="baseline" mt={1}>
                    <Heading size="lg" color={draftTone}>{formatUnits(facultyUnitStats.draftUnits)}</Heading>
                    <Badge colorScheme="orange" variant="solid">{facultyUnitStats.draftCount} draft</Badge>
                  </HStack>
                  <Text fontSize="xs" color={subtle}>Units from schedules added here but not yet saved</Text>
                </Box>
                <Box p={3} rounded="md" borderWidth="1px" borderColor={totalBorder} bg={totalBg} boxShadow="xs">
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={totalTone}>Projected total</Text>
                  <HStack justify="space-between" align="baseline" mt={1}>
                    <Heading size="lg" color={totalTone}>{formatUnits(facultyUnitStats.totalUnits)}</Heading>
                    <Badge colorScheme="blue" variant="solid">{facultyUnitStats.savedCount + facultyUnitStats.draftCount} item(s)</Badge>
                  </HStack>
                  <Text fontSize="xs" color={subtle}>Total load if all drafts are saved</Text>
                </Box>
              </SimpleGrid>
              <Box borderWidth="1px" borderColor={border} rounded="md" p={2}>
                <HStack spacing={3} mb={2} align="center" flexWrap="wrap">
                  {(() => {
                    const eligible = (facultySchedules.items || []).filter(it => canEditFacultyItem(it));
                    const eligibleCount = eligible.length;
                    const allChecked = eligibleCount > 0 && facSelectedIds.length === eligibleCount;
                    const indeterminate = facSelectedIds.length > 0 && facSelectedIds.length < eligibleCount;
                    return (
                      <HStack>
                        <Checkbox
                          isChecked={allChecked}
                          isIndeterminate={indeterminate}
                          isDisabled={eligibleCount === 0}
                          onChange={(e)=> {
                            const chk = !!e.target.checked;
                            setFacSelected(() => chk ? new Set(eligible.map(it => it.id)) : new Set());
                          }}
                        >
                          Select all
                        </Checkbox>
                        <Badge colorScheme={facSelectedIds.length ? 'blue' : 'gray'}>{facSelectedIds.length} selected</Badge>
                        <Button size="sm" variant="ghost" onClick={()=> setFacSelected(new Set(eligible.map(it => it.id)))} isDisabled={eligibleCount === 0}>
                          Select All
                        </Button>
                        <Button size="sm" variant="ghost" onClick={()=> setFacSelected(new Set())} isDisabled={facSelectedIds.length === 0}>
                          Deselect All
                        </Button>
                      </HStack>
                    );
                  })()}
                  <Button
                    size="sm"
                    colorScheme="blue"
                    leftIcon={<FiUpload />}
                    onClick={saveSelectedFacultyRows}
                    isDisabled={!canLoad || saving || !facCanSaveSelected}
                    isLoading={saving}
                  >
                    Save Selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={()=>requestFacultyBulkLockChange(true)} isDisabled={!canLoad || facSelectedIds.length === 0 || allSelectedLocked}>Lock Selected</Button>
                  <Button size="sm" variant="outline" onClick={()=>requestFacultyBulkLockChange(false)} isDisabled={!isAdmin || facSelectedIds.length === 0 || allSelectedUnlocked}>Unlock Selected</Button>
                </HStack>
                {facultySchedules.items.length === 0 ? (
                  <VStack py={8}><Text color={subtle}>No schedules assigned for the selected school year.</Text></VStack>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {(() => {
                      const groups = new Map();
                      facultySchedules.items.forEach(s => {
                        const key = String(s.term || '').trim() || '—';
                        const arr = groups.get(key) || []; arr.push(s); groups.set(key, arr);
                      });
                      const order = (t) => { const v=String(t).toLowerCase(); if (v.startsWith('1')) return 1; if (v.startsWith('2')) return 2; if (v.startsWith('s')) return 3; return 9; };
                      return Array.from(groups.entries()).sort((a,b)=>order(a[0])-order(b[0])).map(([term, arr]) => (
                        <Box key={term} borderWidth="1px" rounded="md" p={2}>
                          <HStack justify="space-between" mb={1}><Badge colorScheme="blue">{term}</Badge><Text fontSize="xs" color={subtle}>{arr.length} item(s)</Text></HStack>
                          <VStack align="stretch" spacing={2}>
                            {arr.map((c, i) => {
                              const e = facEdits[c.id] || { term: canonicalTerm(c.term || ''), time: String(c.schedule || c.time || '').trim(), day: c.day || 'MON-FRI' };
                            const blkKey = normalizeBlockCode(c.blockCode || c.section || '');
                            const sessionKey = normalizeSessionKey(blockSessionMap.get(blkKey) || c.session || '');
    const timeOpts = timeOptionsForSession(sessionKey, e.time, c, e.day || c.day);
                            const dirty =
                              canonicalTerm(c.term || '') !== e.term ||
                              String(c.schedule || c.time || '').trim() !== e.time ||
                              String(c.day || '').trim() !== String(e.day || '').trim();
                            const termFilled = String(e.term || '').trim().length > 0;
                            const timeFilled = String(e.time || '').trim().length > 0;
                            const isEditable = canEditFacultyItem(c);
                            const canSave = isEditable && dirty && termFilled && timeFilled && !e._checking && !e._conflict;
                            const isLocked = (function(v){ if (typeof v==='boolean') return v; const s=String(v||'').toLowerCase(); return s==='yes'||s==='true'||s==='1'; })(c?._locked ?? c?.lock ?? c?.is_locked ?? c?.locked);
                            const saving = isFacSaving(c.id);
                            return (
                              <Box key={`${term}-${i}`} p={2} borderWidth="1px" rounded="md">
                                <HStack spacing={3} align="center">
                                  <Checkbox isChecked={facSelected.has(c.id)} onChange={(e)=>toggleFacSelect(c.id, e.target.checked)} isDisabled={!isEditable} />
                                    <Badge>{c.code || c.courseName}</Badge>
                                    {String(c.id || '').startsWith('tmp:') && <Badge colorScheme="pink">Draft</Badge>}
                                    <HStack space="2" flex="1" alignItems="center">
                                    {/* Unit Badge */}
                                    <Box
                                      px="2"
                                      py="1"
                                      bg="gray.200"
                                      borderRadius="md"
                                    >
                                      <Text fontSize="xs" fontWeight="bold">
                                        {c.unit.toFixed(1)}
                                      </Text>
                                    </Box>

                                    {/* Title (this part ellipsizes) */}
                                    <Text
                                      noOfLines={1}
                                      flex="1"
                                      fontSize="md"
                                    >
                                      {c.title || c.courseTitle}
                                    </Text>
                                  </HStack>

                                    <Badge colorScheme="orange">{c.blockCode || c.section || '—'}</Badge>
                                  </HStack>
                                  <HStack mt={2} spacing={2} align="center" flexWrap="wrap">
                                  <Select
                                    size="sm"
                                    value={e.term}
                                    onChange={(ev)=>updateFacEdit(c.id, { term: ev.target.value })}
                                    maxW="120px"
                                    isDisabled={!isEditable || isLocked}
                                  >
                                    <option value="">Term</option>
                                    {['1st','2nd','Sem'].map(v => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </Select>

                                  <Select
                                    size="sm"
                                    value={e.day || 'MON-FRI'}
                                    onChange={(ev)=>updateFacEdit(c.id, { day: ev.target.value })}
                                    maxW="140px"
                                    isDisabled={!isEditable || isLocked}
                                  >
                                    {['MON-FRI','Mon','Tue','Wed','Thu','Fri','Sat','Sun','MWF','TTH','TBA'].map(d => (
                                      <option key={d} value={d}>{d}</option>
                                    ))}
                                  </Select>

                                  <Select
                                    size="sm"
                                    value={e.time}
                                    onChange={(ev)=>updateFacEdit(c.id, { time: ev.target.value })}
                                    maxW="160px"
                                    isDisabled={!isEditable || isLocked}
                                  >
                                    {timeOpts.map(t => (
                                      <option key={t} value={t}>{t || 'Time'}</option>
                                    ))}
                                  </Select>

                                    {/* Inline faculty select removed in faculty view for efficiency */}
                                    
                                    <HStack>
                                      {e._checking ? (
                                        <HStack spacing={1}><Spinner size="xs" /><Text fontSize="xs" color={subtle}>Checking...</Text></HStack>
                                      ) : (
                                        <Badge colorScheme={e._conflict ? 'red' : (dirty ? 'yellow' : 'green')}>
                                          {e._conflict ? 'Conflict' : (dirty ? 'Unsaved' : 'OK')}
                                        </Badge>
                                      )}
                                    </HStack>
                                    <HStack ml="auto" spacing={2}>
                                      {e._conflict && (
                                        <>
                                          <Button size="sm" variant="outline" leftIcon={<FiHelpCircle />} onClick={()=>openFacultySuggestions(c.id)} isDisabled={!isEditable || isLocked}>Suggestions</Button>
                                          <Button size="sm" variant="outline" onClick={()=>openFacultyResolve(facultySchedules.items.indexOf(c))} isDisabled={!isEditable || isLocked}>Resolve</Button>
                                        </>
                                      )}
                                      <Button size="sm" variant="outline" onClick={()=>addFacultyItemToSwap(facultySchedules.items.indexOf(c))} isDisabled={!isEditable || isLocked || String(c.id || '').startsWith('tmp:') || !!c._draft}>Add to Swap</Button>
                                      {/* Inline Assign action removed per request */}
                                      <Button size="sm" variant="outline" onClick={()=>updateFacEdit(c.id, { term: canonicalTerm(c.term || ''), time: String(c.schedule || c.time || '').trim(), faculty: c.faculty || c.instructor || '', facultyId: c.facultyId || c.faculty_id || null, _conflict:false, _details:[] })} isDisabled={!isEditable || !dirty || isLocked}>Revert</Button>
                                      <Button size="sm" colorScheme="blue" onClick={()=>saveFacultyEdit(c.id)} isDisabled={!canSave || isLocked || saving} isLoading={saving}>Save</Button>
                                      {isLocked ? (
                                        <Tooltip label={isAdmin ? 'Locked. Click to unlock.' : 'Locked. Only admin can unlock.'}>
                                          <IconButton aria-label="Unlock" icon={<FiLock />} size="sm" colorScheme="red" variant="ghost" onClick={()=>toggleFacultyLock(c.id, false)} isDisabled={!isEditable || !isAdmin} />
                                        </Tooltip>
                                      ) : (
                                        <Tooltip label="Unlocked. Click to lock.">
                                          <IconButton aria-label="Lock" icon={<FiLock />} size="sm" variant="ghost" onClick={()=>toggleFacultyLock(c.id, true)} isDisabled={!isEditable} />
                                        </Tooltip>
                                      )}
                                      <Tooltip label={isLocked ? 'Locked. Unlock to delete.' : 'Delete assignment'}>
                                        <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={()=>requestFacultyDelete(facultySchedules.items.indexOf(c))} isDisabled={!isEditable || isLocked} />
                                      </Tooltip>
                                    </HStack>
                                  </HStack>
                                  {e._conflict && Array.isArray(e._details) && e._details.length > 0 && (
                                    <VStack align="stretch" spacing={1} mt={2}>
                                      {e._details.slice(0,3).map((d, j) => (
                                        <Text key={j} fontSize="xs" color="red.600">{d.reason}: {d.item?.code || ''} / {d.item?.section || ''} {d.item?.time || ''}</Text>
                                      ))}
                                    </VStack>
                                  )}
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      ));
                    })()}
                  </VStack>
                )}
              </Box>
            </VStack>
            <Fade in={facultySchedules.loading} unmountOnExit>
              <Box position="absolute" inset={0} bg={overlayBg} backdropFilter="blur(1.5px)" zIndex={1}>
                <VStack align="stretch" spacing={2} p={3} ref={facSkelWrapRef}>
                  {Array.from({ length: facSkelCount }).map((_, i) => (
                    <HStack key={`fac-skel-${i}`} py={2} px={2} spacing={3} align="center" borderWidth="1px" borderColor={dividerBorder} rounded="md" bg={panelBg}>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '56px', md: '64px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '80px', md: '96px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '82px', md: '92px' }} height="16px" rounded="sm" />
                      <Box flex="1 1 auto" minW={0}>
                        <HStack spacing={2} align="center">
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="120px" rounded="sm" />
                          <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} height="16px" width="28px" rounded="full" />
                        </HStack>
                        <SkeletonText startColor={skStart} endColor={skEnd} noOfLines={1} spacing='2' skeletonHeight='12px' mt={1} width="60%" />
                      </Box>
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '120px', md: '160px' }} height="16px" rounded="sm" />
                      <Skeleton startColor={skStart} endColor={skEnd} speed={1.2} width={{ base: '140px', md: '180px' }} height="16px" rounded="sm" />
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </Fade>
            </Box>
          )}
        </Box>
      </SimpleGrid>

      {!registrarViewOnly && (
        <CourseLoadingSupport
          viewMode={viewMode}
          role={role}
          selectedBlock={selectedBlock}
          selectedFaculty={selectedFaculty}
          rows={rows}
          facultySchedules={facultySchedules}
          blocksAll={blocksAll}
          facultyAll={facultyAll}
          prospectus={prospectus}
          existing={existing}
          settingsLoad={settingsLoad}
          facultyUnitStats={facultyUnitStats}
          accessToken={accessToken}
        />
      )}

      {/* Assign Faculty Modal for Blocks view */}
      <ScheduleHistoryModal scheduleId={histScheduleId} isOpen={histOpen} onClose={()=>{ setHistOpen(false); setHistScheduleId(null); }} />
      <AssignFacultyModal
        isOpen={assignOpen}
        onClose={()=>{ setAssignOpen(false); setAssignIndex(null); }}
        schedule={scheduleForAssign}
        onAssign={handleAssignFromModal}
        schoolyear={settingsLoad?.school_year}
        semester={settingsLoad?.semester}
        attendanceStats={attendanceStatsMap}
      />
      <AssignFacultyModal
        isOpen={facAssignOpen}
        onClose={()=>{ setFacAssignOpen(false); setFacAssignIndex(null); }}
        schedule={scheduleForFacAssign}
        onAssign={handleFacAssign}
        schoolyear={settingsLoad?.school_year}
        semester={settingsLoad?.semester}
        attendanceStats={attendanceStatsMap}
      />

      {/* Resolve conflict dialog */}
      <AlertDialog isOpen={resolveOpen} onClose={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveRowIndex(null); setResolveConflictId(null); setResolveLabel(''); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Resolve conflict?</AlertDialogHeader>
            <AlertDialogBody>
              This will delete the existing conflicting schedule (<b>{resolveLabel || 'schedule'}</b>) and save your new assignment for this course. This action cannot be undone. Proceed?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!resolveBusy) { setResolveOpen(false); setResolveRowIndex(null); setResolveConflictId(null); setResolveLabel(''); } }}>Cancel</Button>
              <Button colorScheme="purple" ml={3} isLoading={resolveBusy} onClick={confirmResolve}>Resolve</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty-view resolve dialog */}
      <AlertDialog isOpen={facResolveOpen} onClose={()=>{ if (!facResolveBusy) { setFacResolveOpen(false); setFacResolveIndex(null); setFacResolveConflictId(null); setFacResolveLabel(''); } }} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Resolve conflict?</AlertDialogHeader>
            <AlertDialogBody>
              Replace conflicting schedule <b>{facResolveLabel || '-'}</b> with your edited assignment?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!facResolveBusy) { setFacResolveOpen(false); setFacResolveIndex(null); setFacResolveConflictId(null); setFacResolveLabel(''); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="blue" onClick={confirmFacultyResolve} ml={3} isLoading={facResolveBusy}>Resolve</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty suggestions modal */}
      <Modal isOpen={facSuggOpen} onClose={()=>{ if (!facSuggBusy) { setFacSuggOpen(false); setFacSuggTargetId(null); } }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Suggestions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {facSuggBusy ? (
              <HStack spacing={2}><Spinner size="sm" /><Text>Analyzing suggestions...</Text></HStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                {Array.isArray(facSuggPlans) && facSuggPlans.length > 0 ? (
                  facSuggPlans.map((s, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text fontWeight="600">{s.label}</Text>
                          {s?.candidateChange && (
                            <Button size="xs" colorScheme="blue" onClick={() => applyFacultySuggestion(s)}>Apply</Button>
                          )}
                        </HStack>
                        {Array.isArray(s.steps) && s.steps.length > 0 && (
                          <VStack align="stretch" spacing={1}>
                            {s.steps.map((st, j) => (
                              <HStack key={j} spacing={3} fontSize="sm" color={subtle}>
                                <Badge colorScheme="gray">{st.node ?? (j+1)}</Badge>
                                <Text><b>{st.course}</b> {st.section ? `/ ${st.section}` : ''}</Text>
                                <Text>from <b>{st.from}</b> to <b>{st.to}</b></Text>
                              </HStack>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="sm" color={subtle}>No suggestions found that avoid conflicts in the same session. Try a different term or adjust surrounding schedules.</Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Lock/Unlock */}
      <AlertDialog isOpen={lockDialogOpen} onClose={()=>{ if (!lockDialogBusy) { setLockDialogOpen(false); setLockDialogIndex(null); setLockDialogBulkIdxs([]); setLockDialogTarget(null); } }} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{lockDialogTarget ? 'Lock schedule(s)?' : 'Unlock schedule(s)?'}</AlertDialogHeader>
            <AlertDialogBody>
              {lockDialogTarget ? 'Locked schedules cannot be edited until unlocked. Proceed to lock the selected item(s)?' : 'Unlocking will allow editing term/time/faculty. Proceed to unlock the selected item(s)?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={()=>{ if (!lockDialogBusy) { setLockDialogOpen(false); setLockDialogIndex(null); setLockDialogBulkIdxs([]); setLockDialogTarget(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="blue" onClick={confirmLockChange} ml={3} isLoading={lockDialogBusy}>{lockDialogTarget ? 'Lock' : 'Unlock'}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Delete assignment */}
      <AlertDialog isOpen={delDialogOpen} onClose={()=>{ if (!delDialogBusy) { setDelDialogOpen(false); setDelDialogIndex(null); } }} leastDestructiveRef={delCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete assignment?</AlertDialogHeader>
            <AlertDialogBody>
              {(() => {
                const r = delDialogIndex != null ? rows[delDialogIndex] : null;
                const label = r ? (r.course_name || r.courseName || r.code || 'this item') : 'this item';
                return (
                  <Text>
                    This action cannot be undone. Are you sure you want to delete <b>{label}</b> from the assigned schedules?
                  </Text>
                );
              })()}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={delCancelRef} onClick={()=>{ if (!delDialogBusy) { setDelDialogOpen(false); setDelDialogIndex(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3} isLoading={delDialogBusy}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty delete confirmation */}
      <AlertDialog isOpen={facDelOpen} onClose={()=>{ if (!facDelBusy) { setFacDelOpen(false); setFacDelIndex(null); } }} leastDestructiveRef={facDelCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete assignment?</AlertDialogHeader>
            <AlertDialogBody>
              {(() => {
                const r = facDelIndex != null ? facultySchedules.items[facDelIndex] : null;
                const label = r ? (r.code || r.courseName || 'this item') : 'this item';
                return (
                  <Text>
                    This action cannot be undone. Are you sure you want to delete <b>{label}</b> from the assigned schedules?
                  </Text>
                );
              })()}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={facDelCancelRef} onClick={()=>{ if (!facDelBusy) { setFacDelOpen(false); setFacDelIndex(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmFacultyDelete} ml={3} isLoading={facDelBusy}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Faculty bulk lock/unlock */}
      <AlertDialog isOpen={facLockOpen} onClose={()=>{ if (!facLockBusy) { setFacLockOpen(false); setFacLockTarget(null); } }} leastDestructiveRef={facLockCancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{facLockTarget ? 'Lock selected schedule(s)?' : 'Unlock selected schedule(s)?'}</AlertDialogHeader>
            <AlertDialogBody>
              {facLockTarget ? 'Locked schedules cannot be edited until unlocked. Proceed to lock the selected item(s)?' : 'Unlocking will allow editing term/time/faculty. Proceed to unlock the selected item(s)?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={facLockCancelRef} onClick={()=>{ if (!facLockBusy) { setFacLockOpen(false); setFacLockTarget(null); } }} variant="ghost">Cancel</Button>
              <Button colorScheme="blue" onClick={confirmFacultyBulkLockChange} ml={3} isLoading={facLockBusy}>{facLockTarget ? 'Lock' : 'Unlock'}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Conflict details modal */}
      <Modal isOpen={conflictOpen} onClose={()=>{ setConflictOpen(false); setConflictIndex(null); }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Why this conflicts</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {(() => {
              const r = (conflictIndex != null) ? rows[conflictIndex] : null;
              const details = r?._conflictDetails || [];
              if (!r) return <Text>No data.</Text>;
              if (!details.length) return <Text>This schedule conflicts with another entry for the same faculty at the same term and time.</Text>;
              return (
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color={subtle}>
                    The selected assignment sets faculty <b>{r._faculty}</b> to <b>{r._term}</b> term at <b>{r._time}</b> for block <b>{selectedBlock?.blockCode || '-'}</b>.
                    Another schedule exists for the same faculty at the same term and time, which causes a double-booking conflict.
                  </Text>
                  {details.map((d, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <Text fontWeight="600" mb={1}>{d.reason}</Text>
                      <Text fontSize="sm">
                        {d.item.code} — {d.item.title}
                      </Text>
                      <HStack spacing={4} fontSize="sm" color={subtle}>
                        <Text>Section: <b>{d.item.section || 'N/A'}</b></Text>
                        <Text>Term: <b>{d.item.term || 'N/A'}</b></Text>
                        <Text>Time: <b>{d.item.time || 'N/A'}</b></Text>
                        <Text>Room: <b>{d.item.room || 'N/A'}</b></Text>
                      </HStack>
                    </Box>
                  ))}
                  <Text fontSize="sm" color={subtle}>
                    To proceed, adjust the time or term so it does not overlap with existing schedules, or assign a different faculty.
                  </Text>
                </VStack>
              );
            })()}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Suggestions modal */}
      <Modal isOpen={suggOpen} onClose={()=>{ setSuggOpen(false); setSuggIndex(null); }} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Suggestions</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {suggBusy ? (
              <HStack spacing={2}><Spinner size="sm" /><Text>Analyzing suggestions...</Text></HStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                {Array.isArray(suggestions) && suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <Box key={i} p={3} borderWidth="1px" borderRadius="md">
                      <VStack align="stretch" spacing={2}>
                        <HStack justify="space-between">
                          <Text fontWeight="600">{s.label}</Text>
                          {s?.candidateChange && (
                            <Button size="xs" colorScheme="blue" onClick={() => applySuggestion(s)}>Apply</Button>
                          )}
                        </HStack>
                        {Array.isArray(s.steps) && s.steps.length > 0 && (
                          <VStack align="stretch" spacing={1}>
                            {s.steps.map((st, j) => (
                              <HStack key={j} spacing={3} fontSize="sm" color={subtle}>
                                <Badge colorScheme="gray">{st.node ?? (j+1)}</Badge>
                                <Text><b>{st.course}</b> {st.section ? `/ ${st.section}` : ''}</Text>
                                <Text>from <b>{st.from}</b> to <b>{st.to}</b></Text>
                              </HStack>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </Box>
                  ))
                ) : (
                  <Text fontSize="sm" color={subtle}>No suggestions found that avoid conflicts in the same session. Try a different term or adjust surrounding schedules.</Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
      <AssignSchedulesModal
        isOpen={schedAssignOpen}
        onClose={()=>setSchedAssignOpen(false)}
        currentFacultyName={selectedFaculty ? (selectedFaculty.name || selectedFaculty.faculty) : ''}
        onCreate={handleCreateFromAssignModal}
      />
    </VStack>
  );
}






