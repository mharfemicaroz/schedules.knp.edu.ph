import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  VStack, HStack, FormControl, FormLabel, Input, Select, Button, Checkbox, Table, Thead, Tbody, Tr, Th, Td,
  Text, useColorModeValue, Spinner, Box, Tag, TagLabel, SimpleGrid, Stat, StatLabel, StatNumber, Badge, Divider
} from '@chakra-ui/react';
import { FiRefreshCw, FiChevronUp, FiChevronDown, FiBookOpen, FiGrid, FiCheckSquare } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import apiService from '../services/apiService';
import { selectSettings } from '../store/settingsSlice';
import Pagination from './Pagination';
import useFaculties from '../hooks/useFaculties';
import { normalizeSem } from '../utils/facultyScoring';
import { loadBlocksThunk } from '../store/blockThunks';
import { selectBlocks } from '../store/blockSlice';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectAllProspectus } from '../store/prospectusSlice';
import { parseBlockMeta } from '../utils/blockMeta';

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeProgram = (value) => normalizeText(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeProgramBase = (value) => normalizeProgram(String(value || '').split('-')[0] || value);
const getYearDigit = (value) => {
  const match = String(value ?? '').match(/(\d+)/);
  return match ? String(parseInt(match[1], 10)) : '';
};
const isTruthyActive = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = normalizeLower(value);
  if (!normalized) return true;
  if (['active', 'true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['inactive', 'false', '0', 'no', 'n', 'deactivated', 'disabled'].includes(normalized)) return false;
  return true;
};
const prospectusIsActive = (row) => isTruthyActive(row?.isActive ?? row?.is_active ?? row?.active ?? row?.status);
const blockIsActive = (block) => isTruthyActive(block?.isActive ?? block?.is_active ?? block?.active ?? block?.status);
const toYearLabel = (value) => {
  const year = Number(value);
  if (!Number.isFinite(year) || year <= 0) return '-';
  const suffix = (year % 10 === 1 && year % 100 !== 11)
    ? 'st'
    : (year % 10 === 2 && year % 100 !== 12)
      ? 'nd'
      : (year % 10 === 3 && year % 100 !== 13)
        ? 'rd'
        : 'th';
  return `${year}${suffix} Year`;
};

export default function AssignSchedulesModal({ isOpen, onClose, currentFacultyName, onCreate }) {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200', 'gray.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const accentBg = useColorModeValue('blue.50', 'blue.900');
  const mutedBg = useColorModeValue('gray.50', 'gray.900');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const { data: facultyOptions } = useFaculties();
  const target = React.useMemo(() => {
    const name = normalizeText(currentFacultyName);
    const found = (facultyOptions || []).find((option) => normalizeText(option.label) === name);
    return { id: found?.id || null, name };
  }, [facultyOptions, currentFacultyName]);

  const settings = useSelector(selectSettings);
  const settingsLoad = settings?.schedulesLoad || {};

  const prospectus = useSelector(selectAllProspectus);
  const blocksAll = useSelector(selectBlocks);
  const authUser = useSelector((state) => state.auth.user);
  const role = String(authUser?.role || '').toLowerCase();
  const isAdmin = (role === 'admin' || role === 'manager' || role === 'sa');
  const [allowedDepts, setAllowedDepts] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [existing, setExisting] = React.useState([]);

  const [program, setProgram] = React.useState('');
  const [yearlevel, setYearlevel] = React.useState('');
  const [blockCode, setBlockCode] = React.useState('');
  const [search, setSearch] = React.useState('');

  const [selected, setSelected] = React.useState(new Set());
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortBy, setSortBy] = React.useState('code');
  const [sortDir, setSortDir] = React.useState('asc');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!isOpen) return;
      if (!authUser?.id || isAdmin) {
        if (alive) setAllowedDepts(null);
        return;
      }
      try {
        const rows = await apiService.getUserDepartmentsByUser(authUser.id);
        const list = Array.isArray(rows) ? rows : [];
        const codes = Array.from(new Set(list.map((row) => normalizeProgram(row?.department)).filter(Boolean)));
        if (alive) setAllowedDepts(codes);
      } catch {
        if (alive) setAllowedDepts([]);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, authUser?.id, isAdmin]);

  React.useEffect(() => {
    if (!isOpen) return;
    dispatch(loadProspectusThunk({ active: true, limit: 5000 }));
    dispatch(loadBlocksThunk({ active: true, limit: 5000 }));
  }, [isOpen, dispatch]);

  React.useEffect(() => {
    if (!isOpen) return;
    setProgram('');
    setYearlevel('');
    setBlockCode('');
    setSearch('');
    setSelected(new Set());
    setPage(1);
    setPageSize(10);
    setSortBy('code');
    setSortDir('asc');
  }, [isOpen]);

  const allowedReady = isAdmin || allowedDepts !== null;
  const hasDeptRestriction = !isAdmin && Array.isArray(allowedDepts);
  const allowedDeptSet = React.useMemo(
    () => new Set((allowedDepts || []).map((value) => normalizeProgram(value)).filter(Boolean)),
    [allowedDepts]
  );

  const activeProspectus = React.useMemo(() => {
    if (!allowedReady && !isAdmin) return [];
    let items = Array.isArray(prospectus) ? prospectus.filter(prospectusIsActive) : [];
    if (hasDeptRestriction) {
      items = items.filter((row) => {
        const exact = normalizeProgram(row?.programcode || row?.program);
        const base = normalizeProgramBase(row?.programcode || row?.program);
        return allowedDeptSet.has(exact) || allowedDeptSet.has(base);
      });
    }
    return items;
  }, [prospectus, allowedReady, isAdmin, hasDeptRestriction, allowedDeptSet]);

  const activeBlocks = React.useMemo(() => {
    if (!allowedReady && !isAdmin) return [];
    let items = Array.isArray(blocksAll) ? blocksAll.filter(blockIsActive) : [];
    if (hasDeptRestriction) {
      items = items.filter((block) => {
        const rawCode = block?.blockCode || block?.block_code || '';
        const meta = parseBlockMeta(rawCode);
        const exact = normalizeProgram(meta.programcode || rawCode);
        const base = normalizeProgramBase(meta.programcode || rawCode);
        return allowedDeptSet.has(exact) || allowedDeptSet.has(base);
      });
    }
    return items;
  }, [blocksAll, allowedReady, isAdmin, hasDeptRestriction, allowedDeptSet]);

  const programOptions = React.useMemo(() => (
    Array.from(new Set(
      activeProspectus
        .map((row) => normalizeText(row?.programcode || row?.program))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  ), [activeProspectus]);

  const yearOptions = React.useMemo(() => (
    Array.from(new Set(
      activeProspectus
        .filter((row) => !program || normalizeLower(row?.programcode || row?.program) === normalizeLower(program))
        .map((row) => getYearDigit(row?.yearlevel))
        .filter(Boolean)
    ))
      .sort((a, b) => Number(a) - Number(b))
      .map((value) => ({ value, label: toYearLabel(value) }))
  ), [activeProspectus, program]);

  const blockOptions = React.useMemo(() => {
    const selectedProgram = normalizeProgram(program);
    const selectedProgramBase = normalizeProgramBase(program);
    const selectedYear = getYearDigit(yearlevel);
    return activeBlocks
      .map((block) => normalizeText(block?.blockCode || block?.block_code))
      .filter(Boolean)
      .filter((code) => {
        const meta = parseBlockMeta(code);
        const blockProgram = normalizeProgram(meta.programcode || code);
        const blockProgramBase = normalizeProgramBase(meta.programcode || code);
        const blockYear = getYearDigit(meta.yearlevel);
        const programMatches = selectedProgram
          ? (
              blockProgram === selectedProgram
              || blockProgram === selectedProgramBase
              || blockProgramBase === selectedProgram
              || blockProgramBase === selectedProgramBase
            )
          : true;
        const yearMatches = selectedYear ? blockYear === selectedYear : true;
        if (programMatches && yearMatches) return true;
        if (!meta.programcode && selectedProgram) {
          const cleanedCode = normalizeProgram(code);
          const cleanedBase = normalizeProgramBase(code);
          const programInCode = cleanedCode.includes(selectedProgram)
            || cleanedCode.includes(selectedProgramBase)
            || cleanedBase === selectedProgram
            || cleanedBase === selectedProgramBase;
          return programInCode && (!selectedYear || cleanedCode.includes(selectedYear));
        }
        return false;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [activeBlocks, program, yearlevel]);

  React.useEffect(() => {
    if (!program) return;
    if (!programOptions.includes(program)) {
      setProgram('');
      setYearlevel('');
      setBlockCode('');
    }
  }, [program, programOptions]);

  React.useEffect(() => {
    if (yearlevel && !yearOptions.some((option) => option.value === yearlevel)) {
      setYearlevel('');
      setBlockCode('');
    }
  }, [yearlevel, yearOptions]);

  React.useEffect(() => {
    if (blockCode && !blockOptions.includes(blockCode)) {
      setBlockCode('');
    }
  }, [blockCode, blockOptions]);

  React.useEffect(() => {
    if (!isOpen) return;
    setYearlevel('');
    setBlockCode('');
    setSelected(new Set());
    setPage(1);
  }, [program, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    setBlockCode('');
    setSelected(new Set());
    setPage(1);
  }, [yearlevel, isOpen]);


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

  const rows = React.useMemo(() => {
    if (!allowedReady && !isAdmin) return [];
    const semester = normalizeSem(settingsLoad?.semester || settings?.semester || '');
    if (!semester || !blockCode) return [];

    const query = normalizeLower(search);
    const targetBlock = normalizeLower(blockCode);
    const codeSet = new Set();
    const titleSet = new Set();

    (existing || [])
      .filter((schedule) => {
        const semA = normalizeSem(schedule?.sem || '');
        const semB = normalizeSem(schedule?.term || '');
        return semA === semester || semB === semester;
      })
      .filter((schedule) => {
        const scheduleBlock = normalizeLower(
          schedule?.blockCode || schedule?.block_code || schedule?.section || schedule?.block
        );
        return scheduleBlock === targetBlock;
      })
      .forEach((schedule) => {
        [schedule?.code, schedule?.courseName, schedule?.course_name].forEach((value) => {
          const normalized = normalizeLower(value);
          if (normalized) codeSet.add(normalized);
        });
        [schedule?.title, schedule?.courseTitle, schedule?.course_title].forEach((value) => {
          const normalized = normalizeLower(value);
          if (normalized) titleSet.add(normalized);
        });
      });

    const filtered = activeProspectus
      .filter((row) => !program || normalizeLower(row?.programcode || row?.program) === normalizeLower(program))
      .filter((row) => !yearlevel || getYearDigit(row?.yearlevel) === getYearDigit(yearlevel))
      .filter((row) => normalizeSem(row?.semester || '') === semester)
      .filter((row) => {
        if (!query) return true;
        return [
          row?.course_name,
          row?.course_title,
          row?.programcode,
          row?.program,
          row?.yearlevel,
        ].some((value) => normalizeLower(value).includes(query));
      })
      .filter((row) => {
        const rowCode = normalizeLower(row?.course_name || row?.courseName);
        const rowTitle = normalizeLower(row?.course_title || row?.courseTitle);
        return !(rowCode && codeSet.has(rowCode)) && !(rowTitle && titleSet.has(rowTitle));
      });

    const direction = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const pick = (item) => {
        switch (sortBy) {
          case 'program':
            return normalizeText(item?.programcode || item?.program);
          case 'title':
            return normalizeText(item?.course_title || item?.courseTitle);
          case 'unit':
            return Number(item?.unit ?? 0);
          case 'year':
            return Number(getYearDigit(item?.yearlevel) || 0);
          case 'code':
          default:
            return normalizeText(item?.course_name || item?.courseName);
        }
      };
      const a = pick(left);
      const b = pick(right);
      if (typeof a === 'number' || typeof b === 'number') return (Number(a) - Number(b)) * direction;
      return String(a).localeCompare(String(b)) * direction;
    });
  }, [
    activeProspectus,
    allowedReady,
    blockCode,
    existing,
    isAdmin,
    program,
    search,
    settings?.semester,
    settingsLoad?.semester,
    sortBy,
    sortDir,
    yearlevel,
  ]);

  React.useEffect(() => {
    if (!isOpen) return;
    setSelected((previous) => {
      const allowedIds = new Set(rows.map((row, index) => row.id ?? `${row.course_name || row.courseName}-${index}`));
      const next = new Set([...previous].filter((key) => allowedIds.has(key)));
      return next.size === previous.size ? previous : next;
    });
    setPage(1);
  }, [rows, isOpen]);

  React.useEffect(() => {
    const nextPageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > nextPageCount) setPage(nextPageCount);
  }, [rows.length, pageSize, page]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = React.useMemo(() => rows.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [rows, page, pageSize]);
  const selectedCount = selected.size;
  const selectedUnits = React.useMemo(
    () => rows
      .filter((row, index) => selected.has(row.id ?? `${row.course_name || row.courseName}-${index}`))
      .reduce((sum, row) => sum + Number(row?.unit || 0), 0),
    [rows, selected]
  );

  const headerChecked = rows.length > 0 && selected.size === rows.length;
  const headerIndeterminate = selected.size > 0 && selected.size < rows.length;
  const toggleAll = () => {
    if (headerChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r, idx) => r.id ?? `${r.course_name || r.courseName}-${idx}`)));
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
    const items = rows.filter((r, idx) => selected.has(r.id ?? `${r.course_name || r.courseName}-${idx}`)).map(r => ({
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
    if (sortBy === key) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
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
            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={accentBg} px={4} py={3}>
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between" align="start" spacing={4} wrap="wrap">
                  <Box>
                    <Text fontSize="lg" fontWeight="700">Faculty Schedule Assignment</Text>
                    <Text fontSize="sm" color={subtle}>
                      Only active blocks and active prospectus courses are shown for the current semester.
                    </Text>
                  </Box>
                  <HStack spacing={2} wrap="wrap" justify="flex-end">
                    <Tag colorScheme="blue" variant="subtle">
                      <TagLabel>Semester: {settingsLoad?.semester || settings?.semester || '-'}</TagLabel>
                    </Tag>
                    <Tag colorScheme="purple" variant="subtle">
                      <TagLabel>Faculty: {currentFacultyName || 'Unassigned'}</TagLabel>
                    </Tag>
                  </HStack>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Box borderWidth="1px" borderColor={border} rounded="lg" bg={panelBg} px={3} py={2.5}>
                    <Stat>
                      <HStack justify="space-between">
                        <StatLabel color={subtle}>Available Courses</StatLabel>
                        <FiBookOpen color="currentColor" />
                      </HStack>
                      <StatNumber fontSize="2xl">{rows.length}</StatNumber>
                    </Stat>
                  </Box>
                  <Box borderWidth="1px" borderColor={border} rounded="lg" bg={panelBg} px={3} py={2.5}>
                    <Stat>
                      <HStack justify="space-between">
                        <StatLabel color={subtle}>Selected Rows</StatLabel>
                        <FiCheckSquare color="currentColor" />
                      </HStack>
                      <StatNumber fontSize="2xl">{selectedCount}</StatNumber>
                    </Stat>
                  </Box>
                  <Box borderWidth="1px" borderColor={border} rounded="lg" bg={panelBg} px={3} py={2.5}>
                    <Stat>
                      <HStack justify="space-between">
                        <StatLabel color={subtle}>Selected Units</StatLabel>
                        <FiGrid color="currentColor" />
                      </HStack>
                      <StatNumber fontSize="2xl">{selectedUnits}</StatNumber>
                    </Stat>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Box>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={mutedBg} p={4}>
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" align="center" wrap="wrap">
                  <Text fontSize="sm" fontWeight="600">Filters</Text>
                  <Button
                    leftIcon={<FiRefreshCw />}
                    size="sm"
                    variant="outline"
                    onClick={refreshExisting}
                    isLoading={loading}
                  >
                    Refresh Existing Schedules
                  </Button>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
                  <FormControl>
                    <FormLabel m={0} fontSize="xs" color="gray.500">Program</FormLabel>
                    <Select size="sm" value={program} onChange={(e) => setProgram(e.target.value)}>
                      <option value="">Select program</option>
                      {programOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel m={0} fontSize="xs" color="gray.500">Year Level</FormLabel>
                    <Select size="sm" value={yearlevel} onChange={(e) => setYearlevel(e.target.value)} isDisabled={!program}>
                      <option value="">Select year level</option>
                      {yearOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel m={0} fontSize="xs" color="gray.500">Block</FormLabel>
                    <Select
                      size="sm"
                      value={blockCode}
                      onChange={(e) => setBlockCode(e.target.value)}
                      placeholder="Select active block"
                      isDisabled={!program || !yearlevel}
                    >
                      {blockOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel m={0} fontSize="xs" color="gray.500">Search</FormLabel>
                    <Input
                      size="sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Code / Title / Program"
                      isDisabled={!blockCode}
                    />
                  </FormControl>
                </SimpleGrid>
                <HStack spacing={2} wrap="wrap">
                  <Badge colorScheme={program ? 'blue' : 'gray'} px={2} py={1} rounded="md">
                    Program: {program || 'Not selected'}
                  </Badge>
                  <Badge colorScheme={yearlevel ? 'green' : 'gray'} px={2} py={1} rounded="md">
                    Year: {yearlevel ? toYearLabel(yearlevel) : 'Not selected'}
                  </Badge>
                  <Badge colorScheme={blockCode ? 'purple' : 'gray'} px={2} py={1} rounded="md">
                    Block: {blockCode || 'Not selected'}
                  </Badge>
                </HStack>
              </VStack>
            </Box>

            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflow="hidden">
              <Box px={4} py={3}>
                <HStack justify="space-between" wrap="wrap" spacing={3}>
                  <Box>
                    <Text fontWeight="600">Eligible Courses</Text>
                    <Text fontSize="sm" color={subtle}>
                      Unscheduled active courses for the selected active block in the current semester.
                    </Text>
                  </Box>
                  <Badge colorScheme="blue" fontSize="0.8em" px={2.5} py={1} rounded="md">
                    {rows.length} candidate{rows.length === 1 ? '' : 's'}
                  </Badge>
                </HStack>
              </Box>
              <Divider />
              {!program || !yearlevel || !blockCode ? (
                <VStack px={6} py={12} spacing={2} color={subtle}>
                  <Text fontWeight="600">Select a program, year level, and active block.</Text>
                  <Text fontSize="sm" textAlign="center">
                    The list only loads after the assignment target is fully scoped, which avoids stale rows and duplicate loading.
                  </Text>
                </VStack>
              ) : loading ? (
                <HStack p={4}><Spinner size="sm" /><Text>Loading existing schedules...</Text></HStack>
              ) : (
                <>
                  <Box overflowX="auto">
                    <Table size="sm">
                      <Thead>
                        <Tr>
                          <Th width="1%"><Checkbox isChecked={headerChecked} isIndeterminate={headerIndeterminate} onChange={toggleAll} /></Th>
                          <Th cursor="pointer" onClick={() => headerClick('program')}><SortLabel label="Program" col="program" /></Th>
                          <Th cursor="pointer" onClick={() => headerClick('code')}><SortLabel label="Code" col="code" /></Th>
                          <Th cursor="pointer" onClick={() => headerClick('title')}><SortLabel label="Title" col="title" /></Th>
                          <Th cursor="pointer" onClick={() => headerClick('unit')}><SortLabel label="Units" col="unit" /></Th>
                          <Th cursor="pointer" onClick={() => headerClick('year')}><SortLabel label="Year" col="year" /></Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {paged.length === 0 ? (
                          <Tr>
                            <Td colSpan={6}>
                              <VStack py={8} spacing={1} color={subtle}>
                                <Text fontWeight="600">No assignable courses found.</Text>
                                <Text fontSize="sm" textAlign="center">
                                  This usually means the active courses for this block are already scheduled, filtered out by search, or inactive.
                                </Text>
                              </VStack>
                            </Td>
                          </Tr>
                        ) : (
                          paged.map((r, idx) => {
                            const key = r.id ?? `${r.programcode}-${r.course_name}-${idx}`;
                            const id = r.id ?? `${r.course_name || r.courseName}-${((page - 1) * pageSize) + idx}`;
                            return (
                              <Tr key={key} _hover={{ bg: hoverBg }}>
                                <Td><Checkbox isChecked={selected.has(id)} onChange={() => toggleOne(id)} /></Td>
                                <Td>{r.programcode || r.program || '-'}</Td>
                                <Td><Text fontWeight="600">{r.course_name || r.courseName || '-'}</Text></Td>
                                <Td maxW="420px"><Text noOfLines={1}>{r.course_title || r.courseTitle || '-'}</Text></Td>
                                <Td>{r.unit ?? '-'}</Td>
                                <Td>{toYearLabel(getYearDigit(r.yearlevel))}</Td>
                              </Tr>
                            );
                          })
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                  <Box px={4} py={3}>
                    <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
                  </Box>
                </>
              )}
            </Box>
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
