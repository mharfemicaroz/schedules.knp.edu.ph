import React, { useMemo } from 'react';
import { useParams, Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
  Button,
  Text,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  useDisclosure,
} from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft, FiShare, FiShare2 } from 'react-icons/fi';
import { usePublicView } from '../utils/uiFlags';
import { useSelector } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { buildTable, printContent } from '../utils/printDesign';
import { encodeShareRoom, decodeShareRoom } from '../utils/share';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import RoomQrModal from '../components/RoomQrModal';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RoomSchedule() {
  const { room: roomParam } = useParams();
  const isPublic = usePublicView();
  const room = isPublic ? decodeShareRoom(String(roomParam || '')) : decodeURIComponent(roomParam || '');
  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector((s) => s.data.loading);
  const acadData = useSelector((s) => s.data.acadData);
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useLocalStorage(
    'roomScheduleViewMode',
    getInitialToggleState(acadData, 'roomScheduleViewMode', 'regular')
  );
  const filterDay = searchParams.get('day');
  const border = useColorModeValue('gray.200', 'gray.700');
  const tableBg = useColorModeValue('white', 'gray.800');
  const authUser = useSelector((s) => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const qrDisc = useDisclosure();

  const rows = useMemo(() => {
    const tokens = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const normRoom = (v) => String(v || 'N/A').trim().replace(/\s+/g, ' ').toUpperCase();
    const dayCode = (v) => String(v || '').trim().slice(0, 3).toUpperCase();
    const getRoomsForDay = (c, d) => {
      const roomsArr = tokens(c.room);
      const daysArr = tokens(c.f2fSched);
      if (roomsArr.length > 1 && daysArr.length > 1) {
        const out = [];
        const len = Math.min(roomsArr.length, daysArr.length);
        for (let i = 0; i < len; i++) {
          if (dayCode(daysArr[i]) === dayCode(d)) out.push(roomsArr[i]);
        }
        return out;
      }
      const days = Array.isArray(c.f2fDays) ? c.f2fDays : daysArr;
      return days.some((x) => dayCode(x) === dayCode(d)) ? roomsArr : [];
    };

    const targetKey = normRoom(room);
    let list = (allCourses || []).filter((c) => {
      return DAY_ORDER.some((d) => getRoomsForDay(c, d).some((r) => normRoom(r) === targetKey));
    });
    if (filterDay) {
      list = list.filter((c) => getRoomsForDay(c, filterDay).some((r) => normRoom(r) === targetKey));
    }

    const seen = new Map();
    const uniq = [];
    for (const c of list) {
      const dayKey = filterDay || c.day || '';
      const timeKey = c.scheduleKey || `${c.timeStartMinutes}-${c.timeEndMinutes}`;
      const termKey = c.term || '';
      const blockKey = c.section || '';
      const facultyKey = c.facultyName || c.faculty || '';
      const key = `${dayKey}|${timeKey}|${termKey}|${blockKey}|${facultyKey}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        uniq.push(c);
      }
    }
    return uniq.sort((a, b) => {
      const oa = a.termOrder ?? 9,
        ob = b.termOrder ?? 9;
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
    const headers =
      viewMode === 'examination'
        ? ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty', 'Exam Day', 'Exam Session', 'Exam Room']
        : ['Time', 'Day', 'Term', 'Program', 'Code', 'Title', 'Section', 'Units', 'Faculty'];
    const data = rows.map((c) => {
      if (viewMode === 'examination') {
        return [
          c.schedule || '',
          c.day || '',
          c.term,
          c.program || '',
          c.code,
          c.title,
          c.section,
          String(c.unit ?? c.hours ?? ''),
          c.facultyName,
          c.examDay || '',
          c.examSession || '',
          c.examRoom || '',
        ];
      } else {
        return [
          c.schedule || '',
          c.day || '',
          c.term,
          c.program || '',
          c.code,
          c.title,
          c.section,
          String(c.unit ?? c.hours ?? ''),
          c.facultyName,
        ];
      }
    });
    const table = buildTable(headers, data);
    const scheduleType = viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule';
    const subtitle = `Room: ${room}${filterDay ? ` · ${filterDay}` : ''} - ${scheduleType}`;
    printContent({ title: 'Room Schedule', subtitle, bodyHtml: table });
  }

  function absoluteQrUrl() {
    const roomPath = `/views/rooms/${encodeURIComponent(room)}/auto`;
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#${roomPath}`;
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Heading size="md">Room: {room}{filterDay ? ` · ${filterDay}` : ''}</Heading>
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
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">
            Print
          </Button>
          {isAdmin && !isPublic && (
            <Button
              as={RouterLink}
              to={`/share/rooms/${encodeURIComponent(encodeShareRoom(room))}`}
              leftIcon={<FiShare2 />}
              size="sm"
              colorScheme="blue"
            >
              Share
            </Button>
          )}
          {isAdmin && !isPublic && (
            <Button leftIcon={<FiShare />} onClick={qrDisc.onOpen} variant="outline" size="sm">
              Show QR
            </Button>
          )}
          {!isPublic && (
            <Button as={RouterLink} to="/views/rooms" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />}>
              Back
            </Button>
          )}
        </HStack>
      </HStack>
      {loading && <Text color="gray.500" mb={2}>Loading schedule...</Text>}
      <Box className="responsive-table table-room" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg}>
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
                <Td>{c.schedule || ''}</Td>
                <Td>{c.day || ''}</Td>
                <Td>{c.term}</Td>
                <Td>{c.program || ''}</Td>
                <Td>{c.code}</Td>
                <Td maxW="380px">{c.title}</Td>
                <Td>{c.section}</Td>
                <Td>{c.unit ?? c.hours ?? ''}</Td>
                <Td>{c.facultyName}</Td>
                {viewMode === 'examination' && (
                  <>
                    <Td>{c.examDay || ''}</Td>
                    <Td>{c.examSession || ''}</Td>
                    <Td>{c.examRoom || ''}</Td>
                  </>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
      <RoomQrModal isOpen={qrDisc.isOpen} onClose={qrDisc.onClose} url={absoluteQrUrl()} room={room} />
    </Box>
  );
}

