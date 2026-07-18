import React, { useMemo, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
  Button,
  VStack,
  Text,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  SimpleGrid,
  Grid,
  Icon,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import {
  FiShare2,
  FiPrinter,
  FiArrowLeft,
  FiBookOpen,
  FiClock,
  FiMapPin,
  FiUser,
  FiCalendar,
} from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import { usePublicView } from '../utils/uiFlags';
import { encodeShareDepartment, decodeShareDepartment } from '../utils/share';
import useEvaluationEnabled from '../hooks/useEvaluationEnabled';

function yearOrder(y) {
  const s = String(y || '').toLowerCase();
  if (s.includes('1st')) return 1;
  if (s.includes('2nd')) return 2;
  if (s.includes('3rd')) return 3;
  if (s.includes('4th')) return 4;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 99;
}

function normalizeTerm(term) {
  const value = String(term || '').trim().toLowerCase();
  if (value.startsWith('1')) return 'first';
  if (value.startsWith('2')) return 'second';
  if (value.startsWith('s') || value.includes('semester')) return 'sem';
  return 'other';
}

function termOrder(term) {
  const key = normalizeTerm(term);
  return { first: 1, second: 2, sem: 3, other: 4 }[key];
}

function termLabel(term) {
  const key = normalizeTerm(term);
  if (key === 'first') return '1st Term';
  if (key === 'second') return '2nd Term';
  if (key === 'sem') return 'Sem Term';
  return String(term || 'Other Term');
}

function termDescription(term) {
  const key = normalizeTerm(term);
  if (key === 'first') return 'First half of the semester';
  if (key === 'second') return 'Second half of the semester';
  if (key === 'sem') return 'Runs across the full semester';
  return 'Additional schedule grouping';
}

export default function DepartmentSchedule() {
  const { dept: deptParam } = useParams();
  const isPublic = usePublicView();
  const dept = isPublic
    ? decodeShareDepartment(String(deptParam || ''))
    : decodeURIComponent(deptParam || '');

  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector((s) => s.data.loading);
  const acadData = useSelector((s) => s.data.acadData);
  const authUser = useSelector((s) => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  const [viewMode, setViewMode] = useLocalStorage(
    'departmentScheduleViewMode',
    getInitialToggleState(acadData, 'departmentScheduleViewMode', 'regular')
  );
  const { enabled: evaluationsEnabled } = useEvaluationEnabled();
  const effectiveShowAccessCodes = !!evaluationsEnabled;
  const termAllowsAccess = React.useCallback((t) => {
    if (!evaluationsEnabled) return false;
    const v = String(t || '').trim().toLowerCase();
    if (!v) return false;
    if (v.startsWith('1')) return true;
    if (v.startsWith('2')) return true;
    if (v.startsWith('s')) return true;
    if (v.includes('summer')) return true;
    return false;
  }, [evaluationsEnabled]);

  const border = useColorModeValue('gray.200', 'gray.700');
  const tableBg = useColorModeValue('white', 'gray.800');
  const panelBg = useColorModeValue('white', 'gray.800');
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const muted = useColorModeValue('gray.600', 'gray.400');
  const rowHover = useColorModeValue('gray.50', 'whiteAlpha.50');
  const termHeaderBg = useColorModeValue('gray.50', 'gray.700');
  const termBorder = useColorModeValue('gray.300', 'gray.600');

  useEffect(() => {
    try { localStorage.removeItem('departmentScheduleShowAccessCodes'); } catch {}
  }, []);

  const groups = useMemo(() => {
    const m = new Map();
    (allCourses || []).forEach((c) => {
      if (String(c.program || '') !== dept) return;
      const yl = c.yearlevel || 'N/A';
      const list = m.get(yl) || [];
      list.push(c);
      m.set(yl, list);
    });

    const entries = Array.from(m.entries()).map(([yl, list]) => {
      const blockMap = new Map();
      list.forEach((c) => {
        const block = c.section || c.block || 'N/A';
        const arr = blockMap.get(block) || [];
        arr.push(c);
        blockMap.set(block, arr);
      });

      const blocks = Array.from(blockMap.entries())
        .map(([block, arr]) => {
          const sorted = arr.slice().sort((a, b) => {
            const oa = a.termOrder ?? 9;
            const ob = b.termOrder ?? 9;
            if (oa !== ob) return oa - ob;
            const ta = a.timeStartMinutes ?? Infinity;
            const tb = b.timeStartMinutes ?? Infinity;
            return ta - tb;
          });

          // Merge same (code+term+schedule+day) within a block; combine room and F2F day hints
          const mergedMap = new Map();
          sorted.forEach((c) => {
            const key = [c.code, c.term || '', c.schedule || '', c.day || ''].join('|');
            const prev = mergedMap.get(key);
            if (prev) {
              const prevRooms = String(prev.room || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const currRooms = String(c.room || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const roomSet = new Set([...prevRooms, ...currRooms]);
              prev.room = Array.from(roomSet).join(',');

              const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              const prevDays = Array.isArray(prev.f2fDays) ? prev.f2fDays : [];
              const currDays = Array.isArray(c.f2fDays) ? c.f2fDays : [];
              if (prevDays.length || currDays.length) {
                const daySet = new Set([...prevDays, ...currDays].filter(Boolean));
                const mergedDays = order.filter((d) => daySet.has(d));
                prev.f2fDays = mergedDays;
                const f2fStr = mergedDays.join(',');
                prev.f2fSched = f2fStr;
                prev.f2fsched = f2fStr;
              }
            } else {
              mergedMap.set(key, { ...c });
            }
          });

          const items = Array.from(mergedMap.values());
          const termMap = new Map();
          items.forEach((item) => {
            const key = normalizeTerm(item.term);
            const current = termMap.get(key) || { term: item.term, items: [] };
            current.items.push(item);
            termMap.set(key, current);
          });
          const terms = Array.from(termMap.values()).sort((a, b) => termOrder(a.term) - termOrder(b.term));
          return { block, items, terms };
        })
        .sort((a, b) => String(a.block).localeCompare(String(b.block), undefined, { numeric: true }));

      return { yl, blocks };
    });

    entries.sort((a, b) => yearOrder(a.yl) - yearOrder(b.yl));
    return entries;
  }, [allCourses, dept]);

  const summary = useMemo(() => {
    let blocks = 0;
    let courses = 0;
    groups.forEach((group) => {
      blocks += group.blocks.length;
      group.blocks.forEach((block) => {
        courses += block.items.length;
      });
    });
    return { yearLevels: groups.length, blocks, courses };
  }, [groups]);

  const getTermStyle = () => ({ colorScheme: 'gray', bg: termHeaderBg, border: termBorder });

  function onPrint() {
    const baseHeadersRegular = ['Year Level', 'Block', 'Term', 'Time', 'Code'];
    if (effectiveShowAccessCodes) baseHeadersRegular.push('Access Code');
    baseHeadersRegular.push('Title', 'Units', 'Room', 'Faculty');
    const baseHeadersExam = ['Year Level', 'Block', 'Term', 'Time', 'Code'];
    if (effectiveShowAccessCodes) baseHeadersExam.push('Access Code');
    baseHeadersExam.push('Title', 'Units', 'Room', 'Faculty', 'Exam Day', 'Exam Session', 'Exam Room');
    const headers = viewMode === 'examination' ? baseHeadersExam : baseHeadersRegular;
    const rows = [];
    groups.forEach((g) => {
      g.blocks.forEach((b) => {
        b.items.forEach((c) => {
          if (viewMode === 'examination') {
            const row = [
              g.yl,
              b.block,
              c.term,
              c.schedule || '',
              c.code,
            ];
            if (effectiveShowAccessCodes) row.push(termAllowsAccess(c.term) ? (c.accessCode || '') : '');
            row.push(
              c.title,
              String(c.unit ?? c.hours ?? ''),
              c.room || '',
              c.facultyName,
              c.examDay || '',
              c.examSession || '',
              c.examRoom || ''
            );
            rows.push(row);
          } else {
            const row = [
              g.yl,
              b.block,
              c.term,
              c.schedule || '',
              c.code,
            ];
            if (effectiveShowAccessCodes) row.push(termAllowsAccess(c.term) ? (c.accessCode || '') : '');
            row.push(
              c.title,
              String(c.unit ?? c.hours ?? ''),
              c.room || '',
              c.facultyName
            );
            rows.push(row);
          }
        });
      });
    });
    const table = buildTable(headers, rows);
    const scheduleType = viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule';
    printContent({
      title: `Program: ${dept}`,
      subtitle: `Year · Block · Term · Time - ${scheduleType}`,
      bodyHtml: table,
    });
  }

  return (
    <VStack align="stretch" spacing={{ base: 4, md: 6 }} bg={pageBg} mx={{ base: -1, md: 0 }}>
      <Box
        bgGradient="linear(to-br, blue.700, blue.600, teal.500)"
        color="white"
        rounded={{ base: 'xl', md: '2xl' }}
        px={{ base: 4, sm: 5, md: 7 }}
        py={{ base: 5, md: 7 }}
        boxShadow="lg"
      >
        <HStack justify="space-between" align={{ base: 'stretch', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} gap={5}>
          <Box minW={0}>
            <Text fontSize="xs" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color="whiteAlpha.800">
              Department class schedule
            </Text>
            <Heading mt={1} size={{ base: 'lg', md: 'xl' }} lineHeight="1.15" wordBreak="break-word">
              {dept}
            </Heading>
            <Wrap mt={4} spacing={2}>
              <WrapItem><Badge px={2.5} py={1} rounded="full" bg="whiteAlpha.200" color="white">{summary.yearLevels} year levels</Badge></WrapItem>
              <WrapItem><Badge px={2.5} py={1} rounded="full" bg="whiteAlpha.200" color="white">{summary.blocks} blocks</Badge></WrapItem>
              <WrapItem><Badge px={2.5} py={1} rounded="full" bg="whiteAlpha.200" color="white">{summary.courses} classes</Badge></WrapItem>
            </Wrap>
          </Box>
          <HStack spacing={2} flexWrap="wrap">
          {!isPublic && (
            <FormControl display="flex" alignItems="center" w="auto" bg="blackAlpha.200" rounded="lg" px={3} py={2}>
              <FormLabel htmlFor="schedule-mode" mb="0" fontSize="xs" fontWeight="700" color="white">
                Regular F2F
              </FormLabel>
              <Switch
                id="schedule-mode"
                colorScheme="blue"
                size="lg"
                isChecked={viewMode === 'examination'}
                onChange={(e) => setViewMode(e.target.checked ? 'examination' : 'regular')}
              />
              <FormLabel htmlFor="schedule-mode" mb="0" fontSize="xs" fontWeight="700" ml={2} color="white">
                Examination
              </FormLabel>
            </FormControl>
          )}
          <Button leftIcon={<FiPrinter />} onClick={onPrint} size="sm" bg="white" color="blue.700" _hover={{ bg: 'blue.50' }}>
            Print
          </Button>
          {isAdmin && !isPublic && (
            <Button
              as={RouterLink}
              to={`/share/departments/${encodeURIComponent(encodeShareDepartment(dept))}`}
              leftIcon={<FiShare2 />}
              bg="white"
              color="blue.700"
              size="sm"
            >
              Share
            </Button>
          )}
          {!isPublic && (
            <Button
              as={RouterLink}
              to="/views/departments"
              variant="outline"
              borderColor="whiteAlpha.600"
              color="white"
              leftIcon={<FiArrowLeft />}
              w="fit-content"
              _hover={{ bg: 'whiteAlpha.200' }}
            >
              Back
            </Button>
          )}
          </HStack>
        </HStack>
      </Box>

      {loading && <Text color="gray.500">Loading...</Text>}

      {groups.map((group) => (
        <Box key={group.yl} bg={panelBg} borderWidth="1px" borderColor={border} rounded={{ base: 'xl', md: '2xl' }} overflow="hidden" boxShadow="sm">
          <HStack px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }} justify="space-between" borderBottomWidth="1px" borderColor={border}>
            <HStack spacing={3}>
              <Box display="grid" placeItems="center" boxSize="40px" rounded="xl" bg="blue.50" color="blue.600">
                <Icon as={FiBookOpen} boxSize={5} />
              </Box>
              <Box>
                <Heading size="md">{group.yl}</Heading>
                <Text fontSize="sm" color={muted}>{group.blocks.length} {group.blocks.length === 1 ? 'block' : 'blocks'}</Text>
              </Box>
            </HStack>
          </HStack>
          {group.blocks.map((b) => (
            <Box key={b.block} px={{ base: 3, md: 6 }} py={{ base: 4, md: 5 }} borderBottomWidth="1px" borderColor={border} _last={{ borderBottomWidth: 0 }}>
              <HStack mb={4} justify="space-between">
                <Box>
                  <Text fontSize="xs" color={muted} fontWeight="700" textTransform="uppercase" letterSpacing="wide">Block</Text>
                  <Heading size="sm">{b.block}</Heading>
                </Box>
                <Badge variant="subtle" colorScheme="gray" rounded="full" px={2.5}>{b.items.length} classes</Badge>
              </HStack>

              <VStack align="stretch" spacing={4}>
                {b.terms.map((termGroup) => {
                  const termStyle = getTermStyle(termGroup.term);
                  return (
                    <Box key={`${b.block}-${normalizeTerm(termGroup.term)}`} borderWidth="1px" borderColor={termStyle.border} borderLeftWidth="5px" rounded="xl" overflow="hidden">
                      <HStack bg={termStyle.bg} px={{ base: 3, md: 4 }} py={3} justify="space-between" align="center">
                        <HStack spacing={3} minW={0}>
                          <Badge colorScheme={termStyle.colorScheme} variant="solid" rounded="full" px={3} py={1} whiteSpace="nowrap">
                            {termLabel(termGroup.term)}
                          </Badge>
                          <Text display={{ base: 'none', sm: 'block' }} fontSize="sm" fontWeight="600" color={muted} noOfLines={1}>
                            {termDescription(termGroup.term)}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" fontWeight="800" whiteSpace="nowrap">{termGroup.items.length} {termGroup.items.length === 1 ? 'class' : 'classes'}</Text>
                      </HStack>

                      <SimpleGrid display={{ base: 'grid', lg: 'none' }} columns={{ base: 1, sm: 2 }} spacing={3} p={3} bg={tableBg}>
                        {termGroup.items.map((c, idx) => (
                          <Box key={`${c.facultyId}-${c.id}-${idx}`} borderWidth="1px" borderColor={border} rounded="lg" p={3} bg={panelBg}>
                            <HStack justify="space-between" align="start" mb={2}>
                              <Badge colorScheme={termStyle.colorScheme} variant="subtle">{c.code || 'No code'}</Badge>
                              <Text fontSize="xs" color={muted} fontWeight="700">{c.unit ?? c.hours ?? '-'} units</Text>
                            </HStack>
                            <Text fontWeight="700" fontSize="sm" lineHeight="short" noOfLines={2}>{c.title || 'Untitled course'}</Text>
                            <Grid templateColumns="18px 1fr" gap={1.5} mt={3} fontSize="xs" color={muted}>
                              <Icon as={FiClock} mt="2px" /><Text>{c.schedule || 'Time not set'}</Text>
                              <Icon as={FiCalendar} mt="2px" />
                              <Text>
                                {viewMode === 'examination'
                                  ? [c.examDay, c.examSession].filter(Boolean).join(' · ') || 'Exam schedule not set'
                                  : [c.day, c.f2fSched || c.f2fsched || (Array.isArray(c.f2fDays) ? c.f2fDays.join(', ') : '')].filter(Boolean).join(' · ') || 'Day not set'}
                              </Text>
                              <Icon as={FiMapPin} mt="2px" /><Text>{(viewMode === 'examination' ? c.examRoom : c.room) || 'Room not set'}</Text>
                              <Icon as={FiUser} mt="2px" /><Text>{c.facultyName || 'Faculty not assigned'}</Text>
                            </Grid>
                            {effectiveShowAccessCodes && termAllowsAccess(c.term) && c.accessCode && (
                              <HStack mt={3} pt={2} borderTopWidth="1px" borderColor={border} justify="space-between">
                                <Text fontSize="xs" color={muted}>Access code</Text>
                                <Badge colorScheme="green">{c.accessCode}</Badge>
                              </HStack>
                            )}
                          </Box>
                        ))}
                      </SimpleGrid>

                      <Box display={{ base: 'none', lg: 'block' }} overflowX="auto" bg={tableBg}>
                        <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Time</Th>
                      <Th>Code</Th>
                      {effectiveShowAccessCodes && <Th>Access Code</Th>}
                      <Th>Title</Th>
                      <Th>Units</Th>
                      <Th>Room</Th>
                      {viewMode !== 'examination' && (
                        <>
                          <Th>Day</Th>
                          <Th>F2F</Th>
                        </>
                      )}
                      <Th>Faculty</Th>
                      {viewMode === 'examination' && (
                        <>
                          <Th>Exam Day</Th>
                          <Th>Exam Session</Th>
                          <Th>Exam Room</Th>
                        </>
                      )}
                    </Tr>
                  </Thead>
                  <Tbody>
                            {termGroup.items.map((c, idx) => (
                      <Tr key={`${c.facultyId}-${c.id}-${idx}`} _hover={{ bg: rowHover }}>
                        <Td>{c.schedule || ''}</Td>
                        <Td><Badge colorScheme={termStyle.colorScheme} variant="subtle">{c.code}</Badge></Td>
                        {effectiveShowAccessCodes && (
                          <Td>{termAllowsAccess(c.term) ? (c.accessCode || '') : ''}</Td>
                        )}
                        <Td maxW={{ base: '220px', md: '420px' }}>
                          <Text noOfLines={{ base: 2, md: 1 }}>{c.title}</Text>
                        </Td>
                        <Td>{c.unit ?? c.hours ?? ''}</Td>
                        <Td>{c.room || ''}</Td>
                        {viewMode !== 'examination' && (
                          <>
                            <Td>{c.day || ''}</Td>
                            <Td>
                              {c.f2fSched || c.f2fsched || (Array.isArray(c.f2fDays) ? c.f2fDays.join(',') : '')}
                            </Td>
                          </>
                        )}
                        <Td>{c.facultyName}</Td>
                        {viewMode === 'examination' && (
                          <>
                            <Td>{c.examDay || ''}</Td>
                            <Td>{c.examSession || ''}</Td>
                            <Td>{c.examRoom || ''}</Td>
                          </>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
                      </Box>
                    </Box>
                  );
                })}
              </VStack>
            </Box>
          ))}
        </Box>
      ))}
    </VStack>
  );
}
