import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  FormControl,
  FormErrorMessage,
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
} from '@chakra-ui/react';
import apiService from '../services/apiService';

function Evaluation() {
  const [code, setCode] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const isValid = /^[A-Za-z0-9]{6}$/.test(code);
  const showError = touched && !isValid && code.length > 0;

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

  const onPinChange = (val) => {
    const cleaned = (val || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    setCode(cleaned);
  };

  const encodeToken = (s) => {
    try { return btoa(s).replace(/=+$/,''); } catch { return ''; }
  };

  const handleProceed = async () => {
    setTouched(true);
    if (!isValid) return;
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
      const token = encodeToken(code);
      navigate(`/evaluation/${encodeURIComponent(token)}`);
    } catch (e) {
      toast({
        title: 'Unable to validate access code',
        description: e?.message || 'Please try again.',
        status: 'error',
        duration: 2500,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleProceed();
  };

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
                    Enter your access code
                  </Heading>
                  <Text fontSize="sm" color={textSubtle}>
                    Type the 6-character code given by your instructor. Letters are not case-sensitive.
                  </Text>
                </VStack>

                <FormControl isInvalid={showError}>
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
                    isDisabled={!isValid || submitting}
                    borderRadius="lg"
                    fontWeight="semibold"
                    w="full"
                    _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                    _active={{ transform: 'translateY(0)' }}
                    transition="all 0.15s ease"
                  >
                    {submitting ? 'Checking…' : 'Continue to Evaluation'}
                  </Button>
                  <Text fontSize="xs" textAlign="center" color={textSubtle}>
                    Having trouble with your code? Kindly contact your program chair.
                  </Text>
                </VStack>

                <Divider />

                <VStack spacing={1} align="flex-start" fontSize="xs" color={textSubtle}>
                  <Text>
                    By continuing, you agree to the institution’s evaluation guidelines and data privacy policy.
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
    </Box>
  );
}

export default Evaluation;
