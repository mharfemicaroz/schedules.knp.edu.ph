import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  Button,
  useColorModeValue,
  HStack,
  Image,
  useToast,
  PinInput,
  PinInputField,
  Divider,
  Stack,
  Badge,
  Link,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from '@chakra-ui/react';
import apiService from '../services/apiService';
import { FiCalendar } from 'react-icons/fi';
import useEvaluationEnabled from '../hooks/useEvaluationEnabled';

function Evaluation() {
  const [code, setCode] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [studentId, setStudentId] = React.useState('');
  const [birthDate, setBirthDate] = React.useState(''); // MM/DD/YYYY (display)
  const dateInputRef = React.useRef(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { enabled: evaluationsEnabled, loading: evalLoading } = useEvaluationEnabled();

  const isValid = /^[A-Za-z0-9]{6}$/.test(code);
  const showError = touched && !isValid && code.length > 0;
  const pad2 = (n) => String(n).padStart(2, '0');
  const isValidMDY = (s) => {
    const m = String(s || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!m) return false;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    if (mm < 1 || mm > 12) return false;
    if (yyyy < 1900 || yyyy > new Date().getFullYear()) return false;
    const dt = new Date(`${yyyy}-${pad2(mm)}-${pad2(dd)}`);
    return dt.getFullYear() === yyyy && dt.getMonth() + 1 === mm && dt.getDate() === dd;
  };
  const mdyToDmy = (s) => {
    const m = String(s || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!m) return '';
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    return isValidMDY(s) ? `${pad2(dd)}/${pad2(mm)}/${yyyy}` : '';
  };
  const studentOk = String(studentId).trim().length > 0 && isValidMDY(String(birthDate).trim());

  const pageBg = useColorModeValue('white', 'gray.900');
  const gradientBg = useColorModeValue(
    'radial(ellipse at top left, #ebf8ff 0%, #e6fffb 40%, #ffffff 85%)',
    'radial(ellipse at top left, #1a365d 0%, #171923 70%)'
  );
  const textMain = useColorModeValue('gray.800', 'whiteAlpha.900');
  const textSubtle = useColorModeValue('gray.600', 'gray.300');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('rgba(148, 163, 184, 0.4)', 'whiteAlpha.200');
  const accent = useColorModeValue('blue.500', 'blue.300');
  // Modals: Guidelines & Privacy
  const { isOpen: isGuideOpen, onOpen: onGuideOpen, onClose: onGuideClose } = useDisclosure();
  const { isOpen: isPrivacyOpen, onOpen: onPrivacyOpen, onClose: onPrivacyClose } = useDisclosure();

  // Always show the policy modals on load (sequential)
  React.useEffect(() => {
    if (evalLoading || !evaluationsEnabled) return;
    onGuideOpen();
    // Privacy opens after acknowledging guidelines
  }, [evalLoading, evaluationsEnabled]);

  const handleDontAgree = () => {
    try { window.location.reload(); } catch {}
  };

  const handleGuideAgree = () => {
    onGuideClose();
    setTimeout(() => onPrivacyOpen(), 0);
  };

  const handlePrivacyAgree = () => {
    onPrivacyClose();
  };

  const onPinChange = (val) => {
    const cleaned = (val || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    setCode(cleaned);
  };

  const onStudentIdChange = (e) => {
    const raw = e?.target?.value ?? '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) {
      setStudentId('');
      return;
    }
    if (digits.length <= 3) {
      setStudentId(digits);
      return;
    }
    if (digits.length <= 8) { // allow 3-5 digits after dash
      const formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
      setStudentId(formatted);
      return;
    }
    // Exceeds 8 digits: remove dash, keep digits only
    setStudentId(digits);
  };

  const formatIsoToMDY = (iso) => {
    // iso: YYYY-MM-DD -> MM/DD/YYYY
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  };

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch {}
    }
    el.click();
  };

  const formatMDYMask = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8); // MMDDYYYY -> up to 8
    if (!digits) return '';

    let out = '';

    // Month
    if (digits.length === 1) {
      const a = digits[0];
      if (a === '0' || a === '1') {
        out = a; // wait for second digit
      } else {
        out = `0${a}/`; // auto-complete month and add slash
      }
      return out;
    }

    let mm = digits.slice(0, 2);
    let mNum = Math.max(1, Math.min(12, parseInt(mm, 10) || 0));
    mm = String(mNum).padStart(2, '0');
    out = `${mm}/`;

    const rest = digits.slice(2);
    if (!rest) return out;

    // Day
    if (rest.length === 1) {
      const b = rest[0];
      if (b === '0' || b === '1' || b === '2' || b === '3') {
        out += b; // wait for second digit
        return out;
      } else {
        out += `0${b}/`; // auto-complete day and add slash
        return out;
      }
    }

    let dd = rest.slice(0, 2);
    let dNum = Math.max(1, Math.min(31, parseInt(dd, 10) || 0));
    dd = String(dNum).padStart(2, '0');
    out += `${dd}/`;

    // Year (up to 4)
    const yyyy = rest.slice(2, 6);
    out += yyyy;

    return out;
  };

  const encodeToken = (s) => {
    try { return btoa(s).replace(/=+$/,''); } catch { return ''; }
  };

  const formatStudentName = (s) => {
    if (!s) return '';
    const ln = s.last_name || s.lastname || '';
    const fn = s.first_name || s.firstname || '';
    const mn = s.middle_name || s.midname || '';
    const ne = s.name_ext || s.nameext || '';
    const parts = [fn, mn && (mn[0] + '.').toUpperCase(), ln, ne].filter(Boolean);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  const handleProceed = async () => {
    if (evalLoading || !evaluationsEnabled) {
      toast({ title: 'Evaluations are currently disabled.', status: 'warning', duration: 2200 });
      return;
    }
    setTouched(true);
    if (!isValid) return;
    if (!studentOk) {
      toast({ title: 'Enter valid Student ID and Birthdate (MM/DD/YYYY).', status: 'warning', duration: 2200 });
      return;
    }
    setSubmitting(true);
    try {
      const params = new URLSearchParams({ accessCode: code });
      const rows = await apiService.request(`/?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const first = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (!first) {
        toast({ title: 'Schedule not found', status: 'error', duration: 2000 });
        return;
      }
      const birthDMY = mdyToDmy(String(birthDate).trim());
      const v = await apiService.verifyStudent(String(studentId).trim(), birthDMY);
      if (!v?.exists) {
        toast({ title: 'Student record not found', description: 'Check your Student ID and birthdate.', status: 'error', duration: 2500 });
        return;
      }
      // Check if evaluation already exists for this student + code
      const studentName = formatStudentName(v.data || v);
      try {
        const ex = await apiService.checkEvaluationExists(code, studentName);
        if (ex?.exists) {
          toast({
            title: 'Already Submitted',
            description: 'You have already completed this evaluation. Thank you!',
            status: 'info',
            duration: 3500,
          });
          return;
        }
      } catch {}
      try { sessionStorage.setItem('evaluation:student', JSON.stringify(v.data || v)); } catch {}
      const token = encodeToken(code);
      navigate(`/evaluation/${encodeURIComponent(token)}`);
    } catch (e) {
      if (e && Number(e.status) === 429) {
        const secs = Math.max(1, Number(e.retryAfter) || 60);
        toast({
          title: 'Too many attempts',
          description: `Please wait ${secs}s before trying again.`,
          status: 'warning',
          duration: Math.min(9000, (secs + 2) * 1000),
        });
      } else {
        toast({
          title: 'Unable to validate access code',
          description: e?.message || 'Please try again.',
          status: 'error',
          duration: 2500,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleProceed();
  };

  if (evalLoading) {
    return (
      <Box bg={pageBg} minH="100vh" display="flex" alignItems="center">
        <Container maxW="lg" py={{ base: 10, md: 16 }}>
          <VStack spacing={4} textAlign="center" bg={cardBg} borderRadius="2xl" borderWidth="1px" borderColor={cardBorder} p={{ base: 6, md: 8 }}>
            <Heading size="md">Checking Evaluation Access</Heading>
            <Text color={textSubtle}>Please wait a moment...</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!evaluationsEnabled) {
    return (
      <Box bg={pageBg} minH="100vh" display="flex" alignItems="center">
        <Container maxW="lg" py={{ base: 10, md: 16 }}>
          <VStack spacing={4} textAlign="center" bg={cardBg} borderRadius="2xl" borderWidth="1px" borderColor={cardBorder} p={{ base: 6, md: 8 }}>
            <Heading size="md">Unauthorized Access</Heading>
            <Text color={textSubtle}>The evaluation portal is currently turned off. Please contact your program chair.</Text>
            <Button colorScheme="blue" onClick={() => navigate('/')}>Back to Home</Button>
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <Box position="relative" minH="100vh" bg={pageBg}>
      <Box
        position="absolute"
        inset={0}
        bgGradient={gradientBg}
      />
      <Box
        position="absolute"
        inset={0}
        bgImage="url('/bg.jpg')"
        bgSize="cover"
        bgPos="center"
        opacity={0.18}
      />

      <Container maxW="6xl" position="relative" py={{ base: 10, md: 16 }}>
        <Stack
          direction={{ base: 'column', lg: 'row' }}
          spacing={{ base: 10, lg: 16 }}
          align="center"
          justify="space-between"
        >
          <VStack
            flex={1}
            align="flex-start"
            spacing={5}
            color={textMain}
            maxW="lg"
          >
            <HStack spacing={3}>
              <Image src="/logo.png" boxSize={{ base: '40px', md: '52px' }} />
              <VStack align="flex-start" spacing={0}>
                <Text fontSize={{ base: 'sm', md: 'sm' }} color={accent} fontWeight="semibold" letterSpacing="widest" textTransform="uppercase">
                  Kolehiyo ng Pantukan
                </Text>
                <Text fontWeight="medium" fontSize={{ base: 'md', md: 'lg' }}>
                  Office of the VPAA
                </Text>
              </VStack>
            </HStack>

            <Heading
              as="h1"
              fontSize={{ base: '2xl', md: '3xl', lg: '4xl' }}
              lineHeight={1.15}
              fontWeight="extrabold"
            >
              Faculty Evaluation Web Portal
            </Heading>

            <Text fontSize={{ base: 'sm', md: 'md' }} color={textSubtle}>
              Students may access the evaluation form using the unique code assigned to each class.
              Kindly prepare your code before proceeding.
            </Text>

            <HStack spacing={4} pt={2} flexWrap="wrap">
              <Badge px={3} py={1} borderRadius="full" colorScheme="blue" variant="subtle">
                Student Access
              </Badge>
              <Text fontSize="xs" color={textSubtle}>
                Secure • Fast • Confidential
              </Text>

            </HStack>
          </VStack>

          <Box
            flex={1}
            maxW="420px"
            bg={cardBg}
            borderRadius="2xl"
            borderWidth="1px"
            borderColor={cardBorder}
            boxShadow="0 18px 45px rgba(15, 23, 42, 0.18)"
            overflow="hidden"
          >
            <Box
              h="4px"
              w="100%"
              bgGradient="linear(to-r, blue.500, cyan.400)"
            />
            <Box as="form" onSubmit={onSubmit} px={{ base: 6, md: 8 }} py={{ base: 7, md: 9 }}>
              <VStack spacing={7} align="stretch">
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" color={accent} fontWeight="semibold">
                    Step 1
                  </Text>
            <Heading size="md" fontWeight="semibold" color={textMain}>
                    Enter your details
                  </Heading>
                  <Text fontSize="sm" color={textSubtle}>
                    Provide your Student ID and birthdate, then the 6-character access code from your instructor.
                  </Text>
                </VStack>

                <VStack align="stretch" spacing={4}>
                  <FormControl>
                    <Text fontSize="sm" fontWeight="600">Student ID</Text>
                    <Text fontSize="xs" color={textSubtle} mb={1}>As shown in your ID card or certificate of registration form.</Text>
                    <Input
                      value={studentId}
                      onChange={onStudentIdChange}
                      placeholder="e.g., 251-1234"
                      autoComplete="off"
                      inputMode="numeric"
                      pattern="[0-9-]*"
                    />
                  </FormControl>
                  <FormControl>
                    <Text fontSize="sm" fontWeight="600">Birthdate</Text>
                    <Text fontSize="xs" color={textSubtle} mb={1}>Format: MM/DD/YYYY</Text>
                    <InputGroup>
                      <Input
                        value={birthDate}
                        onChange={(e)=>setBirthDate(formatMDYMask(e.target.value))}
                        placeholder="MM/DD/YYYY"
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={10}
                      />
                      <InputRightElement width="3rem">
                        <IconButton
                          aria-label="Select birthdate"
                          variant="ghost"
                          size="sm"
                          icon={<FiCalendar />}
                          onClick={openDatePicker}
                        />
                      </InputRightElement>
                    </InputGroup>
                    {/* hidden native date input to open system date picker */}
                    <Input
                      ref={dateInputRef}
                      type="date"
                      position="absolute"
                      opacity={0}
                      pointerEvents="none"
                      tabIndex={-1}
                      aria-hidden="true"
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e)=>{
                        const iso = e.target.value;
                        setBirthDate(formatIsoToMDY(iso));
                      }}
                    />
                  </FormControl>
                </VStack>

                <FormControl isInvalid={showError} pt={2}>
                  <FormLabel mb={1} fontSize="sm" fontWeight="600">Access Code</FormLabel>
                  <Text fontSize="xs" color={textSubtle} mb={2}>Enter the 6-character code provided by your instructor.</Text>
                  <HStack justify="center" spacing={2}>
                    <PinInput
                      otp
                      type="alphanumeric"
                      value={code}
                      onChange={onPinChange}
                      onComplete={handleProceed}
                      autoFocus
                    >
                      {Array.from({ length: 6 }).map((_, i) => (
                        <PinInputField
                          key={i}
                          textTransform="uppercase"
                          fontWeight="semibold"
                          fontSize="lg"
                          borderRadius="lg"
                          h="56px"
                          w="52px"
                          bg={useColorModeValue('gray.50', 'gray.700')}
                          borderColor={useColorModeValue('gray.300', 'gray.600')}
                          _focus={{
                            borderColor: accent,
                            boxShadow: `0 0 0 1px ${accent}`,
                          }}
                          _hover={{ borderColor: accent }}
                        />
                      ))}
                    </PinInput>
                  </HStack>
                  <FormErrorMessage fontSize="xs" mt={2}>
                    Code must be exactly 6 alphanumeric characters.
                  </FormErrorMessage>
                </FormControl>

                <VStack align="stretch" spacing={3}>
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  isDisabled={!isValid || !studentOk || submitting || evalLoading || !evaluationsEnabled}
                  borderRadius="lg"
                  fontWeight="semibold"
                  w="full"
                    _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                    _active={{ transform: 'translateY(0)' }}
                    transition="all 0.15s ease"
                  >
                    {submitting ? 'Checking...' : 'Continue to Evaluation'}
                  </Button>
                  <Text fontSize="xs" textAlign="center" color={textSubtle}>
                    Having trouble with your code? Kindly contact your program chair.
                  </Text>
                </VStack>

                <Divider />

                {/* Policy acknowledgments with modal links */}
                <VStack spacing={1} align="flex-start" fontSize="xs" color={textSubtle}>
                  <Text>
                    By continuing, you agree to the institution's <Link color={accent} onClick={onGuideOpen}>evaluation guidelines</Link> and <Link color={accent} onClick={onPrivacyOpen}>data privacy policy</Link>.
                  </Text>
                  <Text>
                    This system is developed and managed by the Office of the VPAA.
                  </Text>
                </VStack>

              </VStack>
            </Box>
          </Box>
        </Stack>
      </Container>

      {/* Institution Evaluation Guidelines Modal */}
      <Modal isOpen={isGuideOpen} onClose={onGuideClose} size="xl" scrollBehavior="inside" isCentered closeOnOverlayClick={false} closeOnEsc={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Institution Evaluation Guidelines</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4} fontSize="sm" color={textMain}>
              <Text>
                These guidelines outline the standard evaluation practices of Kolehiyo ng Pantukan (KNP) for collecting student feedback on teaching and learning.
              </Text>
              <VStack align="stretch" spacing={3} as="ul" pl={4}>
                <Text as="li">Purpose: Improve instruction, curriculum design, and service quality.</Text>
                <Text as="li">Scope: Each evaluation relates to a specific class and faculty member.</Text>
                <Text as="li">Honesty: Provide fair, truthful, and constructive feedback.</Text>
                <Text as="li">Respect: Avoid offensive or discriminatory remarks.</Text>
                <Text as="li">Confidentiality: Individual responses are confidential and reported in aggregate.</Text>
                <Text as="li">No Retaliation: No adverse action for submitting honest feedback.</Text>
                <Text as="li">Timeliness: Submit within the announced evaluation window.</Text>
                <Text as="li">Assistance: Contact your Program Chair or the Office of the VPAA.</Text>
              </VStack>
              <Text color={textSubtle}>By continuing, you acknowledge these guidelines.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter display="block" w="full">
            <VStack align="stretch" spacing={2} w="full">
              <Button
                colorScheme="blue"
                onClick={handleGuideAgree}
                w="full"
                whiteSpace="normal"
                textAlign="center"
              >
                I have read and understood, and agree
              </Button>
              <Button
                variant="outline"
                colorScheme="red"
                onClick={handleDontAgree}
                w="full"
                whiteSpace="normal"
                textAlign="center"
              >
                I have read and understood, and don’t agree
              </Button>
            </VStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Data Privacy Policy Modal */}
      <Modal isOpen={isPrivacyOpen} onClose={onPrivacyClose} size="xl" scrollBehavior="inside" isCentered closeOnOverlayClick={false} closeOnEsc={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Data Privacy Policy</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4} fontSize="sm" color={textMain}>
              <Text>
                Kolehiyo ng Pantukan (KNP) protects your personal information in compliance with the Data Privacy Act of 2012 (RA 10173).
              </Text>
              <VStack align="stretch" spacing={3} as="ul" pl={4}>
                <Text as="li">Data: Student ID, birthdate (for verification), evaluation responses, submission metadata.</Text>
                <Text as="li">Purpose: Authenticate access, administer evaluations, generate aggregated reports, improve services.</Text>
                <Text as="li">Legal Basis: Your consent and legitimate interests in quality assurance.</Text>
                <Text as="li">Retention: Kept only as long as necessary for reporting and audit.</Text>
                <Text as="li">Sharing: Limited to authorized KNP offices; not sold to third parties.</Text>
                <Text as="li">Security: Organizational, physical, and technical safeguards are applied.</Text>
                <Text as="li">Your Rights: Access, correction, or deletion subject to policy and law.</Text>
                <Text as="li">Contact: VPAA / Data Protection Officer @ vpaa@knp.edu.ph.</Text>
              </VStack>
              <Text color={textSubtle}>By continuing, you consent to this data processing.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter display="block" w="full">
            <VStack align="stretch" spacing={2} w="full">
              <Button
                colorScheme="blue"
                onClick={handlePrivacyAgree}
                w="full"
                whiteSpace="normal"
                textAlign="center"
              >
                I have read and understood, and agree
              </Button>
              <Button
                variant="outline"
                colorScheme="red"
                onClick={handleDontAgree}
                w="full"
                whiteSpace="normal"
                textAlign="center"
              >
                I have read and understood, and don’t agree
              </Button>
            </VStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default Evaluation;
