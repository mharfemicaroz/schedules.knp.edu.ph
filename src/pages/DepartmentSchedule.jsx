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
} from '@chakra-ui/react';
import { FiShare2, FiPrinter, FiArrowLeft } from 'react-icons/fi';
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
          return { block, items };
        })
        .sort((a, b) => String(a.block).localeCompare(String(b.block), undefined, { numeric: true }));

      return { yl, blocks };
    });

    entries.sort((a, b) => yearOrder(a.yl) - yearOrder(b.yl));
    return entries;
  }, [allCourses, dept]);

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
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="md">Program: {dept}</Heading>
        <HStack spacing={4}>
          {!isPublic && (
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
          )}
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">
            Print
          </Button>
          {isAdmin && !isPublic && (
            <Button
              as={RouterLink}
              to={`/share/departments/${encodeURIComponent(encodeShareDepartment(dept))}`}
              leftIcon={<FiShare2 />}
              colorScheme="blue"
              size="sm"
            >
              Share
            </Button>
          )}
          {!isPublic && (
            <Button
              as={RouterLink}
              to="/views/departments"
              variant="ghost"
              colorScheme="brand"
              leftIcon={<FiArrowLeft />}
              w="fit-content"
            >
              Back
            </Button>
          )}
        </HStack>
      </HStack>

      {loading && <Text color="gray.500">Loading...</Text>}

      {groups.map((group) => (
        <Box key={group.yl}>
          <Text fontWeight="700" mb={2}>
            {group.yl}
          </Text>
          {group.blocks.map((b) => (
            <Box key={b.block} mb={4}>
              <Text fontWeight="600" mb={2}>
                {b.block}
              </Text>
              <Box
                className="responsive-table table-dept"
                overflowX="auto"
                borderWidth="1px"
                borderColor={border}
                rounded="xl"
                bg={tableBg}
              >
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Term</Th>
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
                    {b.items.map((c, idx) => (
                      <Tr key={`${c.facultyId}-${c.id}-${idx}`}>
                        <Td>{c.term}</Td>
                        <Td>{c.schedule || ''}</Td>
                        <Td>{c.code}</Td>
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
          ))}
        </Box>
      ))}
    </VStack>
  );
}
