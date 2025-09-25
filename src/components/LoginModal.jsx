import React, { useState } from 'react';
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
  InputGroup,
  InputRightElement,
  IconButton,
  Text,
  useColorModeValue,
  Checkbox,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function LoginModal({ isOpen, onClose, onSubmit }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const ring = useColorModeValue('blue.100', 'blue.900');

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await onSubmit?.({ username, password });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = username.trim().length > 0 && password.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="xl" boxShadow="2xl">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Sign in</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4} py={1}>
            <Text fontSize="sm" color={useColorModeValue('gray.600','gray.300')}>
              Enter your credentials to continue.
            </Text>
            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                placeholder="you@knp.edu.ph"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                _focusVisible={{ boxShadow: `0 0 0 3px ${ring}` }}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Password</FormLabel>
              <InputGroup>
                <Input
                  placeholder="••••••••"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  _focusVisible={{ boxShadow: `0 0 0 3px ${ring}` }}
                />
                <InputRightElement>
                  <IconButton
                    variant="ghost"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    icon={showPw ? <FiEyeOff /> : <FiEye />}
                    onClick={() => setShowPw(v => !v)}
                    size="sm"
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Checkbox defaultChecked colorScheme="blue">Remember me</Checkbox>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={busy} isDisabled={!canSubmit}>
            Sign in
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
