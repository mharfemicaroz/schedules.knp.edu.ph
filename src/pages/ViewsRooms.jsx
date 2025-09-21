import React, { useMemo, useState } from 'react';
import { Box, Heading, SimpleGrid, useColorModeValue, IconButton, Tooltip, Input, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Text, VStack, Button } from '@chakra-ui/react';
import { useData } from '../context/DataContext';
import { Link as RouterLink } from 'react-router-dom';
import { FiChevronRight, FiPrinter } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import MiniBarChart from '../components/MiniBarChart';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';

export default function ViewsRooms() {
  const { allCourses } = useData();
  const border = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const DAYS = DAY_CODES;
    const res = [];
    // Mon-Fri tabs
    for (const day of DAYS) {
      const m = new Map();
      allCourses.forEach(c => {
        const hasDay = Array.isArray(c.f2fDays) ? c.f2fDays.includes(day) : false;
        if (!hasDay) return;
        const room = c.room || 'â€”';
        const e = m.get(room) || { room, timeSet: new Map(), uniqueCount: 0, minTerm: 9, minStart: Infinity };
        const label = c.schedule || '';
        if (label) {
          const start = Number.isFinite(c.timeStartMinutes) ? c.timeStartMinutes : 1e9;
          const prev = e.timeSet.get(label);
          if (prev == null || start < prev) e.timeSet.set(label, start);
          if ((c.termOrder ?? 9) < e.minTerm) e.minTerm = c.termOrder ?? 9;
          if (start < e.minStart) e.minStart = start;
        }
        m.set(room, e);
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
      res.push({ day, rows, count });
    }
    // Unscheduled tab: no Mon-Fri F2F days
    const unschedMap = new Map();
    const weekdaySet = new Set(['Mon','Tue','Wed','Thu','Fri']);
    allCourses.forEach(c => {
      const f2f = Array.isArray(c.f2fDays) ? c.f2fDays : [];
      const hasWeekday = f2f.some(d => weekdaySet.has(d));
      if (hasWeekday) return;
      const room = c.room || 'â€”';
      const e = unschedMap.get(room) || { room, timeSet: new Map(), uniqueCount: 0, minTerm: 9, minStart: Infinity };
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
    res.push({ day: 'Unscheduled', rows: unschedRows, count: unschedCount });
    return res;
  }, [allCourses]);

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
    const weekDays = getCurrentWeekDays();
    const labelByCode = Object.fromEntries(weekDays.map(d => [d.code, d.label]));
    const label = labelByCode[dayGroup.day] || dayGroup.day;
    printContent({ title: `Rooms — ${label}`, subtitle: 'Unique F2F Time Slots per Room', bodyHtml: table });
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

  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Loads by Room (F2F, Mon–Fri)</Heading>
        <Input placeholder="Filter rooms…" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" />
      </HStack>
      <Tabs variant="enclosed-colored" colorScheme="brand">
        <TabList>
          {filteredGroups.map(g => (
            <Tab key={g.day} isDisabled={g.rows.length === 0}>{labelByCode[g.day] || g.day} {g.count ? `(${g.count})` : ''}</Tab>
          ))}
        </TabList>
        <TabPanels>
          {filteredGroups.map(g => (
            <TabPanel key={g.day} px={0}>
              <HStack justify="flex-end" mb={2}>
                <Button leftIcon={<FiPrinter />} onClick={() => onPrint(g)} variant="outline" size="sm">Print</Button>
              </HStack>
              <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
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
                  <Text fontWeight="800" fontSize="xl">{(() => { const t = Math.min(...g.rows.map(r => r.minTerm || 9)); return t===1?'1st':t===2?'2nd':t===3?'Sem':'—'; })()}</Text>
                </Box>
              </SimpleGrid>
              {g.rows.length === 0 ? (
                <Text color="gray.500">No rooms</Text>
              ) : (
                <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
                  {g.rows.map(r => (
                    <Box
                      key={`${g.day}-${r.room}`}
                      as={RouterLink}
                      to={`/views/rooms/${encodeURIComponent(r.room)}?day=${encodeURIComponent(g.day)}`}
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
                        <HStack justify="space-between" w="full">
                          <Text fontWeight="800">{r.room}</Text>
                          <Tooltip label={`View schedule (${labelByCode[g.day] || g.day})`}>
                            <IconButton as={RouterLink} to={`/views/rooms/${encodeURIComponent(r.room)}?day=${encodeURIComponent(g.day)}`} aria-label="View" icon={<FiChevronRight />} size="sm" variant="ghost" onClick={(e)=>e.stopPropagation()} />
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
