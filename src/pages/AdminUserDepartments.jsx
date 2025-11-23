import React from 'react';
import { Box, HStack, VStack, Heading, Text, Button, IconButton, Input, Select, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Tag, TagLabel, useDisclosure } from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash, FiRefreshCw, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { loadUserDeptOptionsThunk, listUserDepartmentsThunk, createUserDepartmentThunk, updateUserDepartmentThunk, deleteUserDepartmentThunk } from '../store/userDeptThunks';
import { selectUserDeptItems, selectUserDeptOptions, selectUserDeptFilters, setUserDeptFilters, clearUserDeptFilters } from '../store/userDeptSlice';
import UserDeptFormModal from '../components/UserDeptFormModal';
import api from '../services/apiService';

export default function AdminUserDepartments() {
  const dispatch = useDispatch();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const items = useSelector(selectUserDeptItems);
  const options = useSelector(selectUserDeptOptions);
  const filters = useSelector(selectUserDeptFilters);
  const [users, setUsers] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [sortKey, setSortKey] = React.useState('userId');
  const [sortDir, setSortDir] = React.useState('asc');
  const formDisc = useDisclosure();
  const [editing, setEditing] = React.useState(null);

  React.useEffect(() => { dispatch(loadUserDeptOptionsThunk()); dispatch(listUserDepartmentsThunk({})); }, [dispatch]);
  React.useEffect(() => {
    let alive = true; (async () => {
      try { setLoadingUsers(true); const res = await api.listUsers({ limit: 1000 }); const rows = Array.isArray(res?.rows) ? res.rows : (Array.isArray(res?.data) ? res.data : []); if (alive) setUsers(rows); }
      catch { if (alive) setUsers([]); } finally { if (alive) setLoadingUsers(false); }
    })(); return () => { alive = false; };
  }, []);

  const userLabel = (id) => {
    const u = users.find(x => String(x.id) === String(id));
    return u ? `${u.username} — ${u.first_name || ''} ${u.last_name || ''}` : id;
  };

  const filtered = React.useMemo(() => {
    let arr = items || [];
    if (filters.userId) arr = arr.filter(r => String(r.userId) === String(filters.userId));
    if (filters.department) arr = arr.filter(r => String(r.department) === String(filters.department));
    return arr;
  }, [items, filters]);

  const sorted = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r, k) => {
      if (k === 'user') return (userLabel(r.userId) || '').toLowerCase();
      return String(r[k] ?? '').toLowerCase();
    };
    return filtered.slice().sort((a,b)=>{ const va=val(a,sortKey), vb=val(b,sortKey); if (va<vb) return -1*dir; if (va>vb) return 1*dir; return 0; });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => { if (sortKey === key) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(key); setSortDir('asc'); } };

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between">
        <Heading size="md">User-Department Management</Heading>
        <Button colorScheme="blue" leftIcon={<FiPlus />} onClick={()=>{ setEditing(null); formDisc.onOpen(); }}>Assign User</Button>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={3} flexWrap="wrap">
          <Select placeholder={loadingUsers ? 'Loading users...' : 'Filter: User'} value={filters.userId || ''} onChange={(e)=>dispatch(setUserDeptFilters({ userId: e.target.value }))} maxW="280px">
            {users.map(u => <option key={u.id} value={u.id}>{u.username} — {u.first_name || ''} {u.last_name || ''}</option>)}
          </Select>
          <Select placeholder="Filter: Department" value={filters.department || ''} onChange={(e)=>dispatch(setUserDeptFilters({ department: e.target.value }))} maxW="200px">
            {(options.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Button leftIcon={<FiRefreshCw />} variant="outline" onClick={()=>dispatch(listUserDepartmentsThunk(filters))}>Refresh</Button>
          <Button variant="ghost" onClick={()=>dispatch(clearUserDeptFilters())}>Clear</Button>
        </HStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
        <HStack justify="space-between" px={4} pt={3} pb={1}>
          <Tag colorScheme="blue" variant="subtle"><TagLabel>{sorted.length} assignments</TagLabel></Tag>
        </HStack>
        <Table size={{ base: 'sm', md: 'md' }} variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th onClick={()=>toggleSort('user')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>User</Text>{sortKey==='user' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack></Th>
              <Th onClick={()=>toggleSort('department')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Department</Text>{sortKey==='department' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack></Th>
              <Th onClick={()=>toggleSort('position')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Position</Text>{sortKey==='position' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack></Th>
              <Th>Primary</Th>
              <Th>Active</Th>
              <Th onClick={()=>toggleSort('assignedAt')} cursor="pointer" userSelect="none"><HStack spacing={1}><Text>Assigned</Text>{sortKey==='assignedAt' && (sortDir==='asc'?<FiChevronUp/>:<FiChevronDown/>)}</HStack></Th>
              <Th>Remarks</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sorted.map(row => (
              <Tr key={`${row.id}-${row.userId}-${row.department}`}>
                <Td>{userLabel(row.userId)}</Td>
                <Td>{row.department}</Td>
                <Td>{row.position || '-'}</Td>
                <Td>{row.isPrimary ? 'Yes' : 'No'}</Td>
                <Td>{row.isActive ? 'Yes' : 'No'}</Td>
                <Td>{row.assignedAt ? String(row.assignedAt).substring(0,10) : '-'}</Td>
                <Td>{row.remarks || '-'}</Td>
                <Td>
                  <HStack justify="end" spacing={1}>
                    <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" colorScheme="yellow" onClick={()=>{ setEditing(row); formDisc.onOpen(); }} />
                    {row.id && (
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={async ()=>{ await dispatch(deleteUserDepartmentThunk(row.id)); dispatch(listUserDepartmentsThunk(filters)); }} />
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {sorted.length === 0 && (
          <VStack py={10}><Text color={muted}>No assignments found.</Text></VStack>
        )}
      </Box>

      <UserDeptFormModal
        isOpen={formDisc.isOpen}
        onClose={()=>{ formDisc.onClose(); setEditing(null); }}
        initial={editing}
        options={options}
        onSubmit={async (payload) => {
          if (editing && editing.id) {
            // Do not touch active/assignedAt on edit; only update changed fields
            const { isActive, assignedAt, departments, ...changes } = payload || {};
            await dispatch(updateUserDepartmentThunk({ id: editing.id, changes }));
          } else {
            const depts = Array.isArray(payload.departments) && payload.departments.length > 0 ? payload.departments : (payload.department ? [payload.department] : []);
            if (depts.length > 0) {
              const firstPrimary = !!payload.isPrimary;
              await Promise.all(
                depts.map((d, idx) =>
                  dispatch(createUserDepartmentThunk({
                    userId: payload.userId,
                    department: d,
                    position: payload.position || undefined,
                    isPrimary: idx === 0 ? firstPrimary : false,
                    isActive: true,
                    assignedAt: new Date().toISOString(),
                    remarks: payload.remarks || undefined,
                  })).unwrap().catch(() => null)
                )
              );
            }
          }
          setEditing(null);
          formDisc.onClose();
          dispatch(listUserDepartmentsThunk(filters));
        }}
      />
    </VStack>
  );
}

