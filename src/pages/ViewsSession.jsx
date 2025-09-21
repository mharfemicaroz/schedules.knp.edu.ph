import React, { useMemo, useState } from 'react';
import { Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, useColorModeValue, HStack, Text, Button, Tooltip, Input, VStack, Wrap, WrapItem, Tag, TagLabel, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverCloseButton, SimpleGrid } from '@chakra-ui/react';
import { useData } from '../context/DataContext';
import { Link as RouterLink } from 'react-router-dom';
import { getProgramColor } from '../utils/programColors';
import MiniBarChart from '../components/MiniBarChart';
import { FiPrinter } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];
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
  const headerBg = useColorModeValue('gray.50','gray.700');
  const cellBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');
  const [q, setQ] = useState('');

  const tabs = useMemo(() => {
    return DAYS.map(day => {
      // Collect all rooms first
      const roomSet = new Set();
      allCourses.forEach(c => {
        if (Array.isArray(c.f2fDays) && c.f2fDays.includes(day)) {
          roomSet.add(c.room || '—');
        }
      });
      const rooms = Array.from(roomSet).sort((a,b)=>String(a).localeCompare(String(b)));
      // Build matrix: session -> room -> Map(block -> program)
      const matrix = {};
      SESSIONS.forEach(s => { matrix[s] = new Map(rooms.map(r => [r, new Map()])); });
      allCourses.forEach(c => {
        if (!(Array.isArray(c.f2fDays) && c.f2fDays.includes(day))) return;
        const session = deriveSession(c.timeStartMinutes, c.session);
        const room = c.room || '—';
        const block = c.section || '—';
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
    return tabs.map(t => ({
      ...t,
      rooms: t.rooms.filter(r => String(r).toLowerCase().includes(ql))
    }));
  }, [tabs, q]);

  function onPrint(day) {
    const headers = ['Room', 'Morning Blocks', 'Afternoon Blocks', 'Evening Blocks'];
    const rows = day.rooms.map(r => {
      const mM = day.matrix['Morning']?.get(r) || new Map();
      const mA = day.matrix['Afternoon']?.get(r) || new Map();
      const mE = day.matrix['Evening']?.get(r) || new Map();
      return [r, Array.from(mM.keys()).join(', '), Array.from(mA.keys()).join(', '), Array.from(mE.keys()).join(', ')];
    });
    const table = buildTable(headers, rows);
    printContent({ title: `By Session • ${day.day}`, subtitle: 'Blocks per Room and Session', bodyHtml: table });
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
        <Heading size="md">By Session (Mon–Fri)</Heading>
        <Input placeholder="Filter room…" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" />
      </HStack>
      <Tabs variant="enclosed-colored" colorScheme="brand">
        <TabList>
          {filteredTabs.map(t => (
            <Tab key={t.day}>{t.day}</Tab>
          ))}
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
                  <Text fontWeight="800" fontSize="xl">{(() => {
                    let s = 0; ['Morning','Afternoon','Evening'].forEach(ses => { t.rooms.forEach(r => { s += (t.matrix[ses]?.get(r)?.size || 0); }); }); return s;
                  })()}</Text>
                </Box>
                <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
                  <Text fontSize="xs" color={subtle}>Non-empty Cells</Text>
                  <Text fontWeight="800" fontSize="xl">{(() => {
                    let s = 0; ['Morning','Afternoon','Evening'].forEach(ses => { t.rooms.forEach(r => { s += ((t.matrix[ses]?.get(r)?.size || 0) > 0 ? 1 : 0); }); }); return s;
                  })()}</Text>
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
                      <Box
                        key={r}
                        as={RouterLink}
                        to={`/views/rooms/${encodeURIComponent(r)}?day=${encodeURIComponent(t.day)}`}
                        className="view-card"
                        bg={cellBg}
                        borderWidth="1px"
                        borderColor={border}
                        rounded="xl"
                        p={4}
                        position="relative"
                        transition="transform 0.18s ease, box-shadow 0.18s ease"
                        cursor="pointer"
                        _hover={{ textDecoration: 'none' }}
                      >
                        <Box position="absolute" top={0} left={0} right={0} h="4px" bg={roomAccent(r)} roundedTop="xl" />
                        <VStack align="stretch" spacing={3}>
                          <HStack justify="space-between">
                            <Text fontWeight="800">{r}</Text>
                          </HStack>
                          <VStack align="stretch" spacing={2}>
                            <VStack align="stretch" spacing={1}>
                              <Text fontSize="xs" color={subtle}>Morning</Text>
                              {blocksMorning.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={blocksMorning} day={t.day} session={'Morning'} programByBlock={mMorning} />}
                            </VStack>
                            <VStack align="stretch" spacing={1}>
                              <Text fontSize="xs" color={subtle}>Afternoon</Text>
                              {blocksAfternoon.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={blocksAfternoon} day={t.day} session={'Afternoon'} programByBlock={mAfternoon} />}
                            </VStack>
                            <VStack align="stretch" spacing={1}>
                              <Text fontSize="xs" color={subtle}>Evening</Text>
                              {blocksEvening.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={blocksEvening} day={t.day} session={'Evening'} programByBlock={mEvening} />}
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
    </Box>
  );
}
