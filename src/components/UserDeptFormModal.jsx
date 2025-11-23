import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Select, Input, Switch, Checkbox, CheckboxGroup, Stack, Text } from '@chakra-ui/react';
import api from '../services/apiService';

export default function UserDeptFormModal({ isOpen, onClose, onSubmit, initial, options }) {
  const [users, setUsers] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [form, setForm] = React.useState({ userId: '', department: '', departments: [], position: '', isPrimary: false, remarks: '' });

  React.useEffect(() => {
    if (initial) {
      setForm({
        userId: initial.userId || '',
        department: initial.department || '',
        departments: [],
        position: initial.position || '',
        isPrimary: !!initial.isPrimary,
        remarks: initial.remarks || '',
      });
    } else {
      setForm({ userId: '', department: '', departments: [], position: '', isPrimary: false, remarks: '' });
    }
  }, [initial]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingUsers(true);
        const res = await api.listUsers({ limit: 1000 });
        const rows = Array.isArray(res?.rows) ? res.rows : (Array.isArray(res?.data) ? res.data : []);
        if (alive) setUsers(rows);
      } catch { if (alive) setUsers([]); } finally { if (alive) setLoadingUsers(false); }
    })();
    return () => { alive = false; };
  }, []);

  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const setDepartments = (vals) => setForm(v => ({ ...v, departments: vals }));
  const canSave = !!form.userId && (initial ? !!form.department : (Array.isArray(form.departments) && form.departments.length > 0));

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial ? 'Edit Assignment' : 'Assign User to Departments'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired isDisabled={!!initial}>
              <FormLabel>User</FormLabel>
              <Select value={form.userId} onChange={set('userId')} placeholder={loadingUsers ? 'Loading users...' : 'Select user'}>
                {users.map(u => <option key={u.id} value={u.id}>{u.username} — {u.first_name || ''} {u.last_name || ''}</option>)}
              </Select>
            </FormControl>
            {initial ? (
              <HStack spacing={3} align="start">
                <FormControl isRequired>
                  <FormLabel>Department</FormLabel>
                  <Select value={form.department} onChange={set('department')} placeholder="Select department">
                    {(options?.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Position</FormLabel>
                  <Select value={form.position} onChange={set('position')} placeholder="Select position">
                    {(options?.positions || []).map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </FormControl>
              </HStack>
            ) : (
              <VStack align="stretch" spacing={2}>
                <FormControl isRequired>
                  <FormLabel>Departments</FormLabel>
                  <CheckboxGroup value={form.departments} onChange={setDepartments}>
                    <Stack spacing={2} direction="column" maxH="180px" overflowY="auto" borderWidth="1px" rounded="md" p={3}>
                      {(options?.departments || []).map(d => (
                        <Checkbox key={d} value={d}>{d}</Checkbox>
                      ))}
                    </Stack>
                  </CheckboxGroup>
                </FormControl>
                <Text fontSize="sm" color="gray.500">Select multiple departments to create multiple assignments.</Text>
                <HStack spacing={3} align="start">
                  <FormControl>
                    <FormLabel>Position</FormLabel>
                    <Select value={form.position} onChange={set('position')} placeholder="Select position">
                      {(options?.positions || []).map(p => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl display="flex" alignItems="center">
                    <FormLabel mb="0">Mark first as Primary</FormLabel>
                    <Switch isChecked={form.isPrimary} onChange={set('isPrimary')} />
                  </FormControl>
                </HStack>
              </VStack>
            )}
            {initial && (
              <HStack spacing={3}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">Primary</FormLabel>
                  <Switch isChecked={form.isPrimary} onChange={set('isPrimary')} />
                </FormControl>
              </HStack>
            )}
            <FormControl>
              <FormLabel>Remarks</FormLabel>
              <Input value={form.remarks} onChange={set('remarks')} placeholder="Optional" />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={() => onSubmit && onSubmit(form)} isDisabled={!canSave}>{initial ? 'Save' : 'Assign'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
