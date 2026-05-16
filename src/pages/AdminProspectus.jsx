import React from 'react';
import { Box, HStack, VStack, Heading, Text, Button, IconButton, Input, Select, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Tag, TagLabel, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, SimpleGrid, Badge, useToast, Switch } from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash, FiFilter, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadProspectusThunk, createProspectusThunk, updateProspectusThunk, deleteProspectusThunk } from '../store/prospectusThunks';
import { selectFilteredProspectus, selectProspectusFilterOptions, selectProspectusFilters, setProspectusFilters, clearProspectusFilters } from '../store/prospectusSlice';
import ProspectusFormModal from '../components/ProspectusFormModal';
import Pagination from '../components/Pagination';

const PROGRAM_OPTIONS = [
  'BSAB', 'BSBA-FM', 'BSBA-HRM', 'BSBA-MM', 'BSCRIM', 'BSED-ENGLISH', 'BSED-MATH', 'BSED-SS', 'BSED-VE', 'BSENTREP', 'BSTM', 'BTLED-HE',
];

export default function AdminProspectus() {
  const dispatch = useDispatch();
  const toast = useToast();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const items = useSelector(selectFilteredProspectus);
  const filters = useSelector(selectProspectusFilters);
  const opts = useSelector(selectProspectusFilterOptions);
  const loading = useSelector(s => s.prospectus.loading);
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  const formDisc = useDisclosure();
  const delDisc = useDisclosure();
  const [editing, setEditing] = React.useState(null);
  const [toDelete, setToDelete] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortKey, setSortKey] = React.useState('programcode');
  const [sortDir, setSortDir] = React.useState('asc');
  const [togglingIds, setTogglingIds] = React.useState(new Set());

  const curriculumYearOptions = React.useMemo(() => {
    const y = new Date().getFullYear();
    const set = new Set();
    for (let yr = y - 3; yr <= y + 3; yr++) {
      set.add(`${yr}-${yr + 1}`);
    }
    (items || []).forEach((row) => {
      const val = String(row?.curriculum_year || row?.curriculumYear || '').trim();
      if (val) set.add(val);
    });
    const editingVal = String(editing?.curriculum_year || editing?.curriculumYear || '').trim();
    if (editingVal) set.add(editingVal);
    const filterVal = String(filters?.curriculum_year || '').trim();
    if (filterVal) set.add(filterVal);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, editing, filters?.curriculum_year]);

  React.useEffect(() => { dispatch(loadProspectusThunk({})); }, [dispatch]);
  React.useEffect(() => { setPage(1); }, [filters, items.length]);

  const rowIsActive = React.useCallback((row) => {
    const raw = row?.isActive ?? row?.is_active;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return true;
    return ['true', '1', 'yes', 'active'].includes(s);
  }, []);

  const markToggling = React.useCallback((id, busy) => {
    setTogglingIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  }, []);

  const handleToggleActive = React.useCallback(async (row) => {
    if (!row?.id) return;
    const nextActive = !rowIsActive(row);
    markToggling(row.id, true);
    try {
      await dispatch(updateProspectusThunk({
        id: row.id,
        changes: { isActive: nextActive, is_active: nextActive },
      })).unwrap();
      toast({
        title: nextActive ? 'Course activated' : 'Course deactivated',
        description: `${row.course_name || row.courseName || 'Course'} is now ${nextActive ? 'active' : 'inactive'}.`,
        status: 'success',
      });
    } catch (e) {
      toast({
        title: 'Status update failed',
        description: e?.message || 'Could not update course status.',
        status: 'error',
      });
    } finally {
      markToggling(row.id, false);
    }
  }, [dispatch, markToggling, rowIsActive, toast]);

  const onAdd = () => { setEditing(null); formDisc.onOpen(); };
  const onEdit = (row) => { setEditing(row); formDisc.onOpen(); };
  const onDelete = (row) => { setToDelete(row); delDisc.onOpen(); };

  const access = React.useCallback((row, key) => {
    switch (key) {
      case 'programcode': return String(row.programcode || row.program || '');
      case 'course_name': return String(row.course_name || row.courseName || '');
      case 'course_title': return String(row.course_title || row.courseTitle || '');
      case 'coursetype': return String(row.coursetype || row.courseType || '');
      case 'unit': return String(row.unit ?? '');
      case 'yearlevel': return String(row.yearlevel ?? '');
      case 'semester': return String(row.semester ?? '');
      case 'curriculum_year': return String(row.curriculum_year || row.curriculumYear || '');
      default: return '';
    }
  }, []);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const sortedItems = React.useMemo(() => {
    const dir = (sortDir === 'asc') ? 1 : -1;
    const arr = (items || []).slice();
    return arr.sort((a,b) => {
      const va = access(a, sortKey).toLowerCase();
      const vb = access(b, sortKey).toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      const pa = access(a, 'programcode');
      const pb = access(b, 'programcode');
      if (pa !== pb) return pa < pb ? -1 : 1;
      const ya = access(a, 'yearlevel');
      const yb = access(b, 'yearlevel');
      if (ya !== yb) return ya < yb ? -1 : 1;
      const sa = access(a, 'semester');
      const sb = access(b, 'semester');
      if (sa !== sb) return sa < sb ? -1 : 1;
      return 0;
    });
  }, [items, sortKey, sortDir, access]);

  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);
  const activeOnly = String(filters.active || '').toLowerCase() === 'active';

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between">
        <Heading size="md">Prospectus Management</Heading>
        {isAdmin && (
          <Button colorScheme="blue" leftIcon={<FiPlus />} onClick={onAdd}>Add Prospectus</Button>
        )}
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={3} flexWrap="wrap">
          <Input placeholder="Search course/program/year" value={filters.q || ''} onChange={(e)=>dispatch(setProspectusFilters({ q: e.target.value }))} maxW="260px" />
          <Select placeholder="Program" value={filters.programcode || ''} onChange={(e)=>dispatch(setProspectusFilters({ programcode: e.target.value }))} maxW="220px">
            {[...new Set([...(opts.programs || []), ...PROGRAM_OPTIONS])].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Year Level" value={filters.yearlevel || ''} onChange={(e)=>dispatch(setProspectusFilters({ yearlevel: e.target.value }))} maxW="160px">
            {['1st Year','2nd Year','3rd Year','4th Year'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Semester" value={filters.semester || ''} onChange={(e)=>dispatch(setProspectusFilters({ semester: e.target.value }))} maxW="180px">
            {['1st Semester','2nd Semester','Summer'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Curriculum Year" value={filters.curriculum_year || ''} onChange={(e)=>dispatch(setProspectusFilters({ curriculum_year: e.target.value }))} maxW="180px">
            {curriculumYearOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <HStack
            spacing={3}
            px={3}
            py={2}
            borderWidth="1px"
            borderColor={border}
            rounded="lg"
            bg={activeOnly ? 'green.50' : 'transparent'}
          >
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" fontWeight="700">Active Only</Text>
              <Text fontSize="xs" color={muted}>Hide inactive courses by default</Text>
            </VStack>
            <Switch
              colorScheme="green"
              isChecked={activeOnly}
              onChange={(e) => dispatch(setProspectusFilters({ active: e.target.checked ? 'active' : '' }))}
            />
          </HStack>
          <Button leftIcon={<FiFilter />} onClick={()=>dispatch(loadProspectusThunk(filters))} variant="outline" isLoading={loading}>Apply</Button>
          <Button variant="ghost" onClick={()=>dispatch(clearProspectusFilters())}>Clear</Button>
        </HStack>
      </Box>

      {/* Mobile cards view */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {paged.map(row => {
            const program = row.programcode || row.program || 'N/A';
            const name = row.course_name || row.courseName || 'N/A';
            const title = row.course_title || row.courseTitle || 'N/A';
            const courseType = row.coursetype || row.courseType || '-';
            const isActive = rowIsActive(row);
            const isToggling = togglingIds.has(String(row.id));
            return (
              <Box key={row.id} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between" align="start" spacing={3}>
                    <Text fontWeight="800" fontSize="md" noOfLines={2}>{name}</Text>
                    <Badge colorScheme={isActive ? 'green' : 'gray'} variant={isActive ? 'subtle' : 'outline'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </HStack>
                  <Text color={muted} noOfLines={2}>{title}</Text>
                  <SimpleGrid columns={2} spacing={3}>
                    <Box>
                      <Text fontSize="xs" color={muted}>Program</Text>
                      <Text>{program}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color={muted}>Units</Text>
                      <Text>{row.unit ?? '-'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color={muted}>Course Type</Text>
                      <Text>{courseType || '-'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color={muted}>Year/Sem</Text>
                      <Text>{row.yearlevel ?? '-'} / {row.semester ?? '-'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color={muted}>Curriculum</Text>
                      <Text>{row.curriculum_year || row.curriculumYear || '-'}</Text>
                    </Box>
                  </SimpleGrid>
                  {isAdmin && (
                    <HStack justify="flex-end" spacing={2} ml="auto">
                      <Button
                        size="sm"
                        variant={isActive ? 'outline' : 'solid'}
                        colorScheme={isActive ? 'orange' : 'green'}
                        onClick={() => handleToggleActive(row)}
                        isLoading={isToggling}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="outline" colorScheme="yellow" onClick={()=>onEdit(row)} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="outline" colorScheme="red" onClick={()=>onDelete(row)} />
                    </HStack>
                  )}
                </VStack>
              </Box>
            );
          })}
        </VStack>
        {sortedItems.length === 0 && (
          <VStack py={10}>
            <Heading size="sm">No prospectus found</Heading>
            <Text color="gray.500">Adjust filters or add a new record.</Text>
          </VStack>
        )}
      </Box>

      {/* Desktop/tablet table view */}
      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <HStack justify="space-between" px={4} pt={3} pb={1}>
          <Tag colorScheme="blue" variant="subtle"><TagLabel>{sortedItems.length} results</TagLabel></Tag>
          <Select size="sm" value={pageSize} onChange={(e)=>{ const n=Number(e.target.value)||10; setPageSize(n); setPage(1); }} maxW="100px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
        </HStack>
        <Table size={{ base: 'sm', md: 'md' }} variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('programcode')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Program</Text>{sortKey==='programcode' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('course_name')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Course Name</Text>{sortKey==='course_name' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('course_title')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Course Title</Text>{sortKey==='course_title' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('coursetype')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Course Type</Text>{sortKey==='coursetype' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('unit')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Unit</Text>{sortKey==='unit' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('yearlevel')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Year</Text>{sortKey==='yearlevel' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('semester')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Sem</Text>{sortKey==='semester' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('curriculum_year')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Curriculum Year</Text>{sortKey==='curriculum_year' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th>Status</Th>
              {isAdmin && <Th>Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(row => {
              const isActive = rowIsActive(row);
              const isToggling = togglingIds.has(String(row.id));
              return (
              <Tr key={row.id}>
                <Td>{row.programcode || row.program || ''}</Td>
                <Td>{row.course_name || row.courseName || ''}</Td>
                <Td>{row.course_title || row.courseTitle || ''}</Td>
                <Td>{row.coursetype || row.courseType || ''}</Td>
                <Td>{row.unit ?? ''}</Td>
                <Td>{row.yearlevel ?? ''}</Td>
                <Td>{row.semester ?? ''}</Td>
                <Td>{row.curriculum_year || row.curriculumYear || ''}</Td>
                <Td>
                  <Badge colorScheme={isActive ? 'green' : 'gray'} variant={isActive ? 'subtle' : 'outline'}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                {isAdmin && (
                  <Td textAlign="right">
                    <HStack justify="end" spacing={2}>
                      <Button
                        size="xs"
                        variant={isActive ? 'outline' : 'solid'}
                        colorScheme={isActive ? 'orange' : 'green'}
                        onClick={()=>handleToggleActive(row)}
                        isLoading={isToggling}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" colorScheme="yellow" onClick={()=>onEdit(row)} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={()=>onDelete(row)} />
                    </HStack>
                  </Td>
                )}
              </Tr>
              );
            })}
          </Tbody>
        </Table>
        {sortedItems.length === 0 && (
          <VStack py={10}>
            <Heading size="sm">No prospectus found</Heading>
            <Text color="gray.500">Adjust filters or add a new record.</Text>
          </VStack>
        )}
      </Box>

      {sortedItems.length > 0 && (
        <VStack>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(n)=>{ setPageSize(n); setPage(1); }}
          />
        </VStack>
      )}

      <ProspectusFormModal
        isOpen={formDisc.isOpen}
        onClose={formDisc.onClose}
        initial={editing}
        curriculumYearOptions={curriculumYearOptions}
        onSubmit={async (payload) => {
          if (editing) {
            await dispatch(updateProspectusThunk({ id: editing.id, changes: payload }));
          } else {
            await dispatch(createProspectusThunk(payload));
          }
          formDisc.onClose();
          setEditing(null);
          dispatch(loadProspectusThunk({}));
        }}
      />

      <AlertDialog isOpen={delDisc.isOpen} onClose={()=>{ delDisc.onClose(); setToDelete(null); }} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete prospectus item?</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <b>{toDelete?.course_name || toDelete?.courseName}</b>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={()=>{ delDisc.onClose(); setToDelete(null); }}>Cancel</Button>
              <Button colorScheme="red" ml={3} onClick={async ()=>{ await dispatch(deleteProspectusThunk(toDelete.id)); delDisc.onClose(); setToDelete(null); }}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
