import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Input, Switch, Box, Select } from '@chakra-ui/react';
import DayMultiSelect from './DayMultiSelect';

export default function BlockFormModal({ isOpen, onClose, onSubmit, initial }) {
  const mapInitial = React.useCallback((src) => {
    const it = src || {};
    return {
      blockCode: it.blockCode || it.block_code || '',
      room: it.room || '',
      session: it.session || '',
      f2fSched: it.f2fSched || it.f2f_sched || '',
      examDay: it.examDay || it.Exam_Day || '',
      examSession: it.examSession || it.Exam_Session || '',
      examRoom: it.examRoom || it.Exam_Room || '',
      isActive: typeof it.isActive === 'boolean' ? it.isActive : (typeof it.is_active === 'boolean' ? it.is_active : true),
    };
  }, []);

  const [form, setForm] = React.useState(() => mapInitial(initial));
  const [f2fDaysSel, setF2fDaysSel] = React.useState(() => String((initial?.f2fSched || initial?.f2f_sched || '')).split(',').map(s => s.trim()).filter(Boolean));
  React.useEffect(() => { 
    setForm(mapInitial(initial));
    setF2fDaysSel(String((initial?.f2fSched || initial?.f2f_sched || '')).split(',').map(s => s.trim()).filter(Boolean));
  }, [initial, mapInitial]);
  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const tokens = (s) => String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial?.id ? 'Edit Block' : 'Add Block'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <FormControl isRequired>
              <FormLabel>Block Code</FormLabel>
              <Input value={form.blockCode || ''} onChange={set('blockCode')} placeholder="e.g., BSCS-1A" />
            </FormControl>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Room(s)</FormLabel>
                <Input value={form.room || ''} onChange={set('room')} placeholder="NB201, OB101" />
                <HStack spacing={2} mt={2} wrap="wrap">
                  {tokens(form.room).map((t, idx) => (
                    <Box as="span" key={`room-${idx}`} bg="gray.100" _dark={{ bg: 'gray.700' }} px={2} py={1} rounded="md" fontSize="xs">{t}</Box>
                  ))}
                </HStack>
              </FormControl>
              <FormControl>
                <FormLabel>Session</FormLabel>
                <Select value={form.session || ''} onChange={set('session')}>
                  <option value="">Select</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                </Select>
              </FormControl>
            </HStack>
            <FormControl>
              <FormLabel>F2F Schedule (Days)</FormLabel>
              <DayMultiSelect value={f2fDaysSel} onChange={(list)=>{ const uniq = Array.from(new Set(list)); setF2fDaysSel(uniq); setForm(v => ({ ...v, f2fSched: uniq.join(', ') })); }} />
            </FormControl>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Exam Day</FormLabel>
                <Select value={form.examDay || ''} onChange={set('examDay')}>
                  <option value="">Select</option>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Exam Session</FormLabel>
                <Select value={form.examSession || ''} onChange={set('examSession')}>
                  <option value="">Select</option>
                  <option value="Morning">Morning</option>
                  <option value="Afternoon">Afternoon</option>
                  <option value="Evening">Evening</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Exam Room(s)</FormLabel>
                <Input value={form.examRoom || ''} onChange={set('examRoom')} placeholder="NB201" />
              </FormControl>
            </HStack>
            <FormControl display="flex" alignItems="center">
              <FormLabel mb="0">Active</FormLabel>
              <Switch isChecked={!!form.isActive} onChange={set('isActive')} />
            </FormControl>
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
