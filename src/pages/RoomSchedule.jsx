import React, { useMemo } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Text, HStack } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { useData } from '../context/DataContext';
import { buildTable, printContent } from '../utils/printDesign';

const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function RoomSchedule() {
  const { room: roomParam } = useParams();
  const room = decodeURIComponent(roomParam || '');
  const { allCourses, loading } = useData();
  const [searchParams] = useSearchParams();
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
    const headers = ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty'];
    const data = rows.map(c => [
      c.schedule || '—',
      c.day || '—',
      c.semester,
      c.program || '—',
      c.code,
      c.title,
      c.section,
      String(c.units ?? c.hours ?? ''),
      c.facultyName,
    ]);
    const table = buildTable(headers, data);
    const subtitle = `Room: ${room}${filterDay ? ` • ${filterDay}` : ''}`;
    printContent({ title: 'Room Schedule', subtitle, bodyHtml: table });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Room: {room}{filterDay ? ` — ${filterDay}` : ''}</Heading>
        <HStack>
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
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
