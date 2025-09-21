import React, { useMemo, useState } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Text, HStack, Switch, FormControl, FormLabel } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { useData } from '../context/DataContext';
import { buildTable, printContent } from '../utils/printDesign';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';

const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function RoomSchedule() {
  const { room: roomParam } = useParams();
  const room = decodeURIComponent(roomParam || '');
  const { allCourses, loading, acadData } = useData();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useLocalStorage('roomScheduleViewMode', getInitialToggleState(acadData, 'roomScheduleViewMode', 'regular'));
  const filterDay = searchParams.get('day');
  const border = useColorModeValue('gray.200','gray.700');

  const rows = useMemo(() => {
    let list = allCourses.filter(c => String(c.room || '') === room);
    if (filterDay) {
      list = list.filter(c => Array.isArray(c.f2fDays) && c.f2fDays.includes(filterDay));
    }
    return list.sort((a,b) => {
      const oa = a.termOrder ?? 9, ob = b.termOrder ?? 9;
      if (oa !== ob) return oa - ob;
      const ta = a.timeStartMinutes ?? Infinity;
      const tb = b.timeStartMinutes ?? Infinity;
      if (ta !== tb) return ta - tb;
      const da = DAY_ORDER.indexOf(a.day) === -1 ? 99 : DAY_ORDER.indexOf(a.day);
      const db = DAY_ORDER.indexOf(b.day) === -1 ? 99 : DAY_ORDER.indexOf(b.day);
      return da - db;
    });
  }, [allCourses, room, filterDay]);

  function onPrint() {
    const headers = viewMode === 'examination'
      ? ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty', 'Exam Day', 'Exam Session', 'Exam Room']
      : ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty'];
    const data = rows.map(c => {
      if (viewMode === 'examination') {
        return [
          c.schedule || '—',
          c.day || '—',
          c.semester,
          c.program || '—',
          c.code,
          c.title,
          c.section,
          String(c.units ?? c.hours ?? ''),
          c.facultyName,
          c.examDay || '—',
          c.examSession || '—',
          c.examRoom || '—'
        ];
      } else {
        return [
          c.schedule || '—',
          c.day || '—',
          c.semester,
          c.program || '—',
          c.code,
          c.title,
          c.section,
          String(c.units ?? c.hours ?? ''),
          c.facultyName
        ];
      }
    });
    const table = buildTable(headers, data);
    const scheduleType = viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule';
    const subtitle = `Room: ${room}${filterDay ? ` • ${filterDay}` : ''} - ${scheduleType}`;
    printContent({ title: 'Room Schedule', subtitle, bodyHtml: table });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Heading size="md">Room: {room}{filterDay ? ` — ${filterDay}` : ''}</Heading>
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
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          <Button as={RouterLink} to="/views/rooms" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />}>Back</Button>
        </HStack>
      </HStack>
      {loading && (
        <Text color="gray.500" mb={2}>Loading schedule…</Text>
      )}
      <Box className="responsive-table table-room" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={useColorModeValue('white','gray.800')}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Time</Th>
              <Th>Day</Th>
              <Th>Term</Th>
              <Th>Program</Th>
              <Th>Code</Th>
              <Th>Title</Th>
              <Th>Section</Th>
              <Th>Units</Th>
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
            {rows.map((c, i) => (
              <Tr key={`${c.facultyId}-${c.id}-${i}`}>
                <Td>{c.schedule || '—'}</Td>
                <Td>{c.day || '—'}</Td>
                <Td>{c.semester}</Td>
                <Td>{c.program || '—'}</Td>
                <Td>{c.code}</Td>
                <Td maxW="380px">{c.title}</Td>
                <Td>{c.section}</Td>
                <Td>{c.units ?? c.hours ?? '—'}</Td>
                <Td>{c.facultyName}</Td>
                {viewMode === 'examination' && (
                  <>
                    <Td>{c.examDay || '—'}</Td>
                    <Td>{c.examSession || '—'}</Td>
                    <Td>{c.examRoom || '—'}</Td>
                  </>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
