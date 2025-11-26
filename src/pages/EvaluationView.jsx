import React from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  Avatar,
  Badge,
  useColorModeValue,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  RadioGroup,
  Radio,
  Stack,
  Button,
  useToast,
  Skeleton,
  Alert,
  AlertIcon,
  Center,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

function decodeToken(token) {
  try {
    // restore padding for base64
    const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4));
    const raw = atob(token + pad);
    return raw;
  } catch {
    return '';
  }
}

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

function EvaluationView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [schedule, setSchedule] = React.useState(null);
  const [answers, setAnswers] = React.useState({});
  const [studentName, setStudentName] = React.useState('');
  const [selectedProgram, setSelectedProgram] = React.useState('');
  const [programs, setPrograms] = React.useState([]);
  const [programsLoading, setProgramsLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const paper = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subtle = useColorModeValue('gray.600', 'gray.400');

  const decoded = React.useMemo(() => decodeToken(String(token || '').trim()), [token]);
  const malformed = React.useMemo(() => !/^[A-Za-z0-9]{6}$/.test(decoded), [decoded]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      if (malformed) {
        // Skip any network calls for malformed/invalid codes
        setLoading(false);
        return;
      }
      try {
        const params = new URLSearchParams({ accessCode: decoded });
        const rows = await apiService.request(`/?${params.toString()}`, { headers: { 'Content-Type': 'application/json' } });
        const first = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!first) {
          setError('No schedule found for this code.');
          setLoading(false);
          return;
        }
        setSchedule(first);
        setLoading(false);
      } catch (e) {
        setError(e?.message || 'Failed to load schedule.');
        setLoading(false);
      }
    })();
  }, [token, malformed, decoded]);

  // Load program options from prospectus (efficient: single fetch after schedule is set)
  React.useEffect(() => {
    if (!schedule) return;
    setPrograms([]);
    setSelectedProgram('');
    (async () => {
      try {
        setProgramsLoading(true);
        const resp = await apiService.getProspectus({});
        const list = Array.isArray(resp) ? resp : (Array.isArray(resp?.items) ? resp.items : []);
        const options = Array.from(new Set(list.map(x => String(x.programcode || x.program || '').trim()).filter(Boolean))).sort();
        setPrograms(options);
        const schedProgram = String(schedule.programcode || schedule.program || '').trim();
        if (schedProgram && options.includes(schedProgram)) setSelectedProgram(schedProgram);
      } catch (_) {
        setPrograms([]);
      } finally {
        setProgramsLoading(false);
      }
    })();
  }, [schedule]);

  const allAnswered = React.useMemo(() => {
    const qOk = QUESTIONS.every((_, idx) => answers[idx] != null);
    const pOk = !!selectedProgram; // program is required
    const nOk = String(studentName).trim().length > 0; // name required
    const fOk = String(feedback).trim().length > 0; // feedback required
    return qOk && pOk && nOk && fOk;
  }, [answers, selectedProgram, studentName, feedback]);

  const submitEval = async () => {
    if (!String(studentName).trim()) {
      toast({ title: 'Please enter your name.', status: 'warning', duration: 1600 });
      return;
    }
    if (!selectedProgram) {
      toast({ title: 'Please select your program.', status: 'warning', duration: 1600 });
      return;
    }
    if (!QUESTIONS.every((_, idx) => answers[idx] != null)) {
      toast({ title: 'Please answer all questions.', status: 'warning', duration: 1800 });
      return;
    }
    if (!String(feedback).trim()) {
      toast({ title: 'Please provide your overall feedback.', status: 'warning', duration: 1600 });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        token: String(token || '').trim(),
        studentName: String(studentName).trim(),
        program: selectedProgram,
        answers: QUESTIONS.map((_, idx) => Number(answers[idx])),
        feedback: String(feedback).trim(),
      };
      await apiService.requestAbs(`/evaluations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast({ title: 'Evaluation submitted', description: `Thank you${studentName ? `, ${studentName}` : ''}!`, status: 'success', duration: 1800 });
      setTimeout(() => navigate('/evaluation'), 900);
    } catch (e) {
      toast({ title: 'Submission failed', description: e?.message || 'Please try again.', status: 'error', duration: 2200 });
    } finally {
      setSubmitting(false);
    }
  };

  if (malformed) {
    return (
      <Box bg={useColorModeValue('gray.50', 'gray.900')} minH="100vh" px={{ base: 3, md: 6 }} py={{ base: 6, md: 10 }}>
        <Container maxW="lg">
          <Center minH="60vh">
            <VStack spacing={5} align="center" textAlign="center" bg={paper} borderWidth="1px" borderColor={border} rounded="xl" boxShadow={{ base: 'md', md: 'lg' }} px={{ base: 6, md: 10 }} py={{ base: 10, md: 12 }}>
              <Box boxSize={12} display="flex" alignItems="center" justifyContent="center" rounded="full" bg={useColorModeValue('red.50','red.900')} color={useColorModeValue('red.600','red.200')}>
                <Box as="span" fontSize="xl" role="img" aria-label="lock">🔒</Box>
              </Box>
              <Heading size="md">Unauthorized Access</Heading>
              <Text fontSize="sm" color={subtle}>Invalid or malformed access code. Please return to the main evaluation page and enter a valid code.</Text>
              <Button colorScheme="blue" onClick={() => navigate('/evaluation')}>Back to Evaluation</Button>
            </VStack>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box bg={useColorModeValue('gray.50', 'gray.900')} minH="100vh" px={{ base: 3, md: 6 }} py={{ base: 6, md: 10 }}>
      <Container maxW="5xl">
        <VStack align="stretch" spacing={6}>
          <HStack justify="space-between" align="center">
            <Heading size="lg">Student Faculty Evaluation</Heading>
            <Badge colorScheme="blue" variant="subtle">Access Portal</Badge>
          </HStack>

          {error && (
            <Alert status="error" rounded="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

          <Box bg={paper} borderWidth="1px" borderColor={border} rounded="xl" boxShadow={{ base: 'md', md: 'lg' }} overflow="hidden">
            <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }} borderBottomWidth="1px" borderColor={border}>
              <Heading size="md">Schedule Information</Heading>
              <Text fontSize="sm" color={subtle}>Details tied to your access code.</Text>
            </Box>
            <Box px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }}>
              {loading ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} height="64px" rounded="md" />
                  ))}
                </SimpleGrid>
              ) : schedule ? (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                    <Stat p={0}>
                      <StatLabel>Program</StatLabel>
                      <StatNumber fontSize="lg">{schedule.programcode || '—'}</StatNumber>
                      <StatHelpText>{schedule.dept || '—'}</StatHelpText>
                    </Stat>
                    <Stat p={0}>
                      <StatLabel>Course</StatLabel>
                      <StatNumber fontSize="lg">{schedule.courseName || '—'}</StatNumber>
                      <StatHelpText noOfLines={1}>{schedule.courseTitle || '—'}</StatHelpText>
                    </Stat>
                    <Stat p={0}>
                      <StatLabel>Term / Semester</StatLabel>
                      <StatNumber fontSize="lg">{schedule.term || '—'}</StatNumber>
                      <StatHelpText>SY {schedule.sy || '—'} · {schedule.sem || '—'}</StatHelpText>
                    </Stat>
                    <Stat p={0}>
                      <StatLabel>Schedule</StatLabel>
                      <StatNumber fontSize="lg">{schedule.time || '—'}</StatNumber>
                      <StatHelpText>Day {schedule.day || '—'} · Session {schedule.session || '—'}</StatHelpText>
                    </Stat>
                    <Stat p={0}>
                      <StatLabel>Section / Block</StatLabel>
                      <StatNumber fontSize="lg">{schedule.blockCode || '—'}</StatNumber>
                      <StatHelpText>Room {schedule.room || '—'}</StatHelpText>
                    </Stat>
                    <Stat p={0}>
                      <StatLabel>Units</StatLabel>
                      <StatNumber fontSize="lg">{schedule.unit ?? '—'}</StatNumber>
                      <StatHelpText>Year Level {schedule.yearlevel || '—'}</StatHelpText>
                    </Stat>
                  </SimpleGrid>

                  <Divider my={6} />

                  <HStack spacing={4} align="center">
                    <Avatar name={schedule.faculty || schedule.instructor || 'Faculty'} size="lg" />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="700">{schedule.faculty || schedule.instructor || '—'}</Text>
                      <Text fontSize="sm" color={subtle}>{schedule.dept || '—'}</Text>
                    </VStack>
                    {schedule.designation && <Badge>{schedule.designation}</Badge>}
                    {schedule.employment && <Badge colorScheme="purple" variant="subtle">{schedule.employment}</Badge>}
                  </HStack>
                </>
              ) : (
                <Text>No data.</Text>
              )}
            </Box>
          </Box>

          {/* Student details */}
          {!loading && schedule && (
            <Box bg={paper} borderWidth="1px" borderColor={border} rounded="xl" boxShadow={{ base: 'md', md: 'lg' }} overflow="hidden">
              <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }} borderBottomWidth="1px" borderColor={border}>
                <Heading size="md">Student Details</Heading>
                <Text fontSize="sm" color={subtle}>Enter your name and select your program to proceed.</Text>
              </Box>
              <Box px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
                  <FormControl isRequired>
                    <FormLabel>Student Name</FormLabel>
                    <Input placeholder="Juan Dela Cruz" value={studentName} onChange={(e)=>setStudentName(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Program</FormLabel>
                    <Select placeholder={programsLoading ? 'Loading programs…' : 'Select program'} value={selectedProgram} onChange={(e)=>setSelectedProgram(e.target.value)} isDisabled={programsLoading || (programs.length===0)}>
                      {programs.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </Box>
            </Box>
          )}

          <Box bg={paper} borderWidth="1px" borderColor={border} rounded="xl" boxShadow={{ base: 'md', md: 'lg' }} overflow="hidden">
            <Box px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }} borderBottomWidth="1px" borderColor={border}>
              <Heading size="md">Faculty Evaluation</Heading>
              <Text fontSize="sm" color={subtle}>Please rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).</Text>
            </Box>
            <Box px={{ base: 4, md: 6 }} py={{ base: 5, md: 6 }}>
              <VStack align="stretch" spacing={5}>
                {QUESTIONS.map((q, idx) => (
                  <Box key={idx} p={4} borderWidth="1px" borderColor={border} rounded="md" _hover={{ bg: useColorModeValue('gray.50','gray.700') }}>
                    <HStack justify="space-between" align="flex-start" spacing={4}>
                      <Text flex={1}>{idx + 1}. {q}</Text>
                      <RadioGroup value={answers[idx] ?? ''} onChange={(v) => setAnswers((s) => ({ ...s, [idx]: v }))}>
                        <Stack direction="row" spacing={4}>
                          {[1,2,3,4,5].map((v) => (
                            <Radio key={v} value={String(v)}>{v}</Radio>
                          ))}
                        </Stack>
                      </RadioGroup>
                    </HStack>
                  </Box>
                ))}

                <Box p={4} borderWidth="1px" borderColor={border} rounded="md">
                  <FormControl isRequired>
                    <FormLabel>Overall Feedback</FormLabel>
                    <Textarea
                      placeholder="Share comments or suggestions to help improve the course and instruction."
                      value={feedback}
                      onChange={(e)=>setFeedback(e.target.value)}
                      rows={4}
                      resize="vertical"
                      rounded="md"
                      maxLength={1000}
                    />
                    <HStack justify="flex-end">
                      <Text fontSize="xs" color={subtle}>{feedback.length}/1000</Text>
                    </HStack>
                  </FormControl>
                </Box>
              </VStack>

              <HStack mt={6} spacing={3}>
                <Button colorScheme="blue" onClick={submitEval} isDisabled={!allAnswered || submitting} isLoading={submitting} loadingText="Submitting">Submit Evaluation</Button>
                <Button variant="ghost" onClick={() => navigate('/evaluation')}>Back</Button>
              </HStack>
            </Box>
          </Box>

          <Text fontSize="xs" color={subtle} align="center">
            By using this service, you understood and agree to the institution policies and data privacy guidelines. This system is developed and managed by the VPAA.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}

export default EvaluationView;
