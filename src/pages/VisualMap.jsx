import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, Text, Input, VStack, Tag, TagLabel, Wrap, WrapItem, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody, SimpleGrid, Button, useColorModeValue, Badge , Divider, Icon, Link as ChakraLink } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectBlocks } from '../store/blockSlice';
import { loadBlocksThunk } from '../store/blockThunks';
import { buildTable, printContent } from '../utils/printDesign';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';
import { FiPrinter, FiInfo, FiAlertCircle } from 'react-icons/fi';
import { findDayAnnotations } from '../utils/scheduleUtils';
import { getExamDateSet } from '../utils/scheduleUtils';
import { encodeShareBlock, encodeShareRoom } from '../utils/share';

const SESSIONS = ['Morning','Afternoon','Evening'];
const ROOM_SPLIT_THRESHOLD = 10; // split rooms into two parts when exceeding this count

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
  if (t < 12*60) return 'Morning';
  if (t < 17*60) return 'Afternoon';
  return 'Evening';
}

function BlockChips({ blocks, day, session }) {
  const subtle = useColorModeValue('gray.600','gray.400');
  const maxInline = 3;
  const shown = blocks.slice(0, maxInline);
  const more = blocks.slice(maxInline);
  return (
    <HStack align="start" spacing={2} wrap="wrap">
      {shown.map(b => {
        const scheme = schemeForBlockCode(b);
        const href = `/share/session/block/${encodeURIComponent(b)}?day=${encodeURIComponent(day)}&session=${encodeURIComponent(session)}`;
        return (
          <ChakraLink
            as={RouterLink}
            to={href}
            key={b}
            _hover={{ textDecoration: 'none' }}
          >
            <Tag
              size="sm"
              variant="subtle"
              colorScheme={scheme}
              cursor="pointer"
              role="link"
              tabIndex={0}
            >
              <TagLabel>{b}</TagLabel>
            </Tag>
          </ChakraLink>
        );
      })}
      {more.length > 0 && (
        <Popover placement="bottom-start">
          <PopoverTrigger>
            <Button size="xs" variant="ghost">+{more.length} more</Button>
          </PopoverTrigger>
          <PopoverContent w="240px">
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverBody>
              <Wrap spacing={2}>
                {more.map(b => {
                  const scheme = schemeForBlockCode(b);
                  const href = `/share/session/block/${encodeURIComponent(b)}?day=${encodeURIComponent(day)}&session=${encodeURIComponent(session)}`;
                  return (
                    <WrapItem key={b}>
                      <ChakraLink as={RouterLink} to={href} _hover={{ textDecoration: 'none' }}>
                        <Tag size="sm" variant="subtle" colorScheme={scheme} cursor="pointer" role="link" tabIndex={0}>
                          <TagLabel>{b}</TagLabel>
                        </Tag>
                      </ChakraLink>
                    </WrapItem>
                  );
                })}
              </Wrap>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
    </HStack>
  );
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

export default function VisualMap() {
  const dispatch = useDispatch();
  const blocks = useSelector(selectBlocks);
  const acadData = useSelector(s => s.data.acadData);
  const holidays = useSelector(s => s.data.holidays);
  const authUser = useSelector(s => s.auth.user);
  const [q, setQ] = useState('');
  const border = useColorModeValue('gray.200','gray.700');
  const cellBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const muted = useColorModeValue('gray.600','gray.400');
  const partHeaderBg = useColorModeValue('white','gray.900');
  // const headerRowBg = useColorModeValue('gray.100','gray.800');
  // const rowHoverBg = useColorModeValue('gray.50','gray.800');
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  // const partHeaderBg = useColorModeValue('white','gray.900');
  const headerRowBg = useColorModeValue('gray.100','gray.800');
  const rowHoverBg = useColorModeValue('gray.50','gray.800');

  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);

  React.useEffect(() => {
    // Ensure blocks are loaded for mapping
    dispatch(loadBlocksThunk({}));
  }, [dispatch]);

  // Compute which specific days in this week are exam dates
  const autoExamDays = useMemo(() => {
    const set = new Set();
    const examSet = getExamDateSet(acadData);
    weekDays.forEach(wd => {
      const d = new Date(wd.date); d.setHours(0,0,0,0);
      if (examSet.has(d.getTime())) set.add(wd.code);
    });
    return set;
  }, [acadData, weekDays]);

  // Get holiday and event annotations for each day
  const dayAnnotations = useMemo(() => {
    if (!acadData || !holidays) return {};
    const ann = {};
    weekDays.forEach(wd => {
      const d = new Date(wd.date);
      d.setHours(0,0,0,0);
      ann[wd.code] = findDayAnnotations(acadData, holidays, d);
    });
    return ann;
  }, [acadData, holidays, weekDays]);

  const daysWithExams = useMemo(() => {
    const examDays = new Set();
    (blocks || []).forEach(b => { const d = String(b.examDay || '').trim(); if (d) examDays.add(d); });
    return examDays;
  }, [blocks]);

  const tabs = useMemo(() => {
    const norm = (v) => String(v || 'N/A').trim().replace(/\s+/g, ' ').toUpperCase();
    const tokens = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const canonSession = (v) => {
      const s = String(v || '').trim().toLowerCase();
      if (s.includes('even')) return 'Evening';
      if (s.includes('after')) return 'Afternoon';
      if (s.includes('morn')) return 'Morning';
      if (s === 'am') return 'Morning';
      if (s === 'pm') return 'Afternoon';
      return 'Morning';
    };
    // No schedule dependency: program coloring removed

    return DAY_CODES.map(day => {
      const hasExamData = daysWithExams.has(day);
      const useExamMode = (autoExamDays.has(day) && hasExamData);

      if (useExamMode) {
        const displayByKey = new Map();
        (blocks || []).forEach(b => {
          if (String(b.examDay || '') !== String(day)) return;
          tokens(b.examRoom).forEach(r => {
            const key = norm(r);
            if (!displayByKey.has(key)) displayByKey.set(key, r || 'N/A');
          });
        });
        const rooms = Array.from(displayByKey.values()).sort((a,b)=>String(a).localeCompare(String(b)));
        const matrix = {};
        SESSIONS.forEach(s => { matrix[s] = new Map(rooms.map(r => [r, new Map()])); });
        (blocks || []).forEach(b => {
          if (String(b.examDay || '') !== String(day)) return;
          const session = canonSession(b.examSession || 'Morning');
          tokens(b.examRoom).forEach(r => {
            const room = displayByKey.get(norm(r)) || 'N/A';
            const block = b.blockCode || b.block_code || 'N/A';
            if (!matrix[session]) matrix[session] = new Map(rooms.map(r => [r, new Map()]));
            if (!matrix[session].has(room)) matrix[session].set(room, new Map());
            const m = matrix[session].get(room);
            if (!m.has(block)) m.set(block, '');
          });
        });
        return { day, rooms, matrix, hasExamData: true, mode: 'exam' };
      }

      // Regular F2F mapping via blocks
      // If both `room` and `f2fSched` contain multiple comma-separated values,
      // interpret them as index-aligned pairs: Room1->Day1, Room2->Day2, etc.
      const getRoomsForDay = (b, d) => {
        const roomsArr = tokens(b.room);
        const daysArr = tokens(b.f2fSched);
        // Pairwise mapping when both are multiple values
        if (roomsArr.length > 1 && daysArr.length > 1) {
          const out = [];
          const len = Math.min(roomsArr.length, daysArr.length);
          for (let i = 0; i < len; i++) {
            if (String(daysArr[i]) === String(d)) out.push(roomsArr[i]);
          }
          return out;
        }
        // Fallback to legacy behavior
        return daysArr.includes(d) ? roomsArr : [];
      };

      const displayByKey = new Map();
      (blocks || []).forEach(b => {
        const roomsForThisDay = getRoomsForDay(b, day);
        roomsForThisDay.forEach(r => {
          const key = norm(r);
          if (!displayByKey.has(key)) displayByKey.set(key, r || 'N/A');
        });
      });
      const rooms = Array.from(displayByKey.values()).sort((a,b)=>String(a).localeCompare(String(b)));
      const matrix = {};
      SESSIONS.forEach(s => { matrix[s] = new Map(rooms.map(r => [r, new Map()])); });
      (blocks || []).forEach(b => {
        const session = canonSession(b.session || 'Morning');
        const roomsForThisDay = getRoomsForDay(b, day);
        roomsForThisDay.forEach(r => {
          const room = displayByKey.get(norm(r)) || 'N/A';
          const block = b.blockCode || b.block_code || 'N/A';
          if (!matrix[session]) matrix[session] = new Map(rooms.map(r => [r, new Map()]));
          if (!matrix[session].has(room)) matrix[session].set(room, new Map());
          const m = matrix[session].get(room);
          if (!m.has(block)) m.set(block, '');
        });
      });
      return { day, rooms, matrix, hasExamData, mode: 'regular' };
    });
  }, [blocks, daysWithExams, autoExamDays]);

  const filteredTabs = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return tabs;
    return tabs.map(t => ({ ...t, rooms: t.rooms.filter(r => String(r).toLowerCase().includes(ql)) }));
  }, [tabs, q]);

  // Helper to split rooms list into two halves for large counts
  const splitRooms = (rooms) => {
    if (!rooms || rooms.length <= ROOM_SPLIT_THRESHOLD) return [rooms];
    const half = Math.ceil(rooms.length / 2);
    return [rooms.slice(0, half), rooms.slice(half)];
  };

  function onPrint(day) {
    const scheduleType = day.mode === 'exam' ? 'Examination Schedule' : 'Regular F2F Schedule';
    const headers = ['Room', 'Morning Blocks', 'Afternoon Blocks', 'Evening Blocks'];
    const rows = day.rooms.map(r => {
      const mM = day.matrix['Morning']?.get(r) || new Map();
      const mA = day.matrix['Afternoon']?.get(r) || new Map();
      const mE = day.matrix['Evening']?.get(r) || new Map();
      return [r, Array.from(mM.keys()).join(', '), Array.from(mA.keys()).join(', '), Array.from(mE.keys()).join(', ')];
    });
    const table = buildTable(headers, rows);
    const label = labelByCode[day.day] || day.day;
    printContent({
      title: `Classroom Assigment - ${label}`,
      subtitle: `Blocks per Room and Session - ${scheduleType}`,
      bodyHtml: table
    });
  }

  // Removed tabbing; days render sequentially

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Heading size="md">Classroom Assigment</Heading>
        <Input placeholder="Filter rooms" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" w={{ base: '100%', sm: 'auto' }} />
      </HStack>

      {filteredTabs.map(t => (
        <Box key={t.day} mb={8}>
          {/* Stat cards first */}
          {/* <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={3}>
            <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
              <Text fontSize="xs" color={subtle}>Rooms Occupied</Text>
              <Text fontWeight="800" fontSize="xl">{t.rooms.length}</Text>
            </Box>
            <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
              <Text fontSize="xs" color={subtle}>Blocks Present</Text>
              <Text fontWeight="800" fontSize="xl">{(() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })()}</Text>
            </Box>
            <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
              <Text fontSize="xs" color={subtle}>Blocks Present / Total</Text>
              <Text fontWeight="800" fontSize="xl">{(() => { const present = (() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })(); const total = (() => { const all = new Set(); (blocks||[]).forEach(b => all.add(b.blockCode || b.block_code)); return all.size; })(); return `${present}/${total}`; })()}</Text>
            </Box>
          </SimpleGrid> */}

          {/* Day header next */}
          <HStack justify="space-between" mb={2} flexWrap="wrap" gap={2}>
            <HStack spacing={3} align="center">
              <Heading size="sm">{labelByCode[t.day] || t.day}</Heading>
              {(t.hasExamData && autoExamDays.has(t.day)) && (
                <Badge size="sm" colorScheme="green" variant="subtle" display={{ base: 'none', md: 'inline-flex' }}>Exam</Badge>
              )}
              {dayAnnotations[t.day]?.holiday && (
                <Badge size="sm" colorScheme="red" variant="subtle" title={dayAnnotations[t.day].holiday.name} display={{ base: 'none', md: 'inline-flex' }}>Holiday</Badge>
              )}
              {dayAnnotations[t.day]?.mode === 'asynchronous' && (
                <Badge size="sm" colorScheme="purple" variant="subtle" title="Asynchronous Mode" display={{ base: 'none', md: 'inline-flex' }}>Async</Badge>
              )}
              {dayAnnotations[t.day]?.mode === 'no_class' && (
                <Badge size="sm" colorScheme="gray" variant="subtle" title="No Class" display={{ base: 'none', md: 'inline-flex' }}>No Class</Badge>
              )}
            </HStack>
            <HStack>
              <Badge colorScheme="purple" variant="subtle" rounded="full" display={{ base: 'none', md: 'inline-flex' }}>Rooms: {t.rooms.length}</Badge>
              <Badge colorScheme="teal" variant="subtle" rounded="full" display={{ base: 'none', md: 'inline-flex' }}>
                Blocks: {(() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })()}
              </Badge>
              <Button leftIcon={<FiPrinter />} onClick={() => onPrint(t)} variant="outline" size="sm">Print</Button>
            </HStack>
          </HStack>

          {/* No manual exam toggle; no exam-fallback banner */}

          {dayAnnotations[t.day]?.holiday && (
            <Box p={4} mb={4} bg="red.50" borderWidth="1px" borderColor="red.200" rounded="md" display="flex" alignItems="center" gap={3}>
              <Icon as={FiAlertCircle} color="red.500" boxSize={5} />
              <Box>
                <Text fontWeight="700" color="red.600">{dayAnnotations[t.day].holiday.name}</Text>
                <Text fontSize="sm" color="red.600">{dayAnnotations[t.day].holiday.type}</Text>
              </Box>
            </Box>
          )}

          {/* {dayAnnotations[t.day]?.events?.length > 0 && (
            <Box p={4} mb={4} bg="purple.50" borderWidth="1px" borderColor="purple.200" rounded="md">
              {dayAnnotations[t.day].events.map((evt, idx) => (
                <Box key={idx} mb={idx < dayAnnotations[t.day].events.length - 1 ? 2 : 0}>
                  <Text fontWeight="700" color="purple.600">{evt.event}</Text>
                  {evt.type && <Text fontSize="sm" color="purple.600">Type: {evt.type}</Text>}
                  {evt.mode && <Text fontSize="sm" color="purple.600">Mode: {evt.mode}</Text>}
                </Box>
              ))}
            </Box>
          )} */}

          {dayAnnotations[t.day]?.mode === 'no_class' ? (
            <Box p={8} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" mb={4} textAlign="center" color={subtle}>
              <Text fontWeight="700" fontSize="lg" mb={2}>No Classes Today</Text>
              <Text fontSize="md">The schedule for this day is disabled due to a no-class event.</Text>
            </Box>
          ) : (
            <>
              {/* Mobile cards per room */}
              <Box display={{ base: 'block', md: 'none' }}>
                <VStack align="stretch" spacing={3}>
                  {t.rooms.map((r) => {
                    const mM = t.matrix['Morning']?.get(r) || new Map();
                    const mA = t.matrix['Afternoon']?.get(r) || new Map();
                    const mE = t.matrix['Evening']?.get(r) || new Map();
                    const to = isAdmin
                      ? `/views/rooms/${encodeURIComponent(r)}?day=${encodeURIComponent(t.day)}`
                      : `/share/rooms/${encodeURIComponent(encodeShareRoom(r))}?day=${encodeURIComponent(t.day)}`;
                    return (
                      <Box key={`${t.day}-${r}`} borderWidth="1px" borderColor={border} rounded="xl" bg={cellBg} p={4}>
                        <VStack align="stretch" spacing={3}>
                          <HStack justify="space-between" minW={0}>
                            <HStack spacing={2} minW={0}>
                              <Box w="10px" h="10px" rounded="full" bg={roomAccent(r)}></Box>
                              <ChakraLink as={RouterLink} to={to} _hover={{ textDecoration: 'none' }}>
                                <Text fontWeight="700" noOfLines={1}>{r}</Text>
                              </ChakraLink>
                            </HStack>
                            <Badge colorScheme="purple" variant="subtle">Room</Badge>
                          </HStack>
                          <VStack align="stretch" spacing={2}>
                            <Box>
                              <Text fontSize="xs" color={muted}>Morning</Text>
                              {mM.size === 0 ? <Text fontSize="xs" color={muted}>-</Text> : (
                                <Wrap spacing={2} mt={1}>
                                  {Array.from(mM.keys()).sort().map((b) => (
                                    <WrapItem key={`m-${r}-${b}`}>
                                      <Tag size="sm" variant="subtle" colorScheme={schemeForBlockCode(b)}><TagLabel>{b}</TagLabel></Tag>
                                    </WrapItem>
                                  ))}
                                </Wrap>
                              )}
                            </Box>
                            <Box>
                              <Text fontSize="xs" color={muted}>Afternoon</Text>
                              {mA.size === 0 ? <Text fontSize="xs" color={muted}>-</Text> : (
                                <Wrap spacing={2} mt={1}>
                                  {Array.from(mA.keys()).sort().map((b) => (
                                    <WrapItem key={`a-${r}-${b}`}>
                                      <Tag size="sm" variant="subtle" colorScheme={schemeForBlockCode(b)}><TagLabel>{b}</TagLabel></Tag>
                                    </WrapItem>
                                  ))}
                                </Wrap>
                              )}
                            </Box>
                            <Box>
                              <Text fontSize="xs" color={muted}>Evening</Text>
                              {mE.size === 0 ? <Text fontSize="xs" color={muted}>-</Text> : (
                                <Wrap spacing={2} mt={1}>
                                  {Array.from(mE.keys()).sort().map((b) => (
                                    <WrapItem key={`e-${r}-${b}`}>
                                      <Tag size="sm" variant="subtle" colorScheme={schemeForBlockCode(b)}><TagLabel>{b}</TagLabel></Tag>
                                    </WrapItem>
                                  ))}
                                </Wrap>
                              )}
                            </Box>
                          </VStack>
                        </VStack>
                      </Box>
                    );
                  })}
                </VStack>
              </Box>

              {/* <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
                <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontSize="xs" color={subtle}>Rooms Occupied</Text>
                  <Text fontWeight="800" fontSize="xl">{t.rooms.length}</Text>
                </Box>
                <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontSize="xs" color={subtle}>Blocks Present</Text>
                  <Text fontWeight="800" fontSize="xl">{(() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })()}</Text>
                </Box>
                <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
                  <Text fontSize="xs" color={subtle}>Blocks Present / Total</Text>
                  <Text fontWeight="800" fontSize="xl">{(() => { const present = (() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })(); const total = (() => { const all = new Set(); (blocks||[]).forEach(b => all.add(b.blockCode || b.block_code)); return all.size; })(); return `${present}/${total}`; })()}</Text>
                </Box>
              </SimpleGrid> */}

              {(() => {
                const roomParts = splitRooms(t.rooms);
                return (
                  <>
                    {roomParts.map((roomsSlice, partIdx) => (
                      <Box key={`${t.day}-part-${partIdx}`} mb={4}>
                        {roomParts.length > 1 && (
                          <Box px={4} py={2} bg={partHeaderBg} borderTopWidth={partIdx===0? '0':'1px'} borderColor={border}>
                            <Text fontSize="sm" color={subtle}>Rooms {partIdx+1} of {roomParts.length}</Text>
                          </Box>
                        )}
                        <Box overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={cellBg} display={{ base: 'none', md: 'block' }}>
                          <Box as="table" w="100%" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <Box as="thead">
                              <Box as="tr" bg={headerRowBg}>
                                <Box as="th" position="sticky" left={0} zIndex={1} bg={cellBg} p="10px 12px" textAlign="left" borderRightWidth="1px" borderColor={border} width="150px">Session</Box>
                                {roomsSlice.map((r) => {
                                  const to = isAdmin
                                    ? `/views/rooms/${encodeURIComponent(r)}?day=${encodeURIComponent(t.day)}`
                                    : `/share/rooms/${encodeURIComponent(encodeShareRoom(r))}?day=${encodeURIComponent(t.day)}`;
                                  return (
                                    <Box as="th" key={r} p="10px 12px" textAlign="left" borderLeftWidth="1px" borderColor={border}>
                                      <HStack>
                                        <Box w="10px" h="10px" rounded="full" bg={roomAccent(r)}></Box>
                                        <ChakraLink as={RouterLink} to={to} _hover={{ textDecoration: 'none' }} cursor="pointer">
                                          <Text fontWeight="600" noOfLines={1}>{r}</Text>
                                        </ChakraLink>
                                      </HStack>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                            <Box as="tbody">
                              {SESSIONS.map((sess) => (
                                <Box as="tr" key={`${t.day}-${sess}-${partIdx}`} _hover={{ bg: rowHoverBg }}>
                                  <Box as="td" position="sticky" left={0} zIndex={1} bg={cellBg} p="10px 12px" borderTopWidth="1px" borderColor={border} fontWeight="700">{sess}</Box>
                                  {roomsSlice.length === 0 && (
                                    <Box as="td" p="10px 12px" borderTopWidth="1px" borderColor={border} colSpan={999}>
                                      <Text fontSize="xs" color={subtle}>—</Text>
                                    </Box>
                                  )}
                                  {roomsSlice.map((r, cIdx) => {
                                    const map = t.matrix[sess]?.get(r) || new Map();
                                    const arr = Array.from(map.keys()).sort();
                                    return (
                                      <Box as="td" key={`${sess}-${r}-${partIdx}`} p="8px 10px" borderTopWidth="1px" borderLeftWidth={cIdx===0? '1px':'1px'} borderColor={border}>
                                        {arr.length === 0 ? (
                                          <Text fontSize="xs" color={subtle}>—</Text>
                                        ) : (
                                          <Wrap spacing={2}>
                                            {arr.map((b) => (
                                              <WrapItem key={`${sess}-${r}-${b}-${partIdx}`} maxW="100%">
                                                <ChakraLink
                                                  as={RouterLink}
                                                  to={isAdmin
                                                    ? `/views/session/block/${encodeURIComponent(b)}?day=${encodeURIComponent(t.day)}&session=${encodeURIComponent(sess)}`
                                                    : `/share/session/block/${encodeURIComponent(encodeShareBlock(b))}?day=${encodeURIComponent(t.day)}&session=${encodeURIComponent(sess)}`}
                                                  _hover={{ textDecoration: 'none' }}
                                                >
                                                  <Tag
                                                    variant="subtle"
                                                    colorScheme={schemeForBlockCode(b)}
                                                    rounded="full"
                                                    px={6}
                                                    py={2}
                                                    display="inline-block"
                                                    maxW="100%"
                                                    cursor="pointer"
                                                    role="link"
                                                    tabIndex={0}
                                                    style={{ fontSize: '12px', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                                                  >
                                                    <TagLabel display="block" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{b}</TagLabel>
                                                  </Tag>
                                                </ChakraLink>
                                              </WrapItem>
                                            ))}
                                          </Wrap>
                                        )}
                                      </Box>
                                    );
                                  })}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </>
                );
              })()}
            </>
          )}
        </Box>
      ))}
      <Box position="fixed" bottom={{ base: 4, md: 6 }} right={{ base: 4, md: 6 }} zIndex={20}>
        <Button as={RouterLink} to="/share/visual-map" colorScheme="brand" variant="solid" size="sm" target="_blank" rel="noopener noreferrer">
          Preview
        </Button>
      </Box>
    </Box>
  );
}
