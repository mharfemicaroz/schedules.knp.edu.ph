import React from 'react';
import { Box, Heading, HStack, VStack, Text, Table, Thead, Tbody, Tr, Th, Td, useColorModeValue, Input, IconButton, Button, Badge, Tooltip, chakra, Progress, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon, Spinner, Center } from '@chakra-ui/react';
import { useSelector, useDispatch } from 'react-redux';
import FacultySelect from '../components/FacultySelect';
import { selectAllCourses } from '../store/dataSlice';
import { loadAllSchedules, loadAcademicCalendar } from '../store/dataThunks';
import { FiEdit, FiChevronUp, FiChevronDown } from 'react-icons/fi';
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
  const authUser = useSelector(s => s.auth.user);
  const roleStr = String(authUser?.role || '').toLowerCase();
  const canEditDate = roleStr === 'admin' || roleStr === 'manager';
  const canConfirm = roleStr === 'admin' || roleStr === 'manager' || roleStr === 'registrar';
  const border = useColorModeValue('gray.200','gray.700');
  const bg = useColorModeValue('white','gray.800');

  const [selectedFaculty, setSelectedFaculty] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [tempDate, setTempDate] = React.useState('');
  const [sortBy, setSortBy] = React.useState('code');
  const [sortOrder, setSortOrder] = React.useState('asc'); // 'asc' | 'desc'
  const [expanded, setExpanded] = React.useState([]); // indices of expanded faculty accordions

  React.useEffect(() => {
    if (!acadData) dispatch(loadAcademicCalendar());
    // schedules are loaded in App, but safe to refresh lightweight
    if (!allCourses || allCourses.length === 0) dispatch(loadAllSchedules());
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

  const facultyGroups = React.useMemo(() => {
    const map = new Map();
    rows.forEach((c) => {
      const key = c.facultyName || c.faculty || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
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
      const terms = Array.from(termMap.entries()).map(([term, tItems]) => {
        const s = tItems.reduce((acc, it) => acc + (parseDate(it.gradesSubmitted) ? 1 : 0), 0);
        const tot = tItems.length;
        const pp = tot > 0 ? Math.round((s / tot) * 100) : 0;
        return { term, items: tItems, submitted: s, total: tot, pct: pp };
      }).sort((a,b) => termOrder(a.term) - termOrder(b.term));
      return { faculty, items, submitted, total, pct, terms };
    });
    arr.sort((a,b) => a.faculty.localeCompare(b.faculty));
    return arr;
  }, [rows]);

  // Reset expansion when data set changes (keeps initial rendering light)
  React.useEffect(() => { setExpanded([]); }, [rowsBase]);
  const allIdx = React.useMemo(() => facultyGroups.map((_, i) => i), [facultyGroups]);
  const allExpanded = expanded.length === facultyGroups.length && facultyGroups.length > 0;
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

      <Accordion allowMultiple isLazy index={expanded} onChange={(idx) => setExpanded(Array.isArray(idx) ? idx : [idx])}>
        {facultyGroups.map((g, idx) => (
          <AccordionItem key={g.faculty} border="none" mb={3}>
            <h2>
              <AccordionButton borderWidth="1px" borderColor={border} rounded="md" _expanded={{ bg: useColorModeValue('gray.50','whiteAlpha.100') }} px={{ base: 3, md: 4 }} py={{ base: 3, md: 3 }}>
                <VStack align="stretch" flex={1} spacing={1} pr={2}>
                  <HStack>
                    <Heading size="sm" noOfLines={1}>{g.faculty}</Heading>
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
                                        <Button size="xs" colorScheme="blue" onClick={()=>saveEditedDate(c)}>Save</Button>
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
                                      {!submitted && canConfirm && (
                                        <Button size="xs" colorScheme="green" onClick={()=>confirmSubmit(c)}>Confirm Submit</Button>
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

    </Box>
  );
}
