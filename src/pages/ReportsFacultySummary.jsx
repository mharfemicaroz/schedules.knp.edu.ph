import React, { useEffect, useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Text, Input, Select, Table, Thead, Tbody, Tr, Th, Td, Tag, TagLabel, useColorModeValue, Button, Spinner, SimpleGrid } from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import { FiChevronUp, FiChevronDown, FiPrinter, FiDownload } from 'react-icons/fi';
import Pagination from '../components/Pagination';
import { selectAllCourses } from '../store/dataSlice';
import { selectAllFaculty, selectFacultyFilterOptions } from '../store/facultySlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { parseTimeBlockToMinutes } from '../utils/conflicts';
import { buildTable, printContent } from '../utils/printDesign';

export default function ReportsFacultySummary() {
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const faculties = useSelector(selectAllFaculty);
  const opts = useSelector(selectFacultyFilterOptions);
  const facultyLoading = useSelector(s => s.faculty.loading);
  const dataLoading = useSelector(s => s.data.loading);

  useEffect(() => {
    if (!faculties || faculties.length === 0) {
      dispatch(loadFacultiesThunk({}));
    }
  }, [dispatch]);

  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [employment, setEmployment] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortKey, setSortKey] = useState('faculty'); // faculty | department | designation | employment | load | release | overload | courses
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'faculty' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  const termOf = (r) => String(r.semester || r.term || '').trim().toLowerCase();
  const timeKeyOf = (r) => {
    const s = String(r.scheduleKey || r.schedule || r.time || '').trim();
    const start = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
    const end = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
    if (Number.isFinite(start) && Number.isFinite(end)) return `${start}-${end}`;
    const tr = parseTimeBlockToMinutes(s);
    return (Number.isFinite(tr.start) && Number.isFinite(tr.end)) ? `${tr.start}-${tr.end}` : s.toLowerCase();
  };

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = (faculties || []).map(f => {
      const name = f.name || f.faculty || f.instructorName || f.instructor || f.full_name || '';
      const dept = f.department || f.dept || f.department_name || f.departmentName || '';
      const desig = f.designation || '';
      const emp = f.employment || '';
      const release = Number(f.load_release_units ?? f.loadReleaseUnits ?? 0) || 0;
      const fid = f.id != null ? String(f.id) : '';
      const fnameNorm = normalizeName(name);

      const isThisFaculty = (r) => {
        const rid = r.facultyId != null ? String(r.facultyId) : (r.faculty_id != null ? String(r.faculty_id) : '');
        if (fid && rid && fid === rid) return true;
        const rname = normalizeName(r.facultyName || r.faculty || r.instructor);
        return !!fnameNorm && fnameNorm === rname;
      };

      // unique by code+section+term+time (time may be empty; still include)
      const seen = new Set();
      let units = 0;
      let courses = 0;
      for (const r of (allCourses || [])) {
        if (!isThisFaculty(r)) continue;
        const code = String(r.code || r.courseName || '').trim().toLowerCase();
        const sec = normalizeName(r.section || '');
        const term = termOf(r);
        const tk = timeKeyOf(r);
        // Require code and section; do NOT drop rows with missing term or time
        if (!code || !sec) continue;
        const k = [code, sec, term || 'n/a', tk || ''].join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        // Count units; fall back to hours when unit is missing
        units += Number(r.unit ?? r.hours ?? 0) || 0;
        courses += 1;
      }
      const baseline = Math.max(0, 24 - release);
      const overload = Math.max(0, units - baseline);
      return { id: fid || name, faculty: name, department: dept, designation: desig, employment: emp, load: units, release, overload, courses };
    })
    .filter(r => (!ql || [r.faculty, r.department].some(x => String(x||'').toLowerCase().includes(ql))))
    .filter(r => (!department || String(r.department||'') === department))
    .filter(r => (!designation || String(r.designation||'') === designation))
    .filter(r => (!employment || String(r.employment||'') === employment));

    const dir = sortDir === 'asc' ? 1 : -1;
    const v = (r, k) => {
      switch(k){
        case 'faculty': return String(r.faculty||'');
        case 'department': return String(r.department||'');
        case 'designation': return String(r.designation||'');
        case 'employment': return String(r.employment||'');
        case 'load': return (r.load||0);
        case 'release': return (r.release||0);
        case 'overload': return (r.overload||0);
        case 'courses': return (r.courses||0);
        default: return '';
      }
    };
    return list.sort((a,b) => {
      const va = v(a, sortKey);
      const vb = v(b, sortKey);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return String(a.faculty||'').localeCompare(String(b.faculty||''));
    });
  }, [faculties, allCourses, q, department, designation, employment, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = useMemo(() => rows.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [rows, page, pageSize]);

  const handleExportCsv = () => {
    const headers = ['Faculty','Department','Designation','Employment','Load Units','Load Release','Overload','Courses'];
    const data = rows.map(r => [r.faculty, r.department, r.designation, r.employment, r.load, r.release, r.overload, r.courses]);
    const esc = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const csv = [headers.map(esc).join(','), ...data.map(row => row.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'faculty_loading_summary.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const headers = ['Faculty','Department','Designation','Employment','Load Units','Load Release','Overload','Courses'];
    const data = rows.map(r => [r.faculty, r.department, r.designation, r.employment, String(r.load), String(r.release), String(r.overload), String(r.courses)]);
    const html = buildTable(headers, data);
    printContent({ title: 'Course Schedules Summary', subtitle: 'Computed from current schedules and faculty records', bodyHtml: html });
  };

  if ((facultyLoading || dataLoading) && (faculties?.length || 0) === 0) {
    return (
      <VStack align="center" spacing={4} py={12}>
        <Spinner thickness="3px" speed="0.6s" color="blue.400" size="lg" />
        <Text color={muted}>Loading faculty summary…</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <HStack>
          <Heading size="md">Reports: Course Schedules Summary</Heading>
          <Tag colorScheme="blue"><TagLabel>{rows.length} faculties</TagLabel></Tag>
        </HStack>
        <HStack>
          <Button size="sm" leftIcon={<FiDownload />} onClick={handleExportCsv} variant="outline">Export CSV</Button>
          <Button size="sm" leftIcon={<FiPrinter />} onClick={handlePrint} colorScheme="blue">Print</Button>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={3} wrap="wrap">
          <Input placeholder="Search faculty or department" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} maxW="280px" />
          <Select placeholder="Department" value={department} onChange={(e)=>{ setDepartment(e.target.value); setPage(1); }} maxW="200px">
            {(opts?.departments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Designation" value={designation} onChange={(e)=>{ setDesignation(e.target.value); setPage(1); }} maxW="200px">
            {(opts?.designations || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Employment" value={employment} onChange={(e)=>{ setEmployment(e.target.value); setPage(1); }} maxW="180px">
            {(opts?.employments || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||15); setPage(1); }} maxW="110px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
        </HStack>
      </Box>

      {/* Mobile cards: show column labels inline for each record */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {paged.map(r => (
            <Box key={r.id} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <Text fontWeight="800" fontSize="md" noOfLines={2}>{r.faculty || '-'}</Text>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Department</Text>
                    <Text>{r.department || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Designation</Text>
                    <Text>{r.designation || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Employment</Text>
                    <Text>{r.employment || '-'}</Text>
                  </Box>
                </SimpleGrid>
                <HStack spacing={4} wrap="wrap">
                  <Box>
                    <Text fontSize="xs" color={muted}>Load Units</Text>
                    <Text fontWeight="700">{r.load}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Load Release</Text>
                    <Text fontWeight="700">{r.release}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Overload</Text>
                    <Text fontWeight="700">{r.overload}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Courses</Text>
                    <Text fontWeight="700">{r.courses}</Text>
                  </Box>
                </HStack>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* Desktop/tablet table view */}
      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <Table size={{ base: 'sm', md: 'md' }} variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('faculty')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Faculty</Text>{sortKey==='faculty' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('department')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Department</Text>{sortKey==='department' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('designation')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Designation</Text>{sortKey==='designation' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('employment')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Employment</Text>{sortKey==='employment' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th isNumeric onClick={()=>toggleSort('load')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Load Units</Text>{sortKey==='load' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th isNumeric onClick={()=>toggleSort('release')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Load Release</Text>{sortKey==='release' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th isNumeric onClick={()=>toggleSort('overload')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Overload</Text>{sortKey==='overload' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th isNumeric onClick={()=>toggleSort('courses')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Courses</Text>{sortKey==='courses' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(r => (
              <Tr key={r.id}>
                <Td><Text noOfLines={1} maxW="260px">{r.faculty || '-'}</Text></Td>
                <Td>{r.department || '-'}</Td>
                <Td>{r.designation || '-'}</Td>
                <Td>{r.employment || '-'}</Td>
                <Td isNumeric>{r.load}</Td>
                <Td isNumeric>{r.release}</Td>
                <Td isNumeric>{r.overload}</Td>
                <Td isNumeric>{r.courses}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={(n)=>{ setPageSize(n); setPage(1); }} />
    </VStack>
  );
}
