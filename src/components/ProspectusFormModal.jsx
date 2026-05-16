import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  Box,
  Text,
  SimpleGrid,
  useColorModeValue,
} from '@chakra-ui/react';

const PROGRAM_OPTIONS = [
  'BSAB', 'BSBA-FM', 'BSBA-HRM', 'BSBA-MM', 'BSCRIM', 'BSED-ENGLISH', 'BSED-MATH', 'BSED-SS', 'BSED-VE', 'BSENTREP', 'BSTM', 'BTLED-HE',
];

function FormSection({ title, description, children }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const muted = useColorModeValue('gray.600', 'gray.300');

  return (
    <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} px={5} py={4}>
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontSize="sm" fontWeight="700">{title}</Text>
          {description ? (
            <Text fontSize="sm" color={muted} mt={1}>{description}</Text>
          ) : null}
        </Box>
        {children}
      </VStack>
    </Box>
  );
}

function FieldLabel({ children, required = false }) {
  const muted = useColorModeValue('gray.700', 'gray.200');
  return (
    <FormLabel mb={1.5} fontSize="sm" fontWeight="600" color={muted}>
      {children}{required ? ' *' : ''}
    </FormLabel>
  );
}

export default function ProspectusFormModal({ isOpen, onClose, onSubmit, initial, curriculumYearOptions = [] }) {
  const mapInitial = React.useCallback((src) => {
    const it = src || {};
    return {
      programcode: it.programcode || it.program || '',
      course_name: it.course_name || it.courseName || '',
      course_title: it.course_title || it.courseTitle || '',
      coursetype: it.coursetype || it.courseType || '',
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
  const modalBg = useColorModeValue('white', 'gray.800');
  const modalBorder = useColorModeValue('gray.200', 'gray.700');
  const modalMuted = useColorModeValue('gray.600', 'gray.300');
  const title = initial?.id ? 'Edit Prospectus' : 'Add Prospectus';
  const actionLabel = initial?.id ? 'Save Changes' : 'Create Prospectus';

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={modalBg} borderWidth="1px" borderColor={modalBorder} rounded="2xl">
        <ModalHeader pb={2}>
          <VStack align="stretch" spacing={1} pr={10}>
            <Text fontSize="xl" fontWeight="700">{title}</Text>
            <Text fontSize="sm" color={modalMuted}>
              Manage the core curriculum metadata for this course in a cleaner, wider editing workspace.
            </Text>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={5}>
            <FormSection
              title="Course Identity"
              description="Define the program, department, and core descriptive details that make this prospectus entry easy to scan."
            >
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                <FormControl isRequired>
                  <FieldLabel required>Program</FieldLabel>
                  <Select value={form.programcode || ''} onChange={set('programcode')}>
                    <option value="">Select program</option>
                    {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FieldLabel>Department</FieldLabel>
                  <Input value={form.dept || ''} onChange={set('dept')} placeholder="Department code or name" />
                </FormControl>
                <FormControl>
                  <FieldLabel>Course Type</FieldLabel>
                  <Input value={form.coursetype || ''} onChange={set('coursetype')} placeholder="Major, Minor, Elective..." />
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FieldLabel required>Course Name</FieldLabel>
                  <Input value={form.course_name || ''} onChange={set('course_name')} placeholder="e.g., GE 101" />
                </FormControl>
                <FormControl isRequired>
                  <FieldLabel required>Course Title</FieldLabel>
                  <Input value={form.course_title || ''} onChange={set('course_title')} placeholder="Full descriptive title" />
                </FormControl>
              </SimpleGrid>
            </FormSection>

            <FormSection
              title="Academic Placement"
              description="Place the course in the correct year, semester, and curriculum cycle using compact structured fields."
            >
              <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4}>
                <FormControl isRequired>
                  <FieldLabel required>Unit</FieldLabel>
                  <NumberInput min={0} max={12} value={form.unit ?? ''} onChange={(v)=> setForm(s=>({ ...s, unit: v }))}>
                    <NumberInputField placeholder="0" />
                  </NumberInput>
                </FormControl>
                <FormControl isRequired>
                  <FieldLabel required>Year Level</FieldLabel>
                  <Select value={form.yearlevel || ''} onChange={set('yearlevel')}>
                    <option value="">Select year level</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FieldLabel required>Semester</FieldLabel>
                  <Select value={form.semester || ''} onChange={set('semester')}>
                    <option value="">Select semester</option>
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FieldLabel>Curriculum Year</FieldLabel>
                  <Select value={form.curriculum_year || ''} onChange={set('curriculum_year')}>
                    <option value="">Select curriculum year</option>
                    {(curriculumYearOptions || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
            </FormSection>
          </VStack>
        </ModalBody>
        <ModalFooter pt={0}>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" px={6} onClick={() => onSubmit && onSubmit(form)}>{actionLabel}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
