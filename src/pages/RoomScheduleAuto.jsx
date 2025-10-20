import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { Box, VStack, HStack, Heading, Text, Badge, useColorModeValue, SimpleGrid, Button, Icon, Divider, Avatar, useDisclosure, useToast, Menu, MenuButton, MenuList, MenuItem, MenuDivider } from '@chakra-ui/react';
import { FiClock, FiBookOpen, FiUser, FiTag, FiPrinter, FiCalendar, FiKey, FiLogOut } from 'react-icons/fi';
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
  if (/1(st)?|first/.test(t)) return '1st Term';
  if (/2(nd)?|second/.test(t)) return '2nd Term';
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

export default function RoomScheduleAuto() {
  const { room: roomParam } = useParams();
  const room = decodeURIComponent(roomParam || '');
  const all = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const authUser = useSelector(s => s.auth.user);
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

  const rows = useMemo(() => {
    const key = normRoom(room);
    const list = (all || []).filter(c => (c.roomKey || normRoom(c.room)) === key);
    // Filter to today by F2F days when available, otherwise by simple day field
    const sameDay = list.filter(c => {
      const days = Array.isArray(c.f2fDays) ? c.f2fDays : [];
      if (days.length) return days.includes(day);
      return String(c.day||'').trim() === day;
    });
    const withStart = (r) => (Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : 1e9);
    sameDay.sort((a,b)=> withStart(a) - withStart(b));
    return sameDay;
  }, [all, room, day]);

  // Determine current term from academic calendar
  const currentTermKey = useMemo(() => {
    try {
      const cal = Array.isArray(acadData) ? acadData[0]?.academic_calendar : acadData?.academic_calendar;
      const first = cal?.first_semester || {};
      const ft = first.first_term || {};
      const st = first.second_term || {};
      const now = new Date(); now.setHours(0,0,0,0);
      const d = (v)=> { const dd = new Date(v); return isNaN(dd.getTime()) ? null : new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()); };
      const fs = d(ft.start), fe = d(ft.end), ss = d(st.start), se = d(st.end);
      if (fs && fe && fs <= now && now <= fe) return '1st Term';
      if (ss && se && ss <= now && now <= se) return '2nd Term';
      return null;
    } catch { return null; }
  }, [acadData]);

  // Filter rows to current term if known
  const rowsTerm = useMemo(() => {
    if (!currentTermKey) return rows;
    return rows.filter(r => termLabelOf(r.semester || r.term) === currentTermKey);
  }, [rows, currentTermKey]);

  const byTerm = useMemo(() => {
    const m = new Map();
    rowsTerm.forEach(r => { const k = termLabelOf(r.semester || r.term); const a = m.get(k) || []; a.push(r); m.set(k, a); });
    // Ensure 1st then 2nd then Others order
    const keys = Array.from(m.keys());
    keys.sort((a,b)=>{
      const rank = (x)=> x.startsWith('1st') ? 1 : x.startsWith('2nd') ? 2 : 9;
      const ra = rank(a), rb = rank(b); return ra - rb || a.localeCompare(b);
    });
    // If we know current term, restrict to it
    const order = currentTermKey ? keys.filter(k => k === currentTermKey) : keys;
    return { order, map: m };
  }, [rowsTerm, currentTermKey]);

  const getInterval = (rec) => {
    let s = rec.timeStartMinutes, e = rec.timeEndMinutes;
    const tStr = String(rec.scheduleKey || rec.schedule || rec.time || '').trim();
    if (!Number.isFinite(s) || !Number.isFinite(e)) { const tt = parseTimeBlockToMinutes(tStr); s = tt.start; e = tt.end; }
    return [s, e];
  };
  const isNow = (rec) => {
    const [s, e] = getInterval(rec);
    return Number.isFinite(s) && Number.isFinite(e) && s <= nowMin && nowMin < e;
  };
  const nowList = useMemo(() => rowsTerm.filter(isNow), [rowsTerm, nowMin]);
  const nowIds = useMemo(() => new Set(nowList.map(r => String(r.id))), [nowList]);

  function onPrint() {
    const headers = ['Time','Program','Code','Title','Section','Units','Faculty'];
    const data = rows.map(c => [
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
                        <Text>{c.facultyName || '-'}</Text>
                      </HStack>
                      {canAttend && attMap[c.id] && (
                        <HStack spacing={2}>
                          <Badge colorScheme={statusColor(attMap[c.id].status)} textTransform="capitalize">
                            {attMap[c.id].status}
                          </Badge>
                        </HStack>
                      )}
                      {canAttend && (
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
                          <Text>{c.facultyName || '-'}</Text>
                        </HStack>
                        {canAttend && attMap[c.id] && (
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
