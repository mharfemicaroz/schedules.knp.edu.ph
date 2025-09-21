import React, { useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, VStack, Text, HStack } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useData } from '../context/DataContext';

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
  const dept = decodeURIComponent(deptParam || '');
  const { allCourses, loading } = useData();
  const border = useColorModeValue('gray.200','gray.700');
  const tableBg = useColorModeValue('white','gray.800');

  const groups = useMemo(() => {
    const m = new Map();
    allCourses.forEach(c => {
      if (String(c.program || '') !== dept) return;
      const yl = c.yearlevel || 'N/A';
      const list = m.get(yl) || [];
      list.push(c);
      m.set(yl, list);
    });
    // For each year level: group by block (section), and sort courses within block by term then time
    const entries = Array.from(m.entries()).map(([yl, list]) => {
      const blockMap = new Map();
      list.forEach(c => {
        const block = c.section || c.block || 'N/A';
        const arr = blockMap.get(block) || [];
        arr.push(c);
        blockMap.set(block, arr);
      });
      const blocks = Array.from(blockMap.entries()).map(([block, arr]) => {
        const sorted = arr.sort((a,b) => {
          const oa = a.termOrder ?? 9, ob = b.termOrder ?? 9;
          if (oa !== ob) return oa - ob;
          const ta = a.timeStartMinutes ?? Infinity;
          const tb = b.timeStartMinutes ?? Infinity;
          return ta - tb;
        });
        return { block, items: sorted };
      }).sort((a,b) => String(a.block).localeCompare(String(b.block), undefined, { numeric: true }));
      return { yl, blocks };
    });
    // Sort year levels 1st -> 4th -> others
    entries.sort((a,b) => yearOrder(a.yl) - yearOrder(b.yl));
    return entries;
  }, [allCourses, dept]);

  function onPrint() {
    const headers = ['Year Level', 'Block', 'Term', 'Time', 'Code', 'Title', 'Units', 'Room', 'Faculty'];
    const rows = [];
    groups.forEach(g => {
      g.blocks.forEach(b => {
        b.items.forEach(c => {
          rows.push([g.yl, b.block, c.semester, c.schedule || '—', c.code, c.title, String(c.units ?? c.hours ?? ''), c.room || '—', c.facultyName]);
        });
      });
    });
    const table = buildTable(headers, rows);
    printContent({ title: `Program: ${dept}`, subtitle: 'Year • Block • Term • Time', bodyHtml: table });
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center">
        <Heading size="md">Program: {dept}</Heading>
        <HStack>
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          <Button as={RouterLink} to="/views/departments" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
        </HStack>
      </HStack>
      {loading && <Text color="gray.500">Loading…</Text>}
      {groups.map(group => (
        <Box key={group.yl}>
          <Text fontWeight="700" mb={2}>{group.yl}</Text>
          {group.blocks.map(b => (
            <Box key={b.block} mb={4}>
              <Text fontWeight="600" mb={2}>{b.block}</Text>
              <Box className="responsive-table table-dept" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg}>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Term</Th>
                      <Th>Time</Th>
                      <Th>Code</Th>
                      <Th>Title</Th>
                      <Th>Units</Th>
                      <Th>Room</Th>
                      <Th>Faculty</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {b.items.map((c, idx) => (
                      <Tr key={`${c.facultyId}-${c.id}-${idx}`}>
                        <Td>{c.semester}</Td>
                        <Td>{c.schedule || '—'}</Td>
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
          ))}
        </Box>
      ))}
    </VStack>
  );
}
