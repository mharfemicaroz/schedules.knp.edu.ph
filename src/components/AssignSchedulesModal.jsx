import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  VStack, HStack, FormControl, FormLabel, Input, Select, Button, Checkbox, Table, Thead, Tbody, Tr, Th, Td,
  Text, useColorModeValue, Spinner, IconButton, Box
} from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { getTimeOptions } from '../utils/timeOptions';
import apiService from '../services/apiService';
import Pagination from './Pagination';
import useFaculties from '../hooks/useFaculties';
import { updateScheduleThunk, loadAllSchedules } from '../store/dataThunks';

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
  const target = React.useMemo(() => {
    const name = String(currentFacultyName || '').trim();
    const found = (facultyOptions || []).find(o => String(o.label).trim() === name);
    return { id: found?.id || null, name };
  }, [facultyOptions, currentFacultyName]);

  // Filters
  const [dept, setDept] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [time, setTime] = React.useState('');
  const [search, setSearch] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState([]);
  const [selected, setSelected] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (dept) filters.dept = dept;
      if (term) filters.term = term;
      if (time) filters.time = time;
      const res = await apiService.getAllSchedules(filters);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
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
      // sort: unassigned first, then term, then time, then program/code
      filtered.sort((a,b) => {
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
      });
      setRows(filtered);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [dept, term, time, search]);

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
                <FormLabel m={0} fontSize="xs" color="gray.500">Department</FormLabel>
                <Input size="sm" value={dept} onChange={(e)=>setDept(e.target.value)} placeholder="e.g., CICT" />
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
            </HStack>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
              {loading ? (
                <HStack p={4}><Spinner size="sm" /><Text>Loading…</Text></HStack>
              ) : (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th width="1%"><Checkbox isChecked={headerChecked} isIndeterminate={headerIndeterminate} onChange={toggleAll} /></Th>
                      <Th>Avail</Th>
                      <Th>Term</Th>
                      <Th>Time</Th>
                      <Th>Program</Th>
                      <Th>Code</Th>
                      <Th>Title</Th>
                      <Th>Section</Th>
                      <Th>Room</Th>
                      <Th>Faculty</Th>
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
