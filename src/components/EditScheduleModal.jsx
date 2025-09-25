import React, { useEffect, useMemo, useState } from 'react';
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
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  useColorModeValue,
  Text,
} from '@chakra-ui/react';

export default function EditScheduleModal({ isOpen, onClose, schedule, onSave, viewMode }) {
  const emptyForm = {
    day: '',
    time: '',
    room: '',
    session: '',
    examDay: '',
    examSession: '',
    examRoom: '',
    term: '',
    faculty: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const subtleText = useColorModeValue('gray.600','gray.400');

  useEffect(() => {
    if (schedule) {
      setForm({
        ...emptyForm,
        day: schedule.day || '',
        time: schedule.time || schedule.schedule || '',
        room: schedule.room || '',
        session: schedule.session || '',
        examDay: schedule.examDay || '',
        examSession: schedule.examSession || '',
        examRoom: schedule.examRoom || '',
        term: schedule.semester || schedule.term || '',
        faculty: schedule.faculty || schedule.facultyName || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [schedule, isOpen]);

  const canSave = useMemo(() => {
    if (!schedule) return false;
    if (viewMode === 'examination') {
      return Boolean(form.examDay || form.examSession || form.examRoom);
    }
    return Boolean(form.day && form.time && form.room);
  }, [form, schedule, viewMode]);

  const update = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave?.(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered motionPreset="scale">
      <ModalOverlay backdropFilter="blur(6px)" />
      <ModalContent overflow="hidden" borderRadius="xl" boxShadow="2xl">
        <ModalHeader bg={headerBg} borderBottomWidth="1px">Edit Schedule</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {schedule ? (
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color={subtleText}>
                {schedule.code} • {schedule.title}
              </Text>
              <HStack>
                <FormControl>
                  <FormLabel>Term</FormLabel>
                  <Input value={form.term} onChange={update('term')} />
                </FormControl>
                <FormControl>
                  <FormLabel>Session</FormLabel>
                  <Select value={form.session} onChange={update('session')}>
                    <option value="">-</option>
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                  </Select>
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel>Faculty</FormLabel>
                <Input value={form.faculty} onChange={update('faculty')} placeholder="Lastname, Firstname" />
              </FormControl>
              {viewMode === 'examination' ? (
                <>
                  <HStack>
                    <FormControl>
                      <FormLabel>Exam Day</FormLabel>
                      <Input value={form.examDay} onChange={update('examDay')} placeholder="Mon/Tue/..." />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Exam Session</FormLabel>
                      <Select value={form.examSession} onChange={update('examSession')}>
                        <option value="">-</option>
                        <option>Morning</option>
                        <option>Afternoon</option>
                        <option>Evening</option>
                      </Select>
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel>Exam Room</FormLabel>
                    <Input value={form.examRoom} onChange={update('examRoom')} />
                  </FormControl>
                </>
              ) : (
                <>
                  <HStack>
                    <FormControl>
                      <FormLabel>Day</FormLabel>
                      <Input value={form.day} onChange={update('day')} placeholder="Mon/Tue or Mon/Wed/Fri" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Time</FormLabel>
                      <Input value={form.time} onChange={update('time')} placeholder="8:00-9:00AM" />
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel>Room</FormLabel>
                    <Input value={form.room} onChange={update('room')} />
                  </FormControl>
                </>
              )}
            </VStack>
          ) : null}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={handleSave} isDisabled={!canSave} isLoading={busy}>Save changes</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
