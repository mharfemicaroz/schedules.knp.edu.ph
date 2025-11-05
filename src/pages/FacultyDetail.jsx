import React, { useState } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Heading, HStack, Avatar, Text, Badge, VStack, Divider, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Switch, FormControl, FormLabel, IconButton, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft, FiShare2 } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useSelector, useDispatch } from 'react-redux';
import { selectFilteredFaculties, selectAllCourses } from '../store/dataSlice';
import LoadingState from '../components/LoadingState';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { FiEdit, FiTrash } from 'react-icons/fi';
import FacultySelect from '../components/FacultySelect';
import AssignSchedulesModal from '../components/AssignSchedulesModal';
import AssignFacultyModal from '../components/AssignFacultyModal';
// conflict checking removed per request
import { buildConflicts, buildCrossFacultyOverlaps, parseTimeBlockToMinutes } from '../utils/conflicts';
import Pagination from '../components/Pagination';
import { Tag, TagLabel, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Wrap, WrapItem } from '@chakra-ui/react';
import { encodeShareFacultyName, decodeShareFacultyName } from '../utils/share';
import { usePublicView } from '../utils/uiFlags';


export default function FacultyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const faculties = useSelector(selectFilteredFaculties);
  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector(s => s.data.loading);
  const acadData = useSelector(s => s.data.acadData);
  const [viewMode, setViewMode] = useLocalStorage('facultyDetailViewMode', getInitialToggleState(acadData, 'facultyDetailViewMode', 'regular'));
  // Hoist hooks before any early return to keep hook order stable across renders
  const _border = useColorModeValue('gray.200','gray.700');
  const _panelBg = useColorModeValue('white','gray.800');
  const dangerRowBg = useColorModeValue('red.50','rgba(255,0,0,0.12)');
  const _authUser = useSelector(s => s.auth.user);
  const _editDisc = useDisclosure();
  const _delDisc = useDisclosure();
  const _assignDisc = useDisclosure(); // AssignSchedulesModal
  const _assignFacDisc = useDisclosure(); // AssignFacultyModal
  const _confDisc = useDisclosure();
  const [_selected, _setSelected] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const _cancelRef = React.useRef();

  const [, set] = useState('');
  const isPublic = usePublicView();
  let f = null;
  if (isPublic) {
    const decodedName = decodeShareFacultyName(String(id || ''));
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const target = norm(decodedName);
    f = faculties.find(x => norm(x.name) === target || norm(x.faculty) === target) || null;
  } else {
    f = faculties.find(x => String(x.id) === String(id));
  }
  const border = _border;
  const panelBg = _panelBg;
  const authUser = _authUser;
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const editDisc = _editDisc;
  const delDisc = _delDisc;
  const assignDisc = _assignDisc;
  const assignFacDisc = _assignFacDisc;
  const confDisc = _confDisc;
  const [selected, setSelected] = [_selected, _setSelected];
  const cancelRef = _cancelRef;

    // Merge helper: combine same section + code + term + time; merge rooms and F2F days
  const sortedCourses = React.useMemo(() => {
    const list = (f && Array.isArray(f.courses) ? f.courses.slice() : []);
    const startOf = (c) => {
      if (Number.isFinite(c?.timeStartMinutes)) return c.timeStartMinutes;
      const tStr = String(c?.scheduleKey || c?.schedule || c?.time || '').trim();
      // Try AM/PM/NN parser first
      const tr = parseTimeBlockToMinutes(tStr);
      if (Number.isFinite(tr.start)) return tr.start;
      // Try HH:MM-HH:MM (24h) e.g., 11:00-12:00 or 16:00-17:00
      const m = tStr.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (m) {
        const sh = parseInt(m[1], 10), sm = parseInt(m[2], 10);
        if (!Number.isNaN(sh) && !Number.isNaN(sm)) return sh * 60 + sm;
      }
      return Infinity;
    };
    const keyOfTime = (c) => {
      const s = startOf(c);
      return Number.isFinite(s) ? s : Infinity;
    };
    if (viewMode === 'examination') {
      // Examination view: no merging, keep original
      return list.sort((a, b) => {
        const oa = Number.isFinite(a.termOrder) ? a.termOrder : 99;
        const ob = Number.isFinite(b.termOrder) ? b.termOrder : 99;
        if (oa !== ob) return oa - ob;
        const ta = keyOfTime(a);
        const tb = keyOfTime(b);
        if (ta !== tb) return ta - tb;
        return String(a.scheduleKey || '').localeCompare(String(b.scheduleKey || ''));
      });
    }
    const toDayCodes = (src) => {
      const s = String(src || '').trim().toUpperCase();
      if (!s) return [];
      const map = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' };
      const parts = s.split(/[\/,;&\s]+/).filter(Boolean);
      const out = new Set();
      for (const p0 of parts) {
        const p = p0.toUpperCase();
        if (p.includes('-')) {
          const [a,b] = p.split('-').map(t=>t.trim());
          const order=["MON","TUE","WED","THU","FRI","SAT","SUN"]; const ai=order.indexOf(a), bi=order.indexOf(b);
          if (ai!==-1 && bi!==-1) { for(let i=ai;i<=bi;i++){ out.add(map[order[i]]); } }
        } else if (map[p]) out.add(map[p]);
      }
      const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      return order.filter(d => out.has(d));
    };
    const keyOf = (c) => [
      String(c.code || c.courseName || '').toUpperCase().trim(),
      String(c.section || '').toUpperCase().trim(),
      String(c.term || '').toUpperCase().trim(),
      String(c.schedule || c.time || '').toUpperCase().trim(),
    ].join('|');
    const map = new Map();
    for (const c of list) {
      const k = keyOf(c);
      const prev = map.get(k);
      const f2fFromC = Array.isArray(c.f2fDays) && c.f2fDays.length
        ? c.f2fDays
        : toDayCodes(c.f2fSched || c.f2fsched || c.day);
      const dayCodes = toDayCodes(c.day);
      const rooms = new Set();
      if (c.room) rooms.add(String(c.room).trim());
      if (prev) {
        // merge into prev
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
    }
    const merged = Array.from(map.values()).map(x => {
      const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const daysJoined = (x._days && x._days.length) ? order.filter(d => new Set(x._days).has(d)).join(',') : (x.day || '');
      const f2fJoined = (x.f2fDays && x.f2fDays.length) ? order.filter(d => new Set(x.f2fDays).has(d)).join(',') : (x.f2fSched || '');
      return {
        ...x,
        day: daysJoined,
        f2fSched: f2fJoined,
        f2fsched: f2fJoined,
        room: (x._rooms || []).filter(Boolean).join(', '),
      };
    });
    return merged.sort((a, b) => {
      const oa = Number.isFinite(a.termOrder) ? a.termOrder : 99;
      const ob = Number.isFinite(b.termOrder) ? b.termOrder : 99;
      if (oa !== ob) return oa - ob;
      const ta = keyOfTime(a);
      const tb = keyOfTime(b);
      if (ta !== tb) return ta - tb;
      return String(a.scheduleKey || '').localeCompare(String(b.scheduleKey || ''));
    });
  }, [f, viewMode]);

  const mergedStats = React.useMemo(() => {
    const release = Number(f?.loadReleaseUnits) || 0;
    const baseline = Math.max(0, 24 - release);
    const list = viewMode === 'examination' ? (f?.courses || []) : (sortedCourses || []);
    const loadUnits = list.reduce((sum, c) => sum + (Number(c.unit) || 0), 0);
    const overloadUnits = Math.max(0, loadUnits - baseline);
    const courseCount = list.length;
    return { loadUnits, overloadUnits, courseCount, release };
  }, [f, sortedCourses, viewMode]);

  // Group courses by term for display (1st, 2nd, Sem, then others)
  const termGroups = React.useMemo(() => {
    const order = ['1st', '2nd', 'Sem'];
    const buckets = new Map();
    (sortedCourses || []).forEach(c => {
      const t = String(c.term || '').trim() || 'N/A';
      const arr = buckets.get(t) || [];
      arr.push(c);
      buckets.set(t, arr);
    });
    const used = new Set();
    const groups = [];
    order.forEach(t => { if (buckets.has(t)) { groups.push({ term: t, items: buckets.get(t) }); used.add(t); } });
    buckets.forEach((items, t) => { if (!used.has(t)) groups.push({ term: t, items }); });
    return groups;
  }, [sortedCourses]);

  // Conflicts relevant to this faculty (same-faculty reasons + cross-faculty overlaps in same section)
  const facultyConflictGroups = React.useMemo(() => {
    if (!f) return [];
    const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const facObj = { id: f.id, name: f.name };
    const isThisFaculty = (r) => {
      const rObj = { id: r.facultyId || r.faculty_id, name: r.facultyName || r.faculty };
      const aId = facObj.id != null ? String(facObj.id) : '';
      const bId = rObj.id != null ? String(rObj.id) : '';
      if (aId && bId && aId === bId) return true;
      const aName = normalizeName(facObj.name);
      const bName = normalizeName(rObj.name);
      return !!aName && aName === bName;
    };

    // Build a filtered set of rows where we exclude merged duplicates for THIS faculty only
    const termOf = (r) => String(r.term || '').trim().toLowerCase();
    const timeStrOf = (r) => String(r.scheduleKey || r.schedule || r.time || '').trim();
    const timeKeyOf = (r) => {
      const s = timeStrOf(r);
      const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
      const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
      return (Number.isFinite(start) && Number.isFinite(end)) ? `${start}-${end}` : s.toLowerCase();
    };
    const sectionOf = (r) => normalizeName(r.section || '');
    const facIdOf = (r) => (r.facultyId != null ? String(r.facultyId) : (r.faculty_id != null ? String(r.faculty_id) : ''));
    const facNameNorm = normalizeName(f.name);
    const seen = new Set();
    const codeOf = (r) => String(r.code || r.courseName || '').trim().toLowerCase();
    const filteredAll = allCourses.filter(r => {
      if (!isThisFaculty(r)) return true;
      // Include course code in dedupe key so different codes don't merge away
      const k = ['merged', facIdOf(r) || facNameNorm, termOf(r), timeKeyOf(r), sectionOf(r), codeOf(r)].join('|');
      if (seen.has(k)) return false; // drop merged duplicate
      seen.add(k);
      return true;
    });

    // Sanitize/normalize times for consistent comparisons
    const toKey = (start, end) => `${start}-${end}`;
    const sanitized = filteredAll.map(r => {
      const tStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const hasNums = Number.isFinite(r.timeStartMinutes) && Number.isFinite(r.timeEndMinutes);
      if (hasNums) {
        return { ...r, scheduleKey: toKey(r.timeStartMinutes, r.timeEndMinutes) };
      }
      const tr = parseTimeBlockToMinutes(tStr);
      const valid = Number.isFinite(tr.start) && Number.isFinite(tr.end);
      return valid ? { ...r, scheduleKey: toKey(tr.start, tr.end) } : { ...r, scheduleKey: '', schedule: '', time: '' };
    });

    const base = buildConflicts(sanitized).filter(g => g.items.some(isThisFaculty));
    const cross = buildCrossFacultyOverlaps(sanitized).filter(g => g.items.some(isThisFaculty));

    // Additional rule: Same faculty, same term, same time (ignore F2F day) — but NOT when same section (merged)
    const sameTimeIgnoreF2F = [];
    const map = new Map();
    const key = (...parts) => parts.map(v => String(v ?? '').toLowerCase().trim()).join('|');
    sanitized.forEach(r => {
      if (!isThisFaculty(r)) return;
      const t = termOf(r);
      const tk = timeKeyOf(r);
      if (!t || !tk) return;
      const k = key('same-time-any-f2f', facIdOf(r) || facNameNorm, t, tk);
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    });
    map.forEach((arr, k) => {
      if (arr.length > 1) {
        const secs = new Set(arr.map(x => sectionOf(x)).filter(Boolean));
        if (secs.size > 1) {
          sameTimeIgnoreF2F.push({ reason: 'Double-booked: same term and time (ignoring F2F day)', key: 'R:'+k, items: arr });
        }
      }
    });

    const allGroups = [...base, ...cross, ...sameTimeIgnoreF2F];
    // Deduplicate redundant pairings: if A-B for same reason exists, drop B-A
    const seenPairs = new Set();
    const seenGroups = new Set();
    const uniq = [];
    for (const g of allGroups) {
      const ids = (g.items || []).map(it => String(it.id)).filter(Boolean);
      if (ids.length === 2) {
        const [a, b] = ids;
        const k = ['pair', String(g.reason || ''), a < b ? a : b, a < b ? b : a].join('|');
        if (seenPairs.has(k)) continue;
        seenPairs.add(k);
        uniq.push(g);
      } else {
        const key = ['group', String(g.reason || ''), ...ids.sort()].join('|');
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
        uniq.push(g);
      }
    }

    return uniq;
  }, [allCourses, f]);

  const [confPage, setConfPage] = useState(1);
  const [confPageSize, setConfPageSize] = useState(10);
  const confPageCount = Math.max(1, Math.ceil(facultyConflictGroups.length / confPageSize));
  const pagedConflicts = facultyConflictGroups.slice((confPage-1)*confPageSize, (confPage-1)*confPageSize + confPageSize);
  const conflictIdSet = React.useMemo(() => {
    const set = new Set();
    if (!f) return set;
    const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const aName = normalizeName(f.name);
    const aId = f.id != null ? String(f.id) : '';
    const isThisFaculty = (r) => {
      const rId = r && (r.facultyId || r.faculty_id);
      const rName = r && (r.facultyName || r.faculty);
      if (aId && rId != null && String(rId) === aId) return true;
      return !!aName && aName === normalizeName(rName);
    };
    facultyConflictGroups.forEach(g => {
      g.items.forEach(it => { if (isThisFaculty(it) && it?.id != null) set.add(String(it.id)); });
    });
    return set;
  }, [facultyConflictGroups, f]);

  

  // Helper functions for mode switching
  const getTableHeaders = () => {
    if (viewMode === 'examination') {
      return ['Code', 'Title', 'Section', 'Units', 'Time', 'Exam Day', 'Exam Session', 'Exam Room'];
    }
    return ['Code', 'Title', 'Section', 'Units', 'Day', 'Time', 'Room', 'Session', 'F2F'];
  };

  const getCourseData = (course) => {
    if (viewMode === 'examination') {
      return [
        course.code || '–',
        course.title || '–',
        course.section || '–',
        String(course.unit ?? course.hours ?? '–'),
        course.schedule || '–',
        course.examDay || '–',
        course.examSession || '–',
        course.examRoom || '–'
      ];
    }
    return [
      course.code || '–',
      course.title || '–',
      course.section || '–',
      String(course.unit ?? course.hours ?? '–'),
      course.day || '–',
      course.schedule || '–',
      course.room || '–',
      course.session || '–',
      course.f2fSched || '–'
    ];
  };

  function onPrint() {
    const esc = (val) => String(val ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>')
      .replace(/\"/g,'"').replace(/'/g,'&#039;');

    const metaHtml = `
      <table class="prt-table"><tbody>
        <tr><th>Department</th><td>${esc(f.department || '')}</td><th>Employment</th><td>${esc(f.employment || '')}</td></tr>
        <tr><th>Designation</th><td colspan="3">${esc(f.designation || f.rank || '')}</td></tr>
        <tr><th>Load Release Units</th><td>${esc(String(f.loadReleaseUnits ?? 0))}</td><th>Total Load Units</th><td>${esc(String(mergedStats.loadUnits))}</td></tr>
        <tr><th>Overload Units</th><td>${esc(String(mergedStats.overloadUnits))}</td><th>Courses</th><td>${esc(String(mergedStats.courseCount))}</td></tr>
        <tr><th>Schedule Type</th><td colspan="3">${esc(viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule')}</td></tr>
      </tbody></table>`;

    const preferredOrder = ['1st', '2nd', 'Sem'];
    const orderedGroups = (() => {
      const map = new Map((termGroups || []).map(g => [String(g.term || 'N/A'), g]));
      const out = [];
      preferredOrder.forEach(t => { if (map.has(t)) out.push(map.get(t)); map.delete(t); });
      map.forEach(g => out.push(g));
      return out;
    })();

    const buildRows = (c) => {
      if (viewMode === 'examination') {
        return [
          c.term || '—',
          c.code || '—',
          c.title || '—',
          c.section || '—',
          String(c.unit ?? c.hours ?? '—'),
          c.schedule || '—',
          c.examDay || '—',
          c.examSession || '—',
          c.examRoom || '—',
        ];
      }
      return [
        c.term || '—',
        c.code || '—',
        c.title || '—',
        c.section || '—',
        String(c.unit ?? c.hours ?? '—'),
        c.day || '—',
        c.schedule || '—',
        c.room || '—',
        c.session || '—',
        c.f2fSched || '—',
      ];
    };

    const headers = (viewMode === 'examination')
      ? ['Term','Code','Title','Section','Units','Time','Exam Day','Exam Session','Exam Room']
      : ['Term','Code','Title','Section','Units','Day','Time','Room','Session','F2F Sched'];

    const dropLabels = (viewMode === 'examination') ? new Set(['Term','Exam Session']) : new Set(['Term','Session']);
    const useHeaders = headers.filter(h => !dropLabels.has(h));
    const dropIdx = headers.map((h, i) => dropLabels.has(h) ? i : -1).filter(i => i >= 0);

    // Build dynamic start-of-classes notice from academic calendar data
    function parseDate(val) {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    function expandDateRangeToken(token) {
      const m = String(token || '').match(/^(\w+)\s+(\d+)-(\d+),\s*(\d{4})$/);
      if (!m) return [];
      const month = m[1];
      const startD = parseInt(m[2], 10);
      const endD = parseInt(m[3], 10);
      const year = parseInt(m[4], 10);
      const out = [];
      for (let d = startD; d <= endD; d++) {
        const dt = new Date(`${month} ${d}, ${year}`);
        if (!isNaN(dt.getTime())) out.push(dt);
      }
      return out;
    }
    const cal = (acadData && Array.isArray(acadData) ? (acadData[0]?.academic_calendar || {}) : (acadData?.academic_calendar || {})) || {};
    const syStr = String(cal.school_year || '').trim();
    const first = cal.first_semester || {};
    const firstTerm = first.first_term || {};
    const startActivity = Array.isArray(firstTerm.activities) ? firstTerm.activities.find(a => /start\s+of\s+classes/i.test(String(a?.event || ''))) : null;
    let startDate = null;
    if (startActivity) {
      if (startActivity.date_range) {
        const arr = expandDateRangeToken(startActivity.date_range);
        if (arr.length) startDate = arr[0];
      } else if (Array.isArray(startActivity.date)) {
        const arr = startActivity.date.map(parseDate).filter(Boolean).sort((a,b)=>a-b);
        if (arr.length) startDate = arr[0];
      } else if (startActivity.date) {
        startDate = parseDate(startActivity.date);
      }
    }
    const startDateText = startDate ? startDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'per academic calendar';
    const noticeHtml = `
      <div class="prt-notice">
        <div class="prt-notice-title">Notice of Teaching Load</div>
        <p>Classes for 1st sem, SY ${syStr || 'TBD'} begin on ${startDateText}${startDate ? '' : ''}.</p>
        <p>Admit only officially enrolled students; verify COR and class codes.</p>
        <p>This load is tentative; we’ll notify you of any changes.</p>
      </div>`;

    const sectionsHtml = orderedGroups.map(g => {
      const rawRows = (g.items || []).map(buildRows);
      const rows = rawRows.map(r => r.filter((_, i) => dropIdx.indexOf(i) === -1));
      if (rows.length === 0) return '';
      const table = buildTable(useHeaders, rows);
      return `<p class=\"prt-sub\" style=\"margin-top:18px;font-weight:800\">Term: ${esc(g.term || 'N/A')}</p>${table}`;
    }).join('');

    // Build QR (share link) and two-column intro (name + details | QR)
    try {
      const token = encodeShareFacultyName(f?.name || '');
      const origin = (window && window.location) ? `${window.location.origin}${window.location.pathname}` : '';
      const shareUrl = `${origin}#/share/faculty/${encodeURIComponent(token)}`;
      const qrData = encodeURIComponent(shareUrl);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;
      const intro = `
        <div class='prt-two'>
          <div class='prt-col-left'>
            <p class='prt-fac-name'>${esc(f?.name || 'Faculty')}</p>
            ${f?.department ? `<p class='prt-fac-sub'>${esc(f.department)}</p>` : ''}
            ${metaHtml}
          </div>
          <div class='prt-col-right'>
            <div class='prt-qr-card'>
              <img class='prt-qr-img' src='${qrUrl}' alt='QR: ${esc(shareUrl)}' />
              <div class='prt-qr-cap'>Scan me to verify or see updates</div>
            </div>
          </div>
        </div>`;
      printContent({ title: `Faculty: ${f.name}`, subtitle: '', bodyHtml: intro + noticeHtml + sectionsHtml }, { compact: true });
    } catch {
      // Fallback without QR
      printContent({ title: `Faculty: ${f.name}`, subtitle: f.department || '', bodyHtml: metaHtml + noticeHtml + sectionsHtml }, { compact: true });
    }
  }
  async function handleSaveEdit(payload) {
    if (!selected) return;
    try {
      // Save-time conflict check (regular mode only)
      if (viewMode !== 'examination') {
        // Build the would-be-updated row (local, no network)
        const up = { ...selected };
        if (payload?.time) { up.time = payload.time; up.schedule = payload.time; up.scheduleKey = payload.time; }
        if (payload?.term) { up.term = payload.term; up.semester = payload.term; }
        if (payload?.room) up.room = payload.room;
        if (payload?.f2fSched || payload?.f2fsched) {
          const f2f = String(payload.f2fSched || payload.f2fsched || '').trim();
          up.f2fSched = f2f; up.f2fsched = f2f;
        }
        if (payload?.facultyId) up.facultyId = payload.facultyId;
        if (payload?.faculty) { up.faculty = payload.faculty; up.facultyName = payload.faculty; }
        if (payload?.session) up.session = payload.session;

        const facKey = String(up.facultyId || up.facultyName || up.faculty || '').trim();
        const term = String(up.semester || up.term || '').trim();
        const time = String(up.scheduleKey || up.schedule || up.time || '').trim();
        const days = [];

        if (facKey && term && time && days.length) {
          const daySet = new Set(days);
          // conflict checking disabled per request
        }
      }
      await dispatch(updateScheduleThunk({ id: selected.id, changes: payload }));
      editDisc.onClose();
      setSelected(null);
      set('');
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }
  async function confirmDelete() {
    if (!selected) return;
    try {
      await dispatch(deleteScheduleThunk(selected.id));
      delDisc.onClose();
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }

  return (
    <>
    {loading ? (
      <LoadingState label="Loading faculty…" />
    ) : !f ? (
      <VStack align="center" spacing={6} py={10}>
        <Heading size="md">Faculty not found</Heading>
        <Button as={RouterLink} to="/" colorScheme="brand" variant="solid" leftIcon={<FiArrowLeft />}>Back to Dashboard</Button>
      </VStack>
    ) : (
    <VStack align="stretch" spacing={6}>
      <HStack spacing={4} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack spacing={4}>
          <Avatar size="lg" name={f.name} />
          <Box>
            {(!isPublic && editingName) ? (
              <HStack>
                <Box minW={{ base: '260px', md: '420px', lg: '640px' }} w={{ base: 'full', md: 'auto' }}>
                  <FacultySelect
                    value={f.name}
                    onChange={(v) => { if (v) { navigate(`/faculty/${encodeURIComponent(v)}`); } setEditingName(false); }}
                    onChangeId={() => {}}
                    autoFocus
                  />
                </Box>
                <Button size="xs" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </HStack>
            ) : (
              <HStack>
                <Heading size="md">{f.name}</Heading>
                {!isPublic && (
                  <IconButton aria-label="Change faculty" icon={<FiEdit />} size="sm" variant="ghost" onClick={() => setEditingName(true)} />
                )}
              </HStack>
            )}
            <VStack align="start" spacing={1} mt={2}>
              <HStack spacing={2}>
                <Badge colorScheme="blue">{f.department || '—'}</Badge>
                {Boolean(f.employment) && <Badge colorScheme="green">{f.employment}</Badge>}
              </HStack>
              {(f.designation || f.rank) && (
                <Text fontSize="sm" color="gray.600">{f.designation || f.rank}</Text>
              )}
            </VStack>
          </Box>
        </HStack>
      <HStack spacing={4}>
          {!isPublic && (
          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium">
              Regular F2F
            </FormLabel>
            <Switch
              id="schedule-mode"
              colorScheme="blue"
              size="lg"
              isChecked={viewMode === 'examination'}
              onChange={(e) => setViewMode(e.target.checked ? 'examination' : 'regular')}
            />
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium" ml={2}>
              Examination
            </FormLabel>
          </FormControl>
          )}
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          {isAdmin && !isPublic && (
            <Button as={RouterLink} to={`/share/faculty/${encodeURIComponent(encodeShareFacultyName(f?.name || ''))}`} leftIcon={<FiShare2 />} size="sm" colorScheme="blue">Share</Button>
          )}
          {isAdmin && !isPublic && (
            <Button onClick={assignDisc.onOpen} variant="solid" size="sm" colorScheme="blue">Assign Schedules</Button>
          )}
          {facultyConflictGroups.length > 0 && !isPublic && (
            <Button variant="outline" size="sm" colorScheme="red" onClick={() => { setConfPage(1); confDisc.onOpen(); }}>
              Conflicts <Tag colorScheme="red" ml={2}><TagLabel>{facultyConflictGroups.length}</TagLabel></Tag>
            </Button>
          )}
          {!isPublic && (
            <Button as={RouterLink} to="/" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
          )}
        </HStack>
      </HStack>
      

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={6}>
          <Stat label="Load Units" value={mergedStats.loadUnits} />
          <Stat label="Load Release Units" value={f.loadReleaseUnits ?? 0} />
          <Stat label="Overload Units" value={mergedStats.overloadUnits} />
          <Stat label="Courses" value={mergedStats.courseCount} />
        </HStack>
      </Box>

      {sortedCourses.length === 0 ? (
        <VStack align="center" spacing={3} py={12} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg}>
          <Heading size="sm">No schedules assigned</Heading>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            This faculty has no {viewMode === 'examination' ? 'examination ' : ''}schedules yet.
          </Text>
          {isAdmin && (
            <Button colorScheme="blue" size="sm" onClick={assignDisc.onOpen}>Assign Schedules</Button>
          )}
        </VStack>
      ) : termGroups.map(group => (
        <Box key={group.term}>
          <HStack justify="space-between" mb={2}>
            <Heading size="sm">Term: {group.term || 'N/A'}</Heading>
          </HStack>
          <Box className="responsive-table table-fac-detail" borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
            <Table size={{ base: 'sm', md: 'md' }}>
              <Thead>
                <Tr>
                  {(() => { const h = getTableHeaders(); if (isAdmin && !isPublic) h.push('Actions'); return h; })().map((header, index) => (
                    <Th key={index}>{header}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {group.items.map(c => {
                  const courseData = getCourseData(c);
                  const isConflict = conflictIdSet.has(String(c.id));
                  return (
                    <Tr key={c.id} bg={isConflict ? dangerRowBg : undefined}>
                      {courseData.map((data, index) => (
                        <Td key={index}>
                          {index === 1 ? (
                            <Text
                              maxW={isPublic ? 'unset' : '380px'}
                              noOfLines={isPublic ? undefined : 1}
                              whiteSpace="normal"
                              wordBreak="break-word"
                            >
                              {data}
                            </Text>
                          ) : (
                            data
                          )}
                        </Td>
                      ))}
                      {isAdmin && !isPublic && (
                        <Td textAlign="right">
                          <HStack justify="end" spacing={1}>
                            <Button size="sm" colorScheme="blue" variant="solid" onClick={() => { setSelected(c); assignFacDisc.onOpen(); }}>Assign</Button>
                            <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" colorScheme="yellow" variant="ghost" onClick={() => { setSelected(c); editDisc.onOpen(); }} />
                            <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => { setSelected(c); delDisc.onOpen(); }} />
                          </HStack>
                        </Td>
                      )}
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </Box>
      ))}


    </VStack>
    )}
    <EditScheduleModal
      isOpen={editDisc.isOpen}
      onClose={() => { editDisc.onClose(); setSelected(null); }}
      schedule={selected}
      onSave={handleSaveEdit}
      viewMode={viewMode}
    />
    {isAdmin && (
      <AssignSchedulesModal isOpen={assignDisc.isOpen} onClose={assignDisc.onClose} currentFacultyName={f?.name} />
    )}
    {isAdmin && (
      <AssignFacultyModal
        isOpen={assignFacDisc.isOpen}
        onClose={() => { assignFacDisc.onClose(); setSelected(null); }}
        schedule={selected}
        onAssign={async (fac) => {
          if (!selected || !fac) return;
          try {
            await dispatch(updateScheduleThunk({ id: selected.id, changes: { facultyId: fac.id } }));
            assignFacDisc.onClose();
            setSelected(null);
            dispatch(loadAllSchedules());
          } catch {}
        }}
      />
    )}
    <Modal isOpen={confDisc.isOpen} onClose={confDisc.onClose} size="4xl" isCentered>
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent>
        <ModalHeader>Conflicts for {f?.name || 'Faculty'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {pagedConflicts.map(group => (
              <Box key={group.key} borderWidth="1px" borderColor={border} rounded="md" p={3}>
                <Text color="red.500" fontWeight="700" mb={2}>{group.reason}</Text>
                <Wrap spacing={2}>
                  {group.items.map((c, idx) => (
                    <WrapItem key={`${c.id}-${idx}`}>
                      <Badge variant="subtle" colorScheme="gray" px={2} py={1} rounded="md">
                        <Text as="span" fontSize="xs" fontWeight="semibold">{c.code || c.courseName || 'Course'}</Text>
                        <Text as="span">/{c.section || ''}</Text>
                        <Text as="span" color="gray.500"> — {(c.f2fSched || c.f2fsched || c.day || '')} • {c.schedule || c.time || ''}</Text>
                        <Text as="span" color="gray.600"> • {c.facultyName || c.faculty || 'Unknown'}</Text>
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            ))}
          </VStack>
        </ModalBody>
        <ModalFooter w="full">
          <VStack w="full">
            <Pagination page={confPage} pageCount={confPageCount} onPage={setConfPage} pageSize={confPageSize} onPageSize={(n)=>{ setConfPageSize(n); setConfPage(1); }} />
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
    <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Delete schedule?</AlertDialogHeader>
          <AlertDialogBody>
            This action cannot be undone. Are you sure you want to delete <b>{selected?.code}</b> - {selected?.title}?
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
            <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <Box>
      <Text fontSize="sm" color="gray.500">{label}</Text>
      <Text fontWeight="800" fontSize="xl">{value}</Text>
    </Box>
  );
}










