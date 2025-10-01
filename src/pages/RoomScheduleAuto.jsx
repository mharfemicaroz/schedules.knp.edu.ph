import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { Box, VStack, HStack, Heading, Text, Badge, useColorModeValue, SimpleGrid, Button, Icon, Divider } from '@chakra-ui/react';
import { FiClock, FiBookOpen, FiUser, FiTag, FiPrinter, FiCalendar } from 'react-icons/fi';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { buildTable, printContent } from '../utils/printDesign';

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
  const border = useColorModeValue('gray.200','gray.700');
  const panel = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const accent = useColorModeValue('blue.600','blue.300');

  const day = todayTag();

  const nowMinutes = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
  const [nowMin, setNowMin] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30000); // update every 30s
    return () => clearInterval(t);
  }, []);

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
          <Button leftIcon={<FiPrinter />} onClick={onPrint} colorScheme="blue" variant="outline" size="sm">Print</Button>
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
    </Box>
  );
}
