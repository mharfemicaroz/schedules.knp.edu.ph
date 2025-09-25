import React, { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, HStack, Avatar, Text, Badge, VStack, Divider, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, Switch, FormControl, FormLabel, IconButton, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useSelector, useDispatch } from 'react-redux';
import { selectFilteredFaculties } from '../store/dataSlice';
import LoadingState from '../components/LoadingState';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { FiEdit, FiTrash } from 'react-icons/fi';

export default function FacultyDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const faculties = useSelector(selectFilteredFaculties);
  const loading = useSelector(s => s.data.loading);
  const acadData = useSelector(s => s.data.acadData);
  const [viewMode, setViewMode] = useLocalStorage('facultyDetailViewMode', getInitialToggleState(acadData, 'facultyDetailViewMode', 'regular'));
  // Hoist hooks before any early return to keep hook order stable across renders
  const _border = useColorModeValue('gray.200','gray.700');
  const _panelBg = useColorModeValue('white','gray.800');
  const _authUser = useSelector(s => s.auth.user);
  const _editDisc = useDisclosure();
  const _delDisc = useDisclosure();
  const [_selected, _setSelected] = useState(null);
  const _cancelRef = React.useRef();
  if (loading) return <LoadingState label="Loading faculty…" />;
  const f = faculties.find(x => String(x.id) === String(id));
  const border = _border;
  const panelBg = _panelBg;
  const authUser = _authUser;
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');
  const editDisc = _editDisc;
  const delDisc = _delDisc;
  const [selected, setSelected] = [_selected, _setSelected];
  const cancelRef = _cancelRef;

  if (!f) {
    return (
      <VStack align="center" spacing={6} py={10}>
        <Heading size="md">Faculty not found</Heading>
        <Button as={RouterLink} to="/" colorScheme="brand" variant="solid" leftIcon={<FiArrowLeft />}>Back to Dashboard</Button>
      </VStack>
    );
  }

  // Helper functions for mode switching
  const getTableHeaders = () => {
    if (viewMode === 'examination') {
      return ['Code', 'Title', 'Section', 'Units', 'Term', 'Time', 'Exam Day', 'Exam Session', 'Exam Room'];
    }
    return ['Code', 'Title', 'Section', 'Units', 'Day', 'Time', 'Term', 'Room', 'Session', 'F2F'];
  };

  const getCourseData = (course) => {
    if (viewMode === 'examination') {
      return [
        course.code || '—',
        course.title || '—',
        course.section || '—',
        String(course.unit ?? course.hours ?? '—'),
        [course.semester, course.year].filter(Boolean).join(' ') || '—',
        course.schedule || '—',
        course.examDay || '—',
        course.examSession || '—',
        course.examRoom || '—'
      ];
    }
    return [
      course.code || '—',
      course.title || '—',
      course.section || '—',
      String(course.unit ?? course.hours ?? '—'),
      course.day || '—',
      course.schedule || '—',
      [course.semester, course.year].filter(Boolean).join(' ') || '—',
      course.room || '—',
      course.session || '—',
      course.f2fSched || '—'
    ];
  };

  // Sort helper: time then term
  const sortedCourses = (f.courses || [])
    .slice()
    .sort((a, b) => {
      // Primary: term order (1st, 2nd, 3rd, Summer)
      const oa = Number.isFinite(a.termOrder) ? a.termOrder : 99;
      const ob = Number.isFinite(b.termOrder) ? b.termOrder : 99;
      if (oa !== ob) return oa - ob;
      // Secondary: start time within term
      const ta = Number.isFinite(a.timeStartMinutes) ? a.timeStartMinutes : Infinity;
      const tb = Number.isFinite(b.timeStartMinutes) ? b.timeStartMinutes : Infinity;
      if (ta !== tb) return ta - tb;
      // Stable fallback by schedule key to avoid jitter
      return String(a.scheduleKey || '').localeCompare(String(b.scheduleKey || ''));
    });

  function onPrint() {
    const headers = getTableHeaders();
    const rows = sortedCourses.map(c => getCourseData(c));
    const table = buildTable(headers, rows);
    const esc = (val) => String(val ?? '').replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'"').replace(/'/g,'&#039;');
    const metaHtml = `
      <table class="prt-table"><tbody>
        <tr><th>Department</th><td>${esc(f.department || '')}</td><th>Employment</th><td>${esc(f.employment || '')}</td></tr>
        <tr><th>Designation</th><td colspan="3">${esc(f.designation || f.rank || '')}</td></tr>
        <tr><th>Load Release Units</th><td>${esc(String(f.loadReleaseUnits ?? 0))}</td><th>Total Load Units</th><td>${esc(String(f.stats?.loadHours ?? 0))}</td></tr>
        <tr><th>Schedule Type</th><td colspan="3">${esc(viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule')}</td></tr>
      </tbody></table>`;
    printContent({ title: `Faculty: ${f.name}`, subtitle: f.email || '', bodyHtml: metaHtml + table });
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
    <>
    <VStack align="stretch" spacing={6}>
      <HStack spacing={4} justify="space-between" flexWrap="wrap" gap={3}>
        <HStack spacing={4}>
          <Avatar size="lg" name={f.name} />
          <Box>
            <Heading size="md">{f.name}</Heading>
            <VStack align="start" spacing={1} mt={2}>
              <HStack spacing={2}>
                <Badge colorScheme="blue">{f.department || '—'}</Badge>
                {Boolean(f.employment) && <Badge colorScheme="green">{f.employment}</Badge>}
              </HStack>
              {(f.designation || f.rank) && (
                <Text fontSize="sm" color="gray.600">{f.designation || f.rank}</Text>
              )}
            </VStack>
          </Box>
        </HStack>
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
          <Button as={RouterLink} to="/" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
        </HStack>
      </HStack>

      <Box borderWidth="1px" borderColor={border} rounded="xl" p={4} bg={panelBg}>
        <HStack spacing={6}>
          <Stat label="Load Units" value={f.stats?.loadHours ?? 0} />
          <Stat label="Load Release Units" value={f.loadReleaseUnits ?? 0} />
          <Stat label="Overload Units" value={(f.stats?.overloadHours != null ? f.stats.overloadHours : Math.max(0, (f.stats?.loadHours||0) - Math.max(0, 24 - (Number(f.loadReleaseUnits)||0))))} />
          <Stat label="Courses" value={f.stats?.courseCount ?? (f.courses?.length || 0)} />
        </HStack>
      </Box>

      <Box className="responsive-table table-fac-detail" borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} overflowX="auto">
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              {(() => { const h = getTableHeaders(); if (isAdmin) h.push('Actions'); return h; })().map((header, index) => (
                <Th key={index}>{header}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {sortedCourses.map(c => {
              const courseData = getCourseData(c);
              return (
                <Tr key={c.id}>
                  {courseData.map((data, index) => (
                    <Td key={index}>
                      {index === 1 ? (
                        <Text maxW="380px" noOfLines={1}>{data}</Text>
                      ) : (
                        data
                      )}
                    </Td>
                  ))}
                  {isAdmin && (
                    <Td textAlign="right">
                      <HStack justify="end" spacing={1}>
                        <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" colorScheme="yellow" variant="ghost" onClick={() => { setSelected(c); editDisc.onOpen(); }} />
                        <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => { setSelected(c); delDisc.onOpen(); }} />
                      </HStack>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>


    </VStack>
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
    </>
  );
}

function Stat({ label, value }) {
  return (
    <Box>
      <Text fontSize="sm" color="gray.500">{label}</Text>
      <Text fontWeight="800" fontSize="xl">{value}</Text>
    </Box>
  );
}
