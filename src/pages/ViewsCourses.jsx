import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Button, Grid, GridItem, Input, Select, Text, Table, Thead, Tr, Th, Tbody, Td, useColorModeValue, IconButton } from '@chakra-ui/react';
import { FiBookOpen, FiClock, FiTrendingUp, FiUsers, FiPrinter, FiEdit, FiTrash } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import StatCard from '../components/StatCard';
import Pagination from '../components/Pagination';
import ChartsCourses from '../components/ChartsCourses';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { buildTable, printContent } from '../utils/printDesign';

export default function ViewsCourses() {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const loading = useSelector(s => s.data.loading);
  const error = useSelector(s => s.data.error);
  const allCourses = useSelector(selectAllCourses);
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  const [q, setQ] = useState('');
  const [program, setProgram] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortKey, setSortKey] = useState('code'); // code | title | program | faculty | term | time
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'code' || key === 'title' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  const filtered = useMemo(() => {
    const ql = norm(q);
    const list = (allCourses || []).filter(c => {
      const prog = String(c.program || c.programcode || '').trim();
      const trm = String(c.semester || c.term || '').trim();
      if (program && prog !== program) return false;
      if (term && trm !== term) return false;
      if (!ql) return true;
      const hay = [c.code, c.title, c.courseName, c.courseTitle, c.section, c.facultyName, c.program, c.programcode]
        .map(v => norm(v))
        .join(' ');
      return hay.includes(ql);
    });
    // Sort alphabetically by code then title by default
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (c, k) => {
      switch (k) {
        case 'code': return String(c.code || c.courseName || '');
        case 'title': return String(c.title || c.courseTitle || '');
        case 'program': return String(c.program || c.programcode || '');
        case 'faculty': return String(c.facultyName || c.faculty || '');
        case 'term': return String(c.semester || c.term || '');
        case 'time': return String(c.schedule || c.time || '');
        default: return String(c.code || c.courseName || '');
      }
    };
    list.sort((a,b) => val(a,sortKey).localeCompare(val(b,sortKey)) * dir);
    return list;
  }, [allCourses, q, program, term, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize);

  // Stats
  const stats = useMemo(() => {
    const uniqueCourses = new Set();
    const uniqueFaculty = new Set();
    const programs = new Set();
    let totalUnits = 0;
    (filtered || []).forEach(c => {
      const key = [c.code||c.courseName, c.title||c.courseTitle].join('|');
      uniqueCourses.add(key);
      if (c.facultyId != null) uniqueFaculty.add(String(c.facultyId)); else if (c.facultyName) uniqueFaculty.add(norm(c.facultyName));
      programs.add(String(c.program || c.programcode || 'N/A'));
      totalUnits += Number(c.unit ?? c.hours ?? 0) || 0;
    });
    return { courses: uniqueCourses.size, faculty: uniqueFaculty.size, programs: programs.size, units: totalUnits };
  }, [filtered]);

  const opts = useMemo(() => {
    const terms = new Set(); const progs = new Set();
    (allCourses || []).forEach(c => { const t = String(c.semester || c.term || '').trim(); if (t) terms.add(t); const p = String(c.program || c.programcode || '').trim(); if (p) progs.add(p); });
    return { terms: Array.from(terms).sort(), programs: Array.from(progs).sort() };
  }, [allCourses]);

  const onPrint = () => {
    const headers = ['Code','Title','Section','Units','Program','Faculty','Term','Time','Room'];
    const rows = filtered.map(c => [
      c.code || c.courseName || '-',
      c.title || c.courseTitle || '-',
      c.section || '-',
      String(c.unit ?? c.hours ?? ''),
      c.program || c.programcode || '-',
      c.facultyName || c.faculty || '-',
      c.semester || c.term || '-',
      c.schedule || c.time || '-',
      c.room || '-',
    ]);
    const table = buildTable(headers, rows);
    printContent({ title: 'Courses', subtitle: 'Alphabetical view of courses', bodyHtml: table });
  };

  async function handleSaveEdit(payload) {
    if (!selected) return;
    try {
      await dispatch(updateScheduleThunk({ id: selected.id, changes: payload }));
      setEditOpen(false);
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch {}
  }
  async function handleDelete(id) {
    try {
      await dispatch(deleteScheduleThunk(id));
      dispatch(loadAllSchedules());
    } catch {}
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="md">View: Courses</Heading>
        <HStack gap={2}>
          <Input placeholder="Search code, title, faculty, program" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} maxW="320px" />
          <Select placeholder="Program" value={program} onChange={(e)=>{ setProgram(e.target.value); setPage(1); }} maxW="200px">
            {opts.programs.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select placeholder="Term" value={term} onChange={(e)=>{ setTerm(e.target.value); setPage(1); }} maxW="140px">
            {opts.terms.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||15); setPage(1); }} maxW="110px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
        </HStack>
      </HStack>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={4}>
        <GridItem><StatCard icon={FiBookOpen} label="Courses" value={stats.courses} accent="orange" /></GridItem>
        <GridItem><StatCard icon={FiClock} label="Total Units" value={stats.units} accent="purple" /></GridItem>
        <GridItem><StatCard icon={FiUsers} label="Unique Faculty" value={stats.faculty} accent="brand" /></GridItem>
        <GridItem><StatCard icon={FiTrendingUp} label="Programs" value={stats.programs} accent="pink" /></GridItem>
      </Grid>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('code')} cursor="pointer" userSelect="none">Code</Th>
              <Th onClick={()=>toggleSort('title')} cursor="pointer" userSelect="none">Title</Th>
              <Th>Section</Th>
              <Th isNumeric>Units</Th>
              <Th onClick={()=>toggleSort('program')} cursor="pointer" userSelect="none">Program</Th>
              <Th onClick={()=>toggleSort('faculty')} cursor="pointer" userSelect="none">Faculty</Th>
              <Th onClick={()=>toggleSort('term')} cursor="pointer" userSelect="none">Term</Th>
              <Th onClick={()=>toggleSort('time')} cursor="pointer" userSelect="none">Time</Th>
              <Th>Room</Th>
              {isAdmin && <Th textAlign="right">Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(c => (
              <Tr key={c.id}>
                <Td>{c.code || c.courseName || '-'}</Td>
                <Td><Text maxW="380px" noOfLines={1}>{c.title || c.courseTitle || '-'}</Text></Td>
                <Td>{c.section || '-'}</Td>
                <Td isNumeric>{String(c.unit ?? c.hours ?? '')}</Td>
                <Td>{c.program || c.programcode || '-'}</Td>
                <Td>{c.facultyName || c.faculty || '-'}</Td>
                <Td>{c.semester || c.term || '-'}</Td>
                <Td>{c.schedule || c.time || '-'}</Td>
                <Td>{c.room || '-'}</Td>
                {isAdmin && (
                  <Td textAlign="right">
                    <HStack justify="end" spacing={1}>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" onClick={() => { setSelected(c); setEditOpen(true); }} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => handleDelete(c.id)} />
                    </HStack>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={(n)=>{ setPageSize(n); setPage(1); }} />

      <ChartsCourses courses={filtered} />

      <EditScheduleModal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setSelected(null); }}
        schedule={selected}
        onSave={handleSaveEdit}
        viewMode={'regular'}
      />
    </VStack>
  );
}
