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
  const authUser = useSelector(s => s.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const isAdmin = (role === 'admin' || role === 'manager');
  const [allowedDepts, setAllowedDepts] = React.useState(null);
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

  // Fetch allowed departments for non-admin users when opening
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!isOpen) return;
      if (!authUser?.id || isAdmin) { if (alive) setAllowedDepts(null); return; }
      try {
        const rows = await apiService.getUserDepartmentsByUser(authUser.id);
        const list = Array.isArray(rows) ? rows : [];
        const codes = Array.from(new Set(list.map(r => String(r.department || '').toUpperCase()).filter(Boolean)));
        if (alive) setAllowedDepts(codes);
      } catch { if (alive) setAllowedDepts([]); }
    })();
    return () => { alive = false; };
  }, [isOpen, authUser?.id, isAdmin]);

  // Helper to parse block program code similar to CourseLoading
  const parseBlockMeta = React.useCallback((blockCode) => {
    const s = String(blockCode || '').trim();
    if (!s) return { programcode: '', yearlevel: '' };
    let m = s.match(/^([A-Z0-9-]+)\s+(\d+)/i);
    if (m) return { programcode: (m[1] || '').toUpperCase(), yearlevel: m[2] || '' };
    const [head, rest] = s.split('-');
    if (rest) {
      const m2 = rest.match(/(\d+)/);
      return { programcode: (head || '').toUpperCase(), yearlevel: m2 ? (m2[1] || '') : '' };
    }
    const m3 = s.match(/^(\D+?)(\d+)/);
    if (m3) return { programcode: (m3[1] || '').replace(/[-\s]+$/, '').toUpperCase(), yearlevel: m3[2] || '' };
    return { programcode: s.toUpperCase(), yearlevel: '' };
  }, []);

  // Load source data when opening
  React.useEffect(() => {
    if (!isOpen) return;
    dispatch(loadProspectusThunk({}));
    dispatch(loadBlocksThunk({}));
  }, [isOpen, dispatch]);

  const allowedReady = isAdmin || allowedDepts !== null;

  // Build program/year options from prospectus
  React.useEffect(() => {
    if (!allowedReady && !isAdmin) { setProgramOptions([]); return; }
    let progs = Array.from(new Set((prospectus || []).map(p => p.programcode || p.program || '').filter(Boolean))).sort();
    if (!isAdmin && Array.isArray(allowedDepts)) {
      const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
      progs = progs.filter(p => allow.size === 0 ? false : allow.has(String(p).toUpperCase()));
    }
    setProgramOptions(progs);
    // Year options: normalize to digits and sort 1,2,3,4; display as '1st Year' etc.
    const toDigit = (v) => { const m = String(v ?? '').match(/(\d+)/); return m ? parseInt(m[1], 10) : NaN; };
    const digits = Array.from(new Set((prospectus || [])
      .map(p => toDigit(p.yearlevel))
      .filter((n) => Number.isFinite(n))))
      .sort((a,b) => a - b);
    const label = (n) => {
      const sfx = (n % 10 === 1 && n % 100 !== 11) ? 'st' : (n % 10 === 2 && n % 100 !== 12) ? 'nd' : (n % 10 === 3 && n % 100 !== 13) ? 'rd' : 'th';
      return `${n}${sfx} Year`;
    };
    setYearOptions(digits.map(n => ({ value: String(n), label: label(n) })));
    // Reset selected program if no longer allowed
    if (program && progs.length && !progs.includes(program)) {
      setProgram('');
    }
  }, [prospectus, isAdmin, allowedDepts, allowedReady]);

  // Build block options for selected program/year
  React.useEffect(() => {
    if (!allowedReady && !isAdmin) { setBlockOptions([]); if (blockCode) setBlockCode(''); return; }
    const up = (s) => String(s || '').toUpperCase();
    const prog = up(program);
    // extract digits from yearlevel, e.g., "3rd Year" -> "3"
    const ydig = (String(yearlevel || '').match(/(\d+)/) || [,''])[1];
    let opts = (blocksAll || [])
      .map(b => String(b.blockCode || b.block_code || '').trim())
      .filter(Boolean)
      .filter(code => {
        const u = up(code);
        const hasProg = prog ? u.includes(up(prog)) : true;
        const hasYear = ydig ? u.includes(ydig) : true;
        return hasProg && hasYear;
      })
      .sort((a,b) => a.localeCompare(b));
    if (!isAdmin && Array.isArray(allowedDepts)) {
      const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
      opts = opts.filter(code => allow.size === 0 ? false : allow.has(String(parseBlockMeta(code).programcode || '').toUpperCase()));
    }
    setBlockOptions(opts);
    if (blockCode && !opts.includes(blockCode)) setBlockCode('');
  }, [blocksAll, program, yearlevel, isAdmin, allowedDepts, parseBlockMeta, allowedReady]);

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
    if (!allowedReady && !isAdmin) { setRows([]); setSelected(new Set()); return; }
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
    const ysel = (String(yearlevel || '').match(/(\d+)/) || [,''])[1];
    let base = (prospectus || []).filter(p =>
      (!program || norm(p.programcode || p.program) === norm(program)) &&
      (!ysel || String((String(p.yearlevel||'').match(/(\d+)/)||[,''])[1]||'') === String(ysel)) &&
      (normalizeSem(p.semester || '') === semNorm)
    );
    if (!isAdmin && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
      const allow = new Set(allowedDepts.map(s => String(s).toUpperCase()));
      base = base.filter(p => allow.has(String(p.programcode || p.program || '').toUpperCase()));
    }
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
              <FormControl maxW="160px">
                <FormLabel m={0} fontSize="xs" color="gray.500">Year Level</FormLabel>
                <Select size="sm" value={yearlevel} onChange={(e)=>setYearlevel(e.target.value)}>
                  <option value="">All</option>
                  {yearOptions.map(y => (<option key={y.value} value={y.value}>{y.label}</option>))}
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
