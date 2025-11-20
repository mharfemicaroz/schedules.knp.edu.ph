import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Select, Input, Switch } from '@chakra-ui/react';
import api from '../services/apiService';

export default function UserDeptFormModal({ isOpen, onClose, onSubmit, initial, options }) {
  const [users, setUsers] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [form, setForm] = React.useState({ userId: '', department: '', position: '', isPrimary: false, isActive: true, assignedAt: '', remarks: '' });

  React.useEffect(() => {
    if (initial) {
      setForm({
        userId: initial.userId || '',
        department: initial.department || '',
        position: initial.position || '',
        isPrimary: !!initial.isPrimary,
        isActive: initial.isActive !== false,
        assignedAt: initial.assignedAt ? String(initial.assignedAt).substring(0,10) : '',
        remarks: initial.remarks || '',
      });
    } else {
      setForm({ userId: '', department: '', position: '', isPrimary: false, isActive: true, assignedAt: '', remarks: '' });
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
  const canSave = !!form.userId && !!form.department;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial ? 'Edit Assignment' : 'Assign User to Department'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired isDisabled={!!initial}>
              <FormLabel>User</FormLabel>
              <Select value={form.userId} onChange={set('userId')} placeholder={loadingUsers ? 'Loading users...' : 'Select user'}>
                {users.map(u => <option key={u.id} value={u.id}>{u.username} — {u.first_name || ''} {u.last_name || ''}</option>)}
              </Select>
            </FormControl>
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
            <HStack spacing={3}>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">Primary</FormLabel>
                <Switch isChecked={form.isPrimary} onChange={set('isPrimary')} />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">Active</FormLabel>
                <Switch isChecked={form.isActive} onChange={set('isActive')} />
              </FormControl>
              <FormControl>
                <FormLabel>Assigned At</FormLabel>
                <Input type="date" value={form.assignedAt} onChange={set('assignedAt')} />
              </FormControl>
            </HStack>
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

