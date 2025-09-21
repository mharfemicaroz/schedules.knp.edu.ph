import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, Text, Input, VStack, Tag, TagLabel, Wrap, WrapItem, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverCloseButton, PopoverBody, Tabs, TabList, TabPanels, Tab, TabPanel, SimpleGrid, Button, useColorModeValue, Switch, FormControl, FormLabel, Badge , Divider, Icon } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { getProgramColor } from '../utils/programColors';
import { buildTable, printContent } from '../utils/printDesign';
import MiniBarChart from '../components/MiniBarChart';
import { DAY_CODES, getCurrentWeekDays } from '../utils/week';
import { FiPrinter, FiInfo, FiAlertCircle } from 'react-icons/fi';
import { findDayAnnotations } from '../utils/scheduleUtils';
import { useLocalStorage, getInitialToggleState, getExamDateSet } from '../utils/scheduleUtils';

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
  const { allCourses, acadData, holidays } = useData();
  const [q, setQ] = useState('');
  const [viewMode, setViewMode] = useLocalStorage('visualMapViewMode', getInitialToggleState(acadData, 'visualMapViewMode', 'regular'));
  const border = useColorModeValue('gray.200','gray.700');
  const cellBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.400');

  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const labelByCode = useMemo(() => Object.fromEntries(weekDays.map(d => [d.code, d.label])), [weekDays]);

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


  // Check which days have exam data
  const daysWithExams = useMemo(() => {
    const examDays = new Set();
    allCourses.forEach(c => {
      if (c.examDay) examDays.add(c.examDay);
    });
    return examDays;
  }, [allCourses]);

  const tabs = useMemo(() => {
    return DAY_CODES.map(day => {
      const hasExamData = daysWithExams.has(day);
      const useExamMode = (autoExamDays.has(day) && hasExamData) || (viewMode === 'examination' && hasExamData);

      if (useExamMode) {
        // Examination mode with exam data
        const examRoomSet = new Set();
        allCourses.forEach(c => {
          if (c.examDay === day) examRoomSet.add(c.examRoom || '—');
        });
        const rooms = Array.from(examRoomSet).sort((a,b)=>String(a).localeCompare(String(b)));
        const matrix = {};
        SESSIONS.forEach(s => { matrix[s] = new Map(rooms.map(r => [r, new Map()])); });
        allCourses.forEach(c => {
          if (c.examDay !== day) return;
          const session = deriveSession(c.timeStartMinutes, c.examSession);
          const room = c.examRoom || '—';
          const block = c.section || '—';
          const prog = c.program || '';
          if (!matrix[session]) matrix[session] = new Map(rooms.map(r => [r, new Map()]));
          if (!matrix[session].has(room)) matrix[session].set(room, new Map());
          const m = matrix[session].get(room);
          if (!m.has(block)) m.set(block, prog);
        });
        return { day, rooms, matrix, hasExamData: true, mode: 'exam' };
      } else {
        // Regular F2F mode or days without exam data
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
        return { day, rooms, matrix, hasExamData, mode: 'regular' };
      }
    });
  }, [allCourses, viewMode, daysWithExams]);

  const filteredTabs = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return tabs;
    return tabs.map(t => ({ ...t, rooms: t.rooms.filter(r => String(r).toLowerCase().includes(ql)) }));
  }, [tabs, q]);

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
      title: `Visual Map — ${label}`,
      subtitle: `Blocks per Room and Session • ${scheduleType}`,
      bodyHtml: table
    });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <HStack align="center" spacing={3}>
          <Heading size="md">Visual Map</Heading>
          {viewMode === 'examination' && (
            <Badge colorScheme="blue" variant="subtle">{autoExamDays.size > 0 ? 'Examination Mode' : 'Exam Mode Preview'}</Badge>
          )}
          {autoExamDays.size > 0 && viewMode === 'regular' && (
            <Badge colorScheme="orange" variant="subtle">Exam Period Detected</Badge>
          )}
        </HStack>
        <HStack spacing={4}>
          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium">
              Regular F2F
            </FormLabel>
            <Switch
              id="schedule-mode"
              colorScheme="blue"
              size="lg"
              isChecked={viewMode === 'examination'}
              onChange={(e) => setViewMode(e.target.checked ? 'examination' : 'regular')}
            />
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium" ml={2}>
              Examination
            </FormLabel>
          </FormControl>
          <Input placeholder="Filter rooms…" value={q} onChange={e=>setQ(e.target.value)} maxW="280px" />
        </HStack>
      </HStack>

      <Tabs variant="enclosed-colored" colorScheme="brand">
        <TabList>
          {filteredTabs.map(t => (
        <Tab key={t.day}>
          <HStack spacing={2}>
            <Text>{labelByCode[t.day] || t.day}</Text>
            {(t.hasExamData && (autoExamDays.has(t.day) || viewMode === 'examination')) && (
              <Badge size="sm" colorScheme="green" variant="subtle">Exam</Badge>
            )}
            {dayAnnotations[t.day]?.holiday && (
              <Badge size="sm" colorScheme="red" variant="subtle" title={dayAnnotations[t.day].holiday.name}>
                Holiday
              </Badge>
            )}
            {dayAnnotations[t.day]?.mode === 'asynchronous' && (
              <Badge size="sm" colorScheme="purple" variant="subtle" title="Asynchronous Mode">
                Async
              </Badge>
            )}
            {dayAnnotations[t.day]?.mode === 'no_class' && (
              <Badge size="sm" colorScheme="gray" variant="subtle" title="No Class">
                No Class
              </Badge>
            )}
          </HStack>
        </Tab>
          ))}
        </TabList>
        <TabPanels>
          {filteredTabs.map(t => (
          <TabPanel key={t.day} px={0}>
            <HStack justify="flex-end" mb={2}>
              <Button leftIcon={<FiPrinter />} onClick={() => onPrint(t)} variant="outline" size="sm">Print</Button>
            </HStack>

            {!t.hasExamData && viewMode === 'examination' ? (
              <Box p={4} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" mb={4}>
                <Text color={subtle} fontSize="sm">
                  No examination schedule available for {labelByCode[t.day] || t.day}. Showing regular F2F schedule instead.
                </Text>
              </Box>
            ) : null}

            {dayAnnotations[t.day]?.holiday && (
              <Box p={4} mb={4} bg="red.50" borderWidth="1px" borderColor="red.200" rounded="md" display="flex" alignItems="center" gap={3}>
                <Icon as={FiAlertCircle} color="red.500" boxSize={5} />
                <Box>
                  <Text fontWeight="700" color="red.600">{dayAnnotations[t.day].holiday.name}</Text>
                  <Text fontSize="sm" color="red.600">{dayAnnotations[t.day].holiday.type}</Text>
                </Box>
              </Box>
            )}

            {dayAnnotations[t.day]?.events.length > 0 && (
              <Box p={4} mb={4} bg="purple.50" borderWidth="1px" borderColor="purple.200" rounded="md">
                {dayAnnotations[t.day].events.map((evt, idx) => (
                  <Box key={idx} mb={idx < dayAnnotations[t.day].events.length - 1 ? 2 : 0}>
                    <Text fontWeight="700" color="purple.600">{evt.event}</Text>
                    {evt.type && <Text fontSize="sm" color="purple.600">Type: {evt.type}</Text>}
                    {evt.mode && <Text fontSize="sm" color="purple.600">Mode: {evt.mode}</Text>}
                  </Box>
                ))}
              </Box>
            )}

            {dayAnnotations[t.day]?.mode === 'no_class' ? (
              <Box p={8} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" mb={4} textAlign="center" color={subtle}>
                <Text fontWeight="700" fontSize="lg" mb={2}>No Classes Today</Text>
                <Text fontSize="md">The schedule for this day is disabled due to a no-class event.</Text>
              </Box>
            ) : (
              <>
                <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
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
                    <Text fontWeight="800" fontSize="xl">{(() => {
                      const present = (() => { const set = new Set(); SESSIONS.forEach(ses => { t.rooms.forEach(r => { (t.matrix[ses]?.get(r) || new Map()).forEach((_, b) => set.add(b)); }); }); return set.size; })();
                      const total = (() => { const all = new Set(); (allCourses||[]).forEach(c => all.add(c.section)); return all.size; })();
                      return `${present}/${total}`;
                    })()}</Text>
                  </Box>
                </SimpleGrid>

                <Box overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={cellBg}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, }}>
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
                
                <Box mt={6} bg={cellBg} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
                  <Text fontWeight="700" mb={2}>Blocks by Program (present/total)</Text>
                  <MiniBarChart
                    labelKey="label"
                    valueKey="value"
                    colorKey="color"
                    unit="%"
                    maxItems={999}
                    data={(() => {
                      const presentByProg = new Map();
                      const totalByProg = new Map();
                      (allCourses || []).forEach(c => {
                        const prog = c.program || 'N/A';
                        const s = totalByProg.get(prog) || new Set();
                        s.add(c.section);
                        totalByProg.set(prog, s);
                      });
                      SESSIONS.forEach(ses => {
                        t.rooms.forEach(r => {
                          const m = t.matrix[ses]?.get(r) || new Map();
                          m.forEach((prog, block) => {
                            const s = presentByProg.get(prog || 'N/A') || new Set();
                            s.add(block);
                            presentByProg.set(prog || 'N/A', s);
                          });
                        });
                      });
                      const keys = Array.from(new Set([...totalByProg.keys(), ...presentByProg.keys()]));
                      const rows = keys.map(k => {
                        const total = (totalByProg.get(k) || new Set()).size;
                        const present = (presentByProg.get(k) || new Set()).size;
                        const pct = Math.round((present / Math.max(1, total)) * 100);
                        const color = getProgramColor(k).bar;
                        return { label: `${k} ${present}/${total}`, value: pct, color, _present: present };
                      })
                      .filter(r => r._present > 0)
                      .sort((a,b)=> b.value - a.value || String(a.label).localeCompare(String(b.label)));
                      return rows;
                    })()}
                  />
                </Box>
              </>
            )}
          </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Box>
  );
}

