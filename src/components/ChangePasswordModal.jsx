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
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function ChangePasswordModal({ isOpen, onClose, onSubmit }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [showPw3, setShowPw3] = useState(false);
  const [busy, setBusy] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');

  const valid = oldPassword && newPassword && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await onSubmit?.({ old_password: oldPassword, new_password: newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="xl" boxShadow="2xl">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Change Password</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel>Current password</FormLabel>
              <InputGroup>
                <Input type={showPw1 ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                <InputRightElement>
                  <IconButton aria-label={showPw1 ? 'Hide' : 'Show'} icon={showPw1 ? <FiEyeOff/> : <FiEye/>} onClick={() => setShowPw1(v=>!v)} size="sm" variant="ghost" />
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <FormControl>
              <FormLabel>New password</FormLabel>
              <InputGroup>
                <Input type={showPw2 ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <InputRightElement>
                  <IconButton aria-label={showPw2 ? 'Hide' : 'Show'} icon={showPw2 ? <FiEyeOff/> : <FiEye/>} onClick={() => setShowPw2(v=>!v)} size="sm" variant="ghost" />
                </InputRightElement>
              </InputGroup>
              <Text mt={1} fontSize="xs" color={useColorModeValue('gray.600','gray.400')}>At least 8 characters</Text>
            </FormControl>
            <FormControl>
              <FormLabel>Confirm new password</FormLabel>
              <InputGroup>
                <Input type={showPw3 ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                <InputRightElement>
                  <IconButton aria-label={showPw3 ? 'Hide' : 'Show'} icon={showPw3 ? <FiEyeOff/> : <FiEye/>} onClick={() => setShowPw3(v=>!v)} size="sm" variant="ghost" />
                </InputRightElement>
              </InputGroup>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isDisabled={!valid} isLoading={busy}>Change Password</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

