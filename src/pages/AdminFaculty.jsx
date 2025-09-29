import React from 'react';
import { Box, HStack, VStack, Heading, Text, Button, IconButton, Input, Select, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Tag, TagLabel, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash, FiFilter } from 'react-icons/fi';
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

  React.useEffect(() => { dispatch(loadFacultiesThunk({})); }, [dispatch]);
  React.useEffect(() => { setPage(1); }, [filters, items.length]);

  const onAdd = () => { setEditing(null); formDisc.onOpen(); };
  const onEdit = (row) => { setEditing(row); formDisc.onOpen(); };
  const onDelete = (row) => { setToDelete(row); delDisc.onOpen(); };

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
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              {['Name','Email','Department','Designation','Employment','Load Release Units','Rank', isAdmin ? 'Actions' : ''].filter(Boolean).map((h,i)=> <Th key={i}>{h}</Th>)}
            </Tr>
          </Thead>
          <Tbody>
            {(() => {
              const start = (page - 1) * pageSize;
              const paged = items.slice(start, start + pageSize);
              return paged;
            })().map(row => {
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
        {items.length === 0 && (
          <VStack py={10}>
            <Heading size="sm">No faculty found</Heading>
            <Text color="gray.500">Adjust filters or add a new record.</Text>
          </VStack>
        )}
      </Box>

      {items.length > 0 && (
        <VStack>
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(items.length / pageSize))}
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
