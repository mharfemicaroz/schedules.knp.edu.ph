import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Tag,
  useColorModeValue,
  ScaleFade,
  Fade,
  Circle,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { FiArrowDownRight, FiArrowRight, FiCheck, FiZap } from 'react-icons/fi';

const COOKIE_KEY = 'cl_ai_support_walkthrough';

function hasSeenWalkthrough() {
  if (typeof document === 'undefined') return true;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE_KEY}=`));
}

function setWalkthroughSeen() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=1; max-age=${60 * 60 * 24 * 365}; path=/;`;
}

export default function CourseLoadingWalkthrough({ anchorId = 'course-loading-support-toggle', supportApi = null }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState(null);
  const [hydrated, setHydrated] = React.useState(false);
  const overlayBg = useColorModeValue('blackAlpha.600', 'blackAlpha.700');
  const panelBg = useColorModeValue('white', 'gray.800');
  const textMuted = useColorModeValue('gray.600', 'gray.300');
  const accent = useColorModeValue('blue.500', 'blue.300');
  const haloPulse = keyframes`
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35); }
    60% { box-shadow: 0 0 0 14px rgba(99, 102, 241, 0.0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  `;

  const steps = [
    {
      title: 'Say hi to AI support',
      body: 'We added a Course Loading AI chat bubble. It lives in the lower-right corner — click it to open.',
      action: 'Next',
    },
    {
      title: 'Ask or tap prompts',
      body: 'Type a question about schedules, blocks, or faculty, or tap the built-in prompts to get instant answers.',
      action: 'Next',
    },
    {
      title: 'Go wide or fullscreen',
      body: 'We just expanded the AI panel so you can see more. Use the header controls to toggle wide or fullscreen anytime.',
      action: 'Done',
    },
  ];

  const captureTargetRect = React.useCallback(() => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(anchorId);
    if (!el) { setTargetRect(null); return; }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [anchorId]);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (hasSeenWalkthrough()) return;
    const t = setTimeout(() => {
      setOpen(true);
      captureTargetRect();
    }, 500);
    window.addEventListener('resize', captureTargetRect);
    window.addEventListener('scroll', captureTargetRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', captureTargetRect);
      window.removeEventListener('scroll', captureTargetRect, true);
    };
  }, [captureTargetRect, hydrated]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    if (step === 1 && supportApi) {
      supportApi.open?.();
      supportApi.setWide?.(false);
      supportApi.setFull?.(false);
      supportApi.focusInput?.();
    }
    if (step === 2 && supportApi) {
      supportApi.open?.();
      supportApi.setWide?.(true);
      const timer = setTimeout(() => supportApi.setFull?.(true), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, step, supportApi]);

  const handleClose = React.useCallback(() => {
    setWalkthroughSeen();
    setOpen(false);
  }, []);

  const goNext = () => {
    if (step >= steps.length - 1) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  if (!open) return null;

  const stepMeta = steps[step] || steps[0];

  return (
    <Box position="fixed" inset={0} bg={overlayBg} backdropFilter="blur(6px)" zIndex={90} pointerEvents="auto">
      <Fade in={open}>
        <Box position="absolute" inset={0} />
      </Fade>
      {targetRect && (
        <Box pointerEvents="none">
          <Box
            position="fixed"
            top={`${targetRect.top - 10}px`}
            left={`${targetRect.left - 10}px`}
            width={`${targetRect.width + 20}px`}
            height={`${targetRect.height + 20}px`}
            borderRadius="full"
            borderWidth="2px"
            borderColor="blue.300"
            boxShadow="0 0 0 8px rgba(99,102,241,0.25)"
            animation={`${haloPulse} 1.9s ease-out infinite`}
          />
          <Circle
            size="18px"
            position="fixed"
            top={`${targetRect.top - 24}px`}
            left={`${targetRect.left + targetRect.width / 2 - 9}px`}
            bg="blue.500"
            color="white"
            boxShadow="md"
          >
            <Icon as={FiArrowDownRight} />
          </Circle>
        </Box>
      )}
      <ScaleFade in={open} initialScale={0.96}>
        <Box
          position="fixed"
          right={{ base: '16px', md: '32px' }}
          bottom={{ base: '20px', md: '28px' }}
          maxW={{ base: '92%', md: '480px' }}
          bg={panelBg}
          color={textMuted}
          borderRadius="lg"
          boxShadow="2xl"
          p={4}
          borderWidth="1px"
          borderColor={useColorModeValue('gray.200', 'gray.700')}
        >
          <HStack justify="space-between" align="center" mb={3}>
            <HStack spacing={2}>
              <Circle size="34px" bg={useColorModeValue('blue.50', 'whiteAlpha.200')} color={accent}>
                <Icon as={FiZap} />
              </Circle>
              <VStack align="start" spacing={0}>
                <Text fontWeight="700" color={useColorModeValue('gray.800', 'white')} fontSize="md">
                  AI Chat walkthrough
                </Text>
                <Text fontSize="xs" color={textMuted}>Step {step + 1} of {steps.length}</Text>
              </VStack>
            </HStack>
            <Tag size="sm" colorScheme="purple" variant="subtle">New</Tag>
          </HStack>
          <VStack align="stretch" spacing={2} mb={4}>
            <Text fontWeight="700" color={useColorModeValue('gray.900', 'white')}>{stepMeta.title}</Text>
            <Text fontSize="sm">{stepMeta.body}</Text>
          </VStack>
          <HStack justify="space-between" align="center">
            <Button variant="ghost" size="sm" onClick={handleClose} leftIcon={<FiCheck />}>
              Skip tour
            </Button>
            <HStack spacing={2}>
              <Button variant="ghost" size="sm" onClick={goBack} isDisabled={step === 0}>
                Back
              </Button>
              <Button colorScheme="blue" size="sm" onClick={goNext} rightIcon={<Icon as={step >= steps.length - 1 ? FiCheck : FiArrowRight} />}>
                {stepMeta.action}
              </Button>
            </HStack>
          </HStack>
        </Box>
      </ScaleFade>
    </Box>
  );
}
