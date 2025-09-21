import React from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, HStack, Avatar, Text, Badge, VStack, Divider, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useData } from '../context/DataContext';
import LoadingState from '../components/LoadingState';

export default function FacultyDetail() {
  const { id } = useParams();
  const { faculties, loading } = useData();
  if (loading) return <LoadingState label="Loading faculty…" />;
  const f = faculties.find(x => String(x.id) === String(id));
  const border = useColorModeValue('gray.200','gray.700');

  if (!f) {
    return (
      <VStack align="center" spacing={6} py={10}>
        <Heading size="md">Faculty not found</Heading>
        <Button as={RouterLink} to="/" colorScheme="brand" variant="solid" leftIcon={<FiArrowLeft />}>Back to Dashboard</Button>
      </VStack>
    );
  }

  function onPrint() {
    const headers = ['Code', 'Title', 'Section', 'Units', 'Day', 'Time', 'Term', 'Room'];
    const rows = (f.courses || []).map(c => [c.code, c.title, c.section, String(c.units ?? c.hours ?? ''), c.day || '—', c.schedule || '—', c.semester, c.room || '—']);
    const table = buildTable(headers, rows);
    const esc = (val) => String(val ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const metaHtml = `
      <table class="prt-table"><tbody>
        <tr><th>Department</th><td>${esc(f.department || '')}</td><th>Employment</th><td>${esc(f.employment || '')}</td></tr>
        <tr><th>Designation</th><td colspan="3">${esc(f.designation || f.rank || '')}</td></tr>
        <tr><th>Load Release Units</th><td>${esc(String(f.loadReleaseUnits ?? 0))}</td><th>Total Load Units</th><td>${esc(String(f.stats?.loadHours ?? 0))}</td></tr>
      </tbody></table>`;
    printContent({ title: `Faculty: ${f.name}`, subtitle: f.email || '', bodyHtml: metaHtml + table });
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack spacing={4} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack spacing={4}>
          <Avatar size="lg" name={f.name} />
          <Box>
            <Heading size="md">{f.name}</Heading>
            <VStack align="start" spacing={1} mt={2}>
              <HStack spacing={2}>
                <Badge colorScheme="blue">{f.department || '—'}</Badge>
                {Boolean(f.employment) && <Badge colorScheme="green">{f.employment}</Badge>}
              </HStack>
              {(f.designation || f.rank) && (
                <Text fontSize="sm" color="gray.600">{f.designation || f.rank}</Text>
              )}
            </VStack>
          </Box>
        </HStack>
        <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={useColorModeValue('white','gray.800')}>
        <HStack spacing={6}>
          <Stat label="Load Units" value={f.stats?.loadHours ?? 0} />
          <Stat label="Load Release Units" value={f.loadReleaseUnits ?? 0} />
          <Stat label="Overload Units" value={(f.stats?.overloadHours != null ? f.stats.overloadHours : Math.max(0, (f.stats?.loadHours||0) - Math.max(0, 24 - (Number(f.loadReleaseUnits)||0))))} />
          <Stat label="Courses" value={f.stats?.courseCount ?? (f.courses?.length || 0)} />
        </HStack>
      </Box>

      <Box className="responsive-table table-fac-detail" borderWidth="1px" borderColor={border} rounded="xl" bg={useColorModeValue('white','gray.800')} overflowX="auto">
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              <Th>Code</Th>
              <Th>Title</Th>
              <Th>Section</Th>
              <Th>Units</Th>
              <Th>Day</Th>
              <Th>Time</Th>
              <Th>Term</Th>
              <Th>Room</Th>
              <Th>Session</Th>
              <Th>F2F</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(f.courses || []).map(c => (
              <Tr key={c.id}>
                <Td>{c.code}</Td>
                <Td maxW="380px"><Text noOfLines={1}>{c.title}</Text></Td>
                <Td>{c.section}</Td>
                <Td>{c.units ?? c.hours ?? '—'}</Td>
                <Td>{c.day || '—'}</Td>
                <Td>{c.schedule || '—'}</Td>
                <Td>{[c.semester, c.year].filter(Boolean).join(' ')}</Td>
                <Td>{c.room || '—'}</Td>
                <Td>{c.session || '—'}</Td>
                <Td>{c.f2f || '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Divider />
      <Button as={RouterLink} to="/" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />}>Back</Button>
    </VStack>
  );
}

function Stat({ label, value }) {
  return (
    <Box>
      <Text fontSize="sm" color="gray.500">{label}</Text>
      <Text fontWeight="800" fontSize="xl">{value}</Text>
    </Box>
  );
}

