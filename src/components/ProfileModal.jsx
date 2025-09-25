import React, { useEffect, useState } from 'react';
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
  useColorModeValue,
  HStack,
  Avatar,
  IconButton,
  Text,
} from '@chakra-ui/react';
import { FiUpload, FiTrash2 } from 'react-icons/fi';
import { compressImageFile } from '../utils/imageUtils';

export default function ProfileModal({ isOpen, onClose, user, onSubmit }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarData, setAvatarData] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setUsername(user.username || '');
      setAvatarData(user.avatar || null);
    }
  }, [user, isOpen]);

  const canSave = Boolean(email && /@/.test(email));

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSubmit?.({ email, first_name: firstName, last_name: lastName, avatar: avatarData });
    } finally {
      setBusy(false);
    }
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const data = await compressImageFile(file, { maxWidth: 256, maxHeight: 256, quality: 0.85 });
      setAvatarData(data);
    } catch (err) {
      // swallow; could toast outside
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="xl" boxShadow="2xl">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <HStack>
              <Avatar size="lg" name={user?.username || user?.email} src={avatarData || undefined} />
              <input id="__avatar_input" type="file" accept="image/*" hidden onChange={onPickAvatar} />
              <HStack>
                <Button leftIcon={<FiUpload />} size="sm" onClick={() => document.getElementById('__avatar_input')?.click()} isLoading={avatarBusy}>
                  Change Avatar
                </Button>
                {avatarData && (
                  <IconButton aria-label="Remove avatar" icon={<FiTrash2 />} size="sm" onClick={() => setAvatarData(null)} />
                )}
              </HStack>
            </HStack>
            <FormControl isDisabled>
              <FormLabel>Username</FormLabel>
              <Input value={username} readOnly />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>First name</FormLabel>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Last name</FormLabel>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSave} isDisabled={!canSave} isLoading={busy}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
