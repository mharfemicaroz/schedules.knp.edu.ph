import React from 'react';
import { Box, Heading, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Input, IconButton, Button, Badge, Tooltip, chakra, Progress, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Spinner, Center, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Select } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import FacultySelect from '../components/FacultySelect';
import Pagination from '../components/Pagination';
import { selectAllCourses } from '../store/dataSlice';
import { selectAllFaculty } from '../store/facultySlice';
import { loadFacultiesThunk } from '../store/facultyThunks';
import { loadAllSchedules, loadAcademicCalendar } from '../store/dataThunks';
import { FiEdit, FiChevronUp, FiChevronDown, FiX } from 'react-icons/fi';
import { updateScheduleThunk } from '../store/dataThunks';

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
function formatDate(d) {
  if (!d) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function sanitize(s) { return String(s ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '').replace(/\\/g,'').trim(); }
function findGradesDueDate(acadData, termLabel) {
  try {
    const cal = Array.isArray(acadData) ? acadData[0]?.academic_calendar : acadData?.[0]?.academic_calendar;
    if (!cal) return null;
    const isFirst = String(termLabel || '').toLowerCase().includes('1');
    const term = isFirst ? cal.first_semester?.first_term : cal.first_semester?.second_term;
    const acts = Array.isArray(term?.activities) ? term.activities : [];
    const hit = acts.find(a => {
      const ev = sanitize(a.event || '');
      return /submission of grades/i.test(ev) && (isFirst ? /1st/i.test(ev) : /2nd/i.test(ev));
    });
    const raw = hit?.date || hit?.date_range || null;
    if (!raw) return null;
    if (Array.isArray(raw)) return parseDate(raw[raw.length - 1]);
    if (typeof raw === 'string' && /\d+\s*-\s*\d+/.test(raw)) {
      const m = raw.match(/^(\w+)\s+(\d+)\s*-\s*(\d+),\s*(\d{4})$/);
      if (m) return parseDate(`${m[1]} ${m[3]}, ${m[4]}`);
    }
    return parseDate(raw);
  } catch { return null; }
}
function computeStatus(submitted, due) {
  if (!submitted) return null;
  if (!due) return 'ontime';
  const s = new Date(submitted); s.setHours(0,0,0,0);
  const d = new Date(due); d.setHours(23,59,59,999);
  if (s.getTime() < d.getTime() - 24*60*60*1000 + 1) return 'early';
  if (s.getTime() <= d.getTime()) return 'ontime';
  return 'late';
}
const statusColor = (st) => st === 'early' ? 'green' : st === 'ontime' ? 'blue' : st === 'late' ? 'red' : 'gray';
const statusLabel = (st) => st ? (st === 'ontime' ? 'On Time' : (st.charAt(0).toUpperCase() + st.slice(1))) : 'No Submission';
const toDateInput = (d) => { if (!d) return ''; const yy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
const fromDateInput = (s) => s ? new Date(`${s}T00:00:00`) : null;

export default function AdminGradesSubmission() {
  const dispatch = useDispatch();
  const allCourses = useSelector(selectAllCourses);
  const acadData = useSelector(s => s.data.acadData);
  const loadingData = useSelector(s => s.data.loading);
  // Source faculty profiles from Faculty API (not schedule-derived),
  // so department filtering uses faculty.dept as the source of truth
  const facultyList = useSelector(selectAllFaculty);
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const canEditDate = roleStr === 'admin' || roleStr === 'manager';
  const canConfirm = roleStr === 'admin' || roleStr === 'manager' || roleStr === 'registrar';
  const canClear = roleStr === 'admin';
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');

  const [selectedFaculty, setSelectedFaculty] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [tempDate, setTempDate] = React.useState('');
  const [sortBy, setSortBy] = React.useState('code');
  const [sortOrder, setSortOrder] = React.useState('asc'); // 'asc' | 'desc'
  const [expanded, setExpanded] = React.useState([]); // indices of expanded faculty accordions
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [groupSortBy, setGroupSortBy] = React.useState('faculty'); // 'faculty' | 'pct'
  const [groupSortOrder, setGroupSortOrder] = React.useState('asc'); // 'asc' | 'desc'
  const [deptFilter, setDeptFilter] = React.useState('');
  const [empFilter, setEmpFilter] = React.useState('');
  const confirmDisc = useDisclosure();
  const [confirmMode, setConfirmMode] = React.useState(null); // 'submit' | 'save'
  const [pendingCourse, setPendingCourse] = React.useState(null);
  const [pendingDate, setPendingDate] = React.useState('');

  React.useEffect(() => {
    if (!acadData) dispatch(loadAcademicCalendar());
    // schedules are loaded in App, but safe to refresh lightweight
    if (!allCourses || allCourses.length === 0) dispatch(loadAllSchedules());
    // ensure we have up-to-date faculty profiles for dept/employment filters
    dispatch(loadFacultiesThunk({ limit: 100000 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowsBase = React.useMemo(() => {
    const list = Array.isArray(allCourses) ? allCourses : [];
    if (!selectedFaculty) return list;
    const norm = (s) => String(s || '').toLowerCase().trim();
    return list.filter(c => norm(c.facultyName || c.faculty || '') === norm(selectedFaculty));
  }, [allCourses, selectedFaculty]);

  // Smooth large updates without blocking UI
  const rows = React.useDeferredValue(rowsBase);

  // Order terms consistently (1st, 2nd, Sem)
  const termOrder = (label) => {
    const s = String(label || '').toLowerCase();
    if (s.startsWith('1')) return 1;
    if (s.startsWith('2')) return 2;
    if (s.includes('sem')) return 3;
    return 9;
  };

  const profileMap = React.useMemo(() => {
    const map = new Map();
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    (facultyList || []).forEach(f => {
      const nameKey = norm(f.name || f.faculty);
      if (nameKey) map.set(nameKey, f);
      // Also index by ID as string for potential lookups
      if (f.id != null) map.set(String(f.id), f);
    });
    return map;
  }, [facultyList]);

  const facultyGroups = React.useMemo(() => {
    const map = new Map();
    rows.forEach((c) => {
      const key = c.facultyName || c.faculty || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const arr = Array.from(map.entries()).map(([faculty, items]) => {
      const submitted = items.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
      const total = items.length;
      const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
      // Build term groups per faculty here to avoid recomputing in render
      const termMap = new Map();
      items.forEach((it) => {
        const t = String(it.term || 'N/A');
        if (!termMap.has(t)) termMap.set(t, []);
        termMap.get(t).push(it);
      });
      // Pull department and employment from Faculty API profile (dept as source of truth)
      const prof = profileMap.get(norm(faculty));
      const dept = prof?.dept ?? prof?.department ?? '';
      const employment = prof?.employment || '';
      const terms = Array.from(termMap.entries()).map(([term, tItems]) => {
        const s = tItems.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
        const tot = tItems.length;
        const pp = tot > 0 ? Math.round((s / tot) * 100) : 0;
        return { term, items: tItems, submitted: s, total: tot, pct: pp };
      }).sort((a,b) => termOrder(a.term) - termOrder(b.term));
      return { faculty, items, submitted, total, pct, terms, department: dept, employment };
    });
    arr.sort((a,b) => a.faculty.localeCompare(b.faculty));
    return arr;
  }, [rows]);

  // Build filter option lists from Faculty API profiles
  const deptOptions = React.useMemo(() => {
    const set = new Set();
    (facultyList || []).forEach(f => {
      const d = String(f.dept ?? f.department ?? '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [facultyList]);
  const empOptions = React.useMemo(() => {
    const set = new Set();
    (facultyList || []).forEach(f => {
      const e = String(f.employment || '').trim();
      if (e) set.add(e);
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [facultyList]);

  // Reset expansion when data set changes (keeps initial rendering light)
  React.useEffect(() => { setExpanded([]); }, [rowsBase]);
  // Sort faculty groups
  const filteredFacultyGroups = React.useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    return facultyGroups.filter(g => {
      if (deptFilter && norm(g.department) !== norm(deptFilter)) return false;
      if (empFilter && norm(g.employment) !== norm(empFilter)) return false;
      return true;
    });
  }, [facultyGroups, deptFilter, empFilter]);

  const sortedFacultyGroups = React.useMemo(() => {
    const arr = filteredFacultyGroups.slice();
    arr.sort((a, b) => {
      let cmp;
      if (groupSortBy === 'pct') {
        cmp = (a.pct - b.pct);
      } else if (groupSortBy === 'dept') {
        cmp = String(a.department || '').localeCompare(String(b.department || ''));
      } else if (groupSortBy === 'employment') {
        cmp = String(a.employment || '').localeCompare(String(b.employment || ''));
      } else {
        cmp = String(a.faculty || '').localeCompare(String(b.faculty || ''));
      }
      return groupSortOrder === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filteredFacultyGroups, groupSortBy, groupSortOrder]);

  // Pagination of faculty groups to improve performance
  const pageCount = React.useMemo(() => Math.max(1, Math.ceil(sortedFacultyGroups.length / pageSize)), [sortedFacultyGroups.length, pageSize]);
  const pagedFacultyGroups = React.useMemo(() => {
    const p = Math.max(1, Math.min(page, pageCount));
    const start = (p - 1) * pageSize;
    return sortedFacultyGroups.slice(start, start + pageSize);
  }, [sortedFacultyGroups, page, pageSize, pageCount]);
  React.useEffect(() => { setPage(1); }, [rowsBase]);
  React.useEffect(() => { setPage(1); setExpanded([]); }, [groupSortBy, groupSortOrder, deptFilter, empFilter]);
  React.useEffect(() => { setExpanded([]); }, [page, pageSize]);
  const allIdx = React.useMemo(() => pagedFacultyGroups.map((_, i) => i), [pagedFacultyGroups]);
  const allExpanded = expanded.length === pagedFacultyGroups.length && pagedFacultyGroups.length > 0;
  const toggleAll = () => setExpanded(allExpanded ? [] : allIdx);

  const dayIndex = (d) => {
    if (!d) return 99;
    const str = String(d).toLowerCase();
    const map = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 };
    // pick earliest day present
    const tokens = str.split(/[\s,\/]+/).filter(Boolean);
    let best = 99;
    for (const t of tokens) {
      const key = t.slice(0,3);
      if (key in map) best = Math.min(best, map[key]);
    }
    return best;
  };
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const statusOrder = { early: 0, ontime: 1, late: 2 };
  const valueForSort = (c, key) => {
    switch (key) {
      case 'code': return String(c.code || c.courseName || '').toLowerCase();
      case 'title': return String(c.title || c.courseTitle || '').toLowerCase();
      case 'section': return String(c.section || c.blockCode || '').toLowerCase();
      case 'time': {
        if (Number.isFinite(c.timeStartMinutes)) return c.timeStartMinutes;
        const m = String(c.scheduleKey || '').match(/^(\d+)-(\d+)$/);
        if (m) return parseInt(m[1], 10);
        return String(c.schedule || c.time || '').toLowerCase();
      }
      case 'day': return dayIndex(c.day);
      case 'gradesSubmitted': {
        const dt = parseDate(c.gradesSubmitted);
        return dt ? dt.getTime() : -Infinity;
      }
      case 'gradesStatus': {
        const due = findGradesDueDate(acadData, c.term);
        const submitted = parseDate(c.gradesSubmitted);
        const eff = c.gradesStatus || computeStatus(submitted, due) || null;
        return eff ? statusOrder[eff] ?? 99 : 99;
      }
      default: return '';
    }
  };
  const sortItems = React.useCallback((items) => {
    if (!Array.isArray(items) || !items.length) return items || [];
    const list = items.slice();
    list.sort((a, b) => {
      const va = valueForSort(a, sortBy);
      const vb = valueForSort(b, sortBy);
      const r = cmp(va, vb);
      return sortOrder === 'asc' ? r : -r;
    });
    return list;
  }, [sortBy, sortOrder, acadData]);

  // Confirmation helpers
  const askConfirmSubmit = (c) => {
    setPendingCourse(c);
    setPendingDate(toDateInput(new Date()));
    setConfirmMode('submit');
    confirmDisc.onOpen();
  };
  const askConfirmSaveDate = (c) => {
    setPendingCourse(c);
    setPendingDate(tempDate);
    setConfirmMode('save');
    confirmDisc.onOpen();
  };
  const askConfirmClear = (c) => {
    setPendingCourse(c);
    setPendingDate('');
    setConfirmMode('clear');
    confirmDisc.onOpen();
  };
  const handleConfirm = async () => {
    const c = pendingCourse;
    if (!c) { confirmDisc.onClose(); return; }
    try {
      if (confirmMode === 'submit') {
        const now = new Date();
        const due = findGradesDueDate(acadData, c.term);
        const status = computeStatus(now, due);
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: now.toISOString(), gradesStatus: status } }));
      } else if (confirmMode === 'save') {
        const d = fromDateInput(pendingDate);
        const due = findGradesDueDate(acadData, c.term);
        const status = computeStatus(d, due);
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: d ? d.toISOString() : null, gradesStatus: d ? status : null } }));
        setEditingId(null);
        setTempDate('');
      } else if (confirmMode === 'clear') {
        await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: null, gradesStatus: null } }));
      }
      dispatch(loadAllSchedules());
    } finally {
      confirmDisc.onClose();
      setPendingCourse(null);
      setConfirmMode(null);
    }
  };

  const onSort = (key) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('asc');
      return key;
    });
  };

  const SortableTh = ({ id, children }) => {
    const active = sortBy === id;
    const color = active ? 'brand.500' : useColorModeValue('gray.600','gray.300');
    return (
      <Th cursor="pointer" onClick={() => onSort(id)} userSelect="none">
        <HStack spacing={1}>
          <chakra.span color={color} fontWeight={active ? '800' : '600'}>{children}</chakra.span>
          {active && (sortOrder === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
        </HStack>
      </Th>
    );
  };

  const confirmSubmit = async (c) => {
    const now = new Date(); const due = findGradesDueDate(acadData, c.term); const status = computeStatus(now, due);
    await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: now.toISOString(), gradesStatus: status } }));
    dispatch(loadAllSchedules());
  };
  const saveEditedDate = async (c) => {
    const d = fromDateInput(tempDate); const due = findGradesDueDate(acadData, c.term); const status = computeStatus(d, due);
    await dispatch(updateScheduleThunk({ id: c.id, changes: { gradesSubmitted: d ? d.toISOString() : null, gradesStatus: d ? status : null } }));
    setEditingId(null); setTempDate('');
    dispatch(loadAllSchedules());
  };

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Grades Submission</Heading>
        <HStack spacing={2}>
          <Box minW={{ base: '220px', md: '360px' }}>
            <FacultySelect value={selectedFaculty} onChange={setSelectedFaculty} allowClear placeholder="Filter by faculty" />
          </Box>
          <HStack spacing={1}>
            <Select size="sm" placeholder="Dept" value={deptFilter} onChange={(e)=>setDeptFilter(e.target.value)} maxW="160px">
              {deptOptions.map(d => (<option key={d} value={d}>{d}</option>))}
            </Select>
            <Select size="sm" placeholder="Employment" value={empFilter} onChange={(e)=>setEmpFilter(e.target.value)} maxW="160px">
              {empOptions.map(v => (<option key={v} value={v}>{v}</option>))}
            </Select>
            <Select size="sm" value={groupSortBy} onChange={(e)=>setGroupSortBy(e.target.value)} maxW="160px">
              <option value="faculty">Sort: Faculty Name</option>
              <option value="pct">Sort: Percentage</option>
              <option value="dept">Sort: Dept</option>
              <option value="employment">Sort: Employment</option>
            </Select>
            <Select size="sm" value={groupSortOrder} onChange={(e)=>setGroupSortOrder(e.target.value)} maxW="120px">
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </Select>
          </HStack>
          <Button size="sm" variant="outline" onClick={toggleAll}>{allExpanded ? 'Collapse All' : 'Expand All'}</Button>
        </HStack>
      </HStack>

      {/* Faculty-level summary with progress + collapsible schedules */}
      {loadingData && (
        <Center py={10}>
          <Spinner mr={3} />
          <Text color={useColorModeValue('gray.600','gray.300')}>Loading grades submission…</Text>
        </Center>
      )}



      <Accordion allowMultiple index={expanded} onChange={(idx) => setExpanded(Array.isArray(idx) ? idx : [idx])}>
        {pagedFacultyGroups.map((g, idx) => (
          <AccordionItem key={g.faculty} border="none" mb={3}>
            <h2>
              <AccordionButton borderWidth="1px" borderColor={border} rounded="md" _expanded={{ bg: useColorModeValue('gray.50','whiteAlpha.100') }} px={{ base: 3, md: 4 }} py={{ base: 3, md: 3 }}>
                <VStack align="stretch" flex={1} spacing={1} pr={2}>
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <Heading size="sm" noOfLines={1}>{g.faculty}</Heading>
                    {g.department && (<Badge colorScheme="blue" variant="subtle">{g.department}</Badge>)}
                    {g.employment && (<Badge colorScheme="green" variant="subtle">{g.employment}</Badge>)}
                    <Badge colorScheme={g.pct >= 90 ? 'green' : g.pct >= 70 ? 'blue' : g.pct >= 40 ? 'orange' : 'red'} variant="subtle">{g.submitted}/{g.total} ({g.pct}%)</Badge>
                  </HStack>
                  <Progress value={g.pct} size="sm" rounded="md" colorScheme={g.pct >= 90 ? 'green' : g.pct >= 70 ? 'blue' : g.pct >= 40 ? 'orange' : 'red'} />
                </VStack>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              {(g.terms || []).map((tg) => (
                  <Box key={tg.term} mb={4}>
                    <HStack justify="space-between" px={2} mb={2}>
                      <HStack>
                        <Heading size="sm">Term: {tg.term}</Heading>
                        <Badge colorScheme={tg.pct >= 90 ? 'green' : tg.pct >= 70 ? 'blue' : tg.pct >= 40 ? 'orange' : 'red'} variant="subtle">{tg.submitted}/{tg.total} ({tg.pct}%)</Badge>
                      </HStack>
                    </HStack>
                    <Progress value={tg.pct} size="xs" rounded="md" mb={2} colorScheme={tg.pct >= 90 ? 'green' : tg.pct >= 70 ? 'blue' : tg.pct >= 40 ? 'orange' : 'red'} />
                    <Box borderWidth="1px" borderColor={border} rounded="xl" bg={bg} overflowX="auto">
                      <Table size={{ base: 'sm', md: 'md' }}>
                        <Thead>
                          <Tr>
                            <SortableTh id="code">Code</SortableTh>
                            <SortableTh id="title">Title</SortableTh>
                            <SortableTh id="section">Section</SortableTh>
                            <SortableTh id="time">Time</SortableTh>
                            <SortableTh id="day">Day</SortableTh>
                            <SortableTh id="gradesSubmitted">Grade Submitted</SortableTh>
                            <SortableTh id="gradesStatus">Grade Status</SortableTh>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {sortItems(tg.items).map((c) => {
                            const submitted = parseDate(c.gradesSubmitted);
                            const due = findGradesDueDate(acadData, c.term);
                            const computed = computeStatus(submitted, due);
                            const effective = c.gradesStatus || computed || null;
                            return (
                              <Tr key={c.id}>
                                <Td>{c.code || c.courseName || '—'}</Td>
                                <Td>
                                  <Text maxW={{ base: 'unset', md: '380px' }} noOfLines={{ base: 2, md: 1 }} whiteSpace="normal" wordBreak="break-word">{c.title || c.courseTitle || '—'}</Text>
                                </Td>
                                <Td>{c.section || c.blockCode || '—'}</Td>
                                <Td>{c.schedule || c.time || '—'}</Td>
                                <Td>{c.day || '—'}</Td>
                                <Td>
                                  {editingId === c.id ? (
                                    canEditDate ? (
                                      <HStack>
                                        <Input type="date" size="sm" value={tempDate} onChange={(e)=>setTempDate(e.target.value)} />
                                  <Button size="xs" colorScheme="blue" onClick={()=>askConfirmSaveDate(c)}>Save</Button>
                                        <Button size="xs" variant="ghost" onClick={()=>{ setEditingId(null); setTempDate(''); }}>Cancel</Button>
                                      </HStack>
                                    ) : (
                                      <Text>{submitted ? formatDate(submitted) : '—'}</Text>
                                    )
                                  ) : (
                                    <HStack>
                                      <Text>{submitted ? formatDate(submitted) : '—'}</Text>
                                      {canEditDate && (
                                        <Tooltip label={submitted ? 'Edit submitted date' : 'Set submitted date'}>
                                          <IconButton aria-label="Edit Grade Date" icon={<FiEdit />} size="xs" variant="ghost" onClick={()=>{ setEditingId(c.id); setTempDate(toDateInput(submitted || new Date())); }} />
                                        </Tooltip>
                                      )}
                                      {canClear && submitted && (
                                        <Tooltip label="Clear submitted date">
                                          <IconButton aria-label="Clear" icon={<FiX />} size="xs" variant="ghost" colorScheme="red" onClick={()=>askConfirmClear(c)} />
                                        </Tooltip>
                                      )}
                                      {!submitted && canConfirm && (
                                         <Button size="xs" colorScheme="green" onClick={()=>askConfirmSubmit(c)}>Confirm Submit</Button>
                                      )}
                                    </HStack>
                                  )}
                                </Td>
                                <Td>
                                  <Badge colorScheme={statusColor(effective)} variant="subtle">{statusLabel(effective)}</Badge>
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </Box>
                  </Box>
                ))}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Bottom pagination */}
      <Box mt={3}>
        <Pagination page={page} pageCount={pageCount} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
      </Box>

      {/* Confirmation Dialog */}
      <AlertDialog isOpen={confirmDisc.isOpen} onClose={confirmDisc.onClose} leastDestructiveRef={undefined} isCentered>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>
            {confirmMode === 'submit' ? 'Confirm Grade Submission' : confirmMode === 'save' ? 'Confirm Save Date' : 'Clear Submitted Date'}
          </AlertDialogHeader>
          <AlertDialogBody>
            {confirmMode === 'submit' ? (
              <VStack align="stretch" spacing={1}>
                <Text>Proceed to mark this schedule as submitted?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={useColorModeValue('gray.600','gray.300')}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            ) : confirmMode === 'save' ? (
              <VStack align="stretch" spacing={1}>
                <Text>Save the selected submitted date for this schedule?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={useColorModeValue('gray.600','gray.300')}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            ) : (
              <VStack align="stretch" spacing={1}>
                <Text>Remove the submitted date and status for this schedule?</Text>
                {pendingCourse && (
                  <Text fontSize="sm" color={useColorModeValue('gray.600','gray.300')}>
                    {(pendingCourse.code || pendingCourse.courseName || '') + ' — ' + (pendingCourse.title || pendingCourse.courseTitle || '')}
                  </Text>
                )}
              </VStack>
            )}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={confirmDisc.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleConfirm} ml={3}>Confirm</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Box>
  );
}
