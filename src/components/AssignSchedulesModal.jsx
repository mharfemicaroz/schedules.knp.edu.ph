import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  VStack, HStack, FormControl, FormLabel, Input, Select, Button, Checkbox, Table, Thead, Tbody, Tr, Th, Td,
  Text, useColorModeValue, Spinner, IconButton, Box, Tag, TagLabel
} from '@chakra-ui/react';
import { FiRefreshCw, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import apiService from '../services/apiService';
import { selectSettings } from '../store/settingsSlice';
import Pagination from './Pagination';
import useFaculties from '../hooks/useFaculties';
import { loadAllSchedules } from '../store/dataThunks';
import { normalizeSem } from '../utils/facultyScoring';
import { loadBlocksThunk } from '../store/blockThunks';
import { selectBlocks } from '../store/blockSlice';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectAllProspectus } from '../store/prospectusSlice';
// no block filtering here per request

export default function AssignSchedulesModal({ isOpen, onClose, currentFacultyName, onCreate }) {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');

  // Target faculty
  const { data: facultyOptions } = useFaculties();
  const target = React.useMemo(() => {
    const name = String(currentFacultyName || '').trim();
    const found = (facultyOptions || []).find(o => String(o.label).trim() === name);
    return { id: found?.id || null, name };
  }, [facultyOptions, currentFacultyName]);

  // Global settings (use schedulesLoad for creation context)
  const settings = useSelector(selectSettings);
  const settingsLoad = settings?.schedulesLoad || {};

  // Source data: prospectus + blocks
  const prospectus = useSelector(selectAllProspectus);
  const blocksAll = useSelector(selectBlocks);
  const [loading, setLoading] = React.useState(false);
  const [existing, setExisting] = React.useState([]);

  // Filters
  const [program, setProgram] = React.useState('');
  const [yearlevel, setYearlevel] = React.useState('');
  const [blockCode, setBlockCode] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [programOptions, setProgramOptions] = React.useState([]);
  const [yearOptions, setYearOptions] = React.useState([]);
  const [blockOptions, setBlockOptions] = React.useState([]);

  // Table state
  const [rows, setRows] = React.useState([]);
  const [selected, setSelected] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortBy, setSortBy] = React.useState('code');
  const [sortDir, setSortDir] = React.useState('asc');

  // Load source data when opening
  React.useEffect(() => {
    if (!isOpen) return;
    dispatch(loadProspectusThunk({}));
    dispatch(loadBlocksThunk({}));
  }, [isOpen, dispatch]);

  // Build program/year options from prospectus
  React.useEffect(() => {
    const progs = Array.from(new Set((prospectus || []).map(p => p.programcode || p.program || '').filter(Boolean))).sort();
    setProgramOptions(progs);
    const yrs = Array.from(new Set((prospectus || []).map(p => String(p.yearlevel ?? '').trim()).filter(Boolean))).sort((a,b)=>Number(a)-Number(b));
    setYearOptions(yrs);
  }, [prospectus]);

  // Build block options for selected program/year
  React.useEffect(() => {
    const up = (s) => String(s || '').toUpperCase();
    const prog = up(program);
    // extract digits from yearlevel, e.g., "3rd Year" -> "3"
    const ydig = (String(yearlevel || '').match(/(\d+)/) || [,''])[1];
    const opts = (blocksAll || [])
      .map(b => String(b.blockCode || b.block_code || '').trim())
      .filter(Boolean)
      .filter(code => {
        const u = up(code);
        const hasProg = prog ? u.includes(up(prog)) : true;
        const hasYear = ydig ? u.includes(ydig) : true;
        return hasProg && hasYear;
      })
      .sort((a,b) => a.localeCompare(b));
    setBlockOptions(opts);
    if (blockCode && !opts.includes(blockCode)) setBlockCode('');
  }, [blocksAll, program, yearlevel]);

  // Fetch existing schedules for current SY/Sem (settingsLoad)
  const refreshExisting = React.useCallback(async () => {
    setLoading(true);
    try {
      const sy = settingsLoad?.school_year || settings?.school_year || '';
      const sem = settingsLoad?.semester || settings?.semester || '';
      const params = {};
      if (sy) params.sy = sy;
      if (sem) params.sem = sem;
      const res = await apiService.getAllSchedules(params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.items || []));
      setExisting(list || []);
    } finally {
      setLoading(false);
    }
  }, [settingsLoad, settings]);

  React.useEffect(() => { if (isOpen) refreshExisting(); }, [isOpen, refreshExisting]);

  // Build prospectus candidates that are not yet mapped to schedules for current load semester (per selected block)
  React.useEffect(() => {
    const semRaw = String(settingsLoad?.semester || '').trim();
    const semNorm = normalizeSem(semRaw) || '';
    const q = String(search || '').toLowerCase();
    const norm = (s) => String(s || '').trim().toLowerCase();
    const codeOf = (r) => norm(r.course_name || r.courseName || '');
    // Require both semester and block to proceed
    if (!semNorm || !blockCode) { setRows([]); setSelected(new Set()); return; }
    const blkNorm = norm(blockCode);
    // Build sets of existing course codes/titles for the selected semester and block
    const codeSet = new Set();
    const titleSet = new Set();
    (existing || [])
      .filter(s => {
        // Consider both `sem` and `term` fields when matching current semester
        const tSem = normalizeSem(s.sem || '');
        const tTerm = normalizeSem(s.term || '');
        return tSem === semNorm || tTerm === semNorm;
      })
      .filter(s => {
        const sb = norm(s.blockCode || s.block_code || s.section || s.block);
        return sb === blkNorm;
      })
      .forEach(s => {
        const c1 = norm(s.code);
        const c2 = norm(s.courseName || s.course_name);
        const t1 = norm(s.title);
        const t2 = norm(s.courseTitle || s.course_title);
        if (c1) codeSet.add(c1);
        if (c2) codeSet.add(c2);
        if (t1) titleSet.add(t1);
        if (t2) titleSet.add(t2);
      });
    let base = (prospectus || []).filter(p =>
      (!program || norm(p.programcode || p.program) === norm(program)) &&
      (!yearlevel || String(p.yearlevel || '') === String(yearlevel)) &&
      (normalizeSem(p.semester || '') === semNorm)
    );
    if (q) base = base.filter(p => [p.course_name, p.course_title, p.programcode, p.program].some(v => norm(v).includes(q)));
    const out = base.filter(p => {
      const pCode = norm(p.course_name || p.courseName);
      const pTitle = norm(p.course_title || p.courseTitle);
      const inCode = pCode && codeSet.has(pCode);
      const inTitle = pTitle && titleSet.has(pTitle);
      return !(inCode || inTitle);
    });
    const dir = (sortDir === 'asc') ? 1 : -1;
    const key = (r) => {
      switch (sortBy) {
        case 'program': return String(r.programcode || r.program || '');
        case 'code': return String(r.course_name || r.courseName || '');
        case 'title': return String(r.course_title || r.courseTitle || '');
        case 'unit': return String(r.unit ?? '');
        case 'year': return String(r.yearlevel ?? '');
        default: return String(r.course_name || r.courseName || '');
      }
    };
    out.sort((a,b) => key(a).localeCompare(key(b)) * dir);
    setRows(out);
    setPage(1);
    setSelected(new Set());
  }, [prospectus, existing, program, yearlevel, blockCode, search, sortBy, sortDir, settingsLoad]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = React.useMemo(() => rows.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [rows, page, pageSize]);

  const headerChecked = rows.length > 0 && selected.size === rows.length;
  const headerIndeterminate = selected.size > 0 && selected.size < rows.length;
  const toggleAll = () => {
    if (headerChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r, idx) => r.id ?? idx)));
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const canAssign = selected.size > 0 && !!blockCode && !!(target.id || target.name);

  // Create schedules for selected prospectus rows and assign to faculty
  const assignSelected = async () => {
    if (!canAssign) return;
    const sy = settingsLoad?.school_year || settings?.school_year || '';
    const sem = settingsLoad?.semester || settings?.semester || '';
    const items = rows.filter((r, idx) => selected.has(r.id ?? idx)).map(r => ({
      id: r.id,
      programcode: r.programcode || r.program,
      courseName: r.course_name || r.courseName,
      courseTitle: r.course_title || r.courseTitle,
      unit: r.unit,
      yearlevel: r.yearlevel,
      semester: r.semester,
    }));
    if (!items.length) return;
    // Delegate creation to parent (CourseLoading) for efficient local insert
    if (typeof onCreate === 'function') {
      try {
        await onCreate({
          blockCode,
          facultyId: target.id ?? null,
          facultyName: target.name,
          schoolyear: sy,
          semester: sem,
          items,
        });
      } finally {
        onClose?.();
      }
    } else {
      onClose?.();
    }
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
              <FormControl maxW="220px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Program</FormLabel>
                <Select size="sm" value={program} onChange={(e)=>setProgram(e.target.value)}>
                  <option value="">All</option>
                  {programOptions.map(p => (<option key={p} value={p}>{p}</option>))}
                </Select>
              </FormControl>
              <FormControl maxW="140px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Year Level</FormLabel>
                <Select size="sm" value={yearlevel} onChange={(e)=>setYearlevel(e.target.value)}>
                  <option value="">All</option>
                  {yearOptions.map(y => (<option key={y} value={y}>{y}</option>))}
                </Select>
              </FormControl>
              <FormControl minW="240px" flex="1">
                <FormLabel m={0} fontSize="xs" color="gray.500">Block</FormLabel>
                <Select size="sm" value={blockCode} onChange={(e)=>setBlockCode(e.target.value)} placeholder="Select block">
                  {blockOptions.map(b => (<option key={b} value={b}>{b}</option>))}
                </Select>
              </FormControl>
              <FormControl flex="1">
                <FormLabel m={0} fontSize="xs" color="gray.500">Search</FormLabel>
                <Input size="sm" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Code / Title / Program" />
              </FormControl>
              <IconButton aria-label="Refresh" icon={<FiRefreshCw />} size="sm" onClick={refreshExisting} isDisabled={loading} />
              <Tag colorScheme="blue" variant="subtle"><TagLabel>Sem: {settingsLoad?.semester || '-'}</TagLabel></Tag>
            </HStack>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
              {loading ? (
                <HStack p={4}><Spinner size="sm" /><Text>Loading...</Text></HStack>
              ) : (
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th width="1%"><Checkbox isChecked={headerChecked} isIndeterminate={headerIndeterminate} onChange={toggleAll} /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('program')}><SortLabel label="Program" col="program" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('code')}><SortLabel label="Code" col="code" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('title')}><SortLabel label="Title" col="title" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('unit')}><SortLabel label="Units" col="unit" /></Th>
                      <Th cursor="pointer" onClick={()=>headerClick('year')}><SortLabel label="Year" col="year" /></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {paged.map((r, idx) => {
                      const key = r.id ?? `${r.programcode}-${r.course_name}-${idx}`;
                      const id = r.id ?? idx;
                      return (
                        <Tr key={key}>
                          <Td><Checkbox isChecked={selected.has(id)} onChange={()=>toggleOne(id)} /></Td>
                          <Td>{r.programcode || r.program || '-'}</Td>
                          <Td>{r.course_name || r.courseName || '-'}</Td>
                          <Td maxW="420px"><Text noOfLines={1}>{r.course_title || r.courseTitle || '-'}</Text></Td>
                          <Td>{r.unit ?? '-'}</Td>
                          <Td>{r.yearlevel ?? '-'}</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}
            </Box>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button colorScheme="blue" onClick={assignSelected} isDisabled={!canAssign}>Create & Assign to {currentFacultyName}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
