import React from 'react';
import { Box, Center, Spinner, Text, useColorModeValue } from '@chakra-ui/react';

export default function LoaderOverlay({ label = 'Initializing…' }) {
  const bg = useColorModeValue('rgba(255,255,255,0.75)', 'rgba(0,0,0,0.55)');
  return (
    <Box position="fixed" inset={0} zIndex={1000} bg={bg} className="glass">
      <Center w="100%" h="100%" flexDir="column" gap={3}>
        <Spinner size="xl" thickness="5px" speed="0.7s" color="brand.500" />
        <Box h="10px" w="280px" rounded="full" overflow="hidden" bg={useColorModeValue('gray.200','gray.700')}>
          <Box className="loader-bar" h="100%" w="60%"></Box>
        </Box>
        <Text color={useColorModeValue('gray.700','gray.300')}>{label}</Text>
      </Center>
    </Box>
  );
}
