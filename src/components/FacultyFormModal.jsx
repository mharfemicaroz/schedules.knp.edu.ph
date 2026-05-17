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
  useColorModeValue,
  Box,
  Text,
  SimpleGrid,
  HStack,
} from '@chakra-ui/react';

const EMPLOYMENT_OPTIONS = ['Full-time', 'Part-time', 'Contract'];

function FormSection({ title, description, children }) {
  const border = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const muted = useColorModeValue('gray.600', 'gray.300');

  return (
    <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} px={5} py={4}>
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontSize="sm" fontWeight="700">{title}</Text>
          {description ? <Text fontSize="sm" color={muted} mt={1}>{description}</Text> : null}
        </Box>
        {children}
      </VStack>
    </Box>
  );
}

function FieldLabel({ children, required = false }) {
  const color = useColorModeValue('gray.700', 'gray.200');
  return (
    <FormLabel mb={1.5} fontSize="sm" fontWeight="600" color={color}>
      {children}{required ? ' *' : ''}
    </FormLabel>
  );
}

export default function FacultyFormModal({ isOpen, onClose, onSubmit, initial, departmentOptions = [] }) {
  const mapInitial = React.useCallback((src) => {
    const it = src || {};
    const name = it.name ?? it.faculty ?? '';
    const department = it.department ?? it.dept ?? '';
    const lru = it.load_release_units ?? it.loadReleaseUnits ?? '';
    const active = it.isActive ?? it.is_active;
    return {
      name,
      department,
      email: it.email ?? '',
      designation: it.designation ?? '',
      employment: it.employment ?? '',
      rank: it.rank ?? '',
      load_release_units: lru,
      is_active: typeof active === 'boolean' ? active : !(String(active || '').trim().toLowerCase() === 'false' || String(active || '').trim() === '0'),
    };
  }, []);

  const [form, setForm] = React.useState(() => mapInitial(initial));

  React.useEffect(() => {
    setForm(mapInitial(initial));
  }, [initial, mapInitial]);

  const muted = useColorModeValue('gray.600', 'gray.300');
  const footerBorder = useColorModeValue('gray.200', 'whiteAlpha.200');
  const set = (k) => (e) => setForm((v) => ({ ...v, [k]: e?.target ? e.target.value : e }));
  const allDepartmentOptions = React.useMemo(() => {
    const set = new Set((departmentOptions || []).filter(Boolean).map((item) => String(item).trim()));
    if (form.department) set.add(String(form.department).trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departmentOptions, form.department]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent rounded="2xl">
        <ModalHeader pb={2}>{initial?.id ? 'Edit Faculty' : 'Add Faculty'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={5}>
            <Box>
              <Text fontSize="sm" color={muted}>
                Keep faculty identity, department assignment, and load controls aligned in one place.
              </Text>
            </Box>

            <FormSection
              title="Faculty Identity"
              description="Capture the core profile details that appear throughout schedules, assignments, and reporting."
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FieldLabel required>Name</FieldLabel>
                  <Input value={form.name || ''} onChange={set('name')} placeholder="Full name" />
                </FormControl>
                <FormControl>
                  <FieldLabel>Email</FieldLabel>
                  <Input type="email" value={form.email || ''} onChange={set('email')} placeholder="name@domain.com" />
                </FormControl>
              </SimpleGrid>
            </FormSection>

            <FormSection
              title="Work Assignment"
              description="Use department and employment settings that match the current program structure and assignment rules."
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FieldLabel>Department</FieldLabel>
                  <Select value={form.department || ''} onChange={set('department')}>
                    <option value="">Select department</option>
                    {allDepartmentOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FieldLabel>Employment</FieldLabel>
                  <Select value={form.employment || ''} onChange={set('employment')}>
                    <option value="">Select employment</option>
                    {EMPLOYMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FieldLabel>Designation</FieldLabel>
                  <Input value={form.designation || ''} onChange={set('designation')} placeholder="Designation" />
                </FormControl>
                <FormControl>
                  <FieldLabel>Rank</FieldLabel>
                  <Input value={form.rank || ''} onChange={set('rank')} placeholder="Instructor I" />
                </FormControl>
              </SimpleGrid>
            </FormSection>

            <FormSection
              title="Load and Status"
              description="Adjust release units and active state without leaving the modal."
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FieldLabel>Load Release Units</FieldLabel>
                  <NumberInput min={0} max={24} value={form.load_release_units ?? ''} onChange={(value) => setForm((s) => ({ ...s, load_release_units: value }))}>
                    <NumberInputField placeholder="0" />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    value={form.is_active ? 'true' : 'false'}
                    onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.value === 'true' }))}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </FormSection>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" borderColor={footerBorder}>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={() => onSubmit && onSubmit({ ...form, isActive: !!form.is_active, is_active: !!form.is_active })}
            >
              {initial?.id ? 'Save Faculty' : 'Create Faculty'}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
