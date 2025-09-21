import React, { useMemo } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Text, HStack } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useData } from '../context/DataContext';

export default function BlockSchedule() {
  const { block: blockParam } = useParams();
  const block = decodeURIComponent(blockParam || '');
  const [search] = useSearchParams();
  const dayFilter = search.get('day');
  const sessionFilter = search.get('session');
  const { allCourses, loading } = useData();
  const border = useColorModeValue('gray.200','gray.700');
  const tableBg = useColorModeValue('white','gray.800');

  const rows = useMemo(() => {
    let list = allCourses.filter(c => String(c.section) === block);
    if (dayFilter) {
      list = list.filter(c => Array.isArray(c.f2fDays) && c.f2fDays.includes(dayFilter));
    }
    if (sessionFilter) {
      const sf = sessionFilter.toLowerCase();
      list = list.filter(c => {
        const s = String(c.session || '').toLowerCase();
        if (s) return s.includes(sf);
        const t = c.timeStartMinutes;
        if (!Number.isFinite(t)) return true;
        if (sf.includes('morn')) return t < 12*60;
        if (sf.includes('after')) return t >= 12*60 && t < 17*60;
        if (sf.includes('even')) return t >= 17*60;
        return true;
      });
    }
    return list.sort((a,b)=>{
      const oa = a.termOrder ?? 9, ob = b.termOrder ?? 9;
      if (oa !== ob) return oa - ob;
      const ta = a.timeStartMinutes ?? Infinity;
      const tb = b.timeStartMinutes ?? Infinity;
      return ta - tb;
    });
  }, [allCourses, block, dayFilter, sessionFilter]);

  function onPrint() {
    const headers = ['Term', 'Time', 'Program', 'Code', 'Title', 'Units', 'Room', 'Faculty'];
    const data = rows.map(c => [
      c.semester,
      c.schedule || '—',
      c.program || '—',
      c.code,
      c.title,
      String(c.units ?? c.hours ?? ''),
      c.room || '—',
      c.facultyName,
    ]);
    const table = buildTable(headers, data);
    const parts = [`Block: ${block}`];
    if (dayFilter) parts.push(dayFilter);
    if (sessionFilter) parts.push(sessionFilter);
    printContent({ title: 'Block Schedule', subtitle: parts.join(' • '), bodyHtml: table });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Heading size="md">Block: {block}{dayFilter ? ` — ${dayFilter}` : ''}{sessionFilter ? ` — ${sessionFilter}` : ''}</Heading>
        <HStack>
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          <Button as={RouterLink} to="/views/session" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />}>Back</Button>
        </HStack>
      </HStack>
      {loading && <Text color="gray.500" mt={2}>Loading…</Text>}
      <Box mt={4} className="responsive-table table-block" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Term</Th>
              <Th>Time</Th>
              <Th>Program</Th>
              <Th>Code</Th>
              <Th>Title</Th>
              <Th>Units</Th>
              <Th>Room</Th>
              <Th>Faculty</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((c, i) => (
              <Tr key={`${block}-${c.facultyId}-${c.id}-${i}`}>
                <Td>{c.semester}</Td>
                <Td>{c.schedule || '—'}</Td>
                <Td>{c.program || '—'}</Td>
                <Td>{c.code}</Td>
                <Td maxW={{ base: '220px', md: '420px' }}><Text noOfLines={{ base: 2, md: 1 }}>{c.title}</Text></Td>
                <Td>{c.units ?? c.hours ?? '—'}</Td>
                <Td>{c.room || '—'}</Td>
                <Td>{c.facultyName}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
