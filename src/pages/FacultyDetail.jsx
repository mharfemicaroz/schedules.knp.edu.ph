import React, { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, HStack, Avatar, Text, Badge, VStack, Divider, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Switch, FormControl, FormLabel } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useData } from '../context/DataContext';
import LoadingState from '../components/LoadingState';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';

export default function FacultyDetail() {
  const { id } = useParams();
  const { faculties, loading, acadData } = useData();
  const [viewMode, setViewMode] = useLocalStorage('facultyDetailViewMode', getInitialToggleState(acadData, 'facultyDetailViewMode', 'regular'));
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

  // Helper functions for mode switching
  const getTableHeaders = () => {
    if (viewMode === 'examination') {
      return ['Code', 'Title', 'Section', 'Units', 'Term', 'Time', 'Exam Day', 'Exam Session', 'Exam Room'];
    }
    return ['Code', 'Title', 'Section', 'Units', 'Day', 'Time', 'Term', 'Room', 'Session', 'F2F'];
  };

  const getCourseData = (course) => {
    if (viewMode === 'examination') {
      return [
        course.code || '—',
        course.title || '—',
        course.section || '—',
        String(course.units ?? course.hours ?? '—'),
        [course.semester, course.year].filter(Boolean).join(' ') || '—',
        course.schedule || '—',
        course.examDay || '—',
        course.examSession || '—',
        course.examRoom || '—'
      ];
    }
    return [
      course.code || '—',
      course.title || '—',
      course.section || '—',
      String(course.units ?? course.hours ?? '—'),
      course.day || '—',
      course.schedule || '—',
      [course.semester, course.year].filter(Boolean).join(' ') || '—',
      course.room || '—',
      course.session || '—',
      course.f2f || '—'
    ];
  };

  function onPrint() {
    const headers = getTableHeaders();
    const rows = (f.courses || []).map(c => getCourseData(c));
    const table = buildTable(headers, rows);
    const esc = (val) => String(val ?? '').replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'"').replace(/'/g,'&#039;');
    const metaHtml = `
      <table class="prt-table"><tbody>
        <tr><th>Department</th><td>${esc(f.department || '')}</td><th>Employment</th><td>${esc(f.employment || '')}</td></tr>
        <tr><th>Designation</th><td colspan="3">${esc(f.designation || f.rank || '')}</td></tr>
        <tr><th>Load Release Units</th><td>${esc(String(f.loadReleaseUnits ?? 0))}</td><th>Total Load Units</th><td>${esc(String(f.stats?.loadHours ?? 0))}</td></tr>
        <tr><th>Schedule Type</th><td colspan="3">${esc(viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule')}</td></tr>
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
          <Button as={RouterLink} to="/" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
        </HStack>
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
              {getTableHeaders().map((header, index) => (
                <Th key={index}>{header}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {(f.courses || []).map(c => {
              const courseData = getCourseData(c);
              return (
                <Tr key={c.id}>
                  {courseData.map((data, index) => (
                    <Td key={index}>
                      {index === 1 ? (
                        <Text maxW="380px" noOfLines={1}>{data}</Text>
                      ) : (
                        data
                      )}
                    </Td>
                  ))}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>


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
