import React, { useMemo, useState } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  useColorModeValue,
  IconButton,
  Tooltip,
  Input,
  Select,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  HStack,
  Text,
  VStack,
  Button,
  Switch,
  FormControl,
  FormLabel,
  Badge,
} from '@chakra-ui/react';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiPrinter, FiShare2 } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import MiniBarChart from '../components/MiniBarChart';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';
import { useLocalStorage, getInitialToggleState, getExamDateSet, findDayAnnotations } from '../utils/scheduleUtils';
import { encodeShareRoom } from '../utils/share';
import { usePublicView } from '../utils/uiFlags';

export default function ViewsRooms() {
  const navigate = useNavigate();
  const allCourses = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const holidays = useSelector(s => s.data.holidays);
  const border = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const [q, setQ] = useState('');
  const isPublic = usePublicView();
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);
  const dayAnnotations = useMemo(() => {
    if (!acadData || !holidays) return {};
    const ann = {};
    weekDays.forEach(wd => {
      const d = new Date(wd.date); d.setHours(0,0,0,0);
      ann[wd.code] = findDayAnnotations(acadData, holidays, d);
    });
    return ann;
  }, [acadData, holidays, weekDays]);
  const [viewMode, setViewMode] = useLocalStorage(
    'viewsRoomsViewMode',
    getInitialToggleState(acadData, 'viewsRoomsViewMode', 'regular')
  );

  const autoExamDays = useMemo(() => {
    const set = new Set();
    const examSet = getExamDateSet(acadData);
    weekDays.forEach(wd => {
      const d = new Date(wd.date); d.setHours(0,0,0,0);
      if (examSet.has(d.getTime())) set.add(wd.code);
    });
    return set;
  }, [acadData, weekDays]);

  const daysWithExams = useMemo(() => {
    const s = new Set();
    allCourses.forEach(c => { if (c.examDay) s.add(c.examDay); });
    return s;
  }, [allCourses]);

  // Build day groups; per-day exam mode only if day is within exam dates AND has exam data
  const groups = useMemo(() => {
    const DAYS = DAY_CODES;
    const res = [];
    const tokens = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const normRoom = (v) => String(v || 'N/A').trim().replace(/\s+/g, ' ').toUpperCase();
    const dayCode = (v) => String(v || '').trim().slice(0,3).toUpperCase();
    const getRoomsForDay = (c, d) => {
      const roomsArr = tokens(c.room);
      const daysArr = tokens(c.f2fSched);
      if (roomsArr.length > 1 && daysArr.length > 1) {
        const out = [];
        const len = Math.min(roomsArr.length, daysArr.length);
        for (let i = 0; i < len; i++) {
          if (dayCode(daysArr[i]) === dayCode(d)) out.push(roomsArr[i]);
        }
        return out;
      }
      return (Array.isArray(c.f2fDays) ? c.f2fDays : daysArr).some(x => dayCode(x) === dayCode(d)) ? roomsArr : [];
    };
    for (const day of DAYS) {
      const hasExamData = daysWithExams.has(day);
      const useExam = (autoExamDays.has(day) && hasExamData) || (viewMode === 'examination' && hasExamData);
      if (useExam) {
        // Exam aggregation by examRoom/section
        const m = new Map();
        allCourses.forEach(c => {
          if (c.examDay !== day) return;
          const room = c.examRoom || 'N/A';
          const e = m.get(room) || { room, blocks: new Set(), minTerm: c.termOrder ?? 9 };
          if (c.section) e.blocks.add(c.section);
          if ((c.termOrder ?? 9) < (e.minTerm ?? 9)) e.minTerm = c.termOrder ?? 9;
          m.set(room, e);
        });
        const rows = Array.from(m.values()).map(e => ({ room: e.room, uniqueCount: e.blocks.size, minTerm: e.minTerm, minStart: Infinity }))
          .sort((a,b)=> {
            if ((a.minTerm ?? 9) !== (b.minTerm ?? 9)) return (a.minTerm ?? 9) - (b.minTerm ?? 9);
            return String(a.room).localeCompare(String(b.room));
          });
        const count = rows.reduce((s, r) => s + (r.uniqueCount || 0), 0);
        res.push({ day, rows, count, mode: 'exam' });
        continue;
      }
      const m = new Map();
      allCourses.forEach(c => {
        const roomsForThisDay = getRoomsForDay(c, day);
        if (roomsForThisDay.length === 0) return;
        roomsForThisDay.forEach(r => {
          const roomKey = normRoom(r);
          const displayRoom = r || 'N/A';
          const e = m.get(roomKey) || { room: displayRoom, timeSet: new Map(), minTerm: 9, minStart: Infinity };
          const key = c.scheduleKey || '';
          if (key) {
            const start = Number.isFinite(c.timeStartMinutes) ? c.timeStartMinutes : 1e9;
            const prev = e.timeSet.get(key);
            if (prev == null || start < prev) e.timeSet.set(key, start);
            if ((c.termOrder ?? 9) < e.minTerm) e.minTerm = c.termOrder ?? 9;
            if (start < e.minStart) e.minStart = start;
          }
          m.set(roomKey, e);
        });
      });
      const rows = Array.from(m.values()).map(e => {
        const times = Array.from(e.timeSet.entries()).sort((a,b)=> a[1]-b[1]).map(x => x[0]);
        return { room: e.room, uniqueCount: times.length, minTerm: e.minTerm, minStart: e.minStart };
      }).sort((a,b)=> {
        if ((a.minTerm ?? 9) !== (b.minTerm ?? 9)) return (a.minTerm ?? 9) - (b.minTerm ?? 9);
        if ((a.minStart ?? Infinity) !== (b.minStart ?? Infinity)) return (a.minStart ?? Infinity) - (b.minStart ?? Infinity);
        return String(a.room).localeCompare(String(b.room));
      });
      const count = rows.reduce((s, r) => s + (r.uniqueCount || 0), 0);
      res.push({ day, rows, count, mode: 'regular' });
    }
    // Unscheduled tab: no Mon–Fri F2F days
    const unschedMap = new Map();
    const weekdaySet = new Set(['Mon','Tue','Wed','Thu','Fri']);
    allCourses.forEach(c => {
      const f2f = Array.isArray(c.f2fDays) ? c.f2fDays : [];
      const hasWeekday = f2f.some(d => weekdaySet.has(d));
      if (hasWeekday) return;
      const room = c.room || 'N/A';
      const e = unschedMap.get(room) || { room, timeSet: new Map(), minTerm: 9, minStart: Infinity };
      const label = c.schedule || '';
      const start = Number.isFinite(c.timeStartMinutes) ? c.timeStartMinutes : 1e9;
      if (label) {
        const prev = e.timeSet.get(label);
        if (prev == null || start < prev) e.timeSet.set(label, start);
      }
      if ((c.termOrder ?? 9) < e.minTerm) e.minTerm = c.termOrder ?? 9;
      if (start < e.minStart) e.minStart = start;
      unschedMap.set(room, e);
    });
    const unschedRows = Array.from(unschedMap.values()).map(e => {
      const times = Array.from(e.timeSet.entries()).sort((a,b)=> a[1]-b[1]).map(x => x[0]);
      return { room: e.room, uniqueCount: times.length, minTerm: e.minTerm, minStart: e.minStart };
    }).sort((a,b)=> {
      if ((a.minTerm ?? 9) !== (b.minTerm ?? 9)) return (a.minTerm ?? 9) - (b.minTerm ?? 9);
      if ((a.minStart ?? Infinity) !== (b.minStart ?? Infinity)) return (a.minStart ?? Infinity) - (b.minStart ?? Infinity);
      return String(a.room).localeCompare(String(b.room));
    });
    const unschedCount = unschedRows.reduce((s, r) => s + (r.uniqueCount || 0), 0);
    res.push({ day: 'Unscheduled', rows: unschedRows, count: unschedCount, mode: 'regular' });
    return res;
  }, [allCourses, autoExamDays, viewMode, daysWithExams]);

  const filteredGroups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return groups;
    return groups.map(g => ({
      ...g,
      rows: g.rows.filter(r => String(r.room).toLowerCase().includes(ql))
    }));
  }, [groups, q]);

  function onPrint(dayGroup) {
    const headers = ['Room', 'Time Slots'];
    const rows = dayGroup.rows.map(r => [r.room, String(r.uniqueCount)]);
    const table = buildTable(headers, rows);
    const wd = getCurrentWeekDays();
    const lbc = Object.fromEntries(wd.map(d => [d.code, d.label]));
    const label = lbc[dayGroup.day] || dayGroup.day;
    printContent({ title: `Rooms - ${label}`, subtitle: 'Unique F2F Time Slots per Room', bodyHtml: table });
  }

  function roomAccent(room) {
    const r = String(room || '').toUpperCase();
    if (r.startsWith('OB')) return 'green.500';
    if (r.startsWith('NB')) return 'blue.500';
    if (r.startsWith('CL') || r.includes('CLB')) return 'purple.500';
    if (r.includes('LAB')) return 'orange.500';
    if (r.includes('LIB')) return 'teal.500';
    if (r.includes('GYM')) return 'red.500';
    return 'brand.500';
  }

  const defaultDayIndex = useMemo(() => {
    const dow = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
    const idx = (dow >= 1 && dow <= 5) ? dow - 1 : 0;
    const code = DAY_CODES[idx];
    const pos = filteredGroups.findIndex(g => g.day === code);
    return pos >= 0 ? pos : 0;
  }, [filteredGroups]);

  const [tabIndex, setTabIndex] = useState(defaultDayIndex);

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <HStack align="center" spacing={3}>
          <Heading size="md">Loads by Room (Mon-Fri)</Heading>
          {viewMode === 'examination' && (
            <Badge colorScheme="blue" variant="subtle">{autoExamDays.size > 0 ? 'Examination Mode' : 'Exam Mode Preview'}</Badge>
          )}
          {autoExamDays.size > 0 && viewMode === 'regular' && (
            <Badge colorScheme="orange" variant="subtle">Exam Period Detected</Badge>
          )}
        </HStack>
        <HStack spacing={4} flexWrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }} w={{ base: '100%', md: 'auto' }}>
          {!isPublic && (
          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="rooms-schedule-mode" mb="0" fontSize="sm" fontWeight="medium">
              Regular F2F
            </FormLabel>
            <Switch
              id="rooms-schedule-mode"
              colorScheme="blue"
              size="lg"
              isChecked={viewMode === 'examination'}
              onChange={(e) => setViewMode(e.target.checked ? 'examination' : 'regular')}
            />
            <FormLabel htmlFor="rooms-schedule-mode" mb="0" fontSize="sm" fontWeight="medium" ml={2}>
              Examination
            </FormLabel>
          </FormControl>
          )}
          {!isPublic && <Input placeholder="Filter rooms." value={q} onChange={e=>setQ(e.target.value)} maxW="280px" w={{ base: '100%', sm: 'auto' }} />}
          {isAdmin && !isPublic && (
            <Button as={RouterLink} to="/share/rooms" leftIcon={<FiShare2 />} size="sm" colorScheme="blue" w={{ base: '100%', sm: 'auto' }}>
              Share
            </Button>
          )}
        </HStack>
      </HStack>

      {/* Mobile day picker */}
      <Box display={{ base: 'block', md: 'none' }} mb={2}>
        <Select size="sm" value={String(tabIndex)} onChange={(e) => setTabIndex(Number(e.target.value))}>
          {filteredGroups.map((g, i) => (
            <option key={g.day} value={String(i)}>{labelByCode[g.day] || g.day}</option>
          ))}
        </Select>
      </Box>

      <Tabs variant="enclosed-colored" colorScheme="brand" size="sm" index={tabIndex} onChange={setTabIndex}>
        <TabList
          display={{ base: 'none', md: 'flex' }}
          overflowX="auto"
          overflowY="hidden"
          whiteSpace="nowrap"
          gap={1}
          px={1}
          sx={{ '::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}
        >
          {filteredGroups.map(g => (
            <Tab
              key={g.day}
              isDisabled={g.rows.length === 0}
              flexShrink={0}
              px={3}
              py={2}
              minW="auto"
            >
              <HStack spacing={2}>
                <Text>{labelByCode[g.day] || g.day}</Text>
                {(((autoExamDays.has(g.day) && daysWithExams.has(g.day)) || (viewMode === 'examination' && daysWithExams.has(g.day)))) && (
                  <Badge size="sm" colorScheme="green" variant="subtle" display={{ base: 'none', lg: 'inline-flex' }}>Exam</Badge>
                )}
                {dayAnnotations[g.day]?.holiday && (
                  <Badge size="sm" colorScheme="red" variant="subtle" title={dayAnnotations[g.day].holiday.name} display={{ base: 'none', lg: 'inline-flex' }}>
                    Holiday
                  </Badge>
                )}
                {dayAnnotations[g.day]?.mode === 'asynchronous' && (
                  <Badge size="sm" colorScheme="purple" variant="subtle" title="Asynchronous Mode" display={{ base: 'none', lg: 'inline-flex' }}>
                    Async
                  </Badge>
                )}
                {dayAnnotations[g.day]?.mode === 'no_class' && (
                  <Badge size="sm" colorScheme="gray" variant="subtle" title="No Class" display={{ base: 'none', lg: 'inline-flex' }}>
                    No Class
                  </Badge>
                )}
              </HStack>
            </Tab>
          ))}
        </TabList>
        <TabPanels>
          {filteredGroups.map(g => (
            <TabPanel key={g.day} px={0}>
              <HStack justify="flex-end" mb={2}>
                <Button leftIcon={<FiPrinter />} onClick={() => onPrint(g)} variant="outline" size="sm">Print</Button>
              </HStack>
              {dayAnnotations[g.day]?.holiday && (
                <Box p={4} mb={4} bg="red.50" borderWidth="1px" borderColor="red.200" rounded="md">
                  <Text fontWeight="700" color="red.600">{dayAnnotations[g.day].holiday.name}</Text>
                  <Text fontSize="sm" color="red.600">{dayAnnotations[g.day].holiday.type}</Text>
                </Box>
              )}
              {(() => {
                const filteredEvents = dayAnnotations[g.day]?.events?.filter(evt => (['external','internal'].includes(String(evt.type||'').toLowerCase()) || String(evt.mode||'').toLowerCase() !== 'default') && !String(evt.event || '').toLowerCase().includes('exam')) || [];
                return filteredEvents.length > 0 && (
                  <Box p={4} mb={4} bg="purple.50" borderWidth="1px" borderColor="purple.200" rounded="md">
                    {filteredEvents.map((evt, idx) => (
                      <Box key={idx} mb={idx < filteredEvents.length - 1 ? 2 : 0}>
                        <Text fontWeight="700" color="purple.600">{evt.event}</Text>
                        {evt.type && <Text fontSize="sm" color="purple.600">Type: {evt.type}</Text>}
                        {evt.mode && <Text fontSize="sm" color="purple.600">Mode: {evt.mode}</Text>}
                      </Box>
                    ))}
                  </Box>
                );
              })()}
              {dayAnnotations[g.day]?.mode === 'no_class' ? (
                <Box p={8} bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" mb={4} textAlign="center" color={subtle}>
                  <Text fontWeight="700" fontSize="lg" mb={2}>No Classes Today</Text>
                  <Text fontSize="md">The schedule for this day is disabled due to a no-class event.</Text>
                </Box>
              ) : null}

              {dayAnnotations[g.day]?.mode === 'no_class' ? null : (
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4} mb={4}>
                <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontSize="xs" color={subtle}>Rooms</Text>
                  <Text fontWeight="800" fontSize="xl">{g.rows.length}</Text>
                </Box>
                <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontSize="xs" color={subtle}>Time Slots</Text>
                  <Text fontWeight="800" fontSize="xl">{g.rows.reduce((s,r)=> s + (r.uniqueCount||0), 0)}</Text>
                </Box>
                <Box bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
                  <Text fontSize="xs" color={subtle}>Earliest Term</Text>
                  <Text fontWeight="800" fontSize="xl">{(() => { const t = Math.min(...g.rows.map(r => r.minTerm || 9)); return t===1?'1st':t===2?'2nd':t===3?'Sem':'-'; })()}</Text>
                </Box>
                  </SimpleGrid>
                  )}

                  {g.rows.length === 0 ? (
                <Text color="gray.500">No rooms</Text>
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
                  {g.rows.map(r => (
                    <Box
                      key={`${g.day}-${r.room}`}
                      as={RouterLink}
                      to={isPublic ? `/share/rooms/${encodeURIComponent(encodeShareRoom(r.room))}?day=${encodeURIComponent(g.day)}` : `/views/rooms/${encodeURIComponent(r.room)}?day=${encodeURIComponent(g.day)}`}
                      className="view-card"
                      bg={cardBg}
                      borderWidth="1px"
                      borderColor={border}
                      rounded="xl"
                      p={4}
                      position="relative"
                      transition="transform 0.18s ease, box-shadow 0.18s ease"
                      cursor="pointer"
                      _hover={{ textDecoration: 'none' }}
                    >
                      <Box position="absolute" top={0} left={0} right={0} h="4px" bg={roomAccent(r.room)} roundedTop="xl" />
                      <VStack align="start" spacing={3}>
                        <HStack justify="space-between" w="full" minW={0}>
                          <Text fontWeight="800" noOfLines={1}>{r.room}</Text>
                          <Tooltip label={`View schedule (${labelByCode[g.day] || g.day})`}>
                            <IconButton
                              aria-label="View"
                              icon={<FiChevronRight />}
                              size="sm"
                              variant="ghost"
                              onClick={(e)=>{ e.stopPropagation(); navigate(`/views/rooms/${encodeURIComponent(r.room)}?day=${encodeURIComponent(g.day)}`); }}
                            />
                          </Tooltip>
                        </HStack>
                        <HStack spacing={6}>
                          <Box>
                            <Text fontSize="xs" color={subtle}>Time slots</Text>
                            <Text fontWeight="700" fontSize="lg">{r.uniqueCount}</Text>
                          </Box>
                        </HStack>
                        <Text fontSize="sm" color={subtle}>Ordered by term, then earliest time.</Text>
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
              )}

              <Box mt={4} bg={cardBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                <Text fontWeight="700" mb={2}>Top Rooms by Time Slots</Text>
                  <MiniBarChart data={[...g.rows].sort((a,b)=> (b.uniqueCount||0) - (a.uniqueCount||0)).map(r => ({ key: r.room, value: r.uniqueCount }))} />
                </Box>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Box>
  );
}
