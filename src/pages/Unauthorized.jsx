import React, { useEffect } from 'react';
import { Box, Heading, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Unauthorized() {
  const navigate = useNavigate();
  const loc = useLocation();
  const border = useColorModeValue('gray.200','gray.700');
  const panelBg = useColorModeValue('white','gray.800');
  useEffect(() => {
    const t = setTimeout(() => navigate('/', { replace: true }), 3000);
    return () => clearTimeout(t);
  }, [navigate]);
  return (
    <VStack align="center" spacing={3} py={16}>
      <Box borderWidth="1px" borderColor={border} bg={panelBg} rounded="xl" p={8} textAlign="center" maxW="560px">
        <Heading size="md" mb={2}>Unauthorized</Heading>
        <Text color={useColorModeValue('gray.600','gray.300')}>You don’t have access to this page.</Text>
        <Text color={useColorModeValue('gray.600','gray.300')}>Redirecting to home…</Text>
      </Box>
      {loc.state?.from && (
        <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Attempted: {String(loc.state.from.pathname || '')}</Text>
      )}
    </VStack>
  );
}

