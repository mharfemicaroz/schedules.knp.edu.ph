import React, { useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, VStack, Text, HStack, Switch, FormControl, FormLabel, IconButton, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { FiEdit, FiTrash } from 'react-icons/fi';

function yearOrder(y) {
  const s = String(y || '').toLowerCase();
  if (s.includes('1st')) return 1;
  if (s.includes('2nd')) return 2;
  if (s.includes('3rd')) return 3;
  if (s.includes('4th')) return 4;
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 99;
}

export default function DepartmentSchedule() {
  const { dept: deptParam } = useParams();
  const dept = decodeURIComponent(deptParam || '');
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const loading = useSelector(s => s.data.loading);
  const acadData = useSelector(s => s.data.acadData);
  const [viewMode, setViewMode] = useLocalStorage('departmentScheduleViewMode', getInitialToggleState(acadData, 'departmentScheduleViewMode', 'regular'));
  const border = useColorModeValue('gray.200','gray.700');
  const tableBg = useColorModeValue('white','gray.800');
  const authUser = useSelector(s => s.auth.user);
  const isAdmin = !!authUser && (String(authUser.role).toLowerCase() === 'admin' || String(authUser.role).toLowerCase() === 'manager');

  // Edit/Delete state
  const editDisc = useDisclosure();
  const delDisc = useDisclosure();
  const [selected, setSelected] = useState(null);
  const cancelRef = React.useRef();

  const groups = useMemo(() => {
    const m = new Map();
    allCourses.forEach(c => {
      if (String(c.program || '') !== dept) return;
      const yl = c.yearlevel || 'N/A';
      const list = m.get(yl) || [];
      list.push(c);
      m.set(yl, list);
    });
    // For each year level: group by block (section), and sort courses within block by term then time
    const entries = Array.from(m.entries()).map(([yl, list]) => {
      const blockMap = new Map();
      list.forEach(c => {
        const block = c.section || c.block || 'N/A';
        const arr = blockMap.get(block) || [];
        arr.push(c);
        blockMap.set(block, arr);
      });
      const blocks = Array.from(blockMap.entries()).map(([block, arr]) => {
        const sorted = arr.sort((a,b) => {
          const oa = a.termOrder ?? 9, ob = b.termOrder ?? 9;
          if (oa !== ob) return oa - ob;
          const ta = a.timeStartMinutes ?? Infinity;
          const tb = b.timeStartMinutes ?? Infinity;
          return ta - tb;
        });
        return { block, items: sorted };
      }).sort((a,b) => String(a.block).localeCompare(String(b.block), undefined, { numeric: true }));
      return { yl, blocks };
    });
    // Sort year levels 1st -> 4th -> others
    entries.sort((a,b) => yearOrder(a.yl) - yearOrder(b.yl));
    return entries;
  }, [allCourses, dept]);

  function onPrint() {
    const headers = viewMode === 'examination'
      ? ['Year Level', 'Block', 'Term', 'Time', 'Code', 'Title', 'Units', 'Room', 'Faculty', 'Exam Day', 'Exam Session', 'Exam Room']
      : ['Year Level', 'Block', 'Term', 'Time', 'Code', 'Title', 'Units', 'Room', 'Faculty'];
    const rows = [];
    groups.forEach(g => {
      g.blocks.forEach(b => {
        b.items.forEach(c => {
          if (viewMode === 'examination') {
            rows.push([g.yl, b.block, c.semester, c.schedule || '—', c.code, c.title, String(c.unit ?? c.hours ?? ''), c.room || '—', c.facultyName, c.examDay || '—', c.examSession || '—', c.examRoom || '—']);
          } else {
            rows.push([g.yl, b.block, c.semester, c.schedule || '—', c.code, c.title, String(c.unit ?? c.hours ?? ''), c.room || '—', c.facultyName]);
          }
        });
      });
    });
    const table = buildTable(headers, rows);
    const scheduleType = viewMode === 'examination' ? 'Examination Schedule' : 'Regular Schedule';
    printContent({ title: `Program: ${dept}`, subtitle: `Year • Block • Term • Time - ${scheduleType}`, bodyHtml: table });
  }

  async function handleSaveEdit(payload) {
    if (!selected) return;
    try {
      const data = { ...payload };
      if (data.faculty == null && selected.facultyName) data.faculty = selected.facultyName;
      await dispatch(updateScheduleThunk({ id: selected.id, changes: data }));
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
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="md">Program: {dept}</Heading>
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
          <Button as={RouterLink} to="/views/departments" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
        </HStack>
      </HStack>
      {loading && <Text color="gray.500">Loading…</Text>}
      {groups.map(group => (
        <Box key={group.yl}>
          <Text fontWeight="700" mb={2}>{group.yl}</Text>
          {group.blocks.map(b => (
            <Box key={b.block} mb={4}>
              <Text fontWeight="600" mb={2}>{b.block}</Text>
              <Box className="responsive-table table-dept" overflowX="auto" borderWidth="1px" borderColor={border} rounded="xl" bg={tableBg}>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Term</Th>
                      <Th>Time</Th>
                      <Th>Code</Th>
                      <Th>Title</Th>
                      <Th>Units</Th>
                      <Th>Room</Th>
                      {viewMode !== 'examination' && (
                        <>
                          <Th>Day</Th>
                          <Th>F2F</Th>
                        </>
                      )}
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
                    {b.items.map((c, idx) => (
                      <Tr key={`${c.facultyId}-${c.id}-${idx}`}>
                        <Td>{c.semester}</Td>
                        <Td>{c.schedule || '—'}</Td>
                        <Td>{c.code}</Td>
                        <Td maxW={{ base: '220px', md: '420px' }}><Text noOfLines={{ base: 2, md: 1 }}>{c.title}</Text></Td>
                        <Td>{c.unit ?? c.hours ?? '—'}</Td>
                        <Td>{c.room || '—'}</Td>
                        {viewMode !== 'examination' && (
                          <>
                            <Td>{c.day || '�?"'}</Td>
                            <Td>{c.f2fSched || '�?"'}</Td>
                          </>
                        )}
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
            </Box>
          ))}
        </Box>
      ))}
      {/* Edit Modal */}
      <EditScheduleModal
        isOpen={editDisc.isOpen}
        onClose={() => { editDisc.onClose(); setSelected(null); }}
        schedule={selected}
        onSave={handleSaveEdit}
        viewMode={viewMode}
      />
      {/* Delete Confirm */}
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
    </VStack>
  );
}
