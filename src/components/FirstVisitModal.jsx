import React from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Select,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { checkIpExists, getClientIP, touchLastAccess, upsertVisitor } from '../utils/visitorLogger';

const ROLES = ['Full-time', 'Part-time', 'Admin'];

export default function FirstVisitModal() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [ip, setIp] = React.useState(null);
  const [checking, setChecking] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // quick local guard to avoid flicker
        const localSeen = localStorage.getItem('visit_info_submitted');
        const clientIp = await getClientIP();
        if (!mounted) return;
        setIp(clientIp);

        if (localSeen === '1') {
          // still update last access, but skip modal
          if (clientIp) touchLastAccess(clientIp);
          setChecking(false);
          return;
        }

        if (clientIp) {
          const resp = await checkIpExists(clientIp);
          if (!mounted) return;
          if (resp.disabled) {
            setChecking(false);
            return;
          }
          if (resp.exists) {
            // known IP, silently touch last access
            touchLastAccess(clientIp);
            setChecking(false);
            return;
          }
        }

        onOpen();
      } catch (e) {
        console.warn('FirstVisitModal init error', e);
        // Fail-open: ask for info
        onOpen();
      } finally {
        if (mounted) setChecking(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, [onOpen]);

  async function handleSubmit() {
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
      <ModalContent>
        <ModalHeader>Welcome</ModalHeader>
        <ModalCloseButton onClick={() => { /* prevent close without submit */ }} disabled />
        <ModalBody>
          <FormControl mb={3} isRequired>
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
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={submitting}>Submit</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}


