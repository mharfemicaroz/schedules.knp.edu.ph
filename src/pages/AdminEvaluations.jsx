import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Select,
  Button,
  Badge,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  TagLabel,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Divider,
  Skeleton,
} from '@chakra-ui/react';
import { FiBarChart2, FiEye } from 'react-icons/fi';
import apiService from '../services/apiService';
import { printEvaluationSummary } from '../utils/printEvaluation';
import { useDispatch, useSelector } from 'react-redux';
import { loadProspectusThunk } from '../store/prospectusThunks';
import { selectProspectusFilterOptions, selectAllProspectus } from '../store/prospectusSlice';
import { selectAllCourses } from '../store/dataSlice';
import { selectSettings } from '../store/settingsSlice';

const QUESTIONS = [
  'Lessons are presented in a clear, structured, and organized manner.',
  'Concepts and ideas are explained in an understandable and meaningful way.',
  'Feedback on activities and assessments is timely and helpful for improvement.',
  'Class discussions and learning activities reflect strong subject-matter expertise.',
  'Teaching methods used in class effectively support student engagement.',
  'Opportunities to ask questions and express ideas are openly encouraged.',
  'Students are treated with fairness, respect, and professionalism at all times.',
  'Assessments and grading practices are aligned with the learning objectives.',
  'Support and assistance outside regular class hours are accessible when needed.',
  'The overall classroom atmosphere promotes a positive and supportive learning environment.',
];

export default function AdminEvaluations() {
  const panel = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');
  const feedbackBg = useColorModeValue('gray.50','gray.700');

  const dispatch = useDispatch();
  const [view, setView] = React.useState('course'); // 'course' | 'faculty' | 'student'
  const [filters, setFilters] = React.useState({ programcode: '', coursecode: '', faculty: '', term: '', student: '' });
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]);

  const summaryDisc = useDisclosure();
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summaryTitle, setSummaryTitle] = React.useState('');
  const [summary, setSummary] = React.useState(null);
  const [summaryMode, setSummaryMode] = React.useState('schedule'); // schedule|faculty
  const [summaryId, setSummaryId] = React.useState(null);
  const [summaryCtx, setSummaryCtx] = React.useState({});
  const settings = useSelector(selectSettings);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const search = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) search.set(k, v); });
      const path = view === 'course'
        ? '/evaluations/aggregate/schedule'
        : view === 'faculty'
        ? '/evaluations/aggregate/faculty'
        : '/evaluations/aggregate/student';
      const data = await apiService.requestAbs(`${path}${search.toString() ? `?${search.toString()}` : ''}`, { method: 'GET' });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view, filters]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Load prospectus for select options (programs, courses)
  const opts = useSelector(selectProspectusFilterOptions);
  const allPros = useSelector(selectAllProspectus);
  const allCourses = useSelector(selectAllCourses);
  React.useEffect(() => { dispatch(loadProspectusThunk({})); }, [dispatch]);

  const programOptions = React.useMemo(() => (opts?.programs || []).map(v => String(v)).filter(Boolean), [opts]);
  const courseOptions = React.useMemo(() => {
    const list = (allPros || []).filter(p => !filters.programcode || String(p.programcode || p.program || '') === filters.programcode)
      .map(p => String(p.course_name || p.courseName || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [allPros, filters.programcode]);
  const facultyOptions = React.useMemo(() => {
    const list = (allCourses || []).map(c => String(c.facultyName || c.instructor || '').trim()).filter(Boolean);
    return Array.from(new Set(list)).sort((a,b)=>a.localeCompare(b));
  }, [allCourses]);

  const termOptions = [
    { value: '', label: 'All terms' },
    { value: '1st', label: '1st' },
    { value: '2nd', label: '2nd' },
    { value: 'Sem', label: 'Sem' },
  ];

  const openSummary = async (mode, id, title, ctx = {}) => {
    setSummaryMode(mode);
    setSummaryId(id);
    setSummaryTitle(title || 'Summary');
    setSummaryCtx(ctx || {});
    setSummary(null);
    setSummaryLoading(true);
    summaryDisc.onOpen();
    try {
      // If faculty view, enrich context with faculty details and current SY/Sem
      if (mode === 'faculty' && id) {
        try {
          const fac = await apiService.getFaculty(id);
          if (fac) {
            ctx = { ...ctx, 
              designation: fac.designation, employment: fac.employment, 
              load_release_units: fac.load_release_units ?? fac.loadReleaseUnits,
              dept: ctx.dept || fac.dept || fac.department,
            };
          }
        } catch {}
        try {
          const sy = settings?.schedulesView?.school_year || settings?.schedulesLoad?.school_year || '';
          const sem = settings?.schedulesView?.semester || settings?.schedulesLoad?.semester || '';
          ctx = { ...ctx, sy, sem };
        } catch {}
        setSummaryCtx(ctx);
      }
      if (mode === 'schedule') {
        try {
          const sched = await apiService.getScheduleById(id);
          const fid = ctx.faculty_id || ctx.facultyId || sched?.facultyId || sched?.faculty_id;
          ctx = {
            ...ctx,
            faculty_id: fid || ctx.faculty_id,
            dept: ctx.dept || sched?.dept || sched?.department,
            instructor: ctx.instructor || sched?.instructor || sched?.faculty,
            course_title: ctx.course_title || sched?.course_title || sched?.courseTitle,
            course_name: ctx.course_name || sched?.course_name || sched?.courseName,
          };
          if (fid) {
            try {
              const fac = await apiService.getFaculty(fid);
              if (fac) {
                ctx = {
                  ...ctx,
                  designation: ctx.designation ?? fac.designation,
                  employment: ctx.employment ?? fac.employment,
                  load_release_units: ctx.load_release_units ?? (fac.load_release_units ?? fac.loadReleaseUnits),
                  dept: ctx.dept || fac.dept || fac.department,
                  faculty: ctx.instructor || ctx.faculty || fac.faculty || fac.name,
                  email: ctx.email || fac.email,
                  rank: ctx.rank || fac.rank,
                };
              }
            } catch {}
          }
          setSummaryCtx(ctx);
        } catch {}
      }
      const search = new URLSearchParams({ mode, id: String(id) });
      const data = await apiService.requestAbs(`/evaluations/summary?${search.toString()}`, { method: 'GET' });
      setSummary(data || null);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const onPrint = () => {
    if (summaryMode === 'student') {
      printEvaluationSummary({
        title: 'Student Evaluation — Courses',
        subtitle: summaryTitle || '',
        context: { ...summaryCtx, courses: Array.isArray(summary?.courses) ? summary.courses : [] },
        mode: 'student',
      });
      return;
    }
    const title = `Evaluation Summary`;
    const subtitle = summaryTitle;
    printEvaluationSummary({
      title,
      subtitle,
      stats: summary?.stats || {},
      feedbacks: summary?.feedbacks || [],
      questions: QUESTIONS,
      context: summaryCtx,
      mode: summaryMode,
    });
  };

  const viewSwitch = (
    <HStack spacing={2}>
      <Button size="sm" variant={view==='course'?'solid':'outline'} colorScheme="blue" onClick={()=>setView('course')}>By Course</Button>
      <Button size="sm" variant={view==='faculty'?'solid':'outline'} colorScheme="blue" onClick={()=>setView('faculty')}>By Faculty</Button>
      <Button size="sm" variant={view==='student'?'solid':'outline'} colorScheme="blue" onClick={()=>setView('student')}>By Students</Button>
    </HStack>
  );

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center">
        <Heading size="md">Admin Evaluations</Heading>
        {viewSwitch}
      </HStack>

      <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" p={4}>
        <HStack spacing={3} flexWrap="wrap">
          <Select value={filters.programcode} onChange={(e)=>setFilters(s=>({...s, programcode: e.target.value, coursecode: '' }))} maxW="220px">
            <option value="">All programs</option>
            {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          {view==='course' && (
            <Select value={filters.coursecode} onChange={(e)=>setFilters(s=>({...s, coursecode: e.target.value }))} maxW="260px" isDisabled={courseOptions.length===0} placeholder={courseOptions.length? 'Select course' : 'No courses'}>
              {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}
          <Select value={filters.faculty} onChange={(e)=>setFilters(s=>({...s, faculty: e.target.value }))} maxW="260px" placeholder="All faculty">
            {facultyOptions.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>
          {view==='student' && (
            <Input value={filters.student} onChange={(e)=>setFilters(s=>({...s, student: e.target.value }))} maxW="260px" placeholder="Search student (ID or name)" />
          )}
          <Select value={filters.term} onChange={(e)=>setFilters(s=>({...s, term: e.target.value }))} maxW="160px">
            {termOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Button leftIcon={<FiBarChart2 />} onClick={fetchData} colorScheme="blue" variant="solid">Apply</Button>
        </HStack>
      </Box>

      <Box bg={panel} borderWidth="1px" borderColor={border} rounded="xl" overflowX="auto">
        <Table size={{ base: 'sm', md: 'md' }}>
          <Thead>
            <Tr>
              {view==='course' ? (
                <>
                  <Th>Program</Th>
                  <Th>Course</Th>
                  <Th>Faculty</Th>
                  <Th>Term</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              ) : view==='faculty' ? (
                <>
                  <Th>Faculty</Th>
                  <Th>Department</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              ) : (
                <>
                  <Th>Student</Th>
                  <Th>Program</Th>
                  <Th isNumeric>Evaluations</Th>
                  <Th>Action</Th>
                </>
              )}
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Tr key={i}><Td colSpan={6}><Skeleton height="20px" /></Td></Tr>
              ))
            ) : rows.length === 0 ? (
              <Tr><Td colSpan={6}><Text color={subtle} p={4}>No evaluations found.</Text></Td></Tr>
            ) : view==='course' ? (
              rows.map((r) => (
                <Tr key={`${r.schedule_id}-${r.accesscode}`}>
                  <Td><Tag colorScheme="blue" variant="subtle"><TagLabel>{r.schedule?.programcode || '-'}</TagLabel></Tag></Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="600">{r.schedule?.course_name || '-'}</Text>
                      <Text fontSize="sm" color={subtle} noOfLines={1}>{r.schedule?.course_title || ''}</Text>
                    </VStack>
                  </Td>
                  <Td><Text>{r.faculty?.faculty || r.schedule?.instructor || '-'}</Text></Td>
                  <Td><Text>{r.schedule?.term || '-'}{r.schedule?.sy ? ` • SY ${r.schedule.sy}` : ''}{r.schedule?.sem ? ` • ${r.schedule.sem}` : ''}</Text></Td>
                  <Td isNumeric><Text fontWeight="700">{r.total}</Text></Td>
                  <Td>
                    <Button size="sm" leftIcon={<FiEye />} onClick={()=>openSummary('schedule', r.schedule_id, `${r.schedule?.course_name} • ${r.schedule?.instructor || ''}`,
                      { programcode: r.schedule?.programcode, course_name: r.schedule?.course_name, course_title: r.schedule?.course_title, instructor: r.schedule?.instructor, term: r.schedule?.term, sy: r.schedule?.sy, sem: r.schedule?.sem, dept: r.schedule?.dept, faculty_id: r.schedule?.faculty_id }
                    )}>View</Button>
                  </Td>
                </Tr>
              ))
            ) : view==='faculty' ? (
              rows.map((r, idx) => (
                <Tr key={`${r.faculty_id || 'x'}-${idx}`}>
                  <Td><Text fontWeight="600">{r.faculty?.faculty || r.instructor || 'Unassigned'}</Text></Td>
                  <Td><Text>{r.faculty?.dept || r.dept || '-'}</Text></Td>
                  <Td isNumeric><Text fontWeight="700">{r.total}</Text></Td>
                  <Td>
                    <Button size="sm" leftIcon={<FiEye />} isDisabled={!r.faculty_id} onClick={()=>openSummary('faculty', r.faculty_id, (r.faculty?.faculty || r.instructor || 'Faculty'), { instructor: r.faculty?.faculty || r.instructor, dept: r.faculty?.dept || r.dept, faculty: r.faculty?.faculty, designation: r.faculty?.designation, employment: r.faculty?.employment, load_release_units: r.faculty?.loadReleaseUnits, email: r.faculty?.email, rank: r.faculty?.rank })}>View</Button>
                  </Td>
                </Tr>
              ))
            ) : view==='student' ? (
              rows.map((r, idx) => {
                const sid = r.student_id || r.student?.id || r.id || idx;
                const sname = r.student_name || r.student?.name || r.name || 'Student';
                const program = r.program || r.student?.program || r.programcode || '-';
                return (
                  <Tr key={`stu-${sid}`}>
                    <Td>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="600">{sname}</Text>
                        <Text fontSize="sm" color={subtle}>{sid ? `ID #${sid}` : ''}</Text>
                      </VStack>
                    </Td>
                    <Td><Tag variant="subtle"><TagLabel>{program}</TagLabel></Tag></Td>
                    <Td isNumeric><Text fontWeight="700">{r.total}</Text></Td>
                    <Td>
                      <Button size="sm" leftIcon={<FiEye />} onClick={()=>openSummary('student', sid, sname, { program })}>View</Button>
                    </Td>
                  </Tr>
                );
              })
            ) : null}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={summaryDisc.isOpen} onClose={summaryDisc.onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{summaryTitle || 'Summary'} {summaryCtx.course_title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {summaryMode !== 'faculty' && summaryCtx && (summaryCtx.faculty_id || summaryCtx.faculty) && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  {summaryCtx.faculty && (
                    <Text fontWeight="700">{summaryCtx.faculty}</Text>
                  )}

                  <HStack spacing={3} wrap="wrap">
                    {summaryCtx.faculty_id && (
                      <Badge colorScheme="blue" variant="subtle">ID #{summaryCtx.faculty_id}</Badge>
                    )}
                    {summaryCtx.dept && <Badge variant="subtle">{summaryCtx.dept}</Badge>}
                    {summaryCtx.designation && <Badge variant="subtle" colorScheme="purple">{summaryCtx.designation}</Badge>}
                    {summaryCtx.employment && <Badge variant="subtle" colorScheme="green">{summaryCtx.employment}</Badge>}
                    {summaryCtx.load_release_units != null && (
                      <Badge variant="subtle" colorScheme="orange">LRU: {summaryCtx.load_release_units}</Badge>
                    )}
                  </HStack>
                  {summaryCtx.email && (
                    <Text fontSize="sm" color={subtle}>Email: {summaryCtx.email}</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryMode === 'faculty' && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  <HStack spacing={3} wrap="wrap">
                    <Badge colorScheme="blue" variant="subtle">ID #{summaryId}</Badge>
                    {summaryCtx.dept && <Badge variant="subtle">{summaryCtx.dept}</Badge>}
                    {summaryCtx.designation && <Badge variant="subtle" colorScheme="purple">{summaryCtx.designation}</Badge>}
                    {summaryCtx.employment && <Badge variant="subtle" colorScheme="green">{summaryCtx.employment}</Badge>}
                    {summaryCtx.load_release_units != null && (
                      <Badge variant="subtle" colorScheme="orange">LRU: {summaryCtx.load_release_units}</Badge>
                    )}
                    {(summaryCtx.sy || summaryCtx.sem) && (
                      <Badge variant="subtle" colorScheme="gray">{[summaryCtx.sy && `SY ${summaryCtx.sy}`, summaryCtx.sem].filter(Boolean).join(' • ')}</Badge>
                    )}
                  </HStack>
                  {summaryCtx.email && (
                    <Text fontSize="sm" color={subtle}>Email: {summaryCtx.email}</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryMode === 'student' && (
              <Box mb={4} p={3} borderWidth="1px" borderColor={border} rounded="md">
                <VStack align="start" spacing={1}>
                  <HStack spacing={3} wrap="wrap">
                    <Badge colorScheme="blue" variant="subtle">ID #{summaryId}</Badge>
                    {summaryCtx.program && <Badge variant="subtle">{summaryCtx.program}</Badge>}
                    {(summaryCtx.sy || summaryCtx.sem) && (
                      <Badge variant="subtle" colorScheme="gray">{[summaryCtx.sy && `SY ${summaryCtx.sy}`, summaryCtx.sem].filter(Boolean).join(' �?� ')}</Badge>
                    )}
                  </HStack>
                </VStack>
              </Box>
            )}
            {summaryMode === 'student' && summary && (
              <Box>
                <Heading size="sm" mb={2}>Evaluated Courses</Heading>
                <VStack align="stretch" spacing={2}>
                  {(summary.courses || []).map((c) => (
                    <Box key={c.id} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={feedbackBg}>
                      <HStack justify="space-between" align="start">
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="600">{c.course_name || '-'}</Text>
                          <Text fontSize="sm" color={subtle} noOfLines={2}>{c.course_title || ''}</Text>
                          <HStack spacing={2} pt={1}>
                            {c.programcode && <Badge variant="subtle">{c.programcode}</Badge>}
                            {(c.term || c.sy || c.sem) && (
                              <Badge variant="subtle" colorScheme="gray">{[c.term, c.sy && `SY ${c.sy}`, c.sem].filter(Boolean).join(' · ')}</Badge>
                            )}
                          </HStack>
                        </VStack>
                        <VStack align="end" spacing={0}>
                          <Text fontSize="sm" color={subtle}>Faculty</Text>
                          <Text fontWeight="600">{c.instructor || '-'}</Text>
                        </VStack>
                      </HStack>
                    </Box>
                  ))}
                  {(summary.courses || []).length === 0 && (
                    <Text color={subtle}>No courses found for this student.</Text>
                  )}
                </VStack>
              </Box>
            )}
            {summaryLoading ? (
              <VStack align="stretch" spacing={3}>
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="24px" />)}
              </VStack>
            ) : !summary ? (
              <Text color={subtle}>No summary available.</Text>
            ) : summaryMode === 'student' ? null : (
              <VStack align="stretch" spacing={5}>
                <Box>
                  <Heading size="sm" mb={2}>Averages</Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {QUESTIONS.map((q, idx) => {
                      const key = `q${idx+1}`;
                      const val = summary?.stats?.[key];
                      const avg = val != null ? Number(val).toFixed(2) : '-';
                      return (
                        <Stat key={key} p={2} borderWidth="1px" borderColor={border} rounded="md">
                          <StatLabel noOfLines={2}>{idx+1}. {q}</StatLabel>
                          <StatNumber fontSize="lg">{avg}</StatNumber>
                          <StatHelpText>Scale 1–5</StatHelpText>
                        </Stat>
                      );
                    })}
                  </SimpleGrid>
                </Box>
                <Divider />
                <Box>
                  <Heading size="sm" mb={2}>Top Feedback</Heading>
                  <VStack align="stretch" spacing={3}>
                    {(summary.feedbacks || []).map((f) => (
                      <Box key={f.id} p={3} borderWidth="1px" borderColor={border} rounded="md" bg={feedbackBg}>
                        <Text fontSize="sm">{f.feedback}</Text>
                      </Box>
                    ))}
                    {(summary.feedbacks || []).length === 0 && (
                      <Text color={subtle}>No feedback yet.</Text>
                    )}
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="outline" onClick={onPrint}>Print</Button>
              <Button onClick={summaryDisc.onClose}>Close</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
