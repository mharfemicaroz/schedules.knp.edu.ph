import React from 'react';
import { Box, HStack, VStack, Heading, Text, Button, IconButton, Input, Select, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Tag, TagLabel, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash, FiFilter, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadFacultiesThunk, createFacultyThunk, updateFacultyThunk, deleteFacultyThunk } from '../store/facultyThunks';
import { selectFilteredFaculty, selectFacultyFilterOptions, selectFacultyFilters } from '../store/facultySlice';
import FacultyFormModal from '../components/FacultyFormModal';
import Pagination from '../components/Pagination';

export default function AdminFaculty() {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const items = useSelector(selectFilteredFaculty);
  const filters = useSelector(selectFacultyFilters);
  const opts = useSelector(selectFacultyFilterOptions);
  const loading = useSelector(s => s.faculty.loading);
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  const formDisc = useDisclosure();
  const delDisc = useDisclosure();
  const [editing, setEditing] = React.useState(null);
  const [toDelete, setToDelete] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortKey, setSortKey] = React.useState('name'); // name | email | department | designation | employment | lru | rank
  const [sortDir, setSortDir] = React.useState('asc');

  React.useEffect(() => { dispatch(loadFacultiesThunk({})); }, [dispatch]);
  React.useEffect(() => { setPage(1); }, [filters, items.length]);

  const onAdd = () => { setEditing(null); formDisc.onOpen(); };
  const onEdit = (row) => { setEditing(row); formDisc.onOpen(); };
  const onDelete = (row) => { setToDelete(row); delDisc.onOpen(); };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const access = React.useCallback((row, key) => {
    switch (key) {
      case 'name': return String(row.name || row.faculty || row.instructorName || row.instructor || row.full_name || '');
      case 'email': return String(row.email || '');
      case 'department': return String(row.department || row.dept || row.department_name || row.departmentName || '');
      case 'designation': return String(row.designation || '');
      case 'employment': return String(row.employment || '');
      case 'lru': return String(row.load_release_units ?? row.loadReleaseUnits ?? '');
      case 'rank': return String(row.rank || '');
      default: return '';
    }
  }, []);

  const sortedItems = React.useMemo(() => {
    const dir = (sortDir === 'asc') ? 1 : -1;
    const arr = (items || []).slice();
    return arr.sort((a,b) => {
      const va = access(a, sortKey).toLowerCase();
      const vb = access(b, sortKey).toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      // stability tie-breakers
      const na = access(a, 'name').toLowerCase();
      const nb = access(b, 'name').toLowerCase();
      if (na !== nb) return na < nb ? -1 : 1;
      const da = access(a, 'department').toLowerCase();
      const db = access(b, 'department').toLowerCase();
      if (da !== db) return da < db ? -1 : 1;
      return 0;
    });
  }, [items, sortKey, sortDir, access]);

  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, page, pageSize]);

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between">
        <Heading size="md">Faculty Management</Heading>
        {isAdmin && (
          <Button colorScheme="blue" leftIcon={<FiPlus />} onClick={onAdd}>Add Faculty</Button>
        )}
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={3} flexWrap="wrap">
          <Input placeholder="Search name, email, dept" value={filters.q || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ q: e.target.value } })} maxW="240px" />
          <Select placeholder="Department" value={filters.department || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ department: e.target.value } })} maxW="200px">
            {opts.departments.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Designation" value={filters.designation || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ designation: e.target.value } })} maxW="200px">
            {opts.designations.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Employment" value={filters.employment || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ employment: e.target.value } })} maxW="180px">
            {opts.employments.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Select placeholder="Rank" value={filters.rank || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ rank: e.target.value } })} maxW="180px">
            {opts.ranks.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <Input placeholder="Email contains" value={filters.email || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ email: e.target.value } })} maxW="220px" />
          <Input placeholder="Load release units" value={filters.load_release_units || ''} onChange={(e)=>dispatch({ type:'faculty/setFacultyFilters', payload:{ load_release_units: e.target.value } })} maxW="180px" />
          <Button leftIcon={<FiFilter />} onClick={()=>dispatch(loadFacultiesThunk(filters))} variant="outline" isLoading={loading}>Apply</Button>
          <Button variant="ghost" onClick={()=>dispatch({ type:'faculty/clearFacultyFilters' })}>Clear</Button>
        </HStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
        <HStack justify="space-between" px={4} pt={3} pb={1}>
          <Tag colorScheme="blue" variant="subtle"><TagLabel>{sortedItems.length} results</TagLabel></Tag>
          <Select size="sm" value={pageSize} onChange={(e)=>{ const n=Number(e.target.value)||10; setPageSize(n); setPage(1); }} maxW="100px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
        </HStack>
        <Table size={{ base: 'sm', md: 'md' }} variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('name')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Name</Text>{sortKey==='name' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('email')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Email</Text>{sortKey==='email' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('department')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Department</Text>{sortKey==='department' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('designation')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Designation</Text>{sortKey==='designation' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('employment')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Employment</Text>{sortKey==='employment' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('lru')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Load Release Units</Text>{sortKey==='lru' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              <Th onClick={()=>toggleSort('rank')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Rank</Text>{sortKey==='rank' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/> )}</HStack></Th>
              {isAdmin && <Th>Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(row => {
              const name = row.name || row.faculty || row.instructorName || row.instructor || row.full_name || '—';
              const dept = row.department || row.dept || row.department_name || row.departmentName || '—';
              const lru = row.load_release_units ?? row.loadReleaseUnits ?? '0';
              return (
              <Tr key={row.id}>
                <Td>{name}</Td>
                <Td><Text noOfLines={1} maxW="240px">{row.email || '—'}</Text></Td>
                <Td>{dept}</Td>
                <Td>{row.designation || '—'}</Td>
                <Td>{row.employment || '—'}</Td>
                <Td>{lru}</Td>
                <Td>{row.rank || '—'}</Td>
                {isAdmin && (
                  <Td textAlign="right">
                    <HStack justify="end" spacing={1}>
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
            <Heading size="sm">No faculty found</Heading>
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

      <FacultyFormModal
        isOpen={formDisc.isOpen}
        onClose={formDisc.onClose}
        initial={editing}
        onSubmit={async (payload) => {
          if (editing) {
            await dispatch(updateFacultyThunk({ id: editing.id, changes: payload }));
          } else {
            await dispatch(createFacultyThunk(payload));
          }
          formDisc.onClose();
          setEditing(null);
          // Optional: refresh listing from server after changes
          dispatch(loadFacultiesThunk({}));
        }}
      />

      <AlertDialog isOpen={delDisc.isOpen} onClose={()=>{ delDisc.onClose(); setToDelete(null); }} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete faculty?</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <b>{toDelete?.name}</b>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={()=>{ delDisc.onClose(); setToDelete(null); }}>Cancel</Button>
              <Button colorScheme="red" ml={3} onClick={async ()=>{ await dispatch(deleteFacultyThunk(toDelete.id)); delDisc.onClose(); setToDelete(null); }}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
