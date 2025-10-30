import React, { useEffect, useMemo, useState } from 'react';
import { Box, Heading, HStack, VStack, Input, Select, Table, Thead, Tr, Th, Tbody, Td, Tag, TagLabel, useColorModeValue, Button, Text, Spinner, Grid, GridItem, IconButton, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, FormControl, FormLabel, Switch, useToast, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, SimpleGrid } from '@chakra-ui/react';
import { useSelector } from 'react-redux';
import apiService from '../services/apiService';
import { FiUsers, FiUserPlus, FiEdit, FiTrash } from 'react-icons/fi';

export default function AdminUsers() {
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selected, setSelected] = useState(null);
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const cancelRef = React.useRef();
  const toast = useToast();

  useEffect(() => { (async () => {
      try {
        setLoading(true); setError(null);
        const list = await apiService.listUsers();
        const arr = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
        setRows(arr);
      } catch (e) { setError(e.message || 'Failed to load users'); } finally { setLoading(false); }
  })(); }, []);

  const filtered = useMemo(() => {
    const norm = (s) => String(s||'').toLowerCase();
    const ql = norm(q);
    return (rows || []).filter(u => {
      if (role && norm(u.role) !== norm(role)) return false;
      if (!ql) return true;
      const hay = [u.username, u.email, u.first_name, u.last_name, u.role].map(norm).join(' ');
      return hay.includes(ql);
    }).sort((a,b)=>String(a.username).localeCompare(String(b.username)));
  }, [rows, q, role]);

  const paged = filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (loading) return (<VStack align="center" py={12}><Spinner/><Text>Loading users…</Text></VStack>);
  if (error) return (<VStack align="center" py={12}><Text color="red.500">{error}</Text></VStack>);

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" flexWrap="wrap" gap={3}>
        <HStack>
          <Heading size="md">Admin: User Management</Heading>
          <Tag colorScheme="blue"><TagLabel>{filtered.length} users</TagLabel></Tag>
        </HStack>
        <HStack>
          <Input placeholder="Search by name, email, username" value={q} onChange={(e)=>{ setQ(e.target.value); setPage(1); }} maxW="320px" />
          <Select placeholder="Role" value={role} onChange={(e)=>{ setRole(e.target.value); setPage(1); }} maxW="180px">
            {['admin','manager','registrar','checker','user'].map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Select size="sm" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)||15); setPage(1); }} maxW="110px">
            {[10,15,20,30,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </Select>
          <Button leftIcon={<FiUserPlus />} colorScheme="blue" onClick={() => { setSelected({}); editDisc.onOpen(); }}>Add User</Button>
        </HStack>
      </HStack>

      {/* Mobile cards view */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {paged.map(u => (
            <Box key={u.id} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <Text fontWeight="800" fontSize="md" noOfLines={2}>{u.username}</Text>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Email</Text>
                    <Text>{u.email}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Role</Text>
                    <Tag size="sm" colorScheme="purple"><TagLabel>{u.role}</TagLabel></Tag>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Active</Text>
                    <Text>{u.is_active ? 'Yes' : 'No'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Joined</Text>
                    <Text>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Last Login</Text>
                    <Text>{u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</Text>
                  </Box>
                </SimpleGrid>
                <HStack justify="flex-end" spacing={2}>
                  <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="outline" onClick={() => { setSelected(u); editDisc.onOpen(); }} />
                  <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="outline" onClick={() => { setSelected(u); delDisc.onOpen(); }} />
                </HStack>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <Box borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto" display={{ base: 'none', md: 'block' }}>
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              <Th>User</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Active</Th>
              <Th>Joined</Th>
              <Th>Last Login</Th>
              <Th textAlign="right">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {paged.map(u => (
              <Tr key={u.id}>
                <Td><Text fontWeight="700">{u.username}</Text></Td>
                <Td>{u.email}</Td>
                <Td><Tag size="sm" colorScheme="purple"><TagLabel>{u.role}</TagLabel></Tag></Td>
                <Td>{u.is_active ? 'Yes' : 'No'}</Td>
                <Td>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '-'}</Td>
                <Td>{u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</Td>
                <Td textAlign="right">
                  <HStack justify="end" spacing={1}>
                    <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" onClick={() => { setSelected(u); editDisc.onOpen(); }} />
                    <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => { setSelected(u); delDisc.onOpen(); }} />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.500">Page {page} / {pageCount}</Text>
        <HStack>
          <Button size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} isDisabled={page<=1}>Prev</Button>
          <Button size="sm" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} isDisabled={page>=pageCount}>Next</Button>
        </HStack>
      </HStack>

      {/* Upsert Modal */}
      <UserUpsertModal
        isOpen={editDisc.isOpen}
        onClose={() => { editDisc.onClose(); setSelected(null); }}
        user={selected}
        onSaved={async () => {
          try {
            setLoading(true);
            const list = await apiService.listUsers();
            const arr = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
            setRows(arr);
            toast({ status: 'success', title: 'User saved' });
          } catch (e) { toast({ status: 'error', title: 'Save failed', description: e.message }); }
          finally { setLoading(false); }
        }}
      />

      {/* Delete Confirm */}
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete user?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone. Delete <b>{selected?.username}</b>?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={async () => {
                try { await apiService.deleteUser(selected.id); toast({ status: 'success', title: 'User deleted' });
                  setRows(rows.filter(r => r.id !== selected.id));
                } catch (e) { toast({ status: 'error', title: 'Delete failed', description: e.message }); }
                finally { delDisc.onClose(); setSelected(null); }
              }} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}

function UserUpsertModal({ isOpen, onClose, user, onSaved }) {
  const isEdit = !!(user && user.id);
  const [form, setForm] = useState({ username: '', email: '', role: '', is_active: true, first_name: '', last_name: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setForm({
          username: user.username || '',
          email: user.email || '',
          role: user.role || '',
          is_active: !!user.is_active,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          password: '',
        });
      } else {
        setForm({ username: '', email: '', role: '', is_active: true, first_name: '', last_name: '', password: '' });
      }
    }
  }, [isOpen, isEdit, user]);

  const canSave = form.username.trim().length >= 3 && /@/.test(form.email) && !!form.role && (!isEdit ? form.password.trim().length >= 6 : true) && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (isEdit) {
        const payload = { username: form.username, email: form.email, role: form.role, is_active: form.is_active, first_name: form.first_name, last_name: form.last_name };
        if (form.password.trim()) payload.password = form.password;
        await apiService.updateUser(user.id, payload);
      } else {
        await apiService.createUser({ username: form.username, email: form.email, role: form.role, password: form.password, is_active: form.is_active, first_name: form.first_name, last_name: form.last_name });
      }
      await onSaved?.();
      onClose();
    } catch (e) {
      // handled by parent toast
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay backdropFilter="blur(8px)" />
      <ModalContent>
        <ModalHeader>{isEdit ? 'Edit User' : 'Add User'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired>
              <FormLabel>Username</FormLabel>
              <Input value={form.username} onChange={(e)=>setForm(f=>({ ...f, username: e.target.value }))} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={form.email} onChange={(e)=>setForm(f=>({ ...f, email: e.target.value }))} />
            </FormControl>
            <HStack>
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select placeholder="Select role" value={form.role} onChange={(e)=>setForm(f=>({ ...f, role: e.target.value }))}>
                  {['admin','manager','registrar','checker','user'].map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Active</FormLabel>
                <Switch isChecked={form.is_active} onChange={(e)=>setForm(f=>({ ...f, is_active: e.target.checked }))} />
              </FormControl>
            </HStack>
            <HStack>
              <FormControl>
                <FormLabel>First Name</FormLabel>
                <Input value={form.first_name} onChange={(e)=>setForm(f=>({ ...f, first_name: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Last Name</FormLabel>
                <Input value={form.last_name} onChange={(e)=>setForm(f=>({ ...f, last_name: e.target.value }))} />
              </FormControl>
            </HStack>
            <FormControl isRequired={!isEdit}>
              <FormLabel>{isEdit ? 'Password (leave blank to keep)' : 'Password'}</FormLabel>
              <Input type="password" value={form.password} onChange={(e)=>setForm(f=>({ ...f, password: e.target.value }))} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave} isDisabled={!canSave} isLoading={busy}>{isEdit ? 'Save' : 'Create'}</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
