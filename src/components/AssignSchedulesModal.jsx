import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  VStack, HStack, FormControl, FormLabel, Input, Select, Button, Checkbox, Table, Thead, Tbody, Tr, Th, Td,
  Text, useColorModeValue, Spinner, IconButton, Box, Switch
} from '@chakra-ui/react';
import { FiRefreshCw, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { getTimeOptions } from '../utils/timeOptions';
import apiService from '../services/apiService';
import { selectSettings } from '../store/settingsSlice';
import Pagination from './Pagination';
import useFaculties from '../hooks/useFaculties';
import { updateScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { selectAllCourses } from '../store/dataSlice';
import { normalizeTimeBlock } from '../utils/timeNormalize';

function isUnassigned(row) {
  const facIdNull = row.faculty_id == null || row.facultyId == null;
  const instr = String(row.instructor || row.faculty || '').trim();
  return facIdNull && (!instr || /^(unknown|unassigned|n\/?a|none|no\s*faculty|not\s*assigned|tba|-)$/i.test(instr));
}

export default function AssignSchedulesModal({ isOpen, onClose, currentFacultyName }) {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');

  // Load faculty list to resolve target ID by name
  const { data: facultyOptions } = useFaculties();
  const allCourses = useSelector(selectAllCourses);
  const target = React.useMemo(() => {
    const name = String(currentFacultyName || '').trim();
    const found = (facultyOptions || []).find(o => String(o.label).trim() === name);
    return { id: found?.id || null, name };
  }, [facultyOptions, currentFacultyName]);

  // Filters
  const [program, setProgram] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [time, setTime] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [programOptions, setProgramOptions] = React.useState([]);
  const [strictMode, setStrictMode] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const settings = useSelector(selectSettings);
  const [rows, setRows] = React.useState([]);
  const [selected, setSelected] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortBy, setSortBy] = React.useState(''); // '', or column key
  const [sortDir, setSortDir] = React.useState('asc');

  // Strict-mode helpers
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim();
  const sameFaculty = React.useCallback((row) => {
    const rId = row && (row.facultyId ?? row.faculty_id);
    const tId = target.id;
    if (tId != null && rId != null && String(tId) === String(rId)) return true;
    const rName = row && (row.facultyName || row.instructor || row.faculty);
    return !!norm(rName) && norm(rName) === norm(target.name);
  }, [target]);

  const facultyScheds = React.useMemo(() => (allCourses || []).filter(s => sameFaculty(s)), [allCourses, sameFaculty]);

  const timeEquals = (aStart, aEnd, bStart, bEnd, aStr, bStr) => {
    if (Number.isFinite(aStart) && Number.isFinite(aEnd) && Number.isFinite(bStart) && Number.isFinite(bEnd)) {
      return aStart === bStart && aEnd === bEnd;
    }
    return aStr && bStr && String(aStr).trim() === String(bStr).trim();
  };

  const candidateNoConflict = (cand) => {
    // Only check when candidate has valid term + time; otherwise allow
    const term = String(cand.term || '').trim().toLowerCase();
    const tn = normalizeTimeBlock(cand.time);
    if (!term || !tn) return true;
    const candStart = tn.start, candEnd = tn.end, candKey = tn.key;
    const candSec = norm(cand.block_code || cand.blockCode || cand.section);
    for (const r of facultyScheds) {
      const rTerm = String(r.term || '').trim().toLowerCase();
      if (!rTerm || rTerm !== term) continue;
      const rStart = Number.isFinite(r.timeStartMinutes) ? r.timeStartMinutes : undefined;
      const rEnd = Number.isFinite(r.timeEndMinutes) ? r.timeEndMinutes : undefined;
      const rKey = String(r.scheduleKey || r.schedule || r.time || '').trim();
      const sameTime = timeEquals(candStart, candEnd, rStart, rEnd, candKey, rKey);
      if (!sameTime) continue;
      const rSec = norm(r.section || '');
      // If same section, it's a merged duplicate (allowed)
      if (rSec && candSec && rSec === candSec) continue;
      // Otherwise, it would be a conflict
      return false;
    }
    return true;
  };

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (program) filters.programcode = program;
      if (term) filters.term = term;
      if (time) filters.time = time;
      // Enforce view filters from settings
      const sy = settings?.schedulesView?.school_year;
      const sem = settings?.schedulesView?.semester;
      if (sy) filters.sy = sy;
      if (sem) filters.sem = sem;
      const res = await apiService.getAllSchedules(filters);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // derive program options from fetched list
      const progs = Array.from(new Set(list.map(r => r.programcode).filter(Boolean))).sort();
      setProgramOptions(progs);
      // client-side search
      const q = String(search || '').trim().toLowerCase();
      const filtered = q
        ? list.filter(r => [
            r.programcode,
            r.courseName, r.course_name,
            r.courseTitle, r.course_title,
            r.blockCode, r.block_code,
            r.dept,
            r.room,
            r.session,
            r.time,
            r.day,
          ].some(v => String(v || '').toLowerCase().includes(q)))
        : list;
      // Exclude schedules already under the current faculty
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim();
      const tgtId = target.id != null ? String(target.id) : '';
      const tgtName = norm(target.name);
      const notCurrentFaculty = (r) => {
        const rId = r.faculty_id != null ? String(r.faculty_id) : (r.facultyId != null ? String(r.facultyId) : '');
        if (tgtId && rId && rId === tgtId) return false;
        const rName = norm(r.instructor || r.faculty || r.facultyName);
        if (tgtName && rName && rName === tgtName) return false;
        return true;
      };
      let filtered2 = filtered.filter(notCurrentFaculty);
      // strict mode: only unassigned and no-conflict with current faculty
      if (strictMode) {
        filtered2 = filtered2.filter(r => isUnassigned(r) && candidateNoConflict(r));
      }
      // sorting
      const cmp = (a, b) => {
        const dir = sortDir === 'desc' ? -1 : 1;
        const val = (row, key) => {
          switch (key) {
            case 'avail': return isUnassigned(row) ? 0 : 1;
            case 'term': return String(row.term || '').toLowerCase();
            case 'time': return String(row.time || '');
            case 'program': return String(row.programcode || '');
            case 'code': return String(row.course_name || row.courseName || '');
            case 'title': return String(row.course_title || row.courseTitle || '');
            case 'section': return String(row.block_code || row.blockCode || '');
            case 'room': return String(row.room || '');
            case 'faculty': return String(row.instructor || row.faculty || '');
            default: return null;
          }
        };
        if (sortBy) {
          const va = val(a, sortBy);
          const vb = val(b, sortBy);
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
          return String(va).localeCompare(String(vb)) * dir;
        }
        // default multi-key sort (unassigned, term, time, code)
        const ua = isUnassigned(a) ? 0 : 1;
        const ub = isUnassigned(b) ? 0 : 1;
        if (ua !== ub) return ua - ub;
        const ta = String(a.term||'').toLowerCase();
        const tb = String(b.term||'').toLowerCase();
        if (ta !== tb) return ta.localeCompare(tb);
        const sa = String(a.time||'');
        const sb = String(b.time||'');
        if (sa !== sb) return sa.localeCompare(sb);
        return String(a.course_name||'').localeCompare(String(b.course_name||''));
      };
      filtered2.sort(cmp);
      setRows(filtered2);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [program, term, time, search, sortBy, sortDir, target, strictMode, facultyScheds]);

  React.useEffect(() => { if (isOpen) fetchData(); }, [isOpen, fetchData]);

  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = React.useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  const headerChecked = paged.length > 0 && paged.every(r => selected.has(r.id));
  const headerIndeterminate = paged.some(r => selected.has(r.id)) && !headerChecked;
  const toggleAll = () => {
    if (headerChecked) {
      const next = new Set(selected);
      paged.forEach(r => next.delete(r.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paged.forEach(r => next.add(r.id));
      setSelected(next);
    }
  };

  const canAssign = selected.size > 0 && (!!target.id || !!target.name);

  const assignSelected = async () => {
    if (!canAssign) return;
    const idList = Array.from(selected);
    try {
      await Promise.all(idList.map(id => dispatch(updateScheduleThunk({ id, changes: { facultyId: target.id ?? null, instructor: target.name } }))));
      setSelected(new Set());
      await dispatch(loadAllSchedules());
      onClose?.();
    } catch {}
  };


  const headerClick = (key) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  const SortLabel = ({ label, col }) => {
    const active = sortBy === col;
    return (
      <HStack as="span" spacing={1} userSelect="none" color={active ? 'blue.500' : undefined}>
        <Text as="span">{label}</Text>
        {active && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
      </HStack>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign Schedules {currentFacultyName ? `to ${currentFacultyName}` : ''}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <HStack spacing={3} wrap="wrap">
              <FormControl maxW="240px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Program</FormLabel>
                <Select size="sm" value={program} onChange={(e)=>setProgram(e.target.value)}>
                  <option value="">All</option>
                  {programOptions.map(p => (<option key={p} value={p}>{p}</option>))}
                </Select>
              </FormControl>
              <FormControl maxW="160px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Term</FormLabel>
                <Select size="sm" value={term} onChange={(e)=>setTerm(e.target.value)}>
                  <option value="">All</option>
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="Sem">Sem</option>
                </Select>
              </FormControl>
              <FormControl maxW="180px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Time</FormLabel>
                <Select size="sm" value={time} onChange={(e)=>setTime(e.target.value)}>
                  <option value="">All</option>
                  {getTimeOptions().map((t,i)=>(<option key={`${t}-${i}`} value={t}>{t || '-'}</option>))}
                </Select>
              </FormControl>
              <FormControl flex="1">
                <FormLabel m={0} fontSize="xs" color="gray.500">Search</FormLabel>
                <Input size="sm" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Program / Code / Title / Section / Room" />
              </FormControl>
              <IconButton aria-label="Refresh" icon={<FiRefreshCw />} size="sm" onClick={fetchData} isDisabled={loading} />
              <HStack ml="auto" spacing={3} align="center">
                <FormControl display="flex" alignItems="center" w="auto">
                  <FormLabel htmlFor="strict-mode" m={0} fontSize="xs" color="gray.500">All</FormLabel>
                  <Switch id="strict-mode" size="md" colorScheme="blue" isChecked={strictMode} onChange={(e)=>setStrictMode(e.target.checked)} />
                  <FormLabel htmlFor="strict-mode" m={0} fontSize="xs" color="gray.500" ml={2}>Strict</FormLabel>
                </FormControl>
              </HStack>
            </HStack>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
              {loading ? (
                <HStack p={4}><Spinner size="sm" /><Text>Loading…</Text></HStack>
              ) : (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th width="1%"><Checkbox isChecked={headerChecked} isIndeterminate={headerIndeterminate} onChange={toggleAll} /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('avail')}><SortLabel label="Avail" col="avail" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('term')}><SortLabel label="Term" col="term" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('time')}><SortLabel label="Time" col="time" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('program')}><SortLabel label="Program" col="program" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('code')}><SortLabel label="Code" col="code" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('title')}><SortLabel label="Title" col="title" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('section')}><SortLabel label="Section" col="section" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('room')}><SortLabel label="Room" col="room" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('faculty')}><SortLabel label="Faculty" col="faculty" /></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map(r => (
                      <Tr key={r.id}>
                        <Td><Checkbox isChecked={selected.has(r.id)} onChange={()=>toggleOne(r.id)} /></Td>
                        <Td color={isUnassigned(r)?'green.500':'gray.500'}>{isUnassigned(r)?'Unassigned':'Assigned'}</Td>
                        <Td>{r.term || '-'}</Td>
                        <Td>{r.time || '-'}</Td>
                        <Td>{r.programcode || '-'}</Td>
                        <Td>{r.courseName || r.course_name || '-'}</Td>
                        <Td maxW="380px"><Text noOfLines={1}>{r.courseTitle || r.course_title || '-'}</Text></Td>
                        <Td>{r.blockCode || r.block_code || '-'}</Td>
                        <Td>{r.room || '-'}</Td>
                        <Td>{r.instructor || r.faculty || '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Box>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button colorScheme="blue" onClick={assignSelected} isDisabled={!canAssign}>Assign to {currentFacultyName}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
