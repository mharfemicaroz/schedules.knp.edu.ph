import React, { useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Table, Thead, Tbody, Tr, Th, Td, Text, useColorModeValue, IconButton, Button, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, FormControl, FormLabel, Input, Select, Tag, TagLabel } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import { FiEdit, FiTrash, FiChevronUp, FiChevronDown, FiDownload, FiPrinter } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import Pagination from '../components/Pagination';
import { getTimeOptions } from '../utils/timeOptions';
import EditScheduleModal from '../components/EditScheduleModal';
import AssignFacultyModal from '../components/AssignFacultyModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';

function isInvalidFacultyName(s) {
  const fac = String(s || '').trim();
  if (!fac) return true;
  return /^(unknown|unassigned|n\/?a|none|no\s*faculty|not\s*assigned|tba|-)?$/i.test(fac);
}

export default function UnassignedSchedules() {
  const dispatch = useDispatch();
  const raw = useSelector(s => Array.isArray(s.data.raw) ? s.data.raw : []);
  const loading = useSelector(s => s.data.loading);
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');

  // Filters
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [time, setTime] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [program, setProgram] = useState('');
  const [sortKey, setSortKey] = useState('term'); // 'term' | 'time' | 'program' | 'code' | 'title' | 'section' | 'units' | 'room' | 'session'
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  // Edit/Delete
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const assignDisc = useDisclosure();
  const [selected, setSelected] = useState(null);
  const cancelRef = React.useRef();

  // Build rows and apply filters
  const programOptions = useMemo(() => {
    const set = new Set();
    (raw||[]).forEach(r => { const p = r.programcode || r.program; if (p) set.add(String(p)); });
    return Array.from(set).sort((a,b)=>String(a).localeCompare(String(b)));
  }, [raw]);

  const rows = useMemo(() => {
    const norm = (v) => String(v || '').trim().toLowerCase();
    const list = (raw || [])
      .filter(r => {
        const unassigned = (r.facultyId == null) && isInvalidFacultyName(r.instructor);
        if (!unassigned) return false;
        if (program && norm(r.programcode || r.program) !== norm(program)) return false;
        if (term && String(r.term || '').trim() !== term) return false;
        if (time && String(r.time || '') !== time) return false;
        const q = query.trim().toLowerCase();
        if (q) {
          const vals = [r.programcode, r.program, r.course_name, r.course_title, r.block_code, r.section, r.dept, r.room, r.session, r.time, r.day, r.term]
            .map(v => String(v || '').toLowerCase());
          if (!vals.some(v => v.includes(q))) return false;
        }
        return true;
      })
      .map(r => ({
        id: r.id,
        program: r.programcode,
        code: r.courseName || r.course_name,
        title: r.courseTitle || r.course_title,
        section: r.blockCode || r.block_code,
        unit: r.unit,
        semester: r.term,
        day: r.day,
        schedule: r.time,
        f2fSched: r.f2fSched || r.f2fsched,
        room: r.room,
        session: r.session,
        dept: r.dept,
        facultyId: r.facultyId,
        facultyName: r.instructor || '',
        examDay: r.examDay || r.Exam_Day,
        examSession: r.examSession || r.Exam_Session,
        examRoom: r.examRoom || r.Exam_Room,
        _raw: r,
      }));
    // Sort by selected column/direction
    const dir = (sortDir === 'asc') ? 1 : -1;
    const get = (r, k) => {
      switch(k){
        case 'term': return String(r.semester||'');
        case 'time': return String(r.schedule||'');
        case 'program': return String(r.program||'');
        case 'code': return String(r.code||'');
        case 'title': return String(r.title||'');
        case 'section': return String(r.section||'');
        case 'units': return String(r.unit ?? r.hours ?? '');
        case 'room': return String(r.room||'');
        case 'session': return String(r.session||'');
        default: return '';
      }
    };
    return list.sort((a,b)=>{
      const va = get(a, sortKey).toLowerCase();
      const vb = get(b, sortKey).toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      // tiebreakers
      const ta = get(a, 'term').toLowerCase();
      const tb = get(b, 'term').toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;
      const sa = get(a, 'time').toLowerCase();
      const sb = get(b, 'time').toLowerCase();
      if (sa !== sb) return sa < sb ? -1 : 1;
      const ca = get(a, 'code').toLowerCase();
      const cb = get(b, 'code').toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;
      return 0;
    });
  }, [raw, query, term, time, sortKey, sortDir, program]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = useMemo(() => rows.slice((page-1)*pageSize, (page)*pageSize), [rows, page, pageSize]);

  async function handleSaveEdit(payload){
    if (!selected) return;
    try {
      await dispatch(updateScheduleThunk({ id: selected.id, changes: payload }));
      editDisc.onClose();
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch {}
  }
  async function confirmDelete(){
    if (!selected) return;
    try {
      await dispatch(deleteScheduleThunk(selected.id));
      delDisc.onClose();
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch {}
  }

  return (
    <VStack align="stretch" spacing={6}>
      <HStack spacing={3}>
        <Heading size="md">Unassigned Schedules</Heading>
        <Text color="gray.500">Items with no faculty assigned</Text>
        <Tag colorScheme="blue"><TagLabel>{rows.length} results</TagLabel></Tag>
        <HStack ml="auto" spacing={2}>
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||15); setPage(1); }} maxW="100px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
          <Button size="sm" leftIcon={<FiDownload />} variant="outline" onClick={()=>{
            const headers = ['Term','Time','Program','Code','Title','Section','Units','Room','Session'];
            const data = rows.map(r => [r.semester||'-', r.schedule||'-', r.program||'-', r.code||'-', r.title||'-', r.section||'-', r.unit ?? r.hours ?? '-', r.room||'-', r.session||'-']);
            const esc=(v)=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
            const csv=[headers.map(esc).join(','),...data.map(x=>x.map(esc).join(','))].join('\n');
            const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='unassigned_schedules.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          }}>Export CSV</Button>
          <Button size="sm" leftIcon={<FiPrinter />} colorScheme="blue" onClick={()=>{
            const headers = ['Term','Time','Program','Code','Title','Section','Units','Room','Session'];
            const data = rows.map(r => [r.semester||'-', r.schedule||'-', r.program||'-', r.code||'-', r.title||'-', r.section||'-', String(r.unit ?? r.hours ?? '-'), r.room||'-', r.session||'-']);
            const html = buildTable(headers, data);
            printContent({ title: 'Unassigned Schedules', subtitle: `${rows.length} entries`, bodyHtml: html });
          }}>Print</Button>
        </HStack>
      </HStack>

      {/* Filters */}
      <Box borderWidth="1px" borderColor={border} rounded="md" p={3} bg={panelBg}>
        <HStack spacing={3} wrap="wrap">
          <FormControl maxW="260px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Search</FormLabel>
            <Input size="sm" value={query} onChange={(e)=>{ setQuery(e.target.value); setPage(1); }} placeholder="Program / Code / Title / Section / Room / Term" />
          </FormControl>
          <FormControl maxW="200px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Program</FormLabel>
            <Select size="sm" value={program} onChange={(e)=>{ setProgram(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {programOptions.map(p => (<option key={p} value={p}>{p}</option>))}
            </Select>
          </FormControl>
          <FormControl maxW="160px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Term</FormLabel>
            <Select size="sm" value={term} onChange={(e)=>{ setTerm(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="Sem">Sem</option>
            </Select>
          </FormControl>
          <FormControl maxW="180px">
            <FormLabel m={0} fontSize="xs" color="gray.500">Time</FormLabel>
            <Select size="sm" value={time} onChange={(e)=>{ setTime(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {getTimeOptions().map((t,i)=>(<option key={`${t}-${i}`} value={t}>{t || '-'}</option>))}
            </Select>
          </FormControl>
          <Button size="sm" variant="ghost" onClick={()=>{ setQuery(''); setProgram(''); setTerm(''); setTime(''); setPage(1); }}>Clear</Button>
        </HStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg}>
        <Table size="sm" variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('term')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Term</Text>{sortKey==='term' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('time')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Time</Text>{sortKey==='time' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('program')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Program</Text>{sortKey==='program' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('code')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Code</Text>{sortKey==='code' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('title')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Title</Text>{sortKey==='title' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('section')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Section</Text>{sortKey==='section' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('units')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Units</Text>{sortKey==='units' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('room')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Room</Text>{sortKey==='room' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th onClick={()=>toggleSort('session')} cursor="pointer" userSelect="none">
                <HStack spacing={1}><Text>Session</Text>{sortKey==='session' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack>
              </Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paged.map((r) => (
              <Tr key={r.id}>
                <Td>{r.semester || '-'}</Td>
                <Td>{r.schedule || '-'}</Td>
                <Td>{r.program || '-'}</Td>
                <Td>{r.code || '-'}</Td>
                <Td maxW="420px"><Text noOfLines={1}>{r.title || '-'}</Text></Td>
                <Td>{r.section || '-'}</Td>
                <Td>{r.unit ?? r.hours ?? '-'}</Td>
                <Td>{r.room || '-'}</Td>
                <Td>{r.session || '-'}</Td>
                <Td textAlign="right">
                  <HStack justify="end" spacing={1}>
                    <Button size="sm" colorScheme="blue" onClick={()=>{ setSelected(r); assignDisc.onOpen(); }}>Assign</Button>
                    <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" colorScheme="yellow" variant="ghost" onClick={() => { setSelected(r); editDisc.onOpen(); }} />
                    <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => { setSelected(r); delDisc.onOpen(); }} />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={() => {}} />

      {/* Edit Modal */}
      <EditScheduleModal isOpen={editDisc.isOpen} onClose={() => { editDisc.onClose(); setSelected(null); }} schedule={selected} onSave={handleSaveEdit} viewMode={'regular'} />

      <AssignFacultyModal
        isOpen={assignDisc.isOpen}
        onClose={() => { assignDisc.onClose(); setSelected(null); }}
        schedule={selected}
        onAssign={async (fac) => {
          if (!selected || !fac) return;
          try {
            await dispatch(updateScheduleThunk({ id: selected.id, changes: { facultyId: fac.id } }));
            assignDisc.onClose();
            setSelected(null);
            dispatch(loadAllSchedules());
          } catch {}
        }}
      />

      {/* Assignment modal removed by request */}

      {/* Delete Confirm */}
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete schedule?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone. Are you sure you want to delete <b>{selected?.code}</b> - {selected?.title}?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
