import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Input, Switch, Box, Select, Text, SimpleGrid, Badge, useColorModeValue } from '@chakra-ui/react';
import DayMultiSelect from './DayMultiSelect';

export default function BlockFormModal({ isOpen, onClose, onSubmit, initial }) {
  const sectionBg = useColorModeValue('gray.50', 'whiteAlpha.70');
  const sectionBorder = useColorModeValue('gray.200', 'gray.700');
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
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <VStack align="start" spacing={1}>
            <Text fontSize="xl" fontWeight="800">{initial?.id ? 'Edit Block' : 'Add Block'}</Text>
            <Text fontSize="sm" fontWeight="400" color="gray.500">
              Configure block identity, room allocation, face-to-face days, exam setup, and active status in one place.
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Box borderWidth="1px" borderColor={sectionBorder} rounded="2xl" p={4} bg={sectionBg}>
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="700">Block Identity</Text>
                  <Text fontSize="sm" color="gray.500">Keep the block code format consistent so filtering and matching stay accurate across schedules.</Text>
                </Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Block Code</FormLabel>
                    <Input value={form.blockCode || ''} onChange={set('blockCode')} placeholder="e.g., BSCS-1A or BSED-MATH 3-2" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Session</FormLabel>
                    <Select value={form.session || ''} onChange={set('session')}>
                      <option value="">Select session</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel>Room(s)</FormLabel>
                  <Input value={form.room || ''} onChange={set('room')} placeholder="NB201, OB101, CLAB-2" />
                  <HStack spacing={2} mt={2} wrap="wrap">
                    {tokens(form.room).map((t, idx) => (
                      <Box as="span" key={`room-${idx}`} bg="gray.100" _dark={{ bg: 'gray.700' }} px={2.5} py={1} rounded="md" fontSize="xs">{t}</Box>
                    ))}
                  </HStack>
                </FormControl>
                <FormControl>
                  <FormLabel>F2F Schedule (Days)</FormLabel>
                  <DayMultiSelect value={f2fDaysSel} onChange={(list)=>{ const uniq = Array.from(new Set(list)); setF2fDaysSel(uniq); setForm(v => ({ ...v, f2fSched: uniq.join(', ') })); }} />
                </FormControl>
              </VStack>
            </Box>

            <Box borderWidth="1px" borderColor={sectionBorder} rounded="2xl" p={4} bg={sectionBg}>
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontSize="sm" fontWeight="700">Exam Setup</Text>
                  <Text fontSize="sm" color="gray.500">Optional exam details for the block. Leave blank if exam settings are not yet finalized.</Text>
                </Box>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Exam Day</FormLabel>
                    <Select value={form.examDay || ''} onChange={set('examDay')}>
                      <option value="">Select day</option>
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Exam Session</FormLabel>
                    <Select value={form.examSession || ''} onChange={set('examSession')}>
                      <option value="">Select session</option>
                      <option value="Morning">Morning</option>
                      <option value="Afternoon">Afternoon</option>
                      <option value="Evening">Evening</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Exam Room(s)</FormLabel>
                    <Input value={form.examRoom || ''} onChange={set('examRoom')} placeholder="NB201, AVR-1" />
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </Box>

            <Box borderWidth="1px" borderColor={sectionBorder} rounded="2xl" p={4} bg={sectionBg}>
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" fontWeight="700">Availability</Text>
                <HStack justify="space-between" align="center" flexWrap="wrap" spacing={3}>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="sm">Block Status</Text>
                    <Text fontSize="sm" color="gray.500">
                      Inactive blocks stay hidden in Course Loading unless they already have mapped schedules for the active load context.
                    </Text>
                  </VStack>
                  <HStack spacing={3}>
                    <Badge colorScheme={form.isActive ? 'green' : 'gray'} variant={form.isActive ? 'subtle' : 'outline'}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch isChecked={!!form.isActive} onChange={set('isActive')} />
                  </HStack>
                </HStack>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={() => onSubmit && onSubmit(form)}>{initial?.id ? 'Save Block Changes' : 'Create Block'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
