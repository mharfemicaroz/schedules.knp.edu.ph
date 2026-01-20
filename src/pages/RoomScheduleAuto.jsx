import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { selectSettings } from '../store/settingsSlice';
import { Box, VStack, HStack, Heading, Text, Badge, useColorModeValue, SimpleGrid, Button, Icon, Divider, Avatar, useDisclosure, useToast, Menu, MenuButton, MenuList, MenuItem, MenuDivider, IconButton, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody, Input, InputGroup, InputLeftElement } from '@chakra-ui/react';
import { FiClock, FiBookOpen, FiUser, FiTag, FiPrinter, FiCalendar, FiKey, FiLogOut, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { buildTable, printContent } from '../utils/printDesign';
import apiService from '../services/apiService';
import LoginModal from '../components/LoginModal';
import AttendanceFormModal from '../components/AttendanceFormModal';
import { loginThunk, logoutThunk, changePasswordThunk, updateProfileThunk } from '../store/authThunks';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ProfileModal from '../components/ProfileModal';

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const todayTag = () => {
  try { return DOW[new Date().getDay()] || 'Mon'; } catch { return 'Mon'; }
};

function normRoom(s){ return String(s||'').trim().replace(/\s+/g,' ').toUpperCase(); }

function termLabelOf(s) {
  const t = String(s || '').toLowerCase();
  if (/1(st)?|first/.test(t)) return '1st';
  if (/2(nd)?|second/.test(t)) return '2nd';
  if (/sem/.test(t)) return 'Sem';
  return t ? s : 'Other';
}

function sessionOfRecord(rec) {
  // Prefer explicit session if present
  const raw = String(rec.session || '').trim().toUpperCase();
  if (raw === 'AM' || raw === 'PM') return raw;
  if (raw === 'EVE' || raw === 'EVENING') return 'Evening';
  let s = rec.timeStartMinutes, e = rec.timeEndMinutes;
  const tStr = String(rec.scheduleKey || rec.schedule || rec.time || '').trim();
  if (!Number.isFinite(s) || !Number.isFinite(e)) {
    const tt = parseTimeBlockToMinutes(tStr);
    s = tt.start; e = tt.end;
  }
  if (Number.isFinite(s) && Number.isFinite(e)) {
    const mid = (s + e) / 2;
    if (mid >= 17*60) return 'Evening';
    if (mid >= 13*60) return 'PM';
    return 'AM';
  }
  return 'AM';
}

const normalizeSem = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('1')) return '1st';
  if (v.startsWith('2')) return '2nd';
  if (v.startsWith('s')) return 'Sem';
  if (/first/.test(v)) return '1st';
  if (/second/.test(v)) return '2nd';
  if (/sem/.test(v)) return 'Sem';
  return '';
};

export default function RoomScheduleAuto() {
  const { room: roomParam } = useParams();
  const room = decodeURIComponent(roomParam || '');
  const navigate = useNavigate();
  const all = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const authUser = useSelector(s => s.auth.user);
  const settings = useSelector(selectSettings);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const canAttend = !!authUser && (roleStr === 'admin' || roleStr === 'manager' || roleStr === 'checker');
  const dispatch = useDispatch();
  const loginModal = useDisclosure();
  const attendModal = useDisclosure();
  const changePwdModal = useDisclosure();
  const profileModal = useDisclosure();
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const toast = useToast();
  const border = useColorModeValue('gray.200','gray.700');
  const panel = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const accent = useColorModeValue('blue.600','blue.300');

  const day = todayTag();
  // Attendance map for today (scheduleId -> { status, date })
  const [attMap, setAttMap] = useState({});
  const loadTodayAttendance = React.useCallback(async () => {
    if (!canAttend) { setAttMap({}); return; }
    try {
      const today = new Date().toISOString().slice(0,10);
      const list = await apiService.listAttendance({ startDate: today, endDate: today, limit: 10000 });
      const arr = Array.isArray(list) ? list : (list?.data || []);
      const m = {};
      for (const r of arr) {
        const sid = Number(r.scheduleId || r.schedule_id);
        if (sid) m[sid] = { status: String(r.status || '').toLowerCase(), date: r.date };
      }
      setAttMap(m);
    } catch {
      setAttMap({});
    }
  }, [canAttend]);

  const nowMinutes = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
  const [nowMin, setNowMin] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30000); // update every 30s
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadTodayAttendance(); }, [loadTodayAttendance, room, day]);

  const statusColor = (s) => {
    const v = String(s || '').toLowerCase();
    if (v === 'present') return 'green';
    if (v === 'absent') return 'red';
    if (v === 'late') return 'orange';
    if (v === 'excused') return 'blue';
    return 'gray';
  };

  // Helpers to map days to rooms for schedules with multiple rooms/days
  const tokens = React.useCallback((s) => String(s || '').split(',').map(t => t.trim()).filter(Boolean), []);
  const getRoomsForDay = React.useCallback((rec, d) => {
    try {
      const daysArr = Array.isArray(rec.f2fDays) && rec.f2fDays.length ? rec.f2fDays : tokens(rec.f2fSched || rec.f2fsched || rec.day);
      const roomsArr = tokens(rec.room);
      if (roomsArr.length > 1 && daysArr.length > 1) {
        const out = [];
        const len = Math.min(roomsArr.length, daysArr.length);
        for (let i = 0; i < len; i++) { if (String(daysArr[i]) === String(d)) out.push(roomsArr[i]); }
        return out;
      }
      // Fallback: if day is included and no 1:1 mapping, keep all listed rooms
      return daysArr.includes(d) ? (roomsArr.length ? roomsArr : [rec.room].filter(Boolean)) : [];
    } catch { return []; }
  }, [tokens]);

  const prefSy = useMemo(() => {
    return String(settings?.schedulesView?.school_year || '').trim();
  }, [settings]);

  const prefSem = useMemo(() => {
    const raw = settings?.schedulesView?.semester || '';
    return normalizeSem(raw);
  }, [settings]);

  const resolvedCalendar = useMemo(() => {
    if (!acadData) return null;
    if (acadData?.school_year && !acadData.academic_calendar) return acadData;
    const list = Array.isArray(acadData) ? acadData : (acadData?.academic_calendar ? [acadData] : []);
    if (!list.length) return null;
    if (prefSy) {
      const hit = list.find((item) => String(item?.academic_calendar?.school_year || '').trim() === prefSy);
      if (hit?.academic_calendar) return hit.academic_calendar;
    }
    return list[0]?.academic_calendar || null;
  }, [acadData, prefSy]);

  const autoTerm = useMemo(() => {
    try {
      const cal = resolvedCalendar;
      if (!cal) return null;
      const base = new Date(); base.setHours(0,0,0,0);
      const parseDateVal = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };
      const expandDateRange = (token) => {
        const m = String(token || '').match(/^([A-Za-z]+)\s+(\d+)-(\d+),\s*(\d{4})$/);
        if (!m) return [];
        const month = m[1]; const startD = parseInt(m[2], 10); const endD = parseInt(m[3], 10); const year = parseInt(m[4], 10);
        const out = [];
        for (let d = startD; d <= endD; d++) {
          const dt = new Date(`${month} ${d}, ${year}`);
          if (!isNaN(dt.getTime())) out.push(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
        }
        return out;
      };
      const endFromActivities = (acts = []) => {
        let max = null;
        acts.forEach(a => {
          if (a.date_range) {
            expandDateRange(a.date_range).forEach(dt => { if (!max || dt > max) max = dt; });
          }
          const dates = Array.isArray(a.date) ? a.date : [a.date].filter(Boolean);
          dates.forEach(v => {
            const dt = parseDateVal(v);
            if (dt && (!max || dt > max)) max = dt;
          });
        });
        return max;
      };
      const semKey = prefSem === '2nd' ? 'second_semester' : prefSem === '1st' ? 'first_semester' : null;
      const semData = semKey ? cal?.[semKey] : (cal?.first_semester || cal?.second_semester);
      if (!semData) return null;
      const terms = [
        { key: '1st', data: semData.first_term || {} },
        { key: '2nd', data: semData.second_term || {} },
      ];
      const windows = terms.map(t => {
        const start = parseDateVal(t.data.start) || (t.data.date_range ? expandDateRange(t.data.date_range)[0] : null);
        let end = parseDateVal(t.data.end) || (t.data.date_range ? expandDateRange(t.data.date_range).pop() : null);
        const actEnd = endFromActivities(t.data.activities);
        if (!end || (actEnd && actEnd > end)) end = actEnd;
        return { key: t.key, start, end };
      }).filter(w => w.start && w.end);
      if (!windows.length) return null;
      const hit = windows.find(w => w.start <= base && base <= w.end);
      if (hit) return hit.key;
      const sorted = windows.slice().sort((a,b)=>a.start - b.start);
      if (base < sorted[0].start) return sorted[0].key;
      return sorted[sorted.length - 1].key;
    } catch { return null; }
  }, [resolvedCalendar, prefSem]);

  const termMatches = React.useCallback((t) => {
    const norm = normalizeSem(t);
    if (!norm) return true;
    if (norm === 'Sem') return false;
    if (autoTerm) return norm === autoTerm;
    return true;
  }, [autoTerm]);

  const filteredSchedules = useMemo(() => {
    return (all || []).filter(c => {
      const syVal = String(c.school_year || c.schoolYear || c.schoolyear || c.sy || '').trim();
      if (prefSy && syVal && syVal !== prefSy) return false;
      const semVal = normalizeSem(c.semester || c.sem);
      if (semVal === 'Sem') return false;
      if (prefSem && semVal && semVal !== prefSem) return false;
      return true;
    });
  }, [all, prefSy, prefSem]);

  const rows = useMemo(() => {
    const key = normRoom(room);
    const list = (filteredSchedules || []).filter(c => {
      const roomsForToday = getRoomsForDay(c, day);
      if (!roomsForToday || roomsForToday.length === 0) return false;
      return roomsForToday.some(r => normRoom(r) === key);
    });
    const withStart = (r) => (Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : 1e9);
    list.sort((a,b)=> withStart(a) - withStart(b));
    // Deduplicate by schedule id to avoid double-rendering the same schedule
    const seen = new Set();
    const uniq = [];
    for (const it of list) {
      const k = String(it.id);
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(it);
    }
    return uniq;
  }, [filteredSchedules, room, day, getRoomsForDay]);

  // Filter rows to the active term based on academic calendar
  const rowsTerm = useMemo(() => {
    return rows.filter(r => termMatches(r.term));
  }, [rows, termMatches]);

  const byTerm = useMemo(() => {
    const m = new Map();
    rowsTerm.forEach(r => { const k = termLabelOf(r.term); const a = m.get(k) || []; a.push(r); m.set(k, a); });
    const keys = Array.from(m.keys());
    // Build ordered list: 1st, 2nd, Sem, others
    const order = [];
    if (m.has('1st')) order.push('1st');
    if (m.has('2nd')) order.push('2nd');
    if (m.has('Sem')) order.push('Sem');
    keys.forEach(k => { if (!order.includes(k)) order.push(k); });
    // If current term is known and not Sem, prefer that first but still keep Sem afterwards
    const finalOrder = (() => {
      if (!autoTerm || autoTerm === 'Sem') return order;
      const o = order.filter(k => k === autoTerm || k === 'Sem');
      keys.forEach(k => { if (!o.includes(k)) o.push(k); });
      return o;
    })();
    return { order: finalOrder, map: m };
  }, [rowsTerm, autoTerm]);

  const bucketTime = (start) => {
    if (!Number.isFinite(start)) return null;
    if (start < 8 * 60) return null; // before 8AM ignore
    if (start < 12 * 60) return 'AM';
    if (start < 17 * 60) return 'PM';
    return 'Evening';
  };

  const getInterval = (rec) => {
    let s = rec.timeStartMinutes, e = rec.timeEndMinutes;
    const tStr = String(rec.scheduleKey || rec.schedule || rec.time || '').trim();
    if (!Number.isFinite(s) || !Number.isFinite(e)) { const tt = parseTimeBlockToMinutes(tStr); s = tt.start; e = tt.end; }
    return [s, e];
  };
  const isNow = (rec) => {
    const [s, e] = getInterval(rec);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
    const bucket = bucketTime(s);
    // Require overlap with current time AND valid bucket session
    return bucket !== null && s <= nowMin && nowMin < e;
  };
  const nowList = useMemo(() => {
    const filtered = rowsTerm.filter(r => termLabelOf(r.term) !== 'Sem' && isNow(r));
    const seen = new Set();
    const out = [];
    for (const it of filtered) {
      const k = String(it.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [rowsTerm, nowMin]);
  const nowIds = useMemo(() => new Set(nowList.map(r => String(r.id))), [nowList]);

  function onPrint() {
    const headers = ['Time','Program','Code','Title','Section','Units','Faculty'];
    const data = rowsTerm.map(c => [
      c.schedule || '-', c.program || '-', c.code, c.title, c.section, String(c.unit ?? c.hours ?? ''), c.facultyName
    ]);
    const table = buildTable(headers, data);
    const subtitle = `Room: ${room} – ${day}`;
    printContent({ title: 'Room Schedule (Today)', subtitle, bodyHtml: table });
  }

  async function onLoginSubmit({ username, password }) {
    try {
      await dispatch(loginThunk({ identifier: username, password })).unwrap();
      loginModal.onClose();
    } catch (e) {
      toast({ title: 'Login failed', description: e?.message || 'Invalid credentials', status: 'error' });
    }
  }

  function onLogout() {
    dispatch(logoutThunk());
  }

  // Determine if a schedule has an assigned/valid teacher
  const hasTeacher = React.useCallback((rec) => {
    const name = String(rec.faculty || rec.instructor || rec.facultyName || '').trim();
    const fid = rec.facultyId ?? rec.faculty_id;
    // If we have a clear ID, accept
    if (Number(fid) > 0) return true;
    // Else accept non-empty human-readable name that isn't a placeholder
    if (!name) return false;
    const n = name.toLowerCase();
    if (/(unknown|unassigned|none|no\s*faculty|not\s*assigned)/i.test(n)) return false;
    if (/^n\/?a$/.test(n)) return false;
    if (/^t\.?b\.?a\.?$/.test(n) || n === 'tba') return false;
    if (n === '-' || n === '--') return false;
    return true;
  }, []);

  // Build unique room list (display strings), sorted
  const uniqueRooms = useMemo(() => {
    const map = new Map();
    (filteredSchedules || []).forEach(c => {
      if (!termMatches(c.term)) return;
      const roomsForToday = getRoomsForDay(c, day);
      roomsForToday.forEach((r) => {
        const disp = String(r || '').trim(); if (!disp) return;
        const normed = normRoom(disp);
        if (!map.has(normed)) map.set(normed, disp);
      });
    });
    return Array.from(map.values()).sort((a,b)=>String(a).localeCompare(String(b)));
  }, [filteredSchedules, day, getRoomsForDay, termMatches]);
  const currentIndex = useMemo(() => uniqueRooms.findIndex(r => normRoom(r) === normRoom(room)), [uniqueRooms, room]);
  const [roomQuery, setRoomQuery] = useState('');
  const filteredRooms = useMemo(() => {
    const q = String(roomQuery || '').toLowerCase();
    if (!q) return uniqueRooms.slice(0, 100);
    return uniqueRooms.filter(r => r.toLowerCase().includes(q)).slice(0, 100);
  }, [roomQuery, uniqueRooms]);
  const goRoom = (r) => navigate(`/views/rooms/${encodeURIComponent(r)}/auto`);

  return (
    <Box minH="100vh" bg={useColorModeValue('gray.50','gray.900')}>
      {/* Public Header */}
      <Box bg={useColorModeValue('white','gray.800')} borderBottomWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={4}>
        <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
          <VStack align="start" spacing={0}>
            <HStack>
              <Icon as={FiCalendar} color={accent} />
              <Heading size="md">Room Schedule</Heading>
            </HStack>
            <Text fontSize="sm" color={subtle}>Room: <Text as="span" fontWeight="700">{room}</Text> · {day}</Text>
          </VStack>
          <HStack spacing={2}>
            {canAttend && (
              <HStack spacing={1}>
                <IconButton aria-label="Previous room" icon={<FiChevronLeft />} size="sm" variant="ghost" isDisabled={currentIndex <= 0} onClick={() => { if (currentIndex > 0) goRoom(uniqueRooms[currentIndex - 1]); }} />
                <Popover placement="bottom-end">
                  <PopoverTrigger>
                    <Button size="sm" variant="outline" leftIcon={<FiSearch />}>Change Room</Button>
                  </PopoverTrigger>
                  <PopoverContent w="280px">
                    <PopoverArrow />
                    <PopoverCloseButton />
                    <PopoverBody>
                      <VStack align="stretch" spacing={2}>
                        <InputGroup size="sm">
                          <InputLeftElement><FiSearch /></InputLeftElement>
                          <Input placeholder="Search rooms..." value={roomQuery} onChange={(e)=>setRoomQuery(e.target.value)} />
                        </InputGroup>
                        <Box maxH="260px" overflowY="auto" borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="md">
                          {(filteredRooms.length === 0) ? (
                            <Text p={3} fontSize="sm" color={subtle}>No matches</Text>
                          ) : (
                            filteredRooms.map((r) => (
                              <Button key={r} variant="ghost" justifyContent="flex-start" w="full" size="sm" onClick={() => { goRoom(r); }}>
                                {r}
                              </Button>
                            ))
                          )}
                        </Box>
                      </VStack>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
                <IconButton aria-label="Next room" icon={<FiChevronRight />} size="sm" variant="ghost" isDisabled={currentIndex < 0 || currentIndex >= uniqueRooms.length - 1} onClick={() => { if (currentIndex >= 0 && currentIndex < uniqueRooms.length - 1) goRoom(uniqueRooms[currentIndex + 1]); }} />
              </HStack>
            )}
            <Button leftIcon={<FiPrinter />} onClick={onPrint} colorScheme="blue" variant="outline" size="sm">Print</Button>
            {!authUser ? (
              <Button size="sm" onClick={loginModal.onOpen}>Login</Button>
            ) : (
              <Menu>
                <MenuButton as={Button} variant="ghost" size="sm" px={2}>
                  <HStack spacing={2}>
                    <Avatar size="xs" name={authUser.username || authUser.email} src={authUser.avatar || undefined} />
                    <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>{authUser.username || authUser.email}</Text>
                  </HStack>
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FiUser />} onClick={profileModal.onOpen}>Profile</MenuItem>
                  <MenuItem icon={<FiKey />} onClick={changePwdModal.onOpen}>Change Password</MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<FiLogOut />} onClick={onLogout}>Logout</MenuItem>
                </MenuList>
              </Menu>
            )}
          </HStack>
        </HStack>
      </Box>

      {/* Content */}
      <Box px={{ base: 2, md: 6 }} py={6} maxW="100%" mx="auto">
        {/* Now banner */}
        <Box mb={6} p={4} rounded="xl" borderWidth="1px" borderColor={useColorModeValue('green.200','green.600')} bg={useColorModeValue('green.50','green.900')}>
          {nowList.length > 0 ? (
            <VStack align="start" spacing={2}>
              <HStack spacing={3}>
                <Badge colorScheme="green">Now</Badge>
                <Text color={useColorModeValue('green.800','green.200')} fontWeight="700">Currently in this room</Text>
              </HStack>
              <SimpleGrid columns={{ base: 1, md: Math.min(2, nowList.length) }} spacing={3} w="full">
                {nowList.map((c, i) => (
                  <Box key={`now-${c.id}-${i}`} bg={useColorModeValue('white','gray.800')} borderWidth="1px" borderColor={useColorModeValue('green.300','green.700')} rounded="md" p={3}>
                    <VStack align="start" spacing={1}>
                      <HStack spacing={2}>
                        <Badge colorScheme="blue">{c.program || '-'}</Badge>
                        <Badge>{c.code}</Badge>
                        <Badge variant="subtle" colorScheme="gray">{c.section}</Badge>
                      </HStack>
                      <Text fontWeight="700" noOfLines={2}>{c.title}</Text>
                      <HStack spacing={2} color={subtle}>
                        <Icon as={FiClock} />
                        <Text>{c.schedule || '-'}</Text>
                        <Badge colorScheme={(() => { const s = sessionOfRecord(c); return s==='AM'?'yellow':(s==='PM'?'orange':'purple'); })()}>{sessionOfRecord(c)}</Badge>
                      </HStack>
                      <HStack spacing={2}>
                        <Icon as={FiUser} />
                        <Text>{hasTeacher(c) ? (c.faculty || c.instructor || c.facultyName || '-') : 'No teacher available'}</Text>
                      </HStack>
                      {canAttend && hasTeacher(c) && attMap[c.id] && (
                        <HStack spacing={2}>
                          <Badge colorScheme={statusColor(attMap[c.id].status)} textTransform="capitalize">
                            {attMap[c.id].status}
                          </Badge>
                        </HStack>
                      )}
                      {canAttend && hasTeacher(c) && (
                        <Box pt={2} w="full">
                          <Button size="sm" colorScheme="green" onClick={() => { setSelectedScheduleId(c.id); attendModal.onOpen(); }}>Check Attendance</Button>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                ))}
              </SimpleGrid>
            </VStack>
          ) : (
            <HStack spacing={3}>
              <Badge colorScheme="gray">Now</Badge>
              <Text color={subtle}>No ongoing class at this moment.</Text>
            </HStack>
          )}
        </Box>
        {byTerm.order.length === 0 ? (
          <Box textAlign="center" color={subtle}>No classes scheduled today.</Box>
        ) : (
          byTerm.order.map(termKey => {
            const list = byTerm.map.get(termKey) || [];
            return (
              <Box key={termKey} mb={8}>
                <HStack mb={3}>
                  <Badge colorScheme={termKey.startsWith('1st') ? 'green' : termKey.startsWith('2nd') ? 'purple' : 'gray'}>{termKey}</Badge>
                  <Divider />
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={4}>
                  {list.map((c, idx) => (
                    <Box key={`${c.id}-${idx}`} borderWidth="2px" borderColor={nowIds.has(String(c.id)) ? useColorModeValue('green.400','green.300') : border} rounded="lg" bg={panel} p={4} shadow={nowIds.has(String(c.id)) ? 'md' : 'sm'}>
                      <VStack align="start" spacing={2}>
                        <HStack spacing={2} color={accent}>
                          <Icon as={FiClock} />
                          <Text fontWeight="700">{c.schedule || '-'}</Text>
                          {(() => {
                            const s = sessionOfRecord(c);
                            const scheme = s === 'AM' ? 'yellow' : (s === 'PM' ? 'orange' : 'purple');
                            return <Badge colorScheme={scheme}>{s}</Badge>;
                          })()}
                        </HStack>
                        <HStack spacing={2}>
                          <Badge colorScheme="blue">{c.program || '-'}</Badge>
                          <Badge>{c.code}</Badge>
                          <Badge variant="subtle" colorScheme="gray">{c.section}</Badge>
                        </HStack>
                        <HStack spacing={2}>
                          <Icon as={FiBookOpen} />
                          <Text noOfLines={2}>{c.title}</Text>
                        </HStack>
                        <HStack spacing={2}>
                          <Icon as={FiUser} />
                          <Text>{hasTeacher(c) ? (c.faculty || c.instructor || c.facultyName || '-') : 'No teacher available'}</Text>
                        </HStack>
                        {canAttend && hasTeacher(c) && attMap[c.id] && (
                          <HStack spacing={2}>
                            <Badge colorScheme={statusColor(attMap[c.id].status)} textTransform="capitalize">
                              {attMap[c.id].status}
                            </Badge>
                          </HStack>
                        )}
                        <HStack spacing={2} fontSize="sm" color={subtle}>
                          <Icon as={FiTag} />
                          <Text>Units: {String(c.unit ?? c.hours ?? '-')}</Text>
                        </HStack>
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            );
          })
        )}
      </Box>

      {/* Public Footer */}
      <Box as="footer" borderTopWidth="1px" borderColor={border} px={{ base: 4, md: 8 }} py={6} bg={useColorModeValue('white','gray.800')}>
        <VStack spacing={1} align="center">
          <Text fontSize="sm" fontWeight="700">Kolehiyo ng Pantukan</Text>
          <Text fontSize="xs" color={subtle}>Room schedules auto‑filtered to today&apos;s day.</Text>
        </VStack>
    </Box>

      {/* Modals */}
      <LoginModal isOpen={loginModal.isOpen} onClose={loginModal.onClose} onSubmit={onLoginSubmit} />
      <AttendanceFormModal
        isOpen={attendModal.isOpen}
        onClose={() => { attendModal.onClose(); setSelectedScheduleId(null); }}
        initial={{ scheduleId: selectedScheduleId }}
        lockSchedule
        onSaved={() => { toast({ title: 'Attendance saved', status: 'success' }); loadTodayAttendance(); attendModal.onClose(); setSelectedScheduleId(null); }}
      />
      <ChangePasswordModal
        isOpen={changePwdModal.isOpen}
        onClose={changePwdModal.onClose}
        onSubmit={async (p) => {
          try { await dispatch(changePasswordThunk(p)).unwrap(); toast({ title: 'Password changed', status: 'success' }); changePwdModal.onClose(); } catch (e) { toast({ title: 'Failed', description: e?.message || 'Unable to change password', status: 'error' }); }
        }}
      />
      <ProfileModal
        isOpen={profileModal.isOpen}
        onClose={profileModal.onClose}
        user={authUser}
        onSubmit={async (p) => {
          try { await dispatch(updateProfileThunk(p)).unwrap(); toast({ title: 'Profile updated', status: 'success' }); profileModal.onClose(); } catch (e) { toast({ title: 'Failed', description: e?.message || 'Unable to update profile', status: 'error' }); }
        }}
      />
    </Box>
  );
}
