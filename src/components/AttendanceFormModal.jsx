import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, Select, Textarea, HStack, VStack, Box, useToast, Text, SimpleGrid, Tag, TagLabel, useColorModeValue
} from '@chakra-ui/react';
import apiService from '../services/apiService';
import ScheduleSelect from './ScheduleSelect';
import { useSelector } from 'react-redux';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
];

export default function AttendanceFormModal({ isOpen, onClose, initial, onSaved, lockSchedule = false }) {
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(() => ({
    scheduleId: initial?.scheduleId || initial?.schedule_id || '',
    status: initial?.status || 'present',
    date: initial?.date || new Date().toISOString().slice(0,10),
    remarks: initial?.remarks || '',
  }));
  const raw = useSelector(s => Array.isArray(s.data.raw) ? s.data.raw : []);
  const selectedSchedule = React.useMemo(() => {
    const id = Number(form.scheduleId);
    if (!id) return null;
    return (raw || []).find(r => Number(r.id) === id) || null;
  }, [raw, form.scheduleId]);
  const cardBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  React.useEffect(() => {
    setForm({
      scheduleId: initial?.scheduleId || initial?.schedule_id || '',
      status: initial?.status || 'present',
      date: initial?.date || new Date().toISOString().slice(0,10),
      remarks: initial?.remarks || '',
    });
  }, [initial]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.scheduleId) {
      toast({ title: 'Schedule ID required', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      // Preflight duplicate check (same schedule + date)
      try {
        const existing = form.scheduleId ? await apiService.getAttendanceBySchedule(form.scheduleId, { startDate: form.date, endDate: form.date, limit: 1 }) : [];
        const exists = Array.isArray(existing) && existing.find(r => String(r.date) === String(form.date));
        if (exists && (!initial?.id || Number(exists.id) !== Number(initial.id))) {
          toast({ title: 'Duplicate attendance', description: 'An attendance record already exists for this schedule and date.', status: 'warning' });
          return;
        }
      } catch {}

      if (initial?.id) {
        const res = await apiService.updateAttendance(initial.id, {
          status: form.status,
          date: form.date,
          remarks: form.remarks,
        });
        onSaved && onSaved(res?.data || res);
      } else {
        const res = await apiService.createAttendance({
          scheduleId: Number(form.scheduleId),
          status: form.status,
          date: form.date,
          remarks: form.remarks || undefined,
        });
        onSaved && onSaved(res?.data || res);
      }
      onClose && onClose();
    } catch (e) {
      toast({ title: 'Failed', description: e.message, status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = (s) => setForm(f => ({ ...f, status: s }));
  const setDate = (d) => setForm(f => ({ ...f, date: d }));
  const today = new Date();
  const yest = new Date(today.getTime() - 24*60*60*1000);
  const toISO = (dt) => dt.toISOString().slice(0,10);

  const remarksLeft = 255 - String(form.remarks || '').length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial?.id ? 'Edit Attendance' : 'Add Attendance'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Schedule{lockSchedule ? ' (locked)' : ''}</FormLabel>
                <ScheduleSelect
                  value={form.scheduleId}
                  onChangeId={(id) => setForm((f) => ({ ...f, scheduleId: id }))}
                  placeholder="Search course, block, instructor..."
                  allowClear={!lockSchedule}
                  disabled={lockSchedule}
                />
                {form.scheduleId ? (
                  <Text mt={1} fontSize="xs" color="gray.500">Selected ID: {form.scheduleId}</Text>
                ) : null}
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Status</FormLabel>
                <HStack>
                  {STATUS_OPTIONS.map(o => (
                    <Button key={o.value} size="sm" variant={form.status === o.value ? 'solid' : 'outline'}
                      colorScheme={o.value === 'present' ? 'green' : o.value === 'absent' ? 'red' : o.value === 'late' ? 'orange' : 'blue'}
                      onClick={() => setStatus(o.value)}>
                      {o.label}
                    </Button>
                  ))}
                </HStack>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <HStack>
                  <Input type="date" name="date" value={form.date} onChange={onChange} maxW="200px" />
                  <Button size="sm" variant="ghost" onClick={() => setDate(toISO(today))}>Today</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDate(toISO(yest))}>Yesterday</Button>
                </HStack>
              </FormControl>

              <FormControl>
                <FormLabel>Remarks <Text as="span" fontSize="xs" color={remarksLeft < 20 ? 'red.400' : 'gray.500'}>({Math.max(0, remarksLeft)} left)</Text></FormLabel>
                <Textarea name="remarks" value={form.remarks} onChange={onChange} rows={4} placeholder="Optional notes (max 255 chars)" maxLength={255} />
              </FormControl>
            </VStack>

            <Box borderWidth="1px" borderColor={useColorModeValue('gray.200','gray.700')} rounded="md" p={4} bg={cardBg}>
              <Text fontWeight="700" mb={2}>Schedule Preview</Text>
              {selectedSchedule ? (
                <VStack align="start" spacing={1} fontSize="sm">
                  <Text><b>Program:</b> {selectedSchedule.programcode || '-'}</Text>
                  <Text><b>Course:</b> {selectedSchedule.courseTitle || selectedSchedule.course_name || '-'}</Text>
                  <Text><b>Section:</b> {selectedSchedule.blockCode || '-'}</Text>
                  <Text><b>Instructor:</b> {selectedSchedule.instructor || selectedSchedule.faculty || '-'}</Text>
                  <Text><b>When:</b> {selectedSchedule.day || '-'} {selectedSchedule.time || '-'}</Text>
                  <Text><b>Room:</b> {selectedSchedule.room || '-'}</Text>
                </VStack>
              ) : (
                <Text color={useColorModeValue('gray.600','gray.400')}>Pick a schedule to preview details here.</Text>
              )}
              <Box mt={4}>
                <Text fontWeight="700" mb={2}>Current Selection</Text>
                <HStack spacing={2} flexWrap="wrap">
                  <Tag size="sm" colorScheme="purple"><TagLabel>Status: {form.status}</TagLabel></Tag>
                  <Tag size="sm" colorScheme="teal"><TagLabel>Date: {form.date}</TagLabel></Tag>
                  {form.remarks ? <Tag size="sm" colorScheme="gray"><TagLabel>{form.remarks.slice(0, 24)}{form.remarks.length > 24 ? '…' : ''}</TagLabel></Tag> : null}
                </HStack>
              </Box>
            </Box>
          </SimpleGrid>
        </ModalBody>
        <ModalFooter>
          <Button mr={3} onClick={onClose} variant="ghost">Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={saving}>{initial?.id ? 'Update' : 'Create'}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
