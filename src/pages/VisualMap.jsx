import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, Text, Input, VStack, Tag, TagLabel, Wrap, WrapItem, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody, Tabs, TabList, TabPanels, Tab, TabPanel, SimpleGrid, Button, useColorModeValue } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { getProgramColor } from '../utils/programColors';
import { buildTable, printContent } from '../utils/printDesign';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';
import { FiPrinter } from 'react-icons/fi';

const SESSIONS = ['Morning','Afternoon','Evening'];

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

function BlockChips({ blocks, day, session, programByBlock }) {
  const subtle = useColorModeValue('gray.600','gray.400');
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
  const { allCourses } = useData();
  const [q, setQ] = useState('');
  const border = useColorModeValue('gray.200','gray.700');
  const cellBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');

  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);

  const tabs = useMemo(() => {
    return DAY_CODES.map(day => {
      const roomSet = new Set();
      allCourses.forEach(c => {
        if (Array.isArray(c.f2fDays) && c.f2fDays.includes(day)) roomSet.add(c.room || '—');
      });
      const rooms = Array.from(roomSet).sort((a,b)=>String(a).localeCompare(String(b)));
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
    return tabs.map(t => ({ ...t, rooms: t.rooms.filter(r => String(r).toLowerCase().includes(ql)) }));
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
    const label = labelByCode[day.day] || day.day;
    printContent({ title: `Visual Map — ${label}`, subtitle: 'Blocks per Room and Session', bodyHtml: table });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Visual Map</Heading>
        <Input placeholder="Filter rooms…" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" />
      </HStack>

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
                  <Text fontWeight="800" fontSize="xl">{(() => { let s = 0; SESSIONS.forEach(ses => { t.rooms.forEach(r => { s += (t.matrix[ses]?.get(r)?.size || 0); }); }); return s; })()}</Text>
                </Box>
                <Box bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4} display={{ base: 'none', md: 'block' }}>
                  <Text fontSize="xs" color={subtle}>Non-empty Cells</Text>
                  <Text fontWeight="800" fontSize="xl">{(() => { let s = 0; SESSIONS.forEach(ses => { t.rooms.forEach(r => { s += ((t.matrix[ses]?.get(r)?.size || 0) > 0 ? 1 : 0); }); }); return s; })()}</Text>
                </Box>
              </SimpleGrid>

              <Box overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={cellBg}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>Room</th>
                      {SESSIONS.map(s => (
                        <th key={s} style={{ textAlign: 'left', padding: '10px 12px' }}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rooms.map(r => {
                      const mM = t.matrix['Morning']?.get(r) || new Map();
                      const mA = t.matrix['Afternoon']?.get(r) || new Map();
                      const mE = t.matrix['Evening']?.get(r) || new Map();
                      const bM = Array.from(mM.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      const bA = Array.from(mA.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      const bE = Array.from(mE.keys()).sort((a,b)=>String(a).localeCompare(String(b)));
                      return (
                        <tr key={r}>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid var(--chakra-colors-gray-200)' }}>
                            <HStack>
                              <Box w="10px" h="10px" rounded="full" bg={roomAccent(r)}></Box>
                              <Text fontWeight="600">{r}</Text>
                            </HStack>
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid var(--chakra-colors-gray-200)' }}>
                            {bM.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={bM} day={t.day} session={'Morning'} programByBlock={mM} />}
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid var(--chakra-colors-gray-200)' }}>
                            {bA.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={bA} day={t.day} session={'Afternoon'} programByBlock={mA} />}
                          </td>
                          <td style={{ padding: '10px 12px', borderTop: '1px solid var(--chakra-colors-gray-200)' }}>
                            {bE.length === 0 ? <Text fontSize="xs" color={subtle}>—</Text> : <BlockChips blocks={bE} day={t.day} session={'Evening'} programByBlock={mE} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Box>
  );
}
