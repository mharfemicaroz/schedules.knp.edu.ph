import React, { useMemo, useState } from 'react';
import { Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, useColorModeValue, HStack, Text, Button, Input, VStack, Wrap, WrapItem, Tag, TagLabel, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverCloseButton, SimpleGrid, RadioGroup, Radio } from '@chakra-ui/react';
import { useData } from '../context/DataContext';
import { Link as RouterLink } from 'react-router-dom';
import { getProgramColor } from '../utils/programColors';
import MiniBarChart from '../components/MiniBarChart';
import { FiPrinter } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';

const SESSIONS = ['Morning', 'Afternoon', 'Evening'];

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

export default function ViewsSession() {
  const { allCourses } = useData();
  const border = useColorModeValue('gray.200','gray.700');
  const cellBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('day'); // 'day' | 'room'
  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);

  // Day tabs data
  const tabs = useMemo(() => {
    return DAY_CODES.map(day => {
      const roomSet = new Set();
      allCourses.forEach(c => {
        if (Array.isArray(c.f2fDays) && c.f2fDays.includes(day)) roomSet.add(c.room || '');
      });
      const rooms = Array.from(roomSet).sort((a,b)=>String(a).localeCompare(String(b)));
      const matrix = {};
      SESSIONS.forEach(s => { matrix[s] = new Map(rooms.map(r => [r, new Map()])); });
      allCourses.forEach(c => {
        if (!(Array.isArray(c.f2fDays) && c.f2fDays.includes(day))) return;
        const session = deriveSession(c.timeStartMinutes, c.session);
        const room = c.room || '';
        const block = c.section || '';
        const prog = c.program || '';
        if (!matrix[session]) matrix[session] = new Map(rooms.map(r => [r, new Map()]));
        if (!matrix[session].has(room)) matrix[session].set(room, new Map());
        const m = matrix[session].get(room);
        if (!m.has(block)) m.set(block, prog);
      });
      return { day, rooms, matrix };
    });
  }, [allCourses]);

  const filteredTabs = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return tabs;
    return tabs.map(t => ({ ...t, rooms: t.rooms.filter(r => String(r).toLowerCase().includes(ql)) }));
  }, [tabs, q]);

  // Room tabs data
  const roomTabs = useMemo(() => {
    const roomSet = new Set();
    allCourses.forEach(c => { if (c.room) roomSet.add(c.room); });
    const rooms = Array.from(roomSet).sort((a,b)=>String(a).localeCompare(String(b)));
    return rooms.map(room => {
      const sessions = {};
      SESSIONS.forEach(s => { sessions[s] = new Map(DAY_CODES.map(d => [d, new Map()])); });
      allCourses.forEach(c => {
        const r = c.room || '';
        if (String(r) !== String(room)) return;
        (Array.isArray(c.f2fDays) ? c.f2fDays : []).forEach(day => {
          const ses = deriveSession(c.timeStartMinutes, c.session);
          if (!sessions[ses]) sessions[ses] = new Map(DAY_CODES.map(d => [d, new Map()]));
          if (!sessions[ses].has(day)) sessions[ses].set(day, new Map());
          const m = sessions[ses].get(day);
          const block = c.section || '';
          const prog = c.program || '';
          if (!m.has(block)) m.set(block, prog);
        });
      });
      return { room, sessions };
    });
  }, [allCourses]);

  const filteredRoomTabs = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return roomTabs;
    return roomTabs.filter(t => String(t.room).toLowerCase().includes(ql));
  }, [roomTabs, q]);

  function onPrint(day) {
    const headers = ['Room', 'Morning Blocks', 'Afternoon Blocks', 'Evening Blocks'];
    const rows = day.rooms.map(r => {
      const mM = day.matrix['Morning']?.get(r) || new Map();
      const mA = day.matrix['Afternoon']?.get(r) || new Map();
      const mE = day.matrix['Evening']?.get(r) || new Map();
      return [r, Array.from(mM.keys()).join(', '), Array.from(mA.keys()).join(', '), Array.from(mE.keys()).join(', ')];
    });
    const table = buildTable(headers, rows);
    printContent({ title: `By Session â€” ${day.day}`, subtitle: 'Blocks per Room and Session', bodyHtml: table });
  }

  function onPrintRoom(rt) {
    const headers = ['Day', 'Morning Blocks', 'Afternoon Blocks', 'Evening Blocks'];
    const rows = DAY_CODES.map(day => {
      const mM = rt.sessions['Morning']?.get(day) || new Map();
      const mA = rt.sessions['Afternoon']?.get(day) || new Map();
      const mE = rt.sessions['Evening']?.get(day) || new Map();
      return [day, Array.from(mM.keys()).join(', '), Array.from(mA.keys()).join(', '), Array.from(mE.keys()).join(', ')];
    });
    const table = buildTable(headers, rows);
    printContent({ title: `By Room â€” ${rt.room}`, subtitle: 'Blocks per Day and Session', bodyHtml: table });
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

  function BlockChips({ blocks, day, session, programByBlock }) {
    const maxInline = 3;
    const shown = blocks.slice(0, maxInline);
    const more = blocks.slice(maxInline);
    return (
      <HStack align="start" spacing={2} wrap="wrap">
        {shown.map(b => {
          const prog = programByBlock?.get(b);
          const accent = getProgramColor(prog);
          return (
            <Tag key={b} size="sm" variant="subtle" colorScheme={accent.scheme} as={RouterLink} to={`/views/session/block/${encodeURIComponent(b)}?day=${encodeURIComponent(day)}&session=${encodeURIComponent(session)}`}>
              <TagLabel>{b}</TagLabel>
            </Tag>
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
                    const prog = programByBlock?.get(b);
                    const accent = getProgramColor(prog);
                    return (
                      <WrapItem key={b}>
                        <Tag size="sm" variant="subtle" colorScheme={accent.scheme} as={RouterLink} to={`/views/session/block/${encodeURIComponent(b)}?day=${encodeURIComponent(day)}&session=${encodeURIComponent(session)}`}>
                          <TagLabel>{b}</TagLabel>
                        </Tag>
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

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">By Session</Heading>
        <HStack>
          <RadioGroup onChange={setMode} value={mode}>
            <HStack spacing={4}>
              <Radio value="day">By Day</Radio>
              <Radio value="room">By Room</Radio>
            </HStack>
          </RadioGroup>
          <Input placeholder="Filter roomâ€¦" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" />
        </HStack>
      </HStack>

      {mode === 'day' ? (
        <Tabs variant="enclosed-colored" colorScheme="brand">
          <TabList>
            {filteredTabs.map(t => (<Tab key={t.day}>{labelByCode[t.day] || t.day}</Tab>))}
          </TabList>
          <TabPanels>
            {filteredTabs.map(t => (
              <TabPanel key={t.day} px={0}>
                <HStack justify="flex-end" mb={2}>
                  <Button leftIcon={<FiPrinter />} onClick={() => onPrint(t)} variant="outline" size="sm">Print</Button>
                </HStack>
                <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
                  <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                    <Text fontSize="xs" color={subtle}>Rooms</Text>
                    <Text fontWeight="800" fontSize="xl">{t.rooms.length}</Text>
                  </Box>
                  <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                    <Text fontSize="xs" color={subtle}>Blocks</Text>
                    <Text fontWeight="800" fontSize="xl">{(() => { let s = 0; ['Morning','Afternoon','Evening'].forEach(ses => { t.rooms.forEach(r => { s += (t.matrix[ses]?.get(r)?.size || 0); }); }); return s; })()}</Text>
                  </Box>
                  <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
                    <Text fontSize="xs" color={subtle}>Non-empty Cells</Text>
                    <Text fontWeight="800" fontSize="xl">{(() => { let s = 0; ['Morning','Afternoon','Evening'].forEach(ses => { t.rooms.forEach(r => { s += ((t.matrix[ses]?.get(r)?.size || 0) > 0 ? 1 : 0); }); }); return s; })()}</Text>
                  </Box>
                </SimpleGrid>
                {t.rooms.length === 0 ? (
                  <Text color={subtle}>No rooms</Text>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                    {t.rooms.map(r => {
                      const mMorning = t.matrix['Morning']?.get(r) || new Map();
                      const mAfternoon = t.matrix['Afternoon']?.get(r) || new Map();
                      const mEvening = t.matrix['Evening']?.get(r) || new Map();
                      const blocksMorning = Array.from(mMorning.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      const blocksAfternoon = Array.from(mAfternoon.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      const blocksEvening = Array.from(mEvening.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      return (
                        <Box key={r} as={RouterLink} to={`/views/rooms/${encodeURIComponent(r)}?day=${encodeURIComponent(t.day)}`} className="view-card" bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} position="relative" transition="transform 0.18s ease, box-shadow 0.18s ease" cursor="pointer" _hover={{ textDecoration: 'none' }}>
                          <Box position="absolute" top={0} left={0} right={0} h="4px" bg={roomAccent(r)} roundedTop="xl" />
                          <VStack align="stretch" spacing={3}>
                            <HStack justify="space-between">
                              <Text fontWeight="800">{r}</Text>
                            </HStack>
                            <VStack align="stretch" spacing={2}>
                              <VStack align="stretch" spacing={1}>
                                <Text fontSize="xs" color={subtle}>Morning</Text>
                                {blocksMorning.length === 0 ? <Text fontSize="xs" color={subtle}></Text> : <BlockChips blocks={blocksMorning} day={t.day} session={'Morning'} programByBlock={mMorning} />}
                              </VStack>
                              <VStack align="stretch" spacing={1}>
                                <Text fontSize="xs" color={subtle}>Afternoon</Text>
                                {blocksAfternoon.length === 0 ? <Text fontSize="xs" color={subtle}></Text> : <BlockChips blocks={blocksAfternoon} day={t.day} session={'Afternoon'} programByBlock={mAfternoon} />}
                              </VStack>
                              <VStack align="stretch" spacing={1}>
                                <Text fontSize="xs" color={subtle}>Evening</Text>
                                {blocksEvening.length === 0 ? <Text fontSize="xs" color={subtle}></Text> : <BlockChips blocks={blocksEvening} day={t.day} session={'Evening'} programByBlock={mEvening} />}
                              </VStack>
                            </VStack>
                          </VStack>
                        </Box>
                      );
                    })}
                  </SimpleGrid>
                )}
                <Box mt={4} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontWeight="700" mb={2}>Blocks by Session</Text>
                  <MiniBarChart data={['Morning','Afternoon','Evening'].map(ses => ({ key: ses, value: t.rooms.reduce((s, r) => s + ((t.matrix[ses]?.get(r)?.size || 0)), 0) }))} />
                </Box>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      ) : mode === 'room' ? (
        <Tabs variant="enclosed-colored" colorScheme="brand">
          <TabList>
            {filteredRoomTabs.map(rt => (<Tab key={rt.room}>{rt.room}</Tab>))}
          </TabList>
          <TabPanels>
            {filteredRoomTabs.map(rt => (
              <TabPanel key={rt.room} px={0}>
                <HStack justify="flex-end" mb={2}>
                  <Button leftIcon={<FiPrinter />} onClick={() => onPrintRoom(rt)} variant="outline" size="sm">Print</Button>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  {SESSIONS.map(ses => {
                    const dayMap = rt.sessions[ses] || new Map();
                    const totalBlocks = DAY_CODES.reduce((acc, d) => acc + ((dayMap.get(d)?.size || 0)), 0);
                    return (
                      <Box key={ses} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                        <Text fontWeight="800" mb={2}>{ses}</Text>
                        <Text fontSize="xs" color={subtle} mb={3}>{totalBlocks} block(s)</Text>
                        <VStack align="stretch" spacing={2}>
                          {DAY_CODES.map(d => {
                            const m = dayMap.get(d) || new Map();
                            const blocks = Array.from(m.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                            return (
                              <VStack key={d} align="stretch" spacing={1}>
                                <Text fontSize="xs" color={subtle}>{labelByCode[d] || d}</Text>
                                {blocks.length === 0 ? (
                                  <Text fontSize="xs" color={subtle}></Text>
                                ) : (
                                  <BlockChips blocks={blocks} day={d} session={ses} programByBlock={m} />
                                )}
                              </VStack>
                            );
                          })}
                        </VStack>
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      ) : null}
    </Box>
  );
}

