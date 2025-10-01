import React, { useMemo, useState } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Text, HStack, Switch, FormControl, FormLabel, IconButton, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft, FiEdit, FiTrash, FiShare } from 'react-icons/fi';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { buildTable, printContent } from '../utils/printDesign';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import EditScheduleModal from '../components/EditScheduleModal';
import RoomQrModal from '../components/RoomQrModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';

const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function RoomSchedule() {
  const { room: roomParam } = useParams();
  const room = decodeURIComponent(roomParam || '');
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector(s => s.data.loading);
  const acadData = useSelector(s => s.data.acadData);
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useLocalStorage('roomScheduleViewMode', getInitialToggleState(acadData, 'roomScheduleViewMode', 'regular'));
  const filterDay = searchParams.get('day');
  const border = useColorModeValue('gray.200','gray.700');
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const qrDisc = useDisclosure();
  const [selected, setSelected] = useState(null);
  const cancelRef = React.useRef();

  const rows = useMemo(() => {
    const targetKey = String(room || '').trim().replace(/\s+/g,' ').toUpperCase();
    let list = allCourses.filter(c => (c.roomKey || String(c.room || '').trim().replace(/\s+/g,' ').toUpperCase()) === targetKey);
    if (filterDay) {
      list = list.filter(c => Array.isArray(c.f2fDays) && c.f2fDays.includes(filterDay));
    }
    return list.sort((a,b) => {
      const oa = a.termOrder ?? 9, ob = b.termOrder ?? 9;
      if (oa !== ob) return oa - ob;
      const ta = a.timeStartMinutes ?? Infinity;
      const tb = b.timeStartMinutes ?? Infinity;
      if (ta !== tb) return ta - tb;
      const da = DAY_ORDER.indexOf(a.day) === -1 ? 99 : DAY_ORDER.indexOf(a.day);
      const db = DAY_ORDER.indexOf(b.day) === -1 ? 99 : DAY_ORDER.indexOf(b.day);
      return da - db;
    });
  }, [allCourses, room, filterDay]);

  function onPrint() {
    const headers = viewMode === 'examination'
      ? ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty', 'Exam Day', 'Exam Session', 'Exam Room']
      : ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty'];
    const data = rows.map(c => {
      if (viewMode === 'examination') {
        return [
          c.schedule || '—',
          c.day || '—',
          c.semester,
          c.program || '—',
          c.code,
          c.title,
          c.section,
          String(c.unit ?? c.hours ?? ''),
          c.facultyName,
          c.examDay || '—',
          c.examSession || '—',
          c.examRoom || '—'
        ];
      } else {
        return [
          c.schedule || '—',
          c.day || '—',
          c.semester,
          c.program || '—',
          c.code,
          c.title,
          c.section,
          String(c.unit ?? c.hours ?? ''),
          c.facultyName
        ];
      }
    });
    const table = buildTable(headers, data);
    const scheduleType = viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule';
    const subtitle = `Room: ${room}${filterDay ? ` • ${filterDay}` : ''} - ${scheduleType}`;
    printContent({ title: 'Room Schedule', subtitle, bodyHtml: table });
  }

  function absoluteQrUrl() {
    const roomPath = `/views/rooms/${encodeURIComponent(room)}/auto`;
    const { origin, pathname } = window.location;
    // HashRouter: include hash anchor
    return `${origin}${pathname}#${roomPath}`;
  }
  async function handleSaveEdit(payload) {
    if (!selected) return;
    try {
      await dispatch(updateScheduleThunk({ id: selected.id, changes: payload }));
      editDisc.onClose();
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }
  async function confirmDelete() {
    if (!selected) return;
    try {
      await dispatch(deleteScheduleThunk(selected.id));
      delDisc.onClose();
      setSelected(null);
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Heading size="md">Room: {room}{filterDay ? ` — ${filterDay}` : ''}</Heading>
        <HStack spacing={4}>
          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium">
              Regular F2F
            </FormLabel>
            <Switch
              id="schedule-mode"
              colorScheme="blue"
              size="lg"
              isChecked={viewMode === 'examination'}
              onChange={(e) => setViewMode(e.target.checked ? 'examination' : 'regular')}
            />
            <FormLabel htmlFor="schedule-mode" mb="0" fontSize="sm" fontWeight="medium" ml={2}>
              Examination
            </FormLabel>
          </FormControl>
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          {isAdmin && (
            <Button leftIcon={<FiShare />} onClick={qrDisc.onOpen} variant="outline" size="sm">Show QR</Button>
          )}
          <Button as={RouterLink} to="/views/rooms" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />}>Back</Button>
        </HStack>
      </HStack>
      {loading && (
        <Text color="gray.500" mb={2}>Loading schedule…</Text>
      )}
      <Box className="responsive-table table-room" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={useColorModeValue('white','gray.800')}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Time</Th>
              <Th>Day</Th>
              <Th>Term</Th>
              <Th>Program</Th>
              <Th>Code</Th>
              <Th>Title</Th>
              <Th>Section</Th>
              <Th>Units</Th>
              <Th>Faculty</Th>
              {isAdmin && <Th textAlign="right">Actions</Th>}
              {viewMode === 'examination' && (
                <>
                  <Th>Exam Day</Th>
                  <Th>Exam Session</Th>
                  <Th>Exam Room</Th>
                </>
              )}
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((c, i) => (
              <Tr key={`${c.facultyId}-${c.id}-${i}`}>
                <Td>{c.schedule || '—'}</Td>
                <Td>{c.day || '—'}</Td>
                <Td>{c.semester}</Td>
                <Td>{c.program || '—'}</Td>
                <Td>{c.code}</Td>
                <Td maxW="380px">{c.title}</Td>
                <Td>{c.section}</Td>
                <Td>{c.unit ?? c.hours ?? '—'}</Td>
                <Td>{c.facultyName}</Td>
                {isAdmin && (
                  <Td textAlign="right">
                    <HStack justify="end" spacing={1}>
                      <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" colorScheme="yellow" variant="ghost" onClick={() => { setSelected(c); editDisc.onOpen(); }} />
                      <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => { setSelected(c); delDisc.onOpen(); }} />
                    </HStack>
                  </Td>
                )}
                {viewMode === 'examination' && (
                  <>
                    <Td>{c.examDay || '—'}</Td>
                    <Td>{c.examSession || '—'}</Td>
                    <Td>{c.examRoom || '—'}</Td>
                  </>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
      <EditScheduleModal
        isOpen={editDisc.isOpen}
        onClose={() => { editDisc.onClose(); setSelected(null); }}
        schedule={selected}
        onSave={handleSaveEdit}
        viewMode={viewMode}
      />
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete schedule?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone. Are you sure you want to delete <b>{selected?.code}</b> - {selected?.title}?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <RoomQrModal isOpen={qrDisc.isOpen} onClose={qrDisc.onClose} url={absoluteQrUrl()} room={room} />
    </Box>
  );
}
