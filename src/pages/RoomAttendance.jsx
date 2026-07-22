import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  useColorModeValue,
  SimpleGrid,
  Button,
  Icon,
  Avatar,
  useDisclosure,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Tag,
  TagLabel,
  Wrap,
  WrapItem,
  useBreakpointValue
} from '@chakra-ui/react';
import {
  FiClock,
  FiUser,
  FiKey,
  FiLogOut,
  FiDownload,
  FiShare2,
  FiCalendar,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiInfo
} from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { selectSettings } from '../store/settingsSlice';
import { loadAllSchedules, loadAcademicCalendar } from '../store/dataThunks';
import { getCurrentWeekDays, DAY_CODES, formatDayLabel } from '../utils/week';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { getAcademicCalendarForSchoolYear, resolveAcademicCalendarTerm } from '../utils/scheduleUtils';
import apiService from '../services/apiService';
import ExcelJS from 'exceljs';
import { keyframes } from '@emotion/react';
import { loginThunk, logoutThunk, changePasswordThunk, updateProfileThunk } from '../store/authThunks';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ProfileModal from '../components/ProfileModal';
import LoginModal from '../components/LoginModal';
import AttendanceFormModal from '../components/AttendanceFormModal';
import { Link as RouterLink } from 'react-router-dom';
import { usePublicView } from '../utils/uiFlags';

function schemeForBlockCode(code) {
  const s = String(code || '').toUpperCase();
  if (s.includes('BSAB')) return 'green';
  if (s.includes('BSBA')) return 'yellow';
  if (s.includes('BSCRIM')) return 'red';
  if (s.includes('BSED') || s.includes('BTLED')) return 'blue';
  if (s.includes('BSTM')) return 'purple';
  if (s.includes('BSENTREP')) return 'orange';
  return 'blue';
}

function deriveSession(timeStartMinutes, explicit) {
  const s = String(explicit || '').toLowerCase();
  if (s.includes('morn')) return 'Morning';
  if (s.includes('after')) return 'Afternoon';
  if (s.includes('even')) return 'Evening';
  const t = Number(timeStartMinutes);
  if (!Number.isFinite(t)) return 'Morning';
  if (t < 12 * 60) return 'Morning';
  if (t < 17 * 60) return 'Afternoon';
  return 'Evening';
}

function normRoom(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function roomExportPrefix(room) {
  const raw = normRoom(room);
  const match = raw.match(/^(BP|NB|OB|EB)(?=\d|\s|-|_|\/|$)/);
  return match ? match[1] : 'OTHER';
}

function compareRoomNames(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function wsColumnLetter(columnNumber) {
  let value = Math.max(1, Number(columnNumber) || 1);
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

const ROOM_SPLIT_THRESHOLD = 10;
const ROOM_EXPORT_ORDER = ['BP', 'NB', 'OB', 'EB'];

const normalizeSem = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('1')) return '1st';
  if (v.startsWith('2')) return '2nd';
  if (/summer|mid\s*year|midyear/.test(v)) return 'Summer';
  if (/first/.test(v)) return '1st';
  if (/second/.test(v)) return '2nd';
  if (/sem/.test(v)) return 'Sem';
  return '';
};

export default function RoomAttendance() {
  const dispatch = useDispatch();
  const all = useSelector(selectAllCourses);
  const acadData = useSelector((s) => s.data.acadData);
  const authUser = useSelector((s) => s.auth.user);
  const settings = useSelector(selectSettings);

  const border = useColorModeValue('gray.200', 'gray.700');
  const panel = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const accent = useColorModeValue('blue.600', 'blue.300');
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const dotBg = useColorModeValue('gray.700', 'gray.200');
  const stickyBg = headerBg;
  const footerBg = headerBg;

  const isPublic = usePublicView();

  const loginModal = useDisclosure();
  const attendModal = useDisclosure();
  const changePwdModal = useDisclosure();
  const profileModal = useDisclosure();
  const toast = useToast();

  const [attendanceInitial, setAttendanceInitial] = React.useState(null);
  const [scheduleRows, setScheduleRows] = React.useState([]);

  const roleStr = String(authUser?.role || '').toLowerCase();
  const canAttend = !!authUser && (roleStr === 'admin' || roleStr === 'manager' || roleStr === 'checker' || roleStr === 'sa');
  const canManageAttendance = !!authUser && (roleStr === 'admin' || roleStr === 'checker' || roleStr === 'sa');

  // Public users should still be able to VIEW attendance.
  const canViewAttendance = isPublic || canAttend || !!authUser;

  const days = getCurrentWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIdx = days.findIndex((d) => {
    const dd = new Date(d.date);
    dd.setHours(0, 0, 0, 0);
    return dd.getTime() === today.getTime();
  });

  const todayCode = todayIdx >= 0 ? days[todayIdx].code : DAY_CODES[0];

  const [selectedDate, setSelectedDate] = React.useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dateToISO = React.useCallback((d) => {
    try {
      const zz = new Date(d);
      zz.setHours(0, 0, 0, 0);
      const y = zz.getFullYear();
      const m = String(zz.getMonth() + 1).padStart(2, '0');
      const day = String(zz.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }, []);

  const selectedDayCode = React.useMemo(() => {
    const wd = new Date(selectedDate).getDay();
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[wd] || 'Mon';
  }, [selectedDate]);

  const selectedIso = React.useMemo(() => dateToISO(selectedDate), [selectedDate, dateToISO]);

  React.useEffect(() => {
    if (!acadData) {
      try {
        dispatch(loadAcademicCalendar());
      } catch {}
    }
  }, [acadData, dispatch]);

  const [termFilter, setTermFilter] = React.useState('auto');

  // Time slots (7:00 AM to 9:00 PM in 1-hour intervals)
  const slots = React.useMemo(() => {
    const out = [];
    for (let h = 7; h <= 20; h++) {
      const start = h * 60;
      const end = start + 60;
      const toLabel = (m) => {
        let hh = Math.floor(m / 60);
        const mer = hh >= 12 ? 'PM' : 'AM';
        hh = ((hh + 11) % 12) + 1;
        return `${hh}` + mer;
      };
      const label = `${toLabel(start).replace(/(AM|PM)$/,'')} - ${toLabel(end)}`;
      out.push({ start, end, label });
    }
    return out;
  }, []);
  const defaultSlotIndex = React.useMemo(() => {
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes();
    let idx = slots.findIndex(s => s.start <= min && min < s.end);
    if (idx === -1) idx = 0;
    return idx;
  }, [slots]);
  const [slotIndex, setSlotIndex] = React.useState(defaultSlotIndex);

  const prefSy = React.useMemo(() => {
    return String(settings?.schedulesView?.school_year || settings?.attendance?.school_year || '').trim();
  }, [settings]);

  const prefSem = React.useMemo(() => {
    const raw = settings?.schedulesView?.semester || settings?.attendance?.semester || '';
    return normalizeSem(raw);
  }, [settings]);

  React.useEffect(() => {
    let active = true;

    // Settings load asynchronously. Do not issue an unfiltered schedules request
    // while the configured schedulesView scope is not available yet.
    if (!prefSy && !prefSem) {
      setScheduleRows([]);
      return () => {
        active = false;
      };
    }

    const mapScheduleRecord = (raw) => {
      const prospectus = raw?.prospectus || {};
      const parsedTime = parseTimeBlockToMinutes(String(raw?.time || raw?.scheduleKey || raw?.schedule || ''));
      return {
        ...raw,
        id: raw?.id,
        facultyId: raw?.facultyId || raw?.faculty_id || null,
        faculty: raw?.faculty || raw?.facultyName || raw?.facultyProfile?.faculty || raw?.instructor || '',
        instructor: raw?.instructor || raw?.faculty || raw?.facultyProfile?.faculty || '',
        school_year: raw?.sy || raw?.schoolyear || raw?.schoolYear || raw?.school_year || '',
        semester: prospectus?.semester || raw?.semester || raw?.sem || raw?.term || '',
        term: raw?.term || raw?.sem || raw?.semester || '',
        section: raw?.section || raw?.block || raw?.blockCode || raw?.block_code || '',
        blockCode: raw?.blockCode || raw?.block_code || raw?.block || raw?.section || '',
        room: raw?.room || '',
        session: raw?.session || '',
        time: raw?.time || raw?.schedule || '',
        timeStartMinutes: raw?.timeStartMinutes ?? parsedTime.start,
        timeEndMinutes: raw?.timeEndMinutes ?? parsedTime.end,
        code: raw?.code || raw?.courseCode || prospectus?.courseCode || '',
        courseName: raw?.courseName || raw?.course_name || prospectus?.courseName || '',
        courseTitle: raw?.courseTitle || raw?.course_title || prospectus?.courseTitle || '',
        programcode: raw?.programcode || raw?.program || prospectus?.programcode || '',
        f2fSched: raw?.f2fSched || raw?.f2fsched || raw?.day || '',
        day: raw?.day || '',
      };
    };

    (async () => {
      try {
        const response = await apiService.getAllSchedules({
          ...(prefSy ? { schoolyear: prefSy } : {}),
          ...(prefSem ? { semester: prefSem } : {}),
          limit: 100000
        });
        const list = response?.data || response;
        if (!active) return;
        setScheduleRows(Array.isArray(list) ? list.map(mapScheduleRecord) : []);
      } catch {
        if (!active) return;
        setScheduleRows([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [prefSy, prefSem]);

  const scheduleSource = React.useMemo(() => {
    if (Array.isArray(scheduleRows) && scheduleRows.length) return scheduleRows;
    return Array.isArray(all) ? all : [];
  }, [scheduleRows, all]);

  const resolvedCalendar = React.useMemo(() => {
    return getAcademicCalendarForSchoolYear(acadData, prefSy);
  }, [acadData, prefSy]);

  const autoTerm = React.useMemo(() => {
    if (prefSem === 'Summer') return 'Summer';
    return resolveAcademicCalendarTerm(resolvedCalendar, prefSem, new Date());
  }, [resolvedCalendar, prefSem]);

  const effectiveTermFilter = React.useMemo(() => {
    if (termFilter === 'auto') return autoTerm || 'all';
    return termFilter;
  }, [termFilter, autoTerm]);

  function termMatches(t) {
    const norm = normalizeSem(t);
    if (!norm) return true; // allow untagged
    const f = String(effectiveTermFilter || 'all').toLowerCase();
    if (f === 'all') return true;
    if (f.startsWith('sum')) return true;
    if (f.startsWith('s')) return norm === 'Sem';
    if (norm === 'Sem') return false;
    if (f.startsWith('1')) return norm === '1st';
    if (f.startsWith('2')) return norm === '2nd';
    return true;
  }

  const [bySched, setBySched] = React.useState({});
  const [attendanceRecordsBySched, setAttendanceRecordsBySched] = React.useState({});
  const attendanceScheduleIds = React.useMemo(() => {
    return new Set(
      Object.keys(bySched || {})
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
  }, [bySched]);

  const filteredSchedules = React.useMemo(() => {
    return (scheduleSource || []).filter((c) => {
      const sid = Number(c.id);
      if (attendanceScheduleIds.has(sid)) return true;
      const syVal = String(c.school_year || c.schoolYear || c.sy || '').trim();
      if (prefSy && syVal && syVal !== prefSy) return false;
      const semVal = normalizeSem(c.semester || c.sem);
      if (prefSem && semVal && semVal !== prefSem) return false;
      return true;
    });
  }, [scheduleSource, attendanceScheduleIds, prefSy, prefSem]);

  const tokens = React.useCallback((s) => String(s || '').split(',').map((t) => t.trim()).filter(Boolean), []);

  const getRoomsForDay = React.useCallback(
    (rec, d) => {
      try {
        const daysArr = Array.isArray(rec.f2fDays) && rec.f2fDays.length ? rec.f2fDays : tokens(rec.f2fSched || rec.f2fsched || rec.day);
        const roomsArr = tokens(rec.room);
        if (roomsArr.length > 1 && daysArr.length > 1) {
          const out = [];
          const len = Math.min(roomsArr.length, daysArr.length);
          for (let i = 0; i < len; i++) {
            if (String(daysArr[i]) === String(d)) out.push(roomsArr[i]);
          }
          return out;
        }
        return daysArr.includes(d) ? (roomsArr.length ? roomsArr : [rec.room].filter(Boolean)) : [];
      } catch {
        return [];
      }
    },
    [tokens]
  );

  const matrix = React.useMemo(() => {
    const roomsSet = new Map();
    (filteredSchedules || []).forEach((c) => {
      const termOk = termMatches(c.term);
      if (!termOk) return;
      const rs = getRoomsForDay(c, selectedDayCode);
      rs.forEach((r) => {
        const disp = String(r || '').trim();
        if (!disp) return;
        const n = normRoom(disp);
        if (!roomsSet.has(n)) roomsSet.set(n, disp);
      });
    });

    const rooms = Array.from(roomsSet.values()).sort((a, b) => String(a).localeCompare(String(b)));

    const m = { Morning: new Map(), Afternoon: new Map(), Evening: new Map() };
    rooms.forEach((r) => {
      m.Morning.set(r, new Map());
      m.Afternoon.set(r, new Map());
      m.Evening.set(r, new Map());
    });

    (filteredSchedules || []).forEach((c) => {
      const termOk = termMatches(c.term);
      if (!termOk) return;
      const rs = getRoomsForDay(c, selectedDayCode);
      if (!rs.length) return;
      const ses = deriveSession(c.timeStartMinutes, c.session);
      const block = c.section || c.blockCode || c.block_code;
      rs.forEach((r) => {
        const disp = roomsSet.get(normRoom(r)) || r;
        const mm = m[ses];
        if (!mm.has(disp)) mm.set(disp, new Map());
        const map = mm.get(disp);
        map.set(block, true);
      });
    });

    return { rooms, matrix: m };
  }, [filteredSchedules, selectedDayCode, getRoomsForDay, termFilter, autoTerm]);

  const presentPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.55); }
    70% { box-shadow: 0 0 0 6px rgba(72, 187, 120, 0.0); }
    100% { box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.0); }
  `;

  const statusMeta = React.useCallback((status) => {
    const v = String(status || '').toLowerCase();
    if (v === 'present') return { icon: FiCheck, color: 'green.500', label: 'Present' };
    if (v === 'absent') return { icon: FiX, color: 'red.500', label: 'Absent' };
    if (v === 'late') return { icon: FiAlertCircle, color: 'orange.500', label: 'Late' };
    if (v === 'excused') return { icon: FiInfo, color: 'blue.500', label: 'Excused' };
    return null;
  }, []);

  const loadAttendance = React.useCallback(async () => {
    const iso = selectedIso;

    const normalizeAttendancePayload = (list) => {
      const arr = Array.isArray(list) ? list : list?.data || list?.rows || list?.results || [];
      const statuses = {};
      const records = {};
      arr.forEach((r) => {
        const scheduleId = Number(
          r.scheduleId ||
          r.schedule_id ||
          r.schedId ||
          r.sched_id ||
          r.schedule?.id ||
          r.schedule?.scheduleId ||
          r.schedule?.schedule_id
        );
        const status = String(r.status || r.attendance || r.attendance_status || '').toLowerCase();
        if (scheduleId) {
          statuses[scheduleId] = status;
          records[scheduleId] = r;
        }
      });
      return { statuses, records };
    };

    try {
      const params = { startDate: iso, endDate: iso, limit: 100000 };

      // Logged-out/public route should try public-friendly methods first.
      const attempts = isPublic || !authUser
        ? [
            async () => {
              if (typeof apiService.listPublicAttendance === 'function') {
                return await apiService.listPublicAttendance(params);
              }
              throw new Error('listPublicAttendance not available');
            },
            async () => {
              if (typeof apiService.getPublicAttendance === 'function') {
                return await apiService.getPublicAttendance(params);
              }
              throw new Error('getPublicAttendance not available');
            },
            async () => {
              if (typeof apiService.listAttendancePublic === 'function') {
                return await apiService.listAttendancePublic(params);
              }
              throw new Error('listAttendancePublic not available');
            },
            async () => {
              if (typeof apiService.listAttendance === 'function') {
                return await apiService.listAttendance({ ...params, public: true, share: true });
              }
              throw new Error('listAttendance not available');
            },
            async () => {
              if (typeof apiService.listAttendance === 'function') {
                return await apiService.listAttendance(params);
              }
              throw new Error('listAttendance not available');
            }
          ]
        : [
            async () => {
              if (typeof apiService.listAttendance === 'function') {
                return await apiService.listAttendance(params);
              }
              throw new Error('listAttendance not available');
            }
          ];

      for (const attempt of attempts) {
        try {
          const result = await attempt();
          const mapped = normalizeAttendancePayload(result);
          setBySched(mapped.statuses);
          setAttendanceRecordsBySched(mapped.records);
          return;
        } catch {}
      }

      setBySched({});
      setAttendanceRecordsBySched({});
    } catch {
      setBySched({});
      setAttendanceRecordsBySched({});
    }
  }, [selectedIso, isPublic, authUser]);

  React.useEffect(() => {
    (async () => {
      try {
        await loadAttendance();
      } catch {}
    })();
  }, [loadAttendance, selectedIso]);

  const openAttendanceModal = React.useCallback(
    (scheduleId, status) => {
      if (!scheduleId) return;
      const existing = attendanceRecordsBySched[Number(scheduleId)];
      setAttendanceInitial(existing
        ? { ...existing, scheduleId, status: existing.status || status || 'present', date: selectedIso }
        : { scheduleId, status: status || 'present', date: selectedIso });
      attendModal.onOpen();
    },
    [selectedIso, attendModal, attendanceRecordsBySched]
  );

  const [rtEnabled, setRtEnabled] = React.useState(false);
  const [rtMs, setRtMs] = React.useState(60000);
  const rtRef = React.useRef(null);

  React.useEffect(() => {
    if (!rtEnabled) {
      if (rtRef.current) {
        clearInterval(rtRef.current);
        rtRef.current = null;
      }
      return;
    }

    if (rtRef.current) {
      clearInterval(rtRef.current);
      rtRef.current = null;
    }

    rtRef.current = setInterval(async () => {
      try {
        await dispatch(loadAllSchedules());
        await loadAttendance();
      } catch {}
    }, rtMs);

    return () => {
      if (rtRef.current) {
        clearInterval(rtRef.current);
        rtRef.current = null;
      }
    };
  }, [rtEnabled, rtMs, dispatch, loadAttendance]);

  function withinSlot(rec, slot) {
    let s = rec.timeStartMinutes;
    let e = rec.timeEndMinutes;
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      const tt = parseTimeBlockToMinutes(String(rec.scheduleKey || rec.schedule || rec.time || ''));
      s = tt.start;
      e = tt.end;
    }
    if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
    return s < slot.end && slot.start < e;
  }

  const slotSummary = React.useMemo(() => {
    const rank = (s) => {
      const v = String(s || '').toLowerCase();
      return v === 'present' ? 4 : v === 'late' ? 3 : v === 'excused' ? 2 : v === 'absent' ? 1 : 0;
    };

    const statusByFacultyId = new Map();
    const idToName = new Map();

    (filteredSchedules || []).forEach((c) => {
      const daysArr = Array.isArray(c.f2fDays)
        ? c.f2fDays
        : String(c.f2fSched || c.f2fsched || c.day)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      if (!daysArr.includes(selectedDayCode)) return;
      if (!termMatches(c.term)) return;
      if (!withinSlot(c, slots[slotIndex])) return;

      const fid = Number(c.facultyId || c.faculty_id);
      if (!fid) return;

      const st = String(bySched[Number(c.id)] || '') || '';
      if (!st) return;

      const cur = statusByFacultyId.get(fid);
      if (!cur || rank(st) > rank(cur)) statusByFacultyId.set(fid, st);

      const name = (c.facultyName || c.faculty || c.instructor || '').trim();
      if (name) idToName.set(fid, name);
    });

    const present = [];
    const absent = [];
    const late = [];
    const excused = [];

    statusByFacultyId.forEach((st, fid) => {
      const label = idToName.get(fid) || String(fid);
      const v = String(st).toLowerCase();
      if (v === 'present') present.push(label);
      else if (v === 'absent') absent.push(label);
      else if (v === 'late') late.push(label);
      else if (v === 'excused') excused.push(label);
    });

    present.sort();
    absent.sort();
    late.sort();
    excused.sort();

    return { present, absent, late, excused };
  }, [filteredSchedules, bySched, slotIndex, selectedDayCode, termFilter, autoTerm, slots]);

  function onPrint() {
    const label = formatDayLabel(new Date(selectedDate));
    const timeSlots = slots;
    const groups = roomExportGroups;
    const getCell = (room, slotIdx) => exportCellMap.get(`${normRoom(room)}::${slotIdx}`) || { faculty: '', status: '', course: '', title: '' };

    const programBg = (prog) => {
      const p = String(prog || '').toUpperCase();
      if (p.includes('BSAB')) return '#e6f7ed';
      if (p.includes('BSBA')) return '#fff7d6';
      if (p.includes('BSCRIM')) return '#fde2e0';
      if (p.includes('BSED') || p.includes('BTLED')) return '#e6efff';
      if (p.includes('BSTM')) return '#eee6ff';
      if (p.includes('BSENTREP')) return '#ffe9d9';
      return '#edf2f7';
    };

    const styles = `
      <style>
        @page { size: A4 landscape; margin: 6mm; }
        body { font-family: Arial, sans-serif; color: #111; }
        .toolbar { position: sticky; top: 0; background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 8px 10px; display: flex; gap: 8px; z-index: 5; }
        .toolbar button { background: #2563eb; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-weight: 700; cursor: pointer; }
        .toolbar button:hover { background: #1d4ed8; }
        @media print { .toolbar { display: none; } }
        .section { page-break-inside: avoid; page-break-before: always; margin-top: 0; padding-top: 0; }
        .section:first-child { page-break-before: auto; padding-top: 0; }
        .section::before { content: ''; display: block; height: 10mm; }
        .section:first-child::before { height: 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #777; padding: 3px 4px; vertical-align: top; }
        th { background: #f4f6f8; font-size: 10px; }
        td { font-size: 9px; }
        .slot { width: 70px; white-space: nowrap; font-weight: 700; }
        .cell { min-height: 28px; }
        .faculty { font-weight: 700; margin-bottom: 1px; }
        .meta { color: #333; font-size: 9px; }
        .status.present { color: #157347; }
        .status.absent { color: #b02a37; }
        .status.late { color: #a75d00; }
        .status.excused { color: #0d6efd; }
        .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .head .left { font-size: 11px; font-weight: 700; }
        .head .right { font-size: 10px; color: #555; }
        .section-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
      </style>
    `;

    const groupHtml = groups
      .map((group) => {
        const grp = group.rooms;
        const headFontSize = grp.length >= 14 ? 8 : grp.length >= 10 ? 9 : 10;
        const cellFontSize = grp.length >= 14 ? 7 : grp.length >= 10 ? 8 : 9;
        const thead = `
          <thead>
            <tr>
              <th class="slot" style="font-size:${headFontSize}px">Time</th>
              ${grp.map((r) => `<th style="width: calc((100% - 70px)/${grp.length}); font-size:${headFontSize}px">${r}</th>`).join('')}
            </tr>
          </thead>
        `;

        const body = timeSlots
          .map((sl, slotIdx) => {
            return `
              <tr>
                <td class="slot">${sl.label}</td>
                ${grp
                  .map((r) => {
                    const info = getCell(r, slotIdx);
                    const st = (info.status || '').toLowerCase();
                    const bg = programBg(info.program);
                    return `<td class="cell" style="background:${bg};width: calc((100% - 70px)/${grp.length}); font-size:${cellFontSize}px">
                      ${info.faculty ? `<div class="faculty">${info.faculty}</div>` : `<div class="meta">&nbsp;</div>`}
                      ${(info.course || info.title) ? `<div class="meta">${info.course || ''}${info.title ? '-' + info.title : ''}</div>` : ''}
                      ${(info.term || info.time) ? `<div class="meta">${info.term ? 'Term: ' + info.term : ''}${info.time ? (info.term ? ' · ' : '') + info.time : ''}</div>` : ''}
                      ${st ? `<div class="status ${st}">Status: ${info.status}</div>` : ''}
                      <div class="sig"></div>
                    </td>`;
                  })
                  .join('')}
              </tr>
            `;
          })
          .join('');

        return `
          <div class="section">
            <div class="section-title">${group.label}</div>
            <table>${thead}<tbody>${body}</tbody></table>
          </div>
        `;
      })
      .join('');

    const html = `
      <!doctype html><html><head><meta charset="utf-8"/><title>Attendance Sheet</title>${styles}</head>
      <body>
        <div class="toolbar"><button onclick="window.print()">Print</button></div>
        <div class="head"><div class="left">Attendance Sheet - Day: ${label}</div><div class="right">Generated: ${new Date().toLocaleString()}</div></div>
        ${groupHtml}
      </body></html>
    `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  async function onDownloadXlsx() {
    const label = formatDayLabel(new Date(selectedDate));
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(selectedDate).getDay()];
    const termLabel = (() => {
      const value = String(effectiveTermFilter || 'all').toLowerCase();
      if (value.startsWith('1')) return '1st Term';
      if (value.startsWith('2')) return '2nd Term';
      if (value.startsWith('sum')) return 'Summer';
      if (value.startsWith('s')) return 'Semestral';
      return 'All Terms';
    })();
    const checkerName = [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ').trim()
      || authUser?.username
      || authUser?.email
      || '';

    const exportRows = [];
    const seen = new Set();
    (filteredSchedules || []).forEach((record) => {
      if (!termMatches(record.term)) return;
      const dayRooms = getRoomsForDay(record, selectedDayCode);
      if (!dayRooms.length) return;

      const parsed = parseTimeBlockToMinutes(String(record.time || record.scheduleKey || record.schedule || ''));
      const start = Number.isFinite(record.timeStartMinutes) ? record.timeStartMinutes : parsed.start;
      const scheduleId = Number(record.id);

      dayRooms.forEach((roomName) => {
        const room = String(roomName || '').trim();
        if (!room) return;
        const key = `${scheduleId || 'schedule'}::${normRoom(room)}::${record.time || ''}::${record.section || record.blockCode || ''}`;
        if (seen.has(key)) return;
        seen.add(key);

        const rawStatus = String(bySched[scheduleId] || '').trim();
        exportRows.push({
          start: Number.isFinite(start) ? start : Number.MAX_SAFE_INTEGER,
          time: record.time || record.schedule || '-',
          room,
          block: record.section || record.blockCode || record.block_code || '',
          course: record.code || record.courseName || '',
          title: record.courseTitle || record.course_name || '',
          faculty: record.faculty || record.facultyName || record.instructor || '',
          remarks: rawStatus ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase() : ''
        });
      });
    });

    exportRows.sort((a, b) => (
      a.start - b.start
      || compareRoomNames(a.room, b.room)
      || String(a.block).localeCompare(String(b.block), undefined, { numeric: true, sensitivity: 'base' })
      || String(a.course).localeCompare(String(b.course), undefined, { numeric: true, sensitivity: 'base' })
    ));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kolehiyo ng Pantukan';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(`${selectedDayCode} ${selectedIso}`.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 5, activeCell: 'A6', showGridLines: false }]
    });
    ws.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: false,
      printTitlesRow: '1:5',
      printArea: `A1:J${Math.max(5, exportRows.length + 5)}`,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.25,
        bottom: 0.25,
        header: 0.1,
        footer: 0.1
      }
    };
    ws.headerFooter.oddFooter = '&LGenerated by KNP Smart Academic Scheduler&CPage &P of &N&R' + selectedIso;

    ws.addRow([`FACULTY ATTENDANCE TRACKER - ${termLabel.toUpperCase()} - ${dayName.toUpperCase()}`]);
    ws.mergeCells('A1:J1');
    ws.addRow([
      `SY ${prefSy || '-'}`,
      `Semester: ${prefSem || '-'}`,
      `Term: ${termLabel}`,
      `Day: ${dayName}`,
      `Date: ${label}`,
      '',
      `Checker: ${checkerName}`,
      '',
      'Route Type:',
      'IN / OUT'
    ]);
    ws.addRow([`Schedule scope: ${dayName} classes`, `Generated from the room-attendance schedule for ${label}.`, '', '', '', '', '', '', '', '']);
    ws.addRow([]);
    ws.addRow(['No.', 'Time', 'Room', 'Block', 'Course', 'Title', 'Faculty', 'IN', 'OUT', 'Remarks']);

    exportRows.forEach((item, index) => {
      ws.addRow([
        index + 1,
        item.time,
        item.room,
        item.block,
        item.course,
        item.title,
        item.faculty,
        '',
        '',
        item.remarks
      ]);
    });

    const titleRow = ws.getRow(1);
    titleRow.height = 26;
    titleRow.font = { name: 'Carlito', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    [2, 3].forEach((rowNumber) => {
      const row = ws.getRow(rowNumber);
      row.height = rowNumber === 2 ? 30 : 24;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Carlito', size: 9, color: { argb: 'FF111827' } };
        cell.alignment = { vertical: 'middle', wrapText: true, shrinkToFit: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2F1' } };
      });
    });
    ws.getRow(4).height = 8;

    const headerRow = ws.getRow(5);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Carlito', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF134E4A' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F3D3A' } },
        left: { style: 'thin', color: { argb: 'FF0F3D3A' } },
        bottom: { style: 'thin', color: { argb: 'FF0F3D3A' } },
        right: { style: 'thin', color: { argb: 'FF0F3D3A' } }
      };
    });

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };
    for (let rowNumber = 6; rowNumber <= ws.rowCount; rowNumber++) {
      const row = ws.getRow(rowNumber);
      row.height = 30;
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.font = { name: 'Carlito', size: 8 };
        cell.alignment = {
          horizontal: [1, 2, 3, 8, 9].includes(columnNumber) ? 'center' : 'left',
          vertical: 'middle',
          wrapText: true,
          shrinkToFit: true
        };
        cell.border = thinBorder;
        if (rowNumber % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
      row.getCell(10).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Present,Late,Absent,Excused,No Class,Substitution,Transferred Room"']
      };
    }

    const widths = [5, 11, 12, 18, 14, 34, 28, 9, 9, 18];
    widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
    if (exportRows.length) ws.autoFilter = `A5:J${ws.rowCount}`;

    const fn = `Faculty_Attendance_${selectedIso}_${selectedDayCode}_${termLabel.replace(/\s+/g, '_')}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onDownloadXlsxV2() {
    const label = formatDayLabel(new Date(selectedDate));
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(selectedDate).getDay()];
    const termLabel = (() => {
      const value = String(effectiveTermFilter || 'all').toLowerCase();
      if (value.startsWith('1')) return '1st Term';
      if (value.startsWith('2')) return '2nd Term';
      if (value.startsWith('sum')) return 'Summer';
      if (value.startsWith('s')) return 'Semestral';
      return 'All Terms';
    })();
    const checkerName = [authUser?.first_name, authUser?.last_name].filter(Boolean).join(' ').trim()
      || authUser?.username
      || authUser?.email
      || '';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kolehiyo ng Pantukan';
    wb.created = new Date();
    wb.modified = new Date();

    const groups = [{
      key: selectedDayCode,
      label: `${dayName} Schedule`,
      rooms
    }];
    const tbaCellMap = new Map();
    (filteredSchedules || []).forEach((record) => {
      if (!termMatches(record.term)) return;
      const timeValue = String(record.time || record.scheduleKey || record.schedule || '').trim();
      if (!/\bTBA\b/i.test(timeValue)) return;

      getRoomsForDay(record, selectedDayCode).forEach((room) => {
        const roomKey = normRoom(room);
        if (!roomKey || tbaCellMap.has(roomKey)) return;
        const scheduleId = Number(record.id);
        tbaCellMap.set(roomKey, {
          faculty: record.faculty || record.facultyName || record.instructor || '',
          status: String(bySched[scheduleId] || '').trim()
        });
      });
    });
    const timeRows = [
      ...slots.map((slot, slotIndex) => ({ label: slot.label, slotIndex, isTba: false })),
      { label: 'TBA', slotIndex: null, isTba: true }
    ];
    const getTimeRoomInfo = (room, timeRow) => (
      timeRow.isTba
        ? tbaCellMap.get(normRoom(room))
        : exportCellMap.get(`${normRoom(room)}::${timeRow.slotIndex}`)
    );
    const statusFills = {
      present: 'FFE2F0D9',
      late: 'FFFFE699',
      absent: 'FFF4CCCC',
      excused: 'FFD9EAF7'
    };
    const border = {
      top: { style: 'thin', color: { argb: 'FF808080' } },
      left: { style: 'thin', color: { argb: 'FF808080' } },
      bottom: { style: 'thin', color: { argb: 'FF808080' } },
      right: { style: 'thin', color: { argb: 'FF808080' } }
    };

    groups.forEach((group, groupIndex) => {
      const roomList = group.rooms || [];
      const lastColumn = Math.max(2, roomList.length + 1);
      const lastColumnLetter = wsColumnLetter(lastColumn);
      const sheetName = String(group.label || `Rooms ${groupIndex + 1}`).slice(0, 31);
      const ws = wb.addWorksheet(sheetName, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 3, activeCell: 'B4', showGridLines: false }]
      });

      ws.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
        verticalCentered: false,
        printTitlesRow: '1:3',
        printArea: `A1:${lastColumnLetter}${timeRows.length + 3}`,
        margins: {
          left: 0.2,
          right: 0.2,
          top: 0.25,
          bottom: 0.25,
          header: 0.1,
          footer: 0.1
        }
      };
      ws.headerFooter.oddFooter = `&LKNP Room Attendance - ${selectedIso}&CPage &P of &N&R${group.label}`;

      ws.addRow([`KNP ROOM ATTENDANCE - ${dayName.toUpperCase()} - ${group.label.toUpperCase()}`]);
      ws.mergeCells(`A1:${lastColumnLetter}1`);
      ws.addRow([
        `DATE: ${label}   |   SY: ${prefSy || '-'}   |   SEMESTER: ${prefSem || '-'}   |   TERM: ${termLabel}   |   CHECKER: ${checkerName || '-'}`
      ]);
      ws.mergeCells(`A2:${lastColumnLetter}2`);
      ws.addRow(['TIME', ...roomList.map((room) => String(room || '').toUpperCase())]);

      timeRows.forEach((timeRow) => {
        const row = ws.addRow([
          timeRow.label.replace(/\s+/g, ''),
          ...roomList.map((room) => {
            const info = getTimeRoomInfo(room, timeRow);
            if (!info?.faculty) return '';
            const status = String(info.status || '').trim();
            return status
              ? `${info.faculty}\n${status.toUpperCase()}`
              : info.faculty;
          })
        ]);
        row.height = 32;
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          cell.font = {
            name: 'Arial',
            size: columnNumber === 1 ? 8 : 7,
            bold: columnNumber === 1
          };
          cell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
            wrapText: true,
            shrinkToFit: true
          };
          cell.border = border;

          if (columnNumber > 1) {
            const room = roomList[columnNumber - 2];
            const info = getTimeRoomInfo(room, timeRow);
            const fillColor = statusFills[String(info?.status || '').toLowerCase()];
            if (fillColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
          }
        });
      });

      const titleRow = ws.getRow(1);
      titleRow.height = 24;
      titleRow.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

      const metaRow = ws.getRow(2);
      metaRow.height = 22;
      metaRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Arial', size: 8, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
        cell.border = border;
      });

      const headerRow = ws.getRow(3);
      headerRow.height = 24;
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.border = border;
      });

      ws.getColumn(1).width = 10;
      for (let columnNumber = 2; columnNumber <= lastColumn; columnNumber++) {
        ws.getColumn(columnNumber).width = roomList.length >= 12 ? 11 : 13;
      }
    });

    const fn = `Room_Attendance_V2_${selectedIso}_${selectedDayCode}_${termLabel.replace(/\s+/g, '_')}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onLoginSubmit({ username, password }) {
    try {
      await dispatch(loginThunk({ identifier: username, password })).unwrap();
      loginModal.onClose();
    } catch (e) {
      toast({
        title: 'Login failed',
        description: e?.message || 'Invalid credentials',
        status: 'error'
      });
    }
  }

  function onLogout() {
    dispatch(logoutThunk());
  }

  const rooms = matrix.rooms;
  const sessions = ['Morning', 'Afternoon', 'Evening'];

  const roomParts = React.useMemo(() => {
    if ((rooms || []).length > ROOM_SPLIT_THRESHOLD) {
      const mid = Math.ceil(rooms.length / 2);
      return [rooms.slice(0, mid), rooms.slice(mid)];
    }
    return [rooms];
  }, [rooms]);
  const roomExportGroups = React.useMemo(() => {
    const buckets = new Map();
    (rooms || []).forEach((roomName) => {
      const prefix = roomExportPrefix(roomName);
      if (!buckets.has(prefix)) buckets.set(prefix, []);
      buckets.get(prefix).push(roomName);
    });

    const ordered = [];
    ROOM_EXPORT_ORDER.forEach((prefix) => {
      const list = (buckets.get(prefix) || []).slice().sort(compareRoomNames);
      if (list.length) ordered.push({ key: prefix, label: `${prefix} Rooms`, rooms: list });
      buckets.delete(prefix);
    });

    Array.from(buckets.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .forEach(([prefix, list]) => {
        const sorted = list.slice().sort(compareRoomNames);
        if (!sorted.length) return;
        ordered.push({
          key: prefix,
          label: prefix === 'OTHER' ? 'Other Rooms' : `${prefix} Rooms`,
          rooms: sorted
        });
      });

    return ordered;
  }, [rooms]);
  const exportCellMap = React.useMemo(() => {
    const map = new Map();
    (filteredSchedules || []).forEach((record) => {
      if (!termMatches(record.term)) return;
      const dayRooms = getRoomsForDay(record, selectedDayCode);
      if (!dayRooms.length) return;

      const matchedSlots = [];
      slots.forEach((slot, slotIdx) => {
        if (withinSlot(record, slot)) matchedSlots.push(slotIdx);
      });
      if (!matchedSlots.length) return;

      dayRooms.forEach((roomName) => {
        const roomKey = normRoom(roomName);
        matchedSlots.forEach((slotIdx) => {
          const key = `${roomKey}::${slotIdx}`;
          if (map.has(key)) return;
          const sid = Number(record.id);
          const status = (bySched[sid] || '').toString();
          map.set(key, {
            faculty: record.faculty || record.instructor || '',
            status: status ? status.toUpperCase() : '',
            course: record.code || record.courseName || '',
            title: record.courseTitle || '',
            term: record.term || '',
            time: record.time || '',
            program: record.programcode || record.program || ''
          });
        });
      });
    });
    return map;
  }, [filteredSchedules, termMatches, getRoomsForDay, selectedDayCode, slots, bySched]);

  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box minH="100vh" bg={pageBg}>
      <Box bg={headerBg} borderBottomWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={4}>
        <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
          <VStack align="start" spacing={0}>
            <HStack>
              <Icon as={FiCalendar} color={accent} />
              <Heading size="md">Room Attendance</Heading>
            </HStack>
            <HStack spacing={2}>
              <Text fontSize="sm" color={subtle}>
                Day:
              </Text>
              <HStack spacing={2}>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    d.setHours(0, 0, 0, 0);
                    setSelectedDate(d);
                  }}
                >
                  Prev
                </Button>
                <input
                  type="date"
                  value={selectedIso}
                  onChange={(e) => {
                    try {
                      const [y, m, dd] = String(e.target.value || '').split('-').map(Number);
                      const d = new Date(y, (m || 1) - 1, dd || 1);
                      d.setHours(0, 0, 0, 0);
                      setSelectedDate(d);
                    } catch {}
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '4px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--chakra-colors-gray-300)'
                  }}
                />
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    d.setHours(0, 0, 0, 0);
                    setSelectedDate(d);
                  }}
                >
                  Next
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    const now = new Date();
                    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    setSelectedDate(d);
                    const minutes = now.getHours() * 60 + now.getMinutes();
                    let idx = slots.findIndex((s) => s.start <= minutes && minutes < s.end);
                    if (idx === -1) idx = 0;
                    setSlotIndex(idx);
                  }}
                >
                  Today
                </Button>
              </HStack>
            </HStack>
          </VStack>

          <HStack spacing={3}>
            {!isPublic && (
              <>
                <HStack spacing={2}>
                  <Text fontSize="xs" color={subtle}>Term</Text>
                  <select value={termFilter} onChange={(e)=> setTermFilter(String(e.target.value||'auto'))} style={{ fontSize: '12px', padding: '4px 6px', borderRadius: 6, border: `1px solid var(--chakra-colors-gray-300)` }}>
                    <option value="auto">Auto{autoTerm ? ` (${autoTerm})` : ''}</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="summer">Summer</option>
                    <option value="all">All</option>
                    <option value="sem">Sem</option>
                  </select>
                </HStack>

                <HStack spacing={2}>
                  <Text fontSize="xs" color={subtle}>
                    Realtime
                  </Text>
                  <Button
                    size="xs"
                    variant={rtEnabled ? 'solid' : 'outline'}
                    colorScheme={rtEnabled ? 'green' : 'gray'}
                    onClick={() => setRtEnabled((v) => !v)}
                  >
                    {rtEnabled ? 'On' : 'Off'}
                  </Button>
                  <select
                    value={rtMs}
                    onChange={(e) => setRtMs(Number(e.target.value) || 60000)}
                    style={{
                      fontSize: '12px',
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: '1px solid var(--chakra-colors-gray-300)'
                    }}
                    disabled={!rtEnabled}
                  >
                    <option value={30000}>30s</option>
                    <option value={60000}>1m</option>
                    <option value={90000}>1.5m</option>
                    <option value={180000}>3m</option>
                    <option value={300000}>5m</option>
                  </select>
                </HStack>

                <Button leftIcon={<FiDownload />} onClick={onDownloadXlsx} colorScheme="blue" variant="outline" size="sm">
                  Download XLSX
                </Button>
                <Button leftIcon={<FiDownload />} onClick={onDownloadXlsxV2} colorScheme="teal" variant="outline" size="sm">
                  Download XLSX V2
                </Button>
                <Button as={RouterLink} to="/share/room-attendance" target="_blank" leftIcon={<FiShare2 />} colorScheme="brand" variant="solid" size="sm">
                  Share
                </Button>
              </>
            )}

            {!isPublic &&
              (!authUser ? (
                <Button size="sm" onClick={loginModal.onOpen}>
                  Login
                </Button>
              ) : (
                <Menu>
                  <MenuButton as={Button} variant="ghost" size="sm" px={2}>
                    <HStack spacing={2}>
                      <Avatar size="xs" name={authUser.username || authUser.email} src={authUser.avatar || undefined} />
                      <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>
                        {authUser.username || authUser.email}
                      </Text>
                    </HStack>
                  </MenuButton>
                  <MenuList>
                    <MenuItem icon={<FiUser />} onClick={profileModal.onOpen}>
                      Profile
                    </MenuItem>
                    <MenuItem icon={<FiKey />} onClick={changePwdModal.onOpen}>
                      Change Password
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<FiLogOut />} onClick={onLogout}>
                      Logout
                    </MenuItem>
                  </MenuList>
                </Menu>
              ))}
          </HStack>
        </HStack>
      </Box>

      <Box px={{ base: 2, md: 6 }} py={6} maxW="100%" mx="auto">
        <Box mb={4} overflowX="auto">
          <HStack spacing={2} minW="max-content">
            {slots.map((s, i) => (
              <Button key={`slot-${i}`} size="xs" variant={i === slotIndex ? 'solid' : 'outline'} colorScheme={i === slotIndex ? 'blue' : 'gray'} onClick={() => setSlotIndex(i)}>
                {s.label}
              </Button>
            ))}
          </HStack>
        </Box>

        <Box borderWidth="1px" borderColor={border} rounded="lg" bg={panel} p={4} mb={6}>
          <HStack justify="space-between" align="center" mb={3} flexWrap="wrap" spacing={3}>
            <HStack>
              <Icon as={FiClock} color={accent} />
              <Text fontWeight="700">Summary for {slots[slotIndex]?.label}</Text>
            </HStack>
            <Text fontSize="xs" color={subtle}>
              Auto-refresh {rtEnabled ? 'enabled' : 'disabled'} - {formatDayLabel(new Date(selectedDate))}
            </Text>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            <Box borderWidth="1px" borderColor={border} rounded="md" p={3}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="700">
                  Present
                </Text>
                <Badge colorScheme="green" rounded="full">
                  {slotSummary.present.length}
                </Badge>
              </HStack>
              <Wrap spacing={2}>
                {slotSummary.present.length === 0 ? (
                  <Text fontSize="xs" color={subtle}>
                    No entries
                  </Text>
                ) : (
                  slotSummary.present.map((name, idx) => (
                    <WrapItem key={`p-${idx}`}>
                      <Tag size="sm" colorScheme="green" variant="subtle">
                        <TagLabel>{name}</TagLabel>
                      </Tag>
                    </WrapItem>
                  ))
                )}
              </Wrap>
            </Box>

            <Box borderWidth="1px" borderColor={border} rounded="md" p={3}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="700">
                  Absent
                </Text>
                <Badge colorScheme="red" rounded="full">
                  {slotSummary.absent.length}
                </Badge>
              </HStack>
              <Wrap spacing={2}>
                {slotSummary.absent.length === 0 ? (
                  <Text fontSize="xs" color={subtle}>
                    No entries
                  </Text>
                ) : (
                  slotSummary.absent.map((name, idx) => (
                    <WrapItem key={`a-${idx}`}>
                      <Tag size="sm" colorScheme="red" variant="subtle">
                        <TagLabel>{name}</TagLabel>
                      </Tag>
                    </WrapItem>
                  ))
                )}
              </Wrap>
            </Box>

            <Box borderWidth="1px" borderColor={border} rounded="md" p={3}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="700">
                  Late
                </Text>
                <Badge colorScheme="orange" rounded="full">
                  {slotSummary.late.length}
                </Badge>
              </HStack>
              <Wrap spacing={2}>
                {slotSummary.late.length === 0 ? (
                  <Text fontSize="xs" color={subtle}>
                    No entries
                  </Text>
                ) : (
                  slotSummary.late.map((name, idx) => (
                    <WrapItem key={`l-${idx}`}>
                      <Tag size="sm" colorScheme="orange" variant="subtle">
                        <TagLabel>{name}</TagLabel>
                      </Tag>
                    </WrapItem>
                  ))
                )}
              </Wrap>
            </Box>

            <Box borderWidth="1px" borderColor={border} rounded="md" p={3}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="700">
                  Excused
                </Text>
                <Badge colorScheme="blue" rounded="full">
                  {slotSummary.excused.length}
                </Badge>
              </HStack>
              <Wrap spacing={2}>
                {slotSummary.excused.length === 0 ? (
                  <Text fontSize="xs" color={subtle}>
                    No entries
                  </Text>
                ) : (
                  slotSummary.excused.map((name, idx) => (
                    <WrapItem key={`e-${idx}`}>
                      <Tag size="sm" colorScheme="blue" variant="subtle">
                        <TagLabel>{name}</TagLabel>
                      </Tag>
                    </WrapItem>
                  ))
                )}
              </Wrap>
            </Box>
          </SimpleGrid>
        </Box>

        {isMobile ? (
          <VStack align="stretch" spacing={4}>
            {rooms.map((r, idx) => (
              <Box key={`m-${r}-${idx}`} borderWidth="1px" borderColor={border} rounded="lg" p={3}>
                <HStack mb={2} spacing={3}>
                  <Box w="8px" h="8px" rounded="full" bg={dotBg}></Box>
                  <Text fontWeight="700">{r}</Text>
                </HStack>

                {sessions.map((sess) => {
                  const map = matrix.matrix[sess]?.get(r) || new Map();
                  const arr = Array.from(map.keys()).sort();

                  return (
                    <Box key={`m-${r}-${sess}`} mb={2}>
                      <Text fontSize="xs" color={subtle} mb={1}>
                        {sess}
                      </Text>

                      {arr.length === 0 ? (
                        <Text fontSize="xs" color={subtle}></Text>
                      ) : (
                        <Wrap spacing={2}>
                          {arr.map((b) => {
                            const candidates = (filteredSchedules || []).filter((c) => {
                              const blk = c.section || c.blockCode || c.block_code;
                              if (String(blk) !== String(b)) return false;
                              const daysArr = Array.isArray(c.f2fDays)
                                ? c.f2fDays
                                : String(c.f2fSched || c.f2fsched || c.day)
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                              const termOk = termMatches(c.term);
                              return termOk && daysArr.includes(selectedDayCode) && withinSlot(c, slots[slotIndex]);
                            });

                            const chosenSchedule = candidates.find((c) => bySched[c.id]);
                            const statusVal = String(chosenSchedule ? bySched[chosenSchedule.id] : '').toLowerCase();
                            const primarySchedule = chosenSchedule || candidates[0];
                            const scheduleId = primarySchedule?.id;

                            const statusInfo = canViewAttendance ? statusMeta(statusVal) : null;
                            const borderColor =
                              !canViewAttendance || !statusVal
                                ? undefined
                                : statusVal === 'present'
                                ? 'green.400'
                                : statusVal === 'absent'
                                ? 'red.400'
                                : statusVal === 'late'
                                ? 'orange.400'
                                : statusVal === 'excused'
                                ? 'blue.400'
                                : undefined;

                            const anim = canViewAttendance && statusVal === 'present' ? `${presentPulse} 1.8s ease-out infinite` : undefined;
                            const canClick = !!scheduleId && canManageAttendance;

                            const tagSx = {
                              ...(anim ? { animation: anim } : {}),
                              ...(canClick
                                ? {
                                    cursor: 'pointer',
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': { transform: 'translateY(-1px)', boxShadow: 'sm' }
                                  }
                                : {})
                            };

                            const hasCand = candidates.length > 0;
                            const fac = hasCand ? (candidates[0].faculty || candidates[0].instructor || '') || '' : '';
                            const codeVal = hasCand ? candidates[0].code || candidates[0].courseName || '' : '';

                            return (
                              <WrapItem key={`m-${r}-${sess}-${b}`}>
                                <VStack spacing={1} align="start">
                                  <Tag
                                    variant="subtle"
                                    colorScheme={schemeForBlockCode(b)}
                                    rounded="full"
                                    px={4}
                                    py={1.5}
                                    display="inline-block"
                                    maxW="100%"
                                    style={{
                                      fontSize: '12px',
                                      lineHeight: 1.2,
                                      whiteSpace: 'normal',
                                      overflowWrap: 'anywhere',
                                      wordBreak: 'break-word'
                                    }}
                                    borderWidth={borderColor ? '2px' : undefined}
                                    borderColor={borderColor}
                                    sx={Object.keys(tagSx).length ? tagSx : undefined}
                                    onClick={canClick ? () => openAttendanceModal(scheduleId, statusVal) : undefined}
                                    onKeyDown={
                                      canClick
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              openAttendanceModal(scheduleId, statusVal);
                                            }
                                          }
                                        : undefined
                                    }
                                    role={canClick ? 'button' : undefined}
                                    tabIndex={canClick ? 0 : undefined}
                                  >
                                    <HStack spacing={1}>
                                      <TagLabel
                                        display="block"
                                        style={{
                                          whiteSpace: 'normal',
                                          overflowWrap: 'anywhere',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {b}
                                      </TagLabel>
                                      {statusInfo ? <Icon as={statusInfo.icon} color={statusInfo.color} boxSize="12px" /> : null}
                                    </HStack>
                                  </Tag>
                                  <Text fontSize="10px" color={subtle}>
                                    {hasCand ? `${fac}${codeVal ? ' · ' + codeVal : ''}` : 'No teacher available'}
                                  </Text>
                                </VStack>
                              </WrapItem>
                            );
                          })}
                        </Wrap>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </VStack>
        ) : (
          <VStack align="stretch" spacing={6}>
            {roomParts.map((roomsSlice, partIdx) => (
              <Box key={`part-${partIdx}`} borderWidth="1px" borderColor={border} rounded="lg" p={0} overflowX="auto">
                <Box as="table" w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <Box as="thead" position="sticky" top={0} zIndex={1} bg={headerBg}>
                    <Box as="tr">
                      <Box as="th" textAlign="left" p="10px 12px" borderBottomWidth="1px" borderColor={border} position="sticky" left={0} zIndex={2} bg={stickyBg}>
                        Session
                      </Box>
                      {roomsSlice.map((r, idx) => (
                        <Box as="th" key={`${r}-${idx}`} textAlign="left" p="10px 12px" borderBottomWidth="1px" borderColor={border}>
                          <HStack spacing={3}>
                            <Box w="8px" h="8px" rounded="full" bg={dotBg}></Box>
                            <Text fontWeight="600" noOfLines={1}>
                              {r}
                            </Text>
                          </HStack>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Box as="tbody">
                    {sessions.map((sess) => (
                      <Box as="tr" key={`${selectedDayCode}-${sess}-${partIdx}`}>
                        <Box as="td" position="sticky" left={0} zIndex={1} bg={stickyBg} p="10px 12px" borderTopWidth="1px" borderColor={border} fontWeight="700">
                          {sess}
                        </Box>

                        {roomsSlice.length === 0 && (
                          <Box as="td" p="10px 12px" borderTopWidth="1px" borderColor={border} colSpan={999}>
                            <Text fontSize="xs" color={subtle}></Text>
                          </Box>
                        )}

                        {roomsSlice.map((r, cIdx) => {
                          const map = matrix.matrix[sess]?.get(r) || new Map();
                          const arr = Array.from(map.keys()).sort();

                          return (
                            <Box as="td" key={`${sess}-${r}-${partIdx}`} p="8px 10px" borderTopWidth="1px" borderLeftWidth={cIdx === 0 ? '1px' : '1px'} borderColor={border}>
                              {arr.length === 0 ? (
                                <Text fontSize="xs" color={subtle}></Text>
                              ) : (
                                <HStack spacing={2} wrap="wrap" align="start">
                                  {arr.map((b) => {
                                    const candidates = (filteredSchedules || []).filter((c) => {
                                      const blk = c.section || c.blockCode || c.block_code;
                                      if (String(blk) !== String(b)) return false;
                                      const daysArr = Array.isArray(c.f2fDays)
                                        ? c.f2fDays
                                        : String(c.f2fSched || c.f2fsched || c.day)
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean);
                                      const termOk = termMatches(c.term);
                                      return termOk && daysArr.includes(selectedDayCode) && withinSlot(c, slots[slotIndex]);
                                    });

                                    const chosenSchedule = candidates.find((c) => bySched[c.id]);
                                    const statusVal = String(chosenSchedule ? bySched[chosenSchedule.id] : '').toLowerCase();
                                    const primarySchedule = chosenSchedule || candidates[0];
                                    const scheduleId = primarySchedule?.id;

                                    const statusInfo = canViewAttendance ? statusMeta(statusVal) : null;
                                    const borderColor =
                                      !canViewAttendance || !statusVal
                                        ? undefined
                                        : statusVal === 'present'
                                        ? 'green.400'
                                        : statusVal === 'absent'
                                        ? 'red.400'
                                        : statusVal === 'late'
                                        ? 'orange.400'
                                        : statusVal === 'excused'
                                        ? 'blue.400'
                                        : undefined;

                                    const anim = canViewAttendance && statusVal === 'present' ? `${presentPulse} 1.8s ease-out infinite` : undefined;
                                    const canClick = !!scheduleId && canManageAttendance;

                                    const tagSx = {
                                      ...(anim ? { animation: anim } : {}),
                                      ...(canClick
                                        ? {
                                            cursor: 'pointer',
                                            transition: 'transform 120ms ease, box-shadow 120ms ease',
                                            '&:hover': { transform: 'translateY(-1px)', boxShadow: 'sm' }
                                          }
                                        : {})
                                    };

                                    if (candidates.length === 0) {
                                      return (
                                        <VStack key={`${sess}-${r}-${b}-${partIdx}`} spacing={1} align="start">
                                          <Tag
                                            variant="subtle"
                                            colorScheme={schemeForBlockCode(b)}
                                            rounded="full"
                                            px={6}
                                            py={2}
                                            display="inline-block"
                                            maxW="100%"
                                            style={{
                                              fontSize: '12px',
                                              lineHeight: 1.2,
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                              wordBreak: 'break-word'
                                            }}
                                          >
                                            <TagLabel
                                              display="block"
                                              style={{
                                                whiteSpace: 'normal',
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word'
                                              }}
                                            >
                                              {b}
                                            </TagLabel>
                                          </Tag>
                                          <Text fontSize="10px" color={subtle}>
                                            No teacher available
                                          </Text>
                                        </VStack>
                                      );
                                    }

                                    const fac = (candidates[0].faculty || candidates[0].instructor || '') || '';
                                    const codeVal = (candidates[0].code || candidates[0].courseName || '') || '';

                                    return (
                                      <VStack key={`${sess}-${r}-${b}-${partIdx}`} spacing={1} align="start">
                                        <Tag
                                          variant="subtle"
                                          colorScheme={schemeForBlockCode(b)}
                                          rounded="full"
                                          px={6}
                                          py={2}
                                          display="inline-block"
                                          maxW="100%"
                                          style={{
                                            fontSize: '12px',
                                            lineHeight: 1.2,
                                            whiteSpace: 'normal',
                                            overflowWrap: 'anywhere',
                                            wordBreak: 'break-word'
                                          }}
                                          borderWidth={borderColor ? '2px' : undefined}
                                          borderColor={borderColor}
                                          sx={Object.keys(tagSx).length ? tagSx : undefined}
                                          onClick={canClick ? () => openAttendanceModal(scheduleId, statusVal) : undefined}
                                          onKeyDown={
                                            canClick
                                              ? (e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    openAttendanceModal(scheduleId, statusVal);
                                                  }
                                                }
                                              : undefined
                                          }
                                          role={canClick ? 'button' : undefined}
                                          tabIndex={canClick ? 0 : undefined}
                                        >
                                          <HStack spacing={1}>
                                            <TagLabel
                                              display="block"
                                              style={{
                                                whiteSpace: 'normal',
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word'
                                              }}
                                            >
                                              {b}
                                            </TagLabel>
                                            {statusInfo ? <Icon as={statusInfo.icon} color={statusInfo.color} boxSize="12px" /> : null}
                                          </HStack>
                                        </Tag>
                                        <Text fontSize="10px" color={subtle}>{`${fac}${codeVal ? ' · ' + codeVal : ''}`}</Text>
                                      </VStack>
                                    );
                                  })}
                                </HStack>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      <Box as="footer" borderTopWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={6} bg={footerBg}>
        <VStack spacing={1} align="center">
          <Text fontSize="sm" fontWeight="700">
            Kolehiyo ng Pantukan
          </Text>
          <Text fontSize="xs" color={subtle}>
            Room attendance view for current day.
          </Text>
        </VStack>
      </Box>

      <LoginModal isOpen={loginModal.isOpen} onClose={loginModal.onClose} onSubmit={onLoginSubmit} />

      <AttendanceFormModal
        isOpen={attendModal.isOpen}
        onClose={() => {
          attendModal.onClose();
          setAttendanceInitial(null);
        }}
        initial={attendanceInitial}
        lockSchedule
        allowDelete={canManageAttendance}
        onSaved={() => {
          toast({ title: 'Attendance saved', status: 'success' });
          loadAttendance();
          attendModal.onClose();
          setAttendanceInitial(null);
        }}
        onDeleted={() => {
          toast({ title: 'Attendance deleted', status: 'success' });
          loadAttendance();
          attendModal.onClose();
          setAttendanceInitial(null);
        }}
      />

      <ChangePasswordModal
        isOpen={changePwdModal.isOpen}
        onClose={changePwdModal.onClose}
        onSubmit={async (p) => {
          try {
            await dispatch(changePasswordThunk(p)).unwrap();
            toast({ title: 'Password changed', status: 'success' });
            changePwdModal.onClose();
          } catch (e) {
            toast({
              title: 'Failed',
              description: e?.message || 'Unable to change password',
              status: 'error'
            });
          }
        }}
      />

      <ProfileModal
        isOpen={profileModal.isOpen}
        onClose={profileModal.onClose}
        user={authUser}
        onSubmit={async (p) => {
          try {
            await dispatch(updateProfileThunk(p)).unwrap();
            toast({ title: 'Profile updated', status: 'success' });
            profileModal.onClose();
          } catch (e) {
            toast({
              title: 'Failed',
              description: e?.message || 'Unable to update profile',
              status: 'error'
            });
          }
        }}
      />
    </Box>
  );
}
