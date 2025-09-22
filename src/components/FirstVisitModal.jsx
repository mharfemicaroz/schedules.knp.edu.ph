import React from 'react';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Select,
  Text,
  VStack,
  Checkbox,
  useColorModeValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { FiInfo, FiUser } from 'react-icons/fi';
import { checkIpExists, getClientIP, touchLastAccess, upsertVisitor } from '../utils/visitorLogger';

const ROLES = ['Full-time', 'Part-time', 'Admin', 'Student'];

export default function FirstVisitModal() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [ip, setIp] = React.useState(null);
  const [checking, setChecking] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const noteBg = useColorModeValue('blue.50', 'blue.900');
  const noteBorder = useColorModeValue('blue.200', 'blue.700');

  React.useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const localSeen = localStorage.getItem('visit_info_submitted');
        const clientIp = await getClientIP();
        if (!mounted) return;
        setIp(clientIp);

        if (localSeen === '1') {
          if (clientIp) touchLastAccess(clientIp);
          setChecking(false);
          return;
        }

        if (clientIp) {
          const { exists } = await checkIpExists(clientIp);
          if (!mounted) return;
          if (exists) {
            touchLastAccess(clientIp);
            setChecking(false);
            return;
          }
        }

        onOpen();
      } catch (e) {
        console.warn('FirstVisitModal init error', e);
        onOpen();
      } finally {
        if (mounted) setChecking(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [onOpen]);

  async function handleSubmit() {
    if (!consent) {
      toast({ title: 'Please acknowledge the privacy statement', status: 'warning' });
      return;
    }
    if (!name.trim() || !role) {
      toast({ title: 'Please enter name and role', status: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await upsertVisitor({ name: name.trim(), role, ip });
      localStorage.setItem('visit_info_submitted', '1');
      toast({ title: 'Info saved', status: 'success' });
      onClose();
    } catch (e) {
      toast({ title: 'Failed to save info', status: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;
  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered>
      <ModalOverlay />
      <ModalContent maxW="420px">
        <ModalHeader>
          <HStack spacing={3} align="center">
            <Icon as={FiUser} boxSize={6} color="blue.500" />
            <Box>
              <Text fontWeight="800">Welcome</Text>
              <Text fontSize="sm" color={subtle}>Kindly tell us who you are</Text>
            </Box>
          </HStack>
        </ModalHeader>
        <ModalCloseButton onClick={() => { /* prevent close without submit */ }} disabled />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color={subtle}>
              We request basic info to personalize your experience and maintain usage records for this dashboard.
            </Text>
            <Divider />
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Role</FormLabel>
              <Select placeholder="Select role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option value={r} key={r}>{r}</option>
                ))}
              </Select>
            </FormControl>
            <Box rounded="md" borderWidth="1px" borderColor={noteBorder} bg={noteBg} p={3}>
              <HStack align="start" spacing={3}>
                <Icon as={FiInfo} mt={1} color="blue.500" />
                <Text fontSize="xs" color={subtle}>
                  Privacy notice: We collect your Name and Role solely for educational and research purposes related to this system's usage. Data is kept confidential and used in aggregate. By submitting, you consent to this use.
                </Text>
              </HStack>
            </Box>
            <Checkbox isChecked={consent} onChange={(e) => setConsent(e.target.checked)} size="sm">
              I acknowledge and consent to the privacy statement.
            </Checkbox>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting} isDisabled={!consent} w="full">
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
