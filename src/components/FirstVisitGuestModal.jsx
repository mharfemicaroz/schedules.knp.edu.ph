import React, { useState, useEffect } from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, VStack, HStack, Input, Select, Checkbox, Text, useColorModeValue, Icon, Box } from '@chakra-ui/react';
import { FiUserPlus, FiShield } from 'react-icons/fi';

export default function FirstVisitGuestModal({ isOpen, onClose, onSubmit, defaultRole = '' }) {
  const panelBg = useColorModeValue('white','gray.800');
  const subtle = useColorModeValue('gray.600','gray.300');
  const [name, setName] = useState('');
  const [role, setRole] = useState(defaultRole || '');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isOpen) { setAgree(false); setBusy(false); } }, [isOpen]);

  const canSave = name.trim().length >= 2 && !!role && agree && !busy;

  const handleSubmit = async () => {
    if (!canSave) return;
    setBusy(true);
    try { await onSubmit?.({ name: name.trim(), role }); } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false}>
      <ModalOverlay backdropFilter="blur(8px)" />
      <ModalContent bg={panelBg} rounded="xl">
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={FiUserPlus} />
            <Text>Welcome! Help us personalize your view</Text>
          </HStack>
        </ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text fontSize="sm" color={subtle}>Please enter your name and role. Information is used for research and educational purposes only.</Text>
            <VStack align="stretch" spacing={3}>
              <Input placeholder="Full name" value={name} onChange={(e)=>setName(e.target.value)} />
              <Select placeholder="Select role" value={role} onChange={(e)=>setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
                <option value="others">Others</option>
              </Select>
            </VStack>
            <HStack align="start" spacing={3}>
              <Icon as={FiShield} color={useColorModeValue('blue.500','blue.300')} boxSize={5} mt={1} />
              <Checkbox isChecked={agree} onChange={(e)=>setAgree(e.target.checked)}>
                <Text fontSize="sm">I agree that my information may be used for research and educational purposes.</Text>
              </Checkbox>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button colorScheme="blue" onClick={handleSubmit} isDisabled={!canSave} isLoading={busy}>Continue</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

