import React from 'react';
import { Box, Heading, Text, SimpleGrid, HStack, Select, Table, Thead, Tbody, Tr, Th, Td, TableContainer, Badge } from '@chakra-ui/react';

export default function AttendanceSummary({ summary, loading }) {
  const [view, setView] = React.useState('all');
  const people = summary.people.filter(p => view === 'all' || p[view] > 0);
  return (
    <Box borderWidth="1px" rounded="lg" p={4} mb={4} aria-busy={loading}>
      <Heading size="sm" mb={2}>Attendance overview</Heading>
      <Text fontSize="sm" color="gray.500" mb={3}>Based on the selected filters. Counts are recorded class sessions; missing entries are not counted as absences. Late is shown separately from present.</Text>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={4}>
        {[
          ['Faculty present', summary.people.filter(p => p.present > 0).length, 'green'],
          ['Faculty with absences', summary.people.filter(p => p.absent > 0).length, 'red'],
          ['Present sessions', summary.byStatus.present || 0, 'green'],
          ['Absent sessions', summary.byStatus.absent || 0, 'red'],
        ].map(([label, value, color]) => <Box key={label} borderWidth="1px" rounded="md" p={3}><Text fontSize="sm">{label}</Text><Badge colorScheme={color} fontSize="xl">{loading ? '…' : value}</Badge></Box>)}
      </SimpleGrid>
      <HStack justify="space-between" mb={3} flexWrap="wrap">
        <Heading size="sm">Faculty summary</Heading>
        <Select aria-label="Summary faculty status" maxW="230px" value={view} onChange={e => setView(e.target.value)}>
          <option value="all">All recorded faculty</option><option value="present">With present records</option><option value="absent">With absent records</option><option value="late">With late records</option><option value="excused">With excused records</option>
        </Select>
      </HStack>
      <Text fontSize="xs" mb={2}>Ranked by distinct absence dates, then absent sessions. Absence rate = absent sessions / all recorded sessions.</Text>
      <TableContainer maxH="420px" overflowY="auto">
        <Table size="sm"><Thead><Tr><Th>Faculty</Th><Th isNumeric>Present</Th><Th isNumeric>Absent</Th><Th isNumeric>Late</Th><Th isNumeric>Excused</Th><Th isNumeric>Absence rate</Th><Th>Dates absent</Th></Tr></Thead>
          <Tbody>{people.map(p => <Tr key={p.key}><Td>{p.name}</Td><Td isNumeric>{p.present}</Td><Td isNumeric>{p.absent}</Td><Td isNumeric>{p.late}</Td><Td isNumeric>{p.excused}</Td><Td isNumeric>{p.absenceRate}%</Td><Td whiteSpace="normal" minW="240px"><Text fontWeight="semibold">{p.absentDates.length} distinct dates</Text>{p.absentDates.join(', ') || '—'}</Td></Tr>)}</Tbody>
        </Table>
      </TableContainer>
      {!loading && !people.length && <Text py={3}>No recorded attendance matches these filters.</Text>}
      <Heading size="sm" mt={4} mb={2}>Dates with the most absences</Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={2}>
        {summary.dates.slice(0, 6).map(d => <Box key={d.date} borderWidth="1px" rounded="md" p={2}><Text fontWeight="semibold">{d.date}</Text><Text fontSize="sm">{d.faculty} faculty · {d.records} absent sessions</Text></Box>)}
      </SimpleGrid>
    </Box>
  );
}
