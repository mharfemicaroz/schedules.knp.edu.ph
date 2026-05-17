import React from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Table,
  Tag,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronUp, FiEdit, FiFilter, FiPlus, FiRefreshCw, FiTrash, FiUserCheck, FiUserX } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import FacultyFormModal from '../components/FacultyFormModal';
import Pagination from '../components/Pagination';
import api from '../services/apiService';
import { selectFacultyFilterOptions, selectFacultyFilters, selectFilteredFaculty, setFacultyFilters, clearFacultyFilters } from '../store/facultySlice';
import { createFacultyThunk, deleteFacultyThunk, loadFacultiesThunk, updateFacultyThunk } from '../store/facultyThunks';

const normalizeDepartmentBase = (value) => String(value || '').trim().toUpperCase().split('-')[0].trim();

const facultyIsActive = (row) => {
  const raw = row?.isActive ?? row?.is_active;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return true;
  return ['true', '1', 'yes', 'active'].includes(s);
};

export default function AdminFacultyPage() {
  const dispatch = useDispatch();
  const toast = useToast();
  const border = useColorModeValue('gray.200', 'gray.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const subtlePanel = useColorModeValue('gray.50', 'whiteAlpha.50');
  const muted = useColorModeValue('gray.600', 'gray.300');
  const accent = useColorModeValue('blue.600', 'blue.200');
  const loading = useSelector((s) => s.faculty.loading);
  const filters = useSelector(selectFacultyFilters);
  const items = useSelector(selectFilteredFaculty);
  const opts = useSelector(selectFacultyFilterOptions);
  const authUser = useSelector((s) => s.auth.user);
  const isAdmin = !!authUser && ['admin', 'manager', 'superadmin', 'sa'].includes(String(authUser.role || '').toLowerCase());

  const formDisc = useDisclosure();
  const delDisc = useDisclosure();
  const [editing, setEditing] = React.useState(null);
  const [toDelete, setToDelete] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortKey, setSortKey] = React.useState('name');
  const [sortDir, setSortDir] = React.useState('asc');
  const [departmentOptions, setDepartmentOptions] = React.useState([]);
  const [statusBusyId, setStatusBusyId] = React.useState(null);

  React.useEffect(() => {
    dispatch(loadFacultiesThunk({}));
  }, [dispatch]);

  React.useEffect(() => {
    setPage(1);
  }, [filters, items.length]);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await api.getProspectus({});
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
        const bases = new Set();
        list.forEach((row) => {
          const base = normalizeDepartmentBase(row?.programcode || row?.program || '');
          if (base) bases.add(base);
        });
        (opts.departments || []).forEach((row) => {
          const base = normalizeDepartmentBase(row);
          if (base) bases.add(base);
        });
        if (!ignore) setDepartmentOptions(Array.from(bases).sort((a, b) => a.localeCompare(b)));
      } catch {
        const fallback = Array.from(new Set((opts.departments || []).map((row) => normalizeDepartmentBase(row)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        if (!ignore) setDepartmentOptions(fallback);
      }
    })();
    return () => { ignore = true; };
  }, [opts.departments]);

  const onAdd = () => {
    setEditing(null);
    formDisc.onOpen();
  };

  const onEdit = (row) => {
    setEditing(row);
    formDisc.onOpen();
  };

  const onDelete = (row) => {
    setToDelete(row);
    delDisc.onOpen();
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const enrichedItems = React.useMemo(() => (
    (items || []).map((row) => ({
      ...row,
      _name: row.name || row.faculty || row.instructorName || row.instructor || row.full_name || 'N/A',
      _department: normalizeDepartmentBase(row.department || row.dept || row.department_name || row.departmentName || ''),
      _rawDepartment: row.department || row.dept || row.department_name || row.departmentName || 'N/A',
      _email: row.email || 'N/A',
      _lru: row.load_release_units ?? row.loadReleaseUnits ?? '0',
      _isActive: facultyIsActive(row),
    }))
  ), [items]);

  const access = React.useCallback((row, key) => {
    switch (key) {
      case 'name': return String(row._name || '');
      case 'email': return String(row._email || '');
      case 'department': return String(row._department || row._rawDepartment || '');
      case 'designation': return String(row.designation || '');
      case 'employment': return String(row.employment || '');
      case 'lru': return String(row._lru || '');
      case 'rank': return String(row.rank || '');
      case 'status': return row._isActive ? 'active' : 'inactive';
      default: return '';
    }
  }, []);

  const sortedItems = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = enrichedItems.slice();
    return arr.sort((a, b) => {
      const va = access(a, sortKey).toLowerCase();
      const vb = access(b, sortKey).toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      const na = access(a, 'name').toLowerCase();
      const nb = access(b, 'name').toLowerCase();
      if (na !== nb) return na < nb ? -1 : 1;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [access, enrichedItems, sortDir, sortKey]);

  const stats = React.useMemo(() => {
    const activeCount = sortedItems.filter((row) => row._isActive).length;
    const inactiveCount = sortedItems.length - activeCount;
    const departments = new Set(sortedItems.map((row) => row._department || row._rawDepartment).filter(Boolean)).size;
    return {
      total: sortedItems.length,
      active: activeCount,
      inactive: inactiveCount,
      departments,
    };
  }, [sortedItems]);

  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedItems]);

  const refreshList = React.useCallback(() => {
    dispatch(loadFacultiesThunk(filters || {}));
  }, [dispatch, filters]);

  const handleToggleActive = async (row) => {
    const nextActive = !row._isActive;
    setStatusBusyId(row.id);
    try {
      await dispatch(updateFacultyThunk({
        id: row.id,
        changes: { isActive: nextActive, is_active: nextActive },
      })).unwrap();
      toast({
        status: 'success',
        title: nextActive ? 'Faculty activated' : 'Faculty deactivated',
        description: `${row._name} is now ${nextActive ? 'active' : 'inactive'}.`,
      });
      refreshList();
    } catch (error) {
      toast({
        status: 'error',
        title: 'Failed to update faculty status',
        description: error?.message || String(error || 'Unknown error'),
      });
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align={{ base: 'start', md: 'center' }} flexDir={{ base: 'column', md: 'row' }} spacing={{ base: 3, md: 4 }}>
        <Box>
          <Heading size="md">Faculty Management</Heading>
          <Text mt={1} color={muted}>Maintain faculty profiles, status, and department alignment from one cleaner workspace.</Text>
        </Box>
        <HStack spacing={3}>
          <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={refreshList} isLoading={loading}>Refresh</Button>
          {isAdmin ? <Button colorScheme="blue" leftIcon={<FiPlus />} onClick={onAdd}>Add Faculty</Button> : null}
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
        <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Faculty</Text>
          <Text fontSize="2xl" fontWeight="800">{stats.total}</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Active</Text>
          <Text fontSize="2xl" fontWeight="800" color="green.500">{stats.active}</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Inactive</Text>
          <Text fontSize="2xl" fontWeight="800" color="orange.500">{stats.inactive}</Text>
        </Box>
        <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
          <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color={muted}>Departments</Text>
          <Text fontSize="2xl" fontWeight="800" color={accent}>{stats.departments}</Text>
        </Box>
      </SimpleGrid>

      <Box borderWidth="1px" borderColor={border} rounded="2xl" p={5} bg={panelBg}>
        <VStack align="stretch" spacing={4}>
          <Box>
            <Text fontSize="sm" fontWeight="700">Filters</Text>
            <Text fontSize="sm" color={muted}>Search faculty records, narrow the list by work profile, and isolate active or inactive entries.</Text>
          </Box>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
            <Input placeholder="Search name, email, department" value={filters.q || ''} onChange={(e) => dispatch(setFacultyFilters({ q: e.target.value }))} />
            <Select value={filters.department || ''} onChange={(e) => dispatch(setFacultyFilters({ department: e.target.value }))}>
              <option value="">All departments</option>
              {departmentOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Select value={filters.designation || ''} onChange={(e) => dispatch(setFacultyFilters({ designation: e.target.value }))}>
              <option value="">All designations</option>
              {opts.designations.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Select value={filters.employment || ''} onChange={(e) => dispatch(setFacultyFilters({ employment: e.target.value }))}>
              <option value="">All employment</option>
              {opts.employments.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Select value={filters.active || ''} onChange={(e) => dispatch(setFacultyFilters({ active: e.target.value }))}>
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            <Select value={filters.rank || ''} onChange={(e) => dispatch(setFacultyFilters({ rank: e.target.value }))}>
              <option value="">All ranks</option>
              {opts.ranks.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
            <Input placeholder="Email contains" value={filters.email || ''} onChange={(e) => dispatch(setFacultyFilters({ email: e.target.value }))} />
            <Input placeholder="Load release units" value={filters.load_release_units || ''} onChange={(e) => dispatch(setFacultyFilters({ load_release_units: e.target.value }))} />
          </SimpleGrid>
          <HStack spacing={3} justify="space-between" flexWrap="wrap">
            <Wrap spacing={2}>
              <WrapItem><Tag colorScheme="blue" variant="subtle"><TagLabel>{sortedItems.length} matched</TagLabel></Tag></WrapItem>
              <WrapItem><Tag colorScheme="green" variant="subtle"><TagLabel>{stats.active} active</TagLabel></Tag></WrapItem>
              <WrapItem><Tag colorScheme="orange" variant="subtle"><TagLabel>{stats.inactive} inactive</TagLabel></Tag></WrapItem>
            </Wrap>
            <HStack spacing={3}>
              <Button leftIcon={<FiFilter />} onClick={refreshList} variant="outline" isLoading={loading}>Apply</Button>
              <Button variant="ghost" onClick={() => dispatch(clearFacultyFilters())}>Clear</Button>
            </HStack>
          </HStack>
        </VStack>
      </Box>

      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {paged.map((row) => (
            <Box key={row.id} borderWidth="1px" borderColor={border} rounded="2xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <HStack justify="space-between" align="start">
                  <Box>
                    <Text fontWeight="800" fontSize="md" noOfLines={2}>{row._name}</Text>
                    <Text fontSize="sm" color={muted} noOfLines={1}>{row._email}</Text>
                  </Box>
                  <Badge colorScheme={row._isActive ? 'green' : 'orange'} variant="subtle">
                    {row._isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </HStack>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Department</Text>
                    <Text>{row._rawDepartment}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Employment</Text>
                    <Text>{row.employment || 'N/A'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Designation</Text>
                    <Text>{row.designation || 'N/A'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Rank</Text>
                    <Text>{row.rank || 'N/A'}</Text>
                  </Box>
                </SimpleGrid>
                <Box borderWidth="1px" borderColor={border} rounded="lg" bg={subtlePanel} px={3} py={2}>
                  <Text fontSize="xs" color={muted}>Load Release Units</Text>
                  <Text fontWeight="700">{row._lru}</Text>
                </Box>
                {isAdmin ? (
                  <HStack justify="space-between">
                    <Button
                      size="sm"
                      leftIcon={row._isActive ? <FiUserX /> : <FiUserCheck />}
                      variant="outline"
                      colorScheme={row._isActive ? 'orange' : 'green'}
                      onClick={() => handleToggleActive(row)}
                      isLoading={statusBusyId === row.id}
                    >
                      {row._isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <HStack spacing={2}>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="outline" colorScheme="yellow" onClick={() => onEdit(row)} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="outline" colorScheme="red" onClick={() => onDelete(row)} />
                    </HStack>
                  </HStack>
                ) : null}
              </VStack>
            </Box>
          ))}
        </VStack>
        {sortedItems.length === 0 ? (
          <VStack py={12} borderWidth="1px" borderColor={border} rounded="2xl" bg={panelBg}>
            <Heading size="sm">No faculty found</Heading>
            <Text color={muted}>Adjust filters or add a new record.</Text>
          </VStack>
        ) : null}
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="2xl" bg={panelBg} overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <HStack justify="space-between" px={5} pt={4} pb={2}>
          <Wrap spacing={2}>
            <WrapItem><Tag colorScheme="blue" variant="subtle"><TagLabel>{sortedItems.length} results</TagLabel></Tag></WrapItem>
            <WrapItem><Tag colorScheme="gray" variant="subtle"><TagLabel>{pageSize}/page</TagLabel></Tag></WrapItem>
          </Wrap>
          <Select size="sm" value={pageSize} onChange={(e) => { const n = Number(e.target.value) || 10; setPageSize(n); setPage(1); }} maxW="110px">
            {[10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </Select>
        </HStack>
        <Table size="md" variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={() => toggleSort('name')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Name</Text>{sortKey === 'name' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th onClick={() => toggleSort('department')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Department</Text>{sortKey === 'department' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th onClick={() => toggleSort('employment')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Employment</Text>{sortKey === 'employment' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th onClick={() => toggleSort('designation')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Designation</Text>{sortKey === 'designation' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th onClick={() => toggleSort('lru')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Load Release</Text>{sortKey === 'lru' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th onClick={() => toggleSort('status')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Status</Text>{sortKey === 'status' && (sortDir === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}</HStack></Th>
              <Th>Email</Th>
              <Th>Rank</Th>
              {isAdmin ? <Th textAlign="right">Actions</Th> : null}
            </Tr>
          </Thead>
          <Tbody>
            {paged.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="700">{row._name}</Text>
                    <Text fontSize="sm" color={muted}>{row._email}</Text>
                  </VStack>
                </Td>
                <Td><Badge colorScheme="blue" variant="subtle">{row._department || row._rawDepartment || 'N/A'}</Badge></Td>
                <Td>{row.employment || 'N/A'}</Td>
                <Td>{row.designation || 'N/A'}</Td>
                <Td>{row._lru}</Td>
                <Td>
                  <Badge colorScheme={row._isActive ? 'green' : 'orange'} variant="subtle">
                    {row._isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td><Text noOfLines={1} maxW="220px">{row._email}</Text></Td>
                <Td>{row.rank || 'N/A'}</Td>
                {isAdmin ? (
                  <Td textAlign="right">
                    <HStack justify="end" spacing={1}>
                      <Button
                        size="sm"
                        leftIcon={row._isActive ? <FiUserX /> : <FiUserCheck />}
                        variant="ghost"
                        colorScheme={row._isActive ? 'orange' : 'green'}
                        onClick={() => handleToggleActive(row)}
                        isLoading={statusBusyId === row.id}
                      >
                        {row._isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" colorScheme="yellow" onClick={() => onEdit(row)} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={() => onDelete(row)} />
                    </HStack>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </Tbody>
        </Table>
        {sortedItems.length === 0 ? (
          <VStack py={12}>
            <Heading size="sm">No faculty found</Heading>
            <Text color={muted}>Adjust filters or add a new record.</Text>
          </VStack>
        ) : null}
      </Box>

      {sortedItems.length > 0 ? (
        <VStack>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPage={setPage}
            pageSize={pageSize}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        </VStack>
      ) : null}

      <FacultyFormModal
        isOpen={formDisc.isOpen}
        onClose={formDisc.onClose}
        initial={editing}
        departmentOptions={departmentOptions}
        onSubmit={async (payload) => {
          if (editing) await dispatch(updateFacultyThunk({ id: editing.id, changes: payload }));
          else await dispatch(createFacultyThunk(payload));
          formDisc.onClose();
          setEditing(null);
          refreshList();
        }}
      />

      <AlertDialog isOpen={delDisc.isOpen} onClose={() => { delDisc.onClose(); setToDelete(null); }} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="xl">
            <AlertDialogHeader>Delete faculty?</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete <b>{toDelete?._name || toDelete?.name || toDelete?.faculty}</b>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={() => { delDisc.onClose(); setToDelete(null); }}>Cancel</Button>
              <Button colorScheme="red" ml={3} onClick={async () => {
                await dispatch(deleteFacultyThunk(toDelete.id));
                delDisc.onClose();
                setToDelete(null);
                refreshList();
              }}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
