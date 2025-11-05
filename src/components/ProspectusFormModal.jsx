import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, HStack, FormControl, FormLabel, Input, Select, NumberInput, NumberInputField } from '@chakra-ui/react';

const PROGRAM_OPTIONS = [
  'BSAB', 'BSBA-FM', 'BSBA-HRM', 'BSBA-MM', 'BSCRIM', 'BSED-ENGLISH', 'BSED-MATH', 'BSED-SS', 'BSED-VE', 'BSENTREP', 'BSTM', 'BTLED-HE',
];

export default function ProspectusFormModal({ isOpen, onClose, onSubmit, initial }) {
  const mapInitial = React.useCallback((src) => {
    const it = src || {};
    return {
      programcode: it.programcode || it.program || '',
      course_name: it.course_name || it.courseName || '',
      course_title: it.course_title || it.courseTitle || '',
      unit: it.unit ?? '',
      yearlevel: it.yearlevel ?? '',
      semester: it.semester ?? '',
      curriculum_year: it.curriculum_year || it.curriculumYear || '',
      dept: it.dept || it.department || '',
    };
  }, []);

  const [form, setForm] = React.useState(() => mapInitial(initial));
  React.useEffect(() => { setForm(mapInitial(initial)); }, [initial, mapInitial]);
  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e?.target ? e.target.value : e }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial?.id ? 'Edit Prospectus' : 'Add Prospectus'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <HStack spacing={3} align="start">
              <FormControl isRequired>
                <FormLabel>Program</FormLabel>
                <Select value={form.programcode || ''} onChange={set('programcode')}>
                  <option value="">Select program</option>
                  {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Department</FormLabel>
                <Input value={form.dept || ''} onChange={set('dept')} placeholder="Dept" />
              </FormControl>
            </HStack>
            <HStack spacing={3} align="start">
              <FormControl isRequired>
                <FormLabel>Course Name</FormLabel>
                <Input value={form.course_name || ''} onChange={set('course_name')} placeholder="e.g., GE 101" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Course Title</FormLabel>
                <Input value={form.course_title || ''} onChange={set('course_title')} placeholder="Descriptive title" />
              </FormControl>
            </HStack>
            <HStack spacing={3} align="start">
              <FormControl isRequired>
                <FormLabel>Unit</FormLabel>
                <NumberInput min={0} max={12} value={form.unit ?? ''} onChange={(v)=> setForm(s=>({ ...s, unit: v }))}>
                  <NumberInputField placeholder="0" />
                </NumberInput>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Year Level</FormLabel>
                <NumberInput min={1} max={5} value={form.yearlevel ?? ''} onChange={(v)=> setForm(s=>({ ...s, yearlevel: v }))}>
                  <NumberInputField placeholder="1" />
                </NumberInput>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Semester</FormLabel>
                <Select value={form.semester || ''} onChange={set('semester')}>
                  <option value="">Select</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </Select>
              </FormControl>
            </HStack>
            <FormControl>
              <FormLabel>Curriculum Year</FormLabel>
              <Input value={form.curriculum_year || ''} onChange={set('curriculum_year')} placeholder="e.g., 2024-2025" />
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

