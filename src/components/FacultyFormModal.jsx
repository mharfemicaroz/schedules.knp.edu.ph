import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Input, Select, NumberInput, NumberInputField, useColorModeValue } from '@chakra-ui/react';

export default function FacultyFormModal({ isOpen, onClose, onSubmit, initial }) {
  const mapInitial = React.useCallback((src) => {
    const it = src || {};
    const name = it.name ?? it.faculty ?? '';
    const department = it.department ?? it.dept ?? '';
    const lru = it.load_release_units ?? it.loadReleaseUnits ?? '';
    return {
      name,
      department,
      email: it.email ?? '',
      designation: it.designation ?? '',
      employment: it.employment ?? '',
      rank: it.rank ?? '',
      load_release_units: lru,
    };
  }, []);

  const [form, setForm] = React.useState(() => mapInitial(initial));

  React.useEffect(() => {
    setForm(mapInitial(initial));
  }, [initial, mapInitial]);

  const border = useColorModeValue('gray.200','gray.700');

  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e?.target ? e.target.value : e }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial?.id ? 'Edit Faculty' : 'Add Faculty'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>
              <Input value={form.name || ''} onChange={set('name')} placeholder="Full name" />
            </FormControl>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input type="email" value={form.email || ''} onChange={set('email')} placeholder="name@domain.com" />
              </FormControl>
              <FormControl>
                <FormLabel>Department</FormLabel>
                <Input value={form.department || ''} onChange={set('department')} placeholder="Department" />
              </FormControl>
            </HStack>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Designation</FormLabel>
                <Input value={form.designation || ''} onChange={set('designation')} placeholder="Designation" />
              </FormControl>
              <FormControl>
                <FormLabel>Employment</FormLabel>
                <Select value={form.employment || ''} onChange={set('employment')}>
                  <option value="">Select</option>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </Select>
              </FormControl>
            </HStack>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Rank</FormLabel>
                <Input value={form.rank || ''} onChange={set('rank')} placeholder="Instructor I" />
              </FormControl>
              <FormControl>
                <FormLabel>Load Release Units</FormLabel>
                <NumberInput min={0} max={24} value={form.load_release_units ?? ''} onChange={(v)=> setForm(s=>({ ...s, load_release_units: v }))}>
                  <NumberInputField placeholder="0" />
                </NumberInput>
              </FormControl>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={() => onSubmit && onSubmit(form)}>{initial?.id ? 'Save' : 'Create'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
