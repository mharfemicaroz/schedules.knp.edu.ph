import React from 'react';
import { Box, Heading, HStack, VStack, Button, Input, FormControl, FormLabel, SimpleGrid, Table, Thead, Tr, Th, Tbody, Td, IconButton, useColorModeValue, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Text, Select, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Tag, TagLabel, Divider, Tabs, TabList, Tab, TabPanels, TabPanel, Alert, AlertIcon, Tooltip, Badge } from '@chakra-ui/react';
import api from '../services/apiService';
import { FiSave, FiRefreshCw, FiPlus, FiTrash, FiEdit } from 'react-icons/fi';

function ensureCalendarShape(cal, sy) {
  const base = { school_year: sy, first_semester: { first_term: { start: '', end: '', activities: [] }, second_term: { start: '', end: '', activities: [] } }, second_semester: { first_term: { start: '', end: '', activities: [] }, second_term: { start: '', end: '', activities: [] } } };
  try {
    const out = { ...base, ...(cal || {}) };
    out.first_semester = { ...base.first_semester, ...(cal?.first_semester || {}) };
    out.second_semester = { ...base.second_semester, ...(cal?.second_semester || {}) };
    // add summer term support
    out.summer = { term: { start: '', end: '', activities: [] }, ...(cal?.summer || {}) };
    const fixTerm = (t) => ({ start: t?.start || '', end: t?.end || '', activities: Array.isArray(t?.activities) ? t.activities : [] });
    out.first_semester.first_term = fixTerm(out.first_semester.first_term);
    out.first_semester.second_term = fixTerm(out.first_semester.second_term);
    out.second_semester.first_term = fixTerm(out.second_semester.first_term);
    out.second_semester.second_term = fixTerm(out.second_semester.second_term);
    out.summer.term = fixTerm(out.summer.term);
    return out;
  } catch { return base; }
}

// Helpers: consistent date parsing and formatting
function toISODate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDisplay(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMaybeRange(v) {
  if (!v) return '';
  if (typeof v === 'string' && v.includes(' - ')) {
    const [a, b] = v.split(' - ').map(s => s.trim());
    return `${fmtDisplay(a)} - ${fmtDisplay(b)}`;
  }
  if (Array.isArray(v)) return v.map(fmtDisplay).join(', ');
  return fmtDisplay(v);
}

function ActivityModal({ isOpen, onClose, onSave, initial }) {
  const [event, setEvent] = React.useState('');
  const [dateMode, setDateMode] = React.useState('single'); // single | multiple | range
  const [d1, setD1] = React.useState('');
  const [d2, setD2] = React.useState('');
  const [multi, setMulti] = React.useState(['']);
  const [mode, setMode] = React.useState('');
  const [etype, setEtype] = React.useState('');
  React.useEffect(() => {
    if (!initial) { setEvent(''); setDateMode('single'); setD1(''); setD2(''); setMulti(['']); setMode(''); setEtype(''); return; }
    setEvent(initial.event || '');
    setMode(initial.mode || '');
    setEtype(initial.type || '');
    if (initial.date_range) { setDateMode('range'); setD1(''); setD2(''); }
    else if (Array.isArray(initial.date)) { setDateMode('multiple'); setMulti(initial.date.map(d => d || '')); }
    else { setDateMode('single'); setD1(initial.date || ''); }
  }, [initial, isOpen]);
  const addMulti = () => setMulti(arr => [...arr, '']);
  const setMultiAt = (i, v) => setMulti(arr => arr.map((x, idx) => idx === i ? v : x));
  const delMultiAt = (i) => setMulti(arr => arr.filter((_, idx) => idx !== i));
  const submit = () => {
    const payload = { event, ...(mode ? { mode } : {}), ...(etype ? { type: etype } : {}) };
    if (dateMode === 'single') payload.date = d1 || '';
    if (dateMode === 'multiple') payload.date = multi.filter(Boolean);
    if (dateMode === 'range') payload.date_range = `${d1} - ${d2}`;
    onSave?.(payload);
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{initial ? 'Edit Activity' : 'Add Activity'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <FormControl isRequired>
              <FormLabel>Event</FormLabel>
              <Input value={event} onChange={(e)=>setEvent(e.target.value)} placeholder="Midterm Examination" />
            </FormControl>
            <HStack spacing={3} align="start">
              <FormControl>
                <FormLabel>Date Mode</FormLabel>
                <Select value={dateMode} onChange={(e)=>setDateMode(e.target.value)}>
                  <option value="single">Single Date</option>
                  <option value="multiple">Multiple Dates</option>
                  <option value="range">Date Range</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Mode</FormLabel>
                <Select value={mode} onChange={(e)=>setMode(e.target.value)}>
                  <option value="">(none)</option>
                  <option value="asynchronous">Asynchronous</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select value={etype} onChange={(e)=>setEtype(e.target.value)}>
                  <option value="">(none)</option>
                  <option value="external">External</option>
                  <option value="internal">Internal</option>
                </Select>
              </FormControl>
            </HStack>
            {dateMode === 'single' && (
              <FormControl isRequired>
                <FormLabel>Date</FormLabel>
                <Input type="date" value={d1} onChange={(e)=>setD1(e.target.value)} />
              </FormControl>
            )}
            {dateMode === 'range' && (
              <HStack>
                <FormControl isRequired>
                  <FormLabel>Start</FormLabel>
                  <Input type="date" value={d1} onChange={(e)=>setD1(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>End</FormLabel>
                  <Input type="date" value={d2} onChange={(e)=>setD2(e.target.value)} />
                </FormControl>
              </HStack>
            )}
            {dateMode === 'multiple' && (
              <VStack align="stretch" spacing={2}>
                {multi.map((m, i) => (
                  <HStack key={i}>
                    <Input type="date" value={m} onChange={(e)=>setMultiAt(i, e.target.value)} />
                    <IconButton aria-label="Remove" icon={<FiTrash />} size="sm" onClick={()=>delMultiAt(i)} />
                  </HStack>
                ))}
                <Button leftIcon={<FiPlus />} onClick={addMulti} size="sm" alignSelf="start">Add Date</Button>
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={submit}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function TermEditor({ title, term, onChange }) {
  const addActivityDisc = useDisclosure();
  const editActivityDisc = useDisclosure();
  const [editing, setEditing] = React.useState(null);
  const [editIndex, setEditIndex] = React.useState(-1);
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const doAdd = (payload) => { onChange({ ...term, activities: [...(term.activities||[]), payload] }); addActivityDisc.onClose(); };
  const doEdit = (payload) => { const list = [...(term.activities||[])]; list[editIndex] = payload; onChange({ ...term, activities: list }); editActivityDisc.onClose(); setEditing(null); setEditIndex(-1); };
  const del = (idx) => { const list = (term.activities||[]).filter((_, i) => i !== idx); onChange({ ...term, activities: list }); };
  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Heading size="sm">{title}</Heading>
        <HStack>
          <Button leftIcon={<FiPlus />} size="sm" onClick={addActivityDisc.onOpen}>Add Activity</Button>
        </HStack>
      </HStack>
      <HStack spacing={3} mb={3}>
        <FormControl maxW={{ base: '50%', md: '240px' }}>
          <FormLabel>Start</FormLabel>
          <Input type="date" value={term.start || ''} onChange={(e)=>onChange({ ...term, start: e.target.value })} />
        </FormControl>
        <FormControl maxW={{ base: '50%', md: '240px' }}>
          <FormLabel>End</FormLabel>
          <Input type="date" value={term.end || ''} onChange={(e)=>onChange({ ...term, end: e.target.value })} />
        </FormControl>
      </HStack>

      {/* Mobile cards for activities */}
      <Box display={{ base: 'block', md: 'none' }}>
        <VStack align="stretch" spacing={3}>
          {(term.activities || []).map((a, idx) => (
            <Box key={idx} borderWidth="1px" borderColor={border} rounded="xl" bg={panelBg} p={4}>
              <VStack align="stretch" spacing={3}>
                <Text fontWeight="700" noOfLines={2}>{a.event}</Text>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color={muted}>Date / Range</Text>
                    <Text>{a.date_range ? fmtMaybeRange(a.date_range) : Array.isArray(a.date) ? fmtMaybeRange(a.date) : fmtMaybeRange(a.date)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Mode</Text>
                    <Text>{a.mode || '-'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={muted}>Type</Text>
                    <Text>{a.type || '-'}</Text>
                  </Box>
                </SimpleGrid>
                <HStack justify="flex-end" spacing={2}>
                  <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="outline" onClick={()=>{ setEditing(a); setEditIndex(idx); editActivityDisc.onOpen(); }} />
                  <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="outline" colorScheme="red" onClick={()=>del(idx)} />
                </HStack>
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      <Table size="sm" display={{ base: 'none', md: 'table' }}>
        <Thead>
          <Tr>
            <Th>Event</Th>
            <Th>Date / Range</Th>
            <Th>Mode</Th>
            <Th>Type</Th>
            <Th textAlign="right">Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {(term.activities || []).map((a, idx) => (
            <Tr key={idx}>
              <Td><Text fontWeight="600">{a.event}</Text></Td>
              <Td>
                {a.date_range ? fmtMaybeRange(a.date_range) : Array.isArray(a.date) ? fmtMaybeRange(a.date) : fmtMaybeRange(a.date)}
              </Td>
              <Td>{a.mode || '-'}</Td>
              <Td>{a.type || '-'}</Td>
              <Td textAlign="right">
                <HStack justify="end" spacing={1}>
                  <IconButton aria-label="Edit" icon={<FiEdit />} size="sm" variant="ghost" onClick={()=>{ setEditing(a); setEditIndex(idx); editActivityDisc.onOpen(); }} />
                  <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" variant="ghost" colorScheme="red" onClick={()=>del(idx)} />
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <ActivityModal isOpen={addActivityDisc.isOpen} onClose={addActivityDisc.onClose} onSave={doAdd} />
      <ActivityModal isOpen={editActivityDisc.isOpen} onClose={()=>{ editActivityDisc.onClose(); setEditing(null); setEditIndex(-1); }} onSave={doEdit} initial={editing} />
    </Box>
  );
}

export default function AdminAcademicCalendar() {
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');
  const muted = useColorModeValue('gray.600','gray.300');
  const [schoolYear, setSchoolYear] = React.useState('2025-2026');
  const [cal, setCal] = React.useState(ensureCalendarShape(null, '2025-2026'));
  const [holYear, setHolYear] = React.useState(new Date().getFullYear());
  const [holidays, setHolidays] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const delDisc = useDisclosure();
  const cancelRef = React.useRef();
  const todayISO = React.useMemo(() => toISODate(new Date()), []);

  const loadCalendar = async () => {
    const res = await api.getAcademicCalendar({ school_year: schoolYear });
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    const payload = list[0]?.academic_calendar || { school_year: schoolYear };
    setCal(ensureCalendarShape(payload, schoolYear));
  };
  const loadHolidays = async () => {
    const arr = await api.getHolidays(holYear);
    setHolidays(Array.isArray(arr) ? arr : []);
  };

  React.useEffect(() => { loadCalendar(); }, [schoolYear]);
  React.useEffect(() => { loadHolidays(); }, [holYear]);

  const saveCalendar = async () => {
    try {
      setBusy(true);
      await api.saveAcademicCalendar({ school_year: schoolYear, content: cal });
      await loadCalendar();
    } finally { setBusy(false); }
  };

  // Add a local holiday row; persist with Save
  const addHoliday = () => {
    const baseDate = `${holYear}-${String((new Date()).getMonth() + 1).padStart(2, '0')}-${String((new Date()).getDate()).padStart(2, '0')}`;
    const item = { year: holYear, date: toISODate(baseDate) || `${holYear}-01-01`, name: '', type: '' };
    setHolidays((list) => [...list, item]);
  };
  const saveHolidays = async () => {
    await api.replaceHolidays(holYear, holidays);
    await loadHolidays();
  };
  const deleteYear = async () => {
    await api.deleteHolidayYear(holYear);
    delDisc.onClose();
    await loadHolidays();
  };

  const setHoliday = (idx, key, val) => {
    setHolidays((list) => list.map((h, i) => {
      if (i !== idx) return h;
      if (key === 'date') {
        const normalized = toISODate(val);
        return { ...h, date: normalized };
      }
      return { ...h, [key]: val };
    }));
  };

  const invalids = React.useMemo(() => {
    const errs = [];
    holidays.forEach((h, i) => {
      if (!h.date || !toISODate(h.date)) errs.push(`Row ${i + 1}: invalid date`);
      if (!h.name || !String(h.name).trim()) errs.push(`Row ${i + 1}: name is required`);
      // keep informational badge if date year differs
    });
    return errs;
  }, [holidays]);

  return (
    <Box px={{ base: 2, md: 4 }} py={4}>
      <Heading size="md" mb={1}>Academic Calendar Settings</Heading>
      <Text color={muted} mb={4}>Organize semester terms, activities, and manage public holidays with consistent date formatting.</Text>
      <Tabs colorScheme="brand" variant="enclosed-colored">
        <TabList>
          <Tab>Calendar</Tab>
          <Tab>Holidays</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} p={4}>
              <HStack justify="space-between" mb={3}>
                <Heading size="sm">Calendar Editor</Heading>
                <HStack>
                  <Button leftIcon={<FiRefreshCw />} onClick={loadCalendar} variant="outline" size="sm">Reload</Button>
                  <Button leftIcon={<FiSave />} colorScheme="blue" onClick={saveCalendar} isLoading={busy} size="sm">Save</Button>
                </HStack>
              </HStack>
              <HStack mb={3} spacing={3}>
                <FormControl maxW={{ base: '100%', md: '220px' }}>
                  <FormLabel>School Year</FormLabel>
                  <Input value={schoolYear} onChange={(e)=>setSchoolYear(e.target.value)} placeholder="2025-2026" />
                </FormControl>
                <Tag variant="subtle" colorScheme="brand" alignSelf="end"><TagLabel>{cal?.school_year || schoolYear}</TagLabel></Tag>
              </HStack>
              <VStack align="stretch" spacing={6}>
                <Box>
                  <Heading size="sm" mb={2}>First Semester</Heading>
                  <TermEditor title="First Term" term={cal.first_semester.first_term} onChange={(t)=>setCal(c=>({ ...c, first_semester: { ...c.first_semester, first_term: t } }))} />
                  <Divider my={3} />
                  <TermEditor title="Second Term" term={cal.first_semester.second_term} onChange={(t)=>setCal(c=>({ ...c, first_semester: { ...c.first_semester, second_term: t } }))} />
                </Box>
                <Box>
                  <Heading size="sm" mb={2}>Second Semester</Heading>
                  <TermEditor title="First Term" term={cal.second_semester.first_term} onChange={(t)=>setCal(c=>({ ...c, second_semester: { ...c.second_semester, first_term: t } }))} />
                  <Divider my={3} />
                  <TermEditor title="Second Term" term={cal.second_semester.second_term} onChange={(t)=>setCal(c=>({ ...c, second_semester: { ...c.second_semester, second_term: t } }))} />
                </Box>
                <Box>
                  <Heading size="sm" mb={2}>Summer</Heading>
                  <TermEditor title="Summer Term" term={cal.summer.term} onChange={(t)=>setCal(c=>({ ...c, summer: { ...c.summer, term: t } }))} />
                </Box>
              </VStack>
            </Box>
          </TabPanel>
          <TabPanel px={0}>
            <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} p={4}>
              <HStack justify="space-between" mb={3}>
                <Heading size="sm">Holidays</Heading>
                <HStack>
                  <Button leftIcon={<FiRefreshCw />} onClick={loadHolidays} variant="outline" size="sm">Reload</Button>
                  <Tooltip label={invalids.length ? 'Fix errors before saving' : 'Save holidays for selected year'}>
                    <Button leftIcon={<FiSave />} onClick={saveHolidays} colorScheme="blue" size="sm" isDisabled={invalids.length > 0}>Save</Button>
                  </Tooltip>
                  <Button leftIcon={<FiTrash />} onClick={delDisc.onOpen} colorScheme="red" variant="outline" size="sm">Clear Year</Button>
                </HStack>
              </HStack>
              {invalids.length > 0 && (
                <Alert status="warning" mb={3} rounded="md">
                  <AlertIcon />
                  Some entries have issues. Please review fields below.
                </Alert>
              )}
              <HStack mb={3} spacing={3} align="end">
                <FormControl maxW={{ base: '100%', md: '220px' }}>
                  <FormLabel>Year</FormLabel>
                  <Input type="number" value={holYear} onChange={(e)=>setHolYear(parseInt(e.target.value||new Date().getFullYear(),10))} />
                </FormControl>
                <Button leftIcon={<FiPlus />} onClick={addHoliday} size="sm" colorScheme="brand">Add Holiday</Button>
              </HStack>
              {/* Mobile cards for holidays */}
              <Box display={{ base: 'block', md: 'none' }}>
                <VStack align="stretch" spacing={3}>
                  {holidays.map((h, idx) => (
                    <Box key={`${h.date}-${idx}`} borderWidth="1px" borderColor={border} rounded="xl" bg={bg} p={4}>
                      <VStack align="stretch" spacing={3}>
                        <SimpleGrid columns={1} spacing={3}>
                          <Box>
                            <Text fontSize="xs" color={muted}>Date</Text>
                            <Input type="date" value={h.date || ''} onChange={(e)=>setHoliday(idx, 'date', e.target.value)} />
                          </Box>
                          <Box>
                            <Text fontSize="xs" color={muted}>Name</Text>
                            <Input value={h.name || ''} onChange={(e)=>setHoliday(idx, 'name', e.target.value)} placeholder="New Year's Day" />
                          </Box>
                          <Box>
                            <Text fontSize="xs" color={muted}>Type</Text>
                            <Select value={h.type || ''} onChange={(e)=>setHoliday(idx, 'type', e.target.value)}>
                              <option value="">(none)</option>
                              <option>Regular Holiday</option>
                              <option>Special Non-Working Holiday</option>
                              <option>Special Working Holiday</option>
                            </Select>
                          </Box>
                        </SimpleGrid>
                        <HStack justify="space-between" align="center">
                          <Badge colorScheme={(h.date || '').startsWith(String(holYear)) ? 'green' : 'orange'}>{(h.date || '').startsWith(String(holYear)) ? 'Year OK' : 'Date not in selected year'}</Badge>
                          <IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="outline" onClick={()=>setHolidays(list=>list.filter((_,i)=>i!==idx))} />
                        </HStack>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              </Box>

              <Box overflowX="auto" display={{ base: 'none', md: 'block' }}>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Date</Th>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {holidays.map((h, idx) => (
                      <Tr key={`${h.date}-${idx}`}>
                        <Td>
                          <HStack>
                            <Input type="date" value={h.date || ''} onChange={(e)=>setHoliday(idx, 'date', e.target.value)} />
                            <Badge colorScheme={(h.date || '').startsWith(String(holYear)) ? 'green' : 'orange'} display={{ base: 'none', lg: 'inline-flex' }}>
                              {(h.date || '').startsWith(String(holYear)) ? 'Year OK' : 'Different year'}
                            </Badge>
                          </HStack>
                        </Td>
                        <Td><Input value={h.name || ''} onChange={(e)=>setHoliday(idx, 'name', e.target.value)} placeholder="New Year's Day" /></Td>
                        <Td>
                          <Select value={h.type || ''} onChange={(e)=>setHoliday(idx, 'type', e.target.value)}>
                            <option value="">(none)</option>
                            <option>Regular Holiday</option>
                            <option>Special Non-Working Holiday</option>
                            <option>Special Working Holiday</option>
                          </Select>
                        </Td>
                        <Td textAlign="right"><IconButton aria-label="Delete" icon={<FiTrash />} size="sm" colorScheme="red" variant="ghost" onClick={()=>setHolidays(list=>list.filter((_,i)=>i!==idx))} /></Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={cancelRef} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Clear holidays for {holYear}?</AlertDialogHeader>
            <AlertDialogBody>
              This will delete all holiday entries for the selected year.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={delDisc.onClose} variant="ghost">Cancel</Button>
              <Button colorScheme="red" onClick={deleteYear} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
