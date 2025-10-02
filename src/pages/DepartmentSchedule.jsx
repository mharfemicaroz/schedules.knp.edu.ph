import React, { useMemo, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Button, VStack, Text, HStack, Switch, FormControl, FormLabel, IconButton, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Checkbox, Collapse, Spacer, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Select, InputGroup, InputRightElement } from '@chakra-ui/react';
import { FiX } from 'react-icons/fi';
import { FiShare2 } from 'react-icons/fi';
import FacultySelect from '../components/FacultySelect';
import { getTimeOptions } from '../utils/timeOptions';
import DayMultiSelect from '../components/DayMultiSelect';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import { buildTable, printContent } from '../utils/printDesign';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllCourses } from '../store/dataSlice';
import { useLocalStorage, getInitialToggleState } from '../utils/scheduleUtils';
import EditScheduleModal from '../components/EditScheduleModal';
import { updateScheduleThunk, deleteScheduleThunk, loadAllSchedules } from '../store/dataThunks';
import { FiEdit, FiTrash } from 'react-icons/fi';
import useFaculties from '../hooks/useFaculties';
import { usePublicView } from '../utils/uiFlags';
import { encodeShareDepartment, decodeShareDepartment } from '../utils/share';
// conflict checking removed per request

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
  const isPublic = usePublicView();
  const dept = isPublic ? decodeShareDepartment(String(deptParam || '')) : decodeURIComponent(deptParam || '');
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
  const bulkDisc = useDisclosure();
  const bulkEditDisc = useDisclosure();
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkRoom, setBulkRoom] = useState('');
  const [bulkF2F, setBulkF2F] = useState('');
  const [bulkFaculty, setBulkFaculty] = useState('');
  const [bulkFacultyId, setBulkFacultyId] = useState(null);
  const [bulkTime, setBulkTime] = useState('');
  const [bulkTerm, setBulkTerm] = useState('');
  const [bulkF2FDays, setBulkF2FDays] = useState([]);
  const { data: facultyOptions, loading: facLoading } = useFaculties();
  const [facQuery, setFacQuery] = useState('');
  const cancelRef = React.useRef();

  // Build hypothetical bulk changes for conflict detection (only when modal is open)
  const bulkChangesById = useMemo(() => {
    if (!bulkEditDisc.isOpen) return {};
    const ids = Array.from(selectedIds).map(String);
    if (ids.length === 0) return {};
    const room = String(bulkRoom || '').trim();
    const f2f = String(bulkF2F || (bulkF2FDays.length ? bulkF2FDays.join(',') : '')).trim();
    const facultyName = String(bulkFaculty || '').trim();
    const changes = {};
    if (!room && !f2f && !facultyName && !bulkFacultyId && !bulkTime && !bulkTerm) return {};
    const common = {};
    if (room) common.room = room;
    if (f2f) { common.f2fSched = f2f; common.f2fsched = f2f; }
    if (bulkFacultyId) common.facultyId = bulkFacultyId; else if (facultyName) common.faculty = facultyName;
    if (bulkTime) common.time = bulkTime;
    if (bulkTerm) common.term = bulkTerm;
    ids.forEach(id => { changes[id] = { ...common }; });
    return changes;
  }, [bulkEditDisc.isOpen, selectedIds, bulkRoom, bulkF2F, bulkF2FDays, bulkFaculty, bulkFacultyId, bulkTime, bulkTerm]);

  const hasBulkConflicts = false;

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
        // Merge same course within the same block that only differ by room (and aggregate F2F days)
        const mergedMap = new Map();
        sorted.forEach((c) => {
          const key = [c.code, c.semester || '', c.schedule || '', c.day || ''].join('|');
          const prev = mergedMap.get(key);
          if (prev) {
            const prevRooms = String(prev.room || '').split(',').map(s => s.trim()).filter(Boolean);
            const currRooms = String(c.room || '').split(',').map(s => s.trim()).filter(Boolean);
            const roomSet = new Set([...prevRooms, ...currRooms]);
            prev.room = Array.from(roomSet).join(',');

            // Also merge F2F day indicators if present (show as e.g., "Mon,Fri")
            const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
            const prevDays = Array.isArray(prev.f2fDays) ? prev.f2fDays : [];
            const currDays = Array.isArray(c.f2fDays) ? c.f2fDays : [];
            if (prevDays.length || currDays.length) {
              const daySet = new Set([...prevDays, ...currDays].filter(Boolean));
              const mergedDays = order.filter(d => daySet.has(d));
              prev.f2fDays = mergedDays;
              const f2fStr = mergedDays.join(',');
              // Normalize both common keys so downstream consumers stay in sync
              prev.f2fSched = f2fStr;
              prev.f2fsched = f2fStr;
            } else {
              // Fallback: try to parse simple CSV/"/" separated lists if arrays are missing
              const parseSimple = (val) => String(val || '')
                .split(/[\/,;&\s]+/)
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => {
                  const u = s.toUpperCase();
                  if (u.startsWith('MON')) return 'Mon';
                  if (u.startsWith('TUE')) return 'Tue';
                  if (u.startsWith('WED')) return 'Wed';
                  if (u.startsWith('THU')) return 'Thu';
                  if (u.startsWith('FRI')) return 'Fri';
                  if (u.startsWith('SAT')) return 'Sat';
                  if (u.startsWith('SUN')) return 'Sun';
                  return '';
                })
                .filter(Boolean);
              const prevList = parseSimple(prev.f2fSched || prev.f2fsched || prev.f2f);
              const currList = parseSimple(c.f2fSched || c.f2fsched || c.f2f);
              if (prevList.length || currList.length) {
                const daySet2 = new Set([...(prevList || []), ...(currList || [])]);
                const mergedDays2 = order.filter(d => daySet2.has(d));
                prev.f2fDays = mergedDays2;
                const f2fStr2 = mergedDays2.join(',');
                prev.f2fSched = f2fStr2;
                prev.f2fsched = f2fStr2;
              }
            }
          } else {
            mergedMap.set(key, { ...c });
          }
        });
        const items = Array.from(mergedMap.values());
        return { block, items };
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
      // Only backfill when field truly omitted; respect explicit null to clear
      const facultyOmitted = (data.faculty === undefined && data.facultyId === undefined);
      if (facultyOmitted && selected.facultyName) data.faculty = selected.facultyName;
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

  const totalVisibleCount = useMemo(() => {
    return groups.reduce((sum, g) => sum + g.blocks.reduce((s, b) => s + b.items.length, 0), 0);
  }, [groups]);

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function blockIds(block) {
    return (block?.items || []).map(it => it.id).filter(Boolean);
  }

  function areAllInBlockSelected(block) {
    const ids = blockIds(block);
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.has(id));
  }

  function isSomeInBlockSelected(block) {
    const ids = blockIds(block);
    const some = ids.some(id => selectedIds.has(id));
    return some && !areAllInBlockSelected(block);
  }

  function toggleBlock(block) {
    const ids = blockIds(block);
    const all = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (all) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }

  // Selection helpers for arbitrary lists (e.g., per-room)
  function idsFromItems(items) {
    return (items || []).map(it => it?.id).filter(Boolean);
  }
  function areAllSelectedIn(items) {
    const ids = idsFromItems(items);
    if (ids.length === 0) return false;
    return ids.every(id => selectedIds.has(id));
  }
  function isSomeSelectedIn(items) {
    const ids = idsFromItems(items);
    const some = ids.some(id => selectedIds.has(id));
    return some && !areAllSelectedIn(items);
  }
  function toggleItems(items) {
    const ids = idsFromItems(items);
    const all = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (all) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map(id => dispatch(deleteScheduleThunk(id))));
      bulkDisc.onClose();
      setSelectedIds(new Set());
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }

  async function confirmBulkUpdate() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // no conflict gating
    const changes = {};
    const room = String(bulkRoom || '').trim();
    const f2f = String(bulkF2F || (bulkF2FDays.length ? bulkF2FDays.join(',') : '')).trim();
    const facultyName = String(bulkFaculty || '').trim();
    if (!room && !f2f && !facultyName && !bulkFacultyId && !bulkTime && !bulkTerm) { bulkEditDisc.onClose(); return; }
    if (room) changes.room = room;
    if (f2f) { changes.f2fSched = f2f; changes.f2fsched = f2f; }
    if (bulkFacultyId) changes.facultyId = bulkFacultyId;
    else if (facultyName) changes.faculty = facultyName;
    if (bulkTime) changes.time = bulkTime;
    if (bulkTerm) changes.term = bulkTerm;
    // removed conflict checks
    // removed conflict checks
    try {
      await Promise.all(ids.map(id => dispatch(updateScheduleThunk({ id, changes }))));
      bulkEditDisc.onClose();
      setBulkRoom('');
      setBulkF2F('');
      setBulkF2FDays([]);
      setBulkFaculty('');
      setBulkTime('');
      setBulkTerm('');
      setSelectedIds(new Set());
      dispatch(loadAllSchedules());
    } catch (e) {
      // Global toaster handles errors
    }
  }

  // Faculty options loaded via useFaculties hook, filtered by dept

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
        <Heading size="md">Program: {dept}</Heading>
        <HStack spacing={4}>
          {!isPublic && (
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
          )}
          <Button leftIcon={<FiPrinter />} onClick={onPrint} variant="outline" size="sm">Print</Button>
          {!isPublic && (
            <Button as={RouterLink} to={`/share/departments/${encodeURIComponent(encodeShareDepartment(dept))}`} leftIcon={<FiShare2 />} colorScheme="blue" size="sm">Share</Button>
          )}
          {!isPublic && (
            <Button as={RouterLink} to="/views/departments" variant="ghost" colorScheme="brand" leftIcon={<FiArrowLeft />} w="fit-content">Back</Button>
          )}
        </HStack>
      </HStack>
      {loading && <Text color="gray.500">Loading…</Text>}
      {isAdmin && !isPublic && (
        <Collapse in={selectedIds.size > 0} animateOpacity>
          <HStack
            p={3}
            borderWidth="1px"
            borderColor={border}
            rounded="lg"
            bg={useColorModeValue('red.50','rgba(255, 0, 0, 0.08)')}
            spacing={3}
          >
            <Text fontWeight="600">
              {selectedIds.size === totalVisibleCount ? 'All items selected' : `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} selected`}
            </Text>
            <Spacer />
            {viewMode !== 'examination' && (
              <Button size="sm" onClick={bulkEditDisc.onOpen}>Bulk Update</Button>
            )}
            <Button colorScheme="red" size="sm" onClick={bulkDisc.onOpen}>
              {selectedIds.size === totalVisibleCount ? 'Delete All' : `Delete (${selectedIds.size})`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </HStack>
        </Collapse>
      )}
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
                      {isAdmin && (
                        <Th width="1%">
                          <Checkbox
                            isChecked={areAllInBlockSelected(b)}
                            isIndeterminate={isSomeInBlockSelected(b)}
                            onChange={() => toggleBlock(b)}
                            colorScheme="red"
                            aria-label="Select all in block"
                          />
                        </Th>
                      )}
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
                      {isAdmin && !isPublic && <Th textAlign="right">Actions</Th>}
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
                        {isAdmin && (
                          <Td>
                            <Checkbox
                              isChecked={selectedIds.has(c.id)}
                              onChange={() => toggleOne(c.id)}
                              colorScheme="red"
                              aria-label={`Select ${c.code}`}
                            />
                          </Td>
                        )}
                        <Td>{c.semester}</Td>
                        <Td>{c.schedule || '—'}</Td>
                        <Td>{c.code}</Td>
                        <Td maxW={{ base: '220px', md: '420px' }}><Text noOfLines={{ base: 2, md: 1 }}>{c.title}</Text></Td>
                        <Td>{c.unit ?? c.hours ?? '—'}</Td>
                        <Td>{c.room || '—'}</Td>
                        {viewMode !== 'examination' && (
                          <>
                            <Td>{c.day || '�?"'}</Td>
                            <Td>{c.f2fSched || c.f2fsched || (Array.isArray(c.f2fDays) ? c.f2fDays.join(',') : '�?"')}</Td>
                          </>
                        )}
                        <Td>{c.facultyName}</Td>
                      {isAdmin && !isPublic && (
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
      {/* Bulk Update Modal (Room, F2F only) */}
      <Modal isOpen={bulkEditDisc.isOpen} onClose={bulkEditDisc.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Bulk Update Selected</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm">Only fields below will be updated. Leave a field blank to keep current values.</Text>
              <FormControl>
                <FormLabel>Faculty</FormLabel>
                <FacultySelect value={bulkFaculty} onChange={setBulkFaculty} onChangeId={setBulkFacultyId} />
              </FormControl>
              <FormControl>
                <FormLabel>Room</FormLabel>
                <Input value={bulkRoom} onChange={(e) => setBulkRoom(e.target.value)} placeholder="e.g., Rm 201" />
              </FormControl>
              <FormControl>
                <FormLabel>Time</FormLabel>
                <Select value={bulkTime} onChange={(e) => setBulkTime(e.target.value)}>
                  {getTimeOptions().map((t, i) => (
                    <option key={`${t}-${i}`} value={t}>{t || '—'}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Term</FormLabel>
                <Select value={bulkTerm} onChange={(e) => setBulkTerm(e.target.value)}>
                  <option value="">—</option>
                  <option value="1st">1st</option>
                  <option value="2nd">2nd</option>
                  <option value="Sem">Sem</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>F2F Sched</FormLabel>
                <VStack align="stretch" spacing={2}>
                  <DayMultiSelect
                    value={bulkF2FDays}
                    onChange={(days) => { setBulkF2FDays(days); setBulkF2F(days.join(',')); }}
                  />
                  <Input value={bulkF2F} onChange={(e) => setBulkF2F(e.target.value)} placeholder="Optional notes (comma days)" />
                </VStack>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={bulkEditDisc.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={confirmBulkUpdate}>Apply to {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {/* Bulk Delete Confirm */}
      <AlertDialog isOpen={bulkDisc.isOpen} onClose={bulkDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete {selectedIds.size === totalVisibleCount ? 'all' : selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}?</AlertDialogHeader>
            <AlertDialogBody>
              This action cannot be undone.
              {selectedIds.size === totalVisibleCount
                ? ' Are you sure you want to delete all visible schedules in this program?'
                : ' Are you sure you want to delete the selected schedules?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={bulkDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={confirmBulkDelete} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}



